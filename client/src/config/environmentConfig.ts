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

function getBuilderDraftOverride(roomId?: string): unknown | undefined {
  if (!roomId || typeof window === "undefined") {
    return undefined;
  }

  const rawDraft = window.sessionStorage.getItem(`featherspace:builder:draft:${roomId}`);
  if (!rawDraft) {
    return undefined;
  }

  try {
    return JSON.parse(rawDraft);
  } catch {
    return undefined;
  }
}

export function loadEnvironmentForRoom(roomId?: string): LoadedEnvironment {
  const environmentFile = resolveEnvironmentFile(roomId);
  const builderDraft = getBuilderDraftOverride(roomId);
  if (builderDraft !== undefined) {
    const draftValidation = validateEnvironmentCandidate(builderDraft);

    if (draftValidation.isValid && draftValidation.config) {
      return {
        roomId: roomId ?? "default-room",
        environmentFile,
        isValid: true,
        usedFallback: false,
        errors: [],
        config: draftValidation.config,
      };
    }
  }

  const roomConfig = getEnvironmentByFile(environmentFile);
  const roomValidation = validateEnvironmentCandidate(roomConfig);

  if (roomValidation.isValid && roomValidation.config) {
    return {
      roomId: roomId ?? "default-room",
      environmentFile,
      isValid: true,
      usedFallback: false,
      errors: [],
      config: roomValidation.config,
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
      config: defaultValidation.config,
    };
  }

  return {
    roomId: roomId ?? "default-room",
    environmentFile,
    isValid: false,
    usedFallback: true,
    errors: [...additionalIssue, ...roomValidation.errors, ...defaultValidation.errors],
    config: SAFE_FALLBACK_ENVIRONMENT,
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
