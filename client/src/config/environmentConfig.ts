import Ajv, { type ErrorObject } from "ajv";
import environmentSchema from "../../../shared/schemas/environment.schema.json";
import defaultRoomConfig from "../../../configs/environments/default_room.json";
import researchStudioConfig from "../../../configs/environments/research_studio.json";
import portfolioLoungeConfig from "../../../configs/environments/portfolio_lounge.json";
import { roomTemplates } from "../data/appData";
import type {
  EnvironmentConfig,
  EnvironmentPipelineStatus,
  EnvironmentValidationIssue,
  EnvironmentVisuals,
  LoadedEnvironment,
} from "../types";

const DEFAULT_ENVIRONMENT_FILE = "default_room.json";

const SAFE_FALLBACK_ENVIRONMENT: EnvironmentConfig = {
  version: "1.0.0",
  map: {
    width: 2000,
    height: 1200,
  },
  communication: {
    talkRadius: 180,
    maxPeers: 4,
  },
  objects: [],
};

const roomConfigByFile: Record<string, unknown> = {
  "default_room.json": defaultRoomConfig,
  "research_studio.json": researchStudioConfig,
  "portfolio_lounge.json": portfolioLoungeConfig,
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validateEnvironment = ajv.compile<EnvironmentConfig>(environmentSchema);

function normalizeIssues(errors?: ErrorObject[] | null): EnvironmentValidationIssue[] {
  if (!errors || errors.length === 0) {
    return [];
  }

  return errors.map((error) => {
    const path = error.instancePath || error.schemaPath || "/";
    return {
      path,
      message: error.message ?? "Invalid value",
    };
  });
}

export function validateEnvironmentCandidate(candidate: unknown): {
  isValid: boolean;
  errors: EnvironmentValidationIssue[];
  config?: EnvironmentConfig;
} {
  const isValid = validateEnvironment(candidate);

  if (isValid) {
    return {
      isValid: true,
      errors: [],
      config: candidate,
    };
  }

  return {
    isValid: false,
    errors: normalizeIssues(validateEnvironment.errors),
  };
}

function resolveEnvironmentFile(roomId?: string): string {
  const template = roomTemplates.find((item) => item.id === roomId);
  return template?.environment ?? DEFAULT_ENVIRONMENT_FILE;
}

function getEnvironmentByFile(environmentFile: string): unknown {
  return roomConfigByFile[environmentFile] ?? defaultRoomConfig;
}

function toMapAssetName(environmentFile: string): string {
  return environmentFile.replace(/\.json$/i, "");
}

function buildMapScopedVisualDefaults(environmentFile: string): EnvironmentVisuals {
  const mapName = toMapAssetName(environmentFile);
  const basePath = `/assets/maps/${mapName}`;

  return {
    mapImageUrl: `${basePath}/map.png`,
    playerSpriteUrl: `${basePath}/sprite.png`,
    remotePlayerSpriteUrl: `${basePath}/sprite.png`,
    artifactSprites: {
      private_room: `${basePath}/tables.png`,
      table: `${basePath}/tables.png`,
      whiteboard: `${basePath}/whiteboard.png`,
      notebook: `${basePath}/notebook.png`,
      door: `${basePath}/doors.png`,
    },
  };
}

function withMapScopedVisualDefaults(config: EnvironmentConfig, environmentFile: string): EnvironmentConfig {
  const defaults = buildMapScopedVisualDefaults(environmentFile);

  return {
    ...config,
    visuals: {
      ...defaults,
      ...(config.visuals ?? {}),
      artifactSprites: {
        ...(defaults.artifactSprites ?? {}),
        ...(config.visuals?.artifactSprites ?? {}),
      },
    },
  };
}

export function loadEnvironmentForRoom(roomId?: string): LoadedEnvironment {
  const environmentFile = resolveEnvironmentFile(roomId);
  const roomConfig = getEnvironmentByFile(environmentFile);
  const roomValidation = validateEnvironmentCandidate(roomConfig);

  if (roomValidation.isValid && roomValidation.config) {
    return {
      roomId: roomId ?? "default-room",
      environmentFile,
      isValid: true,
      usedFallback: false,
      errors: [],
        config: withMapScopedVisualDefaults(roomValidation.config, environmentFile),
    };
  }

  const defaultValidation = validateEnvironmentCandidate(defaultRoomConfig);
  const additionalIssue: EnvironmentValidationIssue[] =
    roomConfigByFile[environmentFile] === undefined
      ? [
          {
            path: "/environment",
            message: `Environment file \"${environmentFile}\" not found. Using default_room.json.`,
          },
        ]
      : [];

  if (defaultValidation.isValid && defaultValidation.config) {
    return {
      roomId: roomId ?? "default-room",
      environmentFile,
      isValid: false,
      usedFallback: true,
      errors: [...additionalIssue, ...roomValidation.errors],
      config: withMapScopedVisualDefaults(defaultValidation.config, environmentFile),
    };
  }

  return {
    roomId: roomId ?? "default-room",
    environmentFile,
    isValid: false,
    usedFallback: true,
    errors: [...additionalIssue, ...roomValidation.errors, ...defaultValidation.errors],
    config: withMapScopedVisualDefaults(SAFE_FALLBACK_ENVIRONMENT, environmentFile),
  };
}

export function getEnvironmentPipelineStatus(): EnvironmentPipelineStatus {
  const files = Object.entries(roomConfigByFile).map(([fileName, config]) => {
    const validation = validateEnvironmentCandidate(config);
    return {
      fileName,
      isValid: validation.isValid,
      errors: validation.errors,
    };
  });

  const totalErrors = files.reduce((count, file) => count + file.errors.length, 0);

  return {
    isValid: totalErrors === 0,
    totalErrors,
    files,
  };
}
