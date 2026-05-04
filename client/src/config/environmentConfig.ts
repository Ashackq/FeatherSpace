import Ajv, { type ErrorObject } from "ajv";
import environmentSchema from "../../../shared/schemas/environment.schema.json";
import defaultRoomConfig from "../../../configs/environments/default_room.json";
import researchStudioConfig from "../../../configs/environments/research_studio.json";
import portfolioLoungeConfig from "../../../configs/environments/portfolio_lounge.json";
import { roomTemplates } from "../data/appData";
import type {
  EnvironmentConfig,
  EnvironmentObject,
  EnvironmentObjectDefinition,
  EnvironmentRoom,
  EnvironmentPipelineStatus,
  EnvironmentValidationIssue,
  EnvironmentVisuals,
  LoadedEnvironment,
  ResolvedEnvironmentConfig,
} from "../types";

const DEFAULT_ENVIRONMENT_FILE = "default_room.json";
const ROOM_ENV_STORAGE_PREFIX = "featherspace.environment.";

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
  objects: [
    {
      type: "whiteboard",
      visual: "/assets/maps/default_room/whiteboard.png",
      parameters: ["x", "y"],
    },
  ],
  rooms: [
    {
      id: "default-room",
      name: "Default Room",
      spawnPoint: {
        x: 220,
        y: 220,
      },
      objects: [],
    },
  ],
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

function getDefinitionMap(definitions: EnvironmentObjectDefinition[]): Map<string, EnvironmentObjectDefinition> {
  return new Map(definitions.map((definition) => [definition.type, definition]));
}

function isNumericValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateRoomObjects(
  rooms: EnvironmentRoom[],
  definitions: EnvironmentObjectDefinition[],
): EnvironmentValidationIssue[] {
  const issues: EnvironmentValidationIssue[] = [];
  const definitionMap = getDefinitionMap(definitions);

  rooms.forEach((room, roomIndex) => {
    const roomPrefix = `/rooms/${roomIndex}`;

    room.objects.forEach((object, objectIndex) => {
      const objectPrefix = `${roomPrefix}/objects/${objectIndex}`;
      const definition = definitionMap.get(object.type);

      if (!definition) {
        issues.push({
          path: `${objectPrefix}/type`,
          message: `Unknown object type "${object.type}".`,
        });
        return;
      }

      const allowedKeys = new Set(["id", "type", ...definition.parameters]);

      Object.keys(object).forEach((key) => {
        if (!allowedKeys.has(key)) {
          issues.push({
            path: `${objectPrefix}/${key}`,
            message: `Property "${key}" is not allowed for ${object.type}.`,
          });
        }
      });

      definition.parameters.forEach((parameter) => {
        if (!(parameter in object)) {
          issues.push({
            path: `${objectPrefix}/${parameter}`,
            message: `Missing required parameter "${parameter}" for ${object.type}.`,
          });
          return;
        }

        if ((parameter === "x" || parameter === "y") && !isNumericValue(object[parameter])) {
          issues.push({
            path: `${objectPrefix}/${parameter}`,
            message: `Parameter "${parameter}" must be numeric.`,
          });
        }
      });
    });
  });

  return issues;
}

function validateEnvironmentStructure(config: EnvironmentConfig): EnvironmentValidationIssue[] {
  const issues: EnvironmentValidationIssue[] = [];

  if (config.objects.length === 0) {
    issues.push({
      path: "/objects",
      message: "At least one object definition is required.",
    });
  }

  if (config.rooms.length === 0) {
    issues.push({
      path: "/rooms",
      message: "At least one room is required.",
    });
    return issues;
  }

  const definitionTypes = new Set<string>();
  config.objects.forEach((definition, index) => {
    if (definitionTypes.has(definition.type)) {
      issues.push({
        path: `/objects/${index}/type`,
        message: `Duplicate object definition type "${definition.type}".`,
      });
    }
    definitionTypes.add(definition.type);

    if (!definition.visual) {
      issues.push({
        path: `/objects/${index}/visual`,
        message: "Object definitions must declare a visual asset.",
      });
    }

    if (!Array.isArray(definition.parameters) || definition.parameters.length === 0) {
      issues.push({
        path: `/objects/${index}/parameters`,
        message: `Object definition "${definition.type}" must declare at least one parameter.`,
      });
    }
  });

  const roomIds = new Set<string>();
  config.rooms.forEach((room, index) => {
    if (roomIds.has(room.id)) {
      issues.push({
        path: `/rooms/${index}/id`,
        message: `Duplicate room id "${room.id}".`,
      });
    }
    roomIds.add(room.id);

    if (!isNumericValue(room.spawnPoint.x) || !isNumericValue(room.spawnPoint.y)) {
      issues.push({
        path: `/rooms/${index}/spawnPoint`,
        message: "Room spawnPoint must contain numeric x and y values.",
      });
    }

    if (room.objects.length === 0) {
      issues.push({
        path: `/rooms/${index}/objects`,
        message: `Room "${room.id}" must contain at least one object.`,
      });
    }
  });

  issues.push(...validateRoomObjects(config.rooms, config.objects));

  return issues;
}

function mergeValidationIssues(schemaIssues: EnvironmentValidationIssue[], structureIssues: EnvironmentValidationIssue[]): EnvironmentValidationIssue[] {
  return [...schemaIssues, ...structureIssues];
}

export function validateEnvironmentCandidate(candidate: unknown): {
  isValid: boolean;
  errors: EnvironmentValidationIssue[];
  config?: EnvironmentConfig;
} {
  const isValid = validateEnvironment(candidate);

  if (isValid) {
    const config = candidate as EnvironmentConfig;
    const structureIssues = validateEnvironmentStructure(config);

    if (structureIssues.length === 0) {
      return {
        isValid: true,
        errors: [],
        config,
      };
    }

    return {
      isValid: false,
      errors: structureIssues,
    };
  }

  return {
    isValid: false,
    errors: mergeValidationIssues(normalizeIssues(validateEnvironment.errors), []),
  };
}

function resolveEnvironmentFile(roomId?: string): string {
  if (!roomId) {
    return DEFAULT_ENVIRONMENT_FILE;
  }

  // First try to match a template id
  const template = roomTemplates.find((item) => item.id === roomId);
  if (template?.environment) {
    return template.environment;
  }

  // Next try to find a file that contains a room with the given id
  for (const [fileName, config] of Object.entries(roomConfigByFile)) {
    try {
      const candidate = config as any;
      if (candidate && Array.isArray(candidate.rooms) && candidate.rooms.some((r: any) => r.id === roomId)) {
        return fileName;
      }
    } catch (e) {
      // ignore malformed entries
    }
  }

  return DEFAULT_ENVIRONMENT_FILE;
}

function getEnvironmentByFile(environmentFile: string): unknown {
  return roomConfigByFile[environmentFile] ?? defaultRoomConfig;
}

function getEnvironmentStorageKey(environmentFile: string): string {
  return `${ROOM_ENV_STORAGE_PREFIX}${environmentFile}`;
}

function loadStoredEnvironmentByFile(environmentFile: string): EnvironmentConfig | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(getEnvironmentStorageKey(environmentFile));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const validation = validateEnvironmentCandidate(parsed);
    if (!validation.isValid || !validation.config) {
      return null;
    }

    return validation.config;
  } catch {
    return null;
  }
}

export function saveEnvironmentDraftForRoom(roomId: string, config: EnvironmentConfig): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const validation = validateEnvironmentCandidate(config);
  if (!validation.isValid) {
    return false;
  }

  const environmentFile = resolveEnvironmentFile(roomId);
  try {
    window.localStorage.setItem(getEnvironmentStorageKey(environmentFile), JSON.stringify(config));
    return true;
  } catch {
    return false;
  }
}

export function clearEnvironmentDraftForRoom(roomId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const environmentFile = resolveEnvironmentFile(roomId);
  window.localStorage.removeItem(getEnvironmentStorageKey(environmentFile));
}

// Returns a saved environment draft from localStorage for the resolved environment file,
// or `null` when none exists or the stored draft fails validation.
export function loadSavedEnvironmentDraftForRoom(roomId: string): EnvironmentConfig | null {
  const environmentFile = resolveEnvironmentFile(roomId);
  return loadStoredEnvironmentByFile(environmentFile);
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
    remotePlayerSpriteUrl: `${basePath}/sprite2.png`,
    artifactSprites: {
      whiteboard: `${basePath}/whiteboard.png`,
      table_cluster: `${basePath}/tables.png`,
      private_room: `${basePath}/tables.png`,
      table: `${basePath}/tables.png`,
      notebook: `${basePath}/notebook.png`,
      door: `${basePath}/doors.png`,
      room_label: `${basePath}/room_label.png`,
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

// Export helper to merge map-scoped visuals into any environment config,
// ensuring sprite URLs resolve correctly.
export function ensureMapScopedVisuals(config: EnvironmentConfig, environmentFile: string): EnvironmentConfig {
  return withMapScopedVisualDefaults(config, environmentFile);
}

function pickActiveRoom(config: EnvironmentConfig, roomId?: string): EnvironmentRoom {
  return config.rooms.find((room) => room.id === roomId) ?? config.rooms[0];
}

function resolveRoomObjects(config: EnvironmentConfig, room: EnvironmentRoom): EnvironmentObject[] {
  const definitionMap = getDefinitionMap(config.objects);

  return room.objects.map((object) => {
    const definition = definitionMap.get(object.type);
    return {
      ...object,
      visual: definition?.visual ?? config.visuals?.artifactSprites?.[object.type as keyof NonNullable<EnvironmentVisuals["artifactSprites"]>],
    };
  });
}

export function resolveEnvironmentRuntimeConfig(
  config: EnvironmentConfig,
  roomId?: string,
): ResolvedEnvironmentConfig {
  const room = pickActiveRoom(config, roomId);

  return {
    version: config.version,
    map: config.map,
    visuals: config.visuals,
    communication: config.communication,
    objects: resolveRoomObjects(config, room),
    activeRoom: room,
  };
}

export function loadEnvironmentForRoom(roomId?: string): LoadedEnvironment {
  const environmentFile = resolveEnvironmentFile(roomId);
  const storedConfig = loadStoredEnvironmentByFile(environmentFile);
  const roomConfig = storedConfig ?? getEnvironmentByFile(environmentFile);
  const roomValidation = validateEnvironmentCandidate(roomConfig);

  if (roomValidation.isValid && roomValidation.config) {
    const config = withMapScopedVisualDefaults(roomValidation.config, environmentFile);
    return {
      roomId: roomId ?? "default-room",
      environmentFile,
      isValid: true,
      usedFallback: false,
      errors: [],
      config,
      resolvedConfig: resolveEnvironmentRuntimeConfig(config, roomId),
      activeRoomId: resolveEnvironmentRuntimeConfig(config, roomId).activeRoom.id,
    };
  }

  const defaultValidation = validateEnvironmentCandidate(defaultRoomConfig);
  const additionalIssue: EnvironmentValidationIssue[] =
    roomConfigByFile[environmentFile] === undefined
      ? [
          {
            path: "/environment",
            message: `Environment file "${environmentFile}" not found. Using default_room.json.`,
          },
        ]
      : [];

  if (defaultValidation.isValid && defaultValidation.config) {
    const config = withMapScopedVisualDefaults(defaultValidation.config, environmentFile);
    return {
      roomId: roomId ?? "default-room",
      environmentFile,
      isValid: false,
      usedFallback: true,
      errors: [...additionalIssue, ...roomValidation.errors],
      config,
      resolvedConfig: resolveEnvironmentRuntimeConfig(config, roomId),
      activeRoomId: resolveEnvironmentRuntimeConfig(config, roomId).activeRoom.id,
    };
  }

  const fallbackConfig = withMapScopedVisualDefaults(SAFE_FALLBACK_ENVIRONMENT, environmentFile);
  return {
    roomId: roomId ?? "default-room",
    environmentFile,
    isValid: false,
    usedFallback: true,
    errors: [...additionalIssue, ...roomValidation.errors, ...defaultValidation.errors],
    config: fallbackConfig,
    resolvedConfig: resolveEnvironmentRuntimeConfig(fallbackConfig, roomId),
    activeRoomId: resolveEnvironmentRuntimeConfig(fallbackConfig, roomId).activeRoom.id,
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
