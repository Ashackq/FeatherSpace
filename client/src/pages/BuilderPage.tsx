import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  saveEnvironmentDraftForRoom,
  loadEnvironmentForRoom,
  resolveEnvironmentRuntimeConfig,
  validateEnvironmentCandidate,
} from "../config/environmentConfig";
import { roomTemplates } from "../data/appData";
import defaultRoomConfig from "../../../configs/environments/default_room.json";
import portfolioLoungeConfig from "../../../configs/environments/portfolio_lounge.json";
import researchStudioConfig from "../../../configs/environments/research_studio.json";
import { runtimeConfig } from "../config/runtime";
import { ScenePreview } from "../components/ScenePreview";
import { useRoomSync } from "../hooks/useRoomSync";
import type { EnvironmentConfig, EnvironmentObjectDefinition, EnvironmentRoom, EnvironmentObject } from "../types";

type MapPreset = {
  id: string;
  label: string;
  config: EnvironmentConfig;
};

type CellOccupant = {
  objectIndex: number;
  objectType: string;
  isAnchor: boolean;
};

const GRID_COLUMNS = 20;
const GRID_ROWS = 12;

function resolveTemplateRoomId(roomIdOrTemplate: string): string {
  // First check if it's a template ID directly
  if (roomTemplates.some((template) => template.id === roomIdOrTemplate)) {
    return roomIdOrTemplate;
  }

  // Otherwise find which template environment file contains this room
  const configsByFile: Record<string, EnvironmentConfig> = {
    "default_room.json": defaultRoomConfig as EnvironmentConfig,
    "research_studio.json": researchStudioConfig as EnvironmentConfig,
    "portfolio_lounge.json": portfolioLoungeConfig as EnvironmentConfig,
  };

  for (const template of roomTemplates) {
    const config = configsByFile[template.environment];
    if (config && config.rooms.some((room) => room.id === roomIdOrTemplate)) {
      return template.id;
    }
  }

  return roomIdOrTemplate; // fallback
}

function cloneConfig(config: EnvironmentConfig): EnvironmentConfig {
  return JSON.parse(JSON.stringify(config)) as EnvironmentConfig;
}

function getMapVisuals(mapName: string): NonNullable<EnvironmentConfig["visuals"]> {
  const basePath = `/assets/maps/${mapName}`;
  return {
    mapImageUrl: `${basePath}/map.png`,
    playerSpriteUrl: `${basePath}/sprite.png`,
    remotePlayerSpriteUrl: `${basePath}/sprite.png`,
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

function toPresetConfig(config: EnvironmentConfig): EnvironmentConfig {
  return cloneConfig(config);
}

const defaultRoomPresetConfig = toPresetConfig(defaultRoomConfig as EnvironmentConfig);
const portfolioLoungePresetConfig = toPresetConfig(portfolioLoungeConfig as EnvironmentConfig);
const researchStudioPresetConfig = toPresetConfig(researchStudioConfig as EnvironmentConfig);

const mapPresets: MapPreset[] = [
  {
    id: "default_room",
    label: "Default Room (2000 x 1200)",
    config: defaultRoomPresetConfig,
  },
  {
    id: "portfolio_lounge",
    label: "Portfolio Lounge (1800 x 1200)",
    config: portfolioLoungePresetConfig,
  },
  {
    id: "research_studio",
    label: "Research Studio (2400 x 1400)",
    config: researchStudioPresetConfig,
  },
];

function getObjectSpan(type: string): number {
  return type === "whiteboard" ? 2 : 1;
}

function mapObjectToCell(config: EnvironmentConfig, objectX: number, objectY: number): { col: number; row: number } {
  const col = Math.min(
    GRID_COLUMNS - 1,
    Math.max(0, Math.floor((objectX / Math.max(config.map.width, 1)) * GRID_COLUMNS)),
  );
  const row = Math.min(
    GRID_ROWS - 1,
    Math.max(0, Math.floor((objectY / Math.max(config.map.height, 1)) * GRID_ROWS)),
  );

  return { col, row };
}

function mapCellToObjectPosition(config: EnvironmentConfig, col: number, row: number): { x: number; y: number } {
  return {
    x: ((col + 0.5) / GRID_COLUMNS) * Math.max(config.map.width, 1),
    y: ((row + 0.5) / GRID_ROWS) * Math.max(config.map.height, 1),
  };
}

function getMapAssetName(environmentFile: string): string {
  return environmentFile.replace(/\.json$/i, "");
}

function getDefaultDefinition(type: string, mapAssetName: string): EnvironmentObjectDefinition {
  const definitions: Record<string, EnvironmentObjectDefinition> = {
    whiteboard: {
      type: "whiteboard",
      visual: `/assets/maps/${mapAssetName}/whiteboard.png`,
      parameters: ["x", "y"],
    },
    table_cluster: {
      type: "table_cluster",
      visual: `/assets/maps/${mapAssetName}/tables.png`,
      parameters: ["x", "y", "radius"],
    },
    notebook: {
      type: "notebook",
      visual: `/assets/maps/${mapAssetName}/notebook.png`,
      parameters: ["x", "y", "noteId", "label"],
    },
    door: {
      type: "door",
      visual: `/assets/maps/${mapAssetName}/doors.png`,
      parameters: ["x", "y", "targetRoomId", "label"],
    },
    room_label: {
      type: "room_label",
      visual: `/assets/maps/${mapAssetName}/room_label.png`,
      parameters: ["x", "y", "label"],
    },
  };

  return definitions[type] ?? {
    type,
    visual: `/assets/maps/${mapAssetName}/whiteboard.png`,
    parameters: ["x", "y"],
  };
}

function createObjectId(type: string, objects: EnvironmentObject[]): string {
  const prefix = type.replace(/[^a-z0-9]+/gi, "_").toLowerCase() || "object";
  let counter = 1;

  while (objects.some((object) => object.id === `${prefix}_${counter}`)) {
    counter += 1;
  }

  return `${prefix}_${counter}`;
}

function createRoomObject(
  definition: EnvironmentObjectDefinition,
  position: { x: number; y: number },
  objects: EnvironmentObject[],
): EnvironmentObject {
  const object: EnvironmentObject = {
    id: createObjectId(definition.type, objects),
    type: definition.type,
    x: Math.round(position.x),
    y: Math.round(position.y),
  };

  definition.parameters.forEach((parameter) => {
    if (parameter === "x" || parameter === "y") {
      return;
    }

    if (parameter === "radius") {
      object[parameter] = 140;
      return;
    }

    if (parameter === "targetRoomId") {
      object[parameter] = "";
      return;
    }

    if (parameter === "noteId") {
      object[parameter] = `${definition.type}_notes`;
      return;
    }

    if (parameter === "label") {
      object[parameter] = definition.type.replace(/_/g, " ");
      return;
    }

    object[parameter] = "";
  });

  return object;
}

function normalizeRoomObjectValue(parameter: string, value: string): string | number {
  if (parameter === "x" || parameter === "y" || parameter === "radius") {
    return Number(value);
  }

  return value;
}

function getRoomObjectValue(object: EnvironmentObject, parameter: string): string {
  const value = object[parameter];
  if (typeof value === "number") {
    return String(value);
  }

  if (typeof value === "string") {
    return value;
  }

  return "";
}

function createRoomCopy(room: EnvironmentRoom, rooms: EnvironmentRoom[]): EnvironmentRoom {
  const baseId = room.id.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "room";
  let counter = 1;
  let nextId = `${baseId}-${counter}`;

  while (rooms.some((entry) => entry.id === nextId)) {
    counter += 1;
    nextId = `${baseId}-${counter}`;
  }

  return {
    ...room,
    id: nextId,
    name: `${room.name} Copy`,
    objects: room.objects.map((object) => ({ ...object, id: `${object.id}_copy` })),
  };
}

export function BuilderPage() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("roomId") ?? "research-studio";

  const loadedEnvironment = useMemo(() => loadEnvironmentForRoom(roomId), [roomId]);
  const [draftConfig, setDraftConfig] = useState<EnvironmentConfig>(loadedEnvironment.config);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(loadedEnvironment.activeRoomId);
  const [selectedDefinitionType, setSelectedDefinitionType] = useState<string>(
    loadedEnvironment.config.objects[0]?.type ?? "whiteboard",
  );
  const [builderStatus, setBuilderStatus] = useState<string>("");
  const [autoPublishEnabled, setAutoPublishEnabled] = useState(true);
  const lastPublishedHashRef = useRef<string>("");
  const lastRemoteHashRef = useRef<string>("");
  const autoPublishTimerRef = useRef<number | null>(null);

  const templateRoomId = useMemo(() => resolveTemplateRoomId(roomId), [roomId]);
  const roomSync = useRoomSync(runtimeConfig.wsUrl, runtimeConfig.enableRealtime, templateRoomId);

  useEffect(() => {
    setDraftConfig(loadedEnvironment.config);
    setSelectedRoomId(loadedEnvironment.activeRoomId);
    setSelectedDefinitionType(loadedEnvironment.config.objects[0]?.type ?? "whiteboard");
    setBuilderStatus("");
  }, [loadedEnvironment.activeRoomId, loadedEnvironment.config]);

  useEffect(() => {
    if (!roomSync.roomEnvironment) {
      return;
    }

    const sessionEnvironment = roomSync.roomEnvironment;
    const sessionEnvironmentHash = JSON.stringify(sessionEnvironment);
    lastRemoteHashRef.current = sessionEnvironmentHash;
    lastPublishedHashRef.current = sessionEnvironmentHash;

    setDraftConfig(sessionEnvironment);
    setSelectedRoomId((currentRoomId) => {
      if (sessionEnvironment.rooms.some((room) => room.id === currentRoomId)) {
        return currentRoomId;
      }

      return sessionEnvironment.rooms[0]?.id ?? currentRoomId;
    });
    setBuilderStatus("Loaded environment from active room session.");
  }, [roomSync.roomEnvironment]);

  const activeRoom = useMemo(() => {
    return draftConfig.rooms.find((room) => room.id === selectedRoomId) ?? draftConfig.rooms[0];
  }, [draftConfig.rooms, selectedRoomId]);

  const activeRoomIndex = useMemo(() => {
    return draftConfig.rooms.findIndex((room) => room.id === activeRoom?.id);
  }, [activeRoom, draftConfig.rooms]);

  const activeRuntimeConfig = useMemo(() => {
    if (!activeRoom) {
      return resolveEnvironmentRuntimeConfig(draftConfig, selectedRoomId);
    }

    return resolveEnvironmentRuntimeConfig(draftConfig, activeRoom.id);
  }, [activeRoom, draftConfig, selectedRoomId]);

  const selectedDefinition = useMemo(() => {
    return draftConfig.objects.find((definition) => definition.type === selectedDefinitionType) ?? draftConfig.objects[0];
  }, [draftConfig.objects, selectedDefinitionType]);

  const cellOccupancy = useMemo(() => {
    const occupancy = new Map<string, CellOccupant>();

    (activeRoom?.objects ?? []).forEach((object, objectIndex) => {
      const objectCell = mapObjectToCell(draftConfig, Number(object.x), Number(object.y));
      const span = getObjectSpan(object.type);
      const startCol = Math.min(objectCell.col, GRID_COLUMNS - span);

      for (let offset = 0; offset < span; offset += 1) {
        const col = startCol + offset;
        const key = `${col}-${objectCell.row}`;
        occupancy.set(key, {
          objectIndex,
          objectType: object.type,
          isAnchor: offset === 0,
        });
      }
    });

    return occupancy;
  }, [activeRoom, draftConfig]);

  const validationMessages = useMemo(() => {
    const messages: string[] = [];

    if (draftConfig.map.width < 400 || draftConfig.map.height < 300) {
      messages.push("Map dimensions must be at least 400 x 300.");
    }
    if (draftConfig.communication.talkRadius < 80 || draftConfig.communication.talkRadius > 320) {
      messages.push("Talk radius must be between 80 and 320.");
    }
    if (draftConfig.communication.maxPeers < 1 || draftConfig.communication.maxPeers > 8) {
      messages.push("Max peers must be between 1 and 8.");
    }
    if (draftConfig.objects.length === 0) {
      messages.push("At least one object definition is required.");
    }
    if (draftConfig.rooms.length === 0) {
      messages.push("At least one room is required.");
    }

    return messages;
  }, [draftConfig]);

  const schemaValidation = useMemo(() => validateEnvironmentCandidate(draftConfig), [draftConfig]);
  const isValid = validationMessages.length === 0 && schemaValidation.isValid;
  const mapAssetName = getMapAssetName(loadedEnvironment.environmentFile);

  useEffect(() => {
    if (!autoPublishEnabled || !isValid) {
      return;
    }

    if (roomSync.status.state !== "connected") {
      return;
    }

    const currentHash = JSON.stringify(draftConfig);
    if (currentHash === lastRemoteHashRef.current || currentHash === lastPublishedHashRef.current) {
      return;
    }

    if (autoPublishTimerRef.current !== null) {
      window.clearTimeout(autoPublishTimerRef.current);
    }

    autoPublishTimerRef.current = window.setTimeout(() => {
      roomSync.sendEnvironmentConfig(draftConfig);
      lastPublishedHashRef.current = currentHash;
      setBuilderStatus("Environment auto-synced to room peers.");
      autoPublishTimerRef.current = null;
    }, 500);

    return () => {
      if (autoPublishTimerRef.current !== null) {
        window.clearTimeout(autoPublishTimerRef.current);
      }
    };
  }, [
    autoPublishEnabled,
    draftConfig,
    isValid,
    roomSync.sendEnvironmentConfig,
    roomSync.status.state,
  ]);

  useEffect(() => {
    if (!selectedDefinition && draftConfig.objects.length > 0) {
      setSelectedDefinitionType(draftConfig.objects[0].type);
    }
  }, [draftConfig.objects, selectedDefinition]);

  useEffect(() => {
    if (!isValid) {
      return;
    }

    saveEnvironmentDraftForRoom(roomId, draftConfig);
  }, [draftConfig, isValid, roomId]);

  useEffect(() => {
    if (!activeRoom && draftConfig.rooms.length > 0) {
      setSelectedRoomId(draftConfig.rooms[0].id);
    }
  }, [activeRoom, draftConfig.rooms]);

  const updateDraftConfig = (updater: (current: EnvironmentConfig) => EnvironmentConfig) => {
    setDraftConfig((current) => updater(cloneConfig(current)));
  };

  const updateRoom = (updater: (room: EnvironmentRoom) => EnvironmentRoom) => {
    if (activeRoomIndex < 0) {
      return;
    }

    updateDraftConfig((current) => ({
      ...current,
      rooms: current.rooms.map((room, index) => {
        if (index !== activeRoomIndex) {
          return room;
        }

        return updater(room);
      }),
    }));
  };

  const applyMapPreset = (presetId: string) => {
    const preset = mapPresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    setDraftConfig(cloneConfig(preset.config));
    setSelectedRoomId(preset.config.rooms[0]?.id ?? "");
    setSelectedDefinitionType(preset.config.objects[0]?.type ?? "whiteboard");
    setBuilderStatus(`Applied ${preset.label}.`);
  };

  const addDefinition = () => {
    const nextType = `custom_${draftConfig.objects.length + 1}`;
    updateDraftConfig((current) => ({
      ...current,
      objects: [
        ...current.objects,
        getDefaultDefinition(nextType, mapAssetName),
      ],
    }));
    setSelectedDefinitionType(nextType);
    setBuilderStatus("Added a new object definition.");
  };

  const addRoom = () => {
    const nextRoomIndex = draftConfig.rooms.length + 1;
    const baseRoomId = `room-${nextRoomIndex}`;
    const spawnPoint = {
      x: Math.round(draftConfig.map.width * 0.2),
      y: Math.round(draftConfig.map.height * 0.2),
    };
    const defaultDefinition = selectedDefinition ?? draftConfig.objects[0];

    updateDraftConfig((current) => ({
      ...current,
      rooms: [
        ...current.rooms,
        {
          id: baseRoomId,
          name: `Room ${nextRoomIndex}`,
          spawnPoint,
          objects: defaultDefinition ? [createRoomObject(defaultDefinition, spawnPoint, [])] : [],
        },
      ],
    }));
    setSelectedRoomId(baseRoomId);
    setBuilderStatus("Added a new room.");
  };

  const handleCellClick = (col: number, row: number) => {
    if (!activeRoom) {
      return;
    }

    const key = `${col}-${row}`;
    const occupant = cellOccupancy.get(key);

    if (occupant) {
      const removedObject = activeRoom.objects[occupant.objectIndex];
      updateRoom((room) => ({
        ...room,
        objects: room.objects.filter((_, index) => index !== occupant.objectIndex),
      }));
      setBuilderStatus(`Removed ${removedObject.type} from cell ${col + 1},${row + 1}.`);
      return;
    }

    if (!selectedDefinition) {
      setBuilderStatus("Select an object definition before placing items.");
      return;
    }

    const span = getObjectSpan(selectedDefinition.type);
    if (col + span > GRID_COLUMNS) {
      setBuilderStatus("Object does not fit at this cell.");
      return;
    }

    const blocked = Array.from({ length: span }).some((_, offset) => cellOccupancy.has(`${col + offset}-${row}`));
    if (blocked) {
      setBuilderStatus("Cell already occupied by another artefact.");
      return;
    }

    const position = mapCellToObjectPosition(draftConfig, col, row);
    updateRoom((room) => ({
      ...room,
      objects: [...room.objects, createRoomObject(selectedDefinition, position, room.objects)],
    }));
    setBuilderStatus(`Placed ${selectedDefinition.type} at cell ${col + 1},${row + 1}.`);
  };

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(draftConfig, null, 2));
      setBuilderStatus("Configuration copied to clipboard.");
    } catch {
      setBuilderStatus("Clipboard write failed. Copy from the JSON block below.");
    }
  };

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(draftConfig, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${roomId}-environment.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    setBuilderStatus("Environment JSON downloaded.");
  };

  const publishToSession = () => {
    if (!isValid) {
      setBuilderStatus("Fix validation issues before publishing to the room session.");
      return;
    }

    if (roomSync.status.state !== "connected") {
      setBuilderStatus("Realtime connection is required to publish to the room session.");
      return;
    }

    roomSync.sendEnvironmentConfig(draftConfig);
    lastPublishedHashRef.current = JSON.stringify(draftConfig);
    setBuilderStatus("Environment published to this room session.");
  };

  const renderDefinitionFields = (definition: EnvironmentObjectDefinition, index: number) => (
    <article key={definition.type} className="feature-card">
      <div className="field-row">
        <div className="field-group">
          <label className="field-label" htmlFor={`definition-type-${index}`}>
            Type
          </label>
          <input
            id={`definition-type-${index}`}
            className="input-field"
            value={definition.type}
            onChange={(event) => {
              updateDraftConfig((current) => ({
                ...current,
                objects: current.objects.map((entry, objectIndex) =>
                  objectIndex === index
                    ? {
                        ...entry,
                        type: event.target.value,
                      }
                    : entry,
                ),
              }));

              if (selectedDefinitionType === definition.type) {
                setSelectedDefinitionType(event.target.value);
              }
            }}
          />
        </div>
        <div className="field-group">
          <label className="field-label" htmlFor={`definition-visual-${index}`}>
            Visual asset
          </label>
          <input
            id={`definition-visual-${index}`}
            className="input-field"
            value={definition.visual}
            onChange={(event) =>
              updateDraftConfig((current) => ({
                ...current,
                objects: current.objects.map((entry, objectIndex) =>
                  objectIndex === index
                    ? {
                        ...entry,
                        visual: event.target.value,
                      }
                    : entry,
                ),
              }))
            }
          />
        </div>
      </div>
      <div className="field-group">
        <label className="field-label" htmlFor={`definition-parameters-${index}`}>
          Parameters
        </label>
        <input
          id={`definition-parameters-${index}`}
          className="input-field"
          value={definition.parameters.join(", ")}
          onChange={(event) =>
            updateDraftConfig((current) => ({
              ...current,
              objects: current.objects.map((entry, objectIndex) =>
                objectIndex === index
                  ? {
                      ...entry,
                      parameters: event.target.value
                        .split(",")
                        .map((parameter) => parameter.trim())
                        .filter(Boolean),
                    }
                  : entry,
              ),
            }))
          }
        />
      </div>
      <p className="section-copy">Used by the room editor to validate and render objects of this type.</p>
    </article>
  );

  return (
    <div className="page-stack">
      <section className="panel-surface section-banner">
        <span className="eyebrow">Environment Builder</span>
        <h2>Build room maps by editing room schemas and placing artefacts directly on the grid.</h2>
        <p>
          Editing room: <strong>{roomId}</strong> · select a room, place artefacts, and publish the full JSON schema.
        </p>
      </section>

      <section className="card-grid two-up map-builder-layout">
        <article className="feature-card">
          <span className="eyebrow">Builder Controls</span>
          <h3>Map settings, room routing, and live publishing</h3>
          <form className="settings-form" onSubmit={(event) => event.preventDefault()}>
            <div className="field-row">
              <div className="field-group">
                <label className="field-label" htmlFor="mapWidth">
                  Map width
                </label>
                <input
                  id="mapWidth"
                  className="input-field"
                  type="number"
                  min={400}
                  max={5000}
                  value={draftConfig.map.width}
                  onChange={(event) =>
                    updateDraftConfig((current) => ({
                      ...current,
                      map: {
                        ...current.map,
                        width: Number(event.target.value),
                      },
                    }))
                  }
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="mapHeight">
                  Map height
                </label>
                <input
                  id="mapHeight"
                  className="input-field"
                  type="number"
                  min={300}
                  max={5000}
                  value={draftConfig.map.height}
                  onChange={(event) =>
                    updateDraftConfig((current) => ({
                      ...current,
                      map: {
                        ...current.map,
                        height: Number(event.target.value),
                      },
                    }))
                  }
                />
              </div>
            </div>

            <div className="field-row">
              <div className="field-group">
                <label className="field-label" htmlFor="talkRadius">
                  Talk radius
                </label>
                <input
                  id="talkRadius"
                  className="input-field"
                  type="number"
                  min={80}
                  max={320}
                  value={draftConfig.communication.talkRadius}
                  onChange={(event) =>
                    updateDraftConfig((current) => ({
                      ...current,
                      communication: {
                        ...current.communication,
                        talkRadius: Number(event.target.value),
                      },
                    }))
                  }
                />
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="maxPeers">
                  Max peers
                </label>
                <input
                  id="maxPeers"
                  className="input-field"
                  type="number"
                  min={1}
                  max={8}
                  value={draftConfig.communication.maxPeers}
                  onChange={(event) =>
                    updateDraftConfig((current) => ({
                      ...current,
                      communication: {
                        ...current.communication,
                        maxPeers: Number(event.target.value),
                      },
                    }))
                  }
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="mapPreset">
                Map asset preset
              </label>
              <select
                id="mapPreset"
                className="input-field"
                onChange={(event) => applyMapPreset(event.target.value)}
                defaultValue=""
              >
                <option value="" disabled>
                  Choose a predefined map
                </option>
                {mapPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="definitionType">
                Place type
              </label>
              <select
                id="definitionType"
                className="input-field"
                value={selectedDefinitionType}
                onChange={(event) => setSelectedDefinitionType(event.target.value)}
              >
                {draftConfig.objects.map((definition) => (
                  <option key={definition.type} value={definition.type}>
                    {definition.type}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-row">
              <button
                className="button button-secondary"
                type="button"
                onClick={() => setAutoPublishEnabled((current) => !current)}
              >
                {autoPublishEnabled ? "Auto-sync on" : "Auto-sync off"}
              </button>
              <button className="button button-secondary" type="button" onClick={copyJson}>
                Copy JSON
              </button>
              <button className="button button-secondary" type="button" onClick={downloadJson}>
                Download JSON
              </button>
            </div>

            <div className="field-row">
              <button
                className="button button-primary"
                type="button"
                onClick={publishToSession}
                disabled={!isValid || roomSync.status.state !== "connected"}
              >
                Publish to room session
              </button>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setDraftConfig(cloneConfig(loadedEnvironment.config));
                  setSelectedRoomId(loadedEnvironment.activeRoomId);
                  setSelectedDefinitionType(loadedEnvironment.config.objects[0]?.type ?? "whiteboard");
                  setBuilderStatus("Builder reset to loaded room configuration.");
                }}
              >
                Reset
              </button>
            </div>

            <p className="section-copy">Realtime sync: {roomSync.status.message}</p>

            <Link className="button button-primary" to={`/rooms/${roomId}`}>
              Exit builder
            </Link>
          </form>
          <p className="section-copy">Object definitions: {draftConfig.objects.length}</p>
          <p className="section-copy">Rooms: {draftConfig.rooms.length}</p>
          {builderStatus ? <p className="section-copy map-builder-status">{builderStatus}</p> : null}
        </article>

        <article className="feature-card">
          <span className="eyebrow">Room Editor</span>
          <h3>Rooms and spawn points</h3>
          <div className="field-group">
            <label className="field-label" htmlFor="roomSelector">
              Active room
            </label>
            <select
              id="roomSelector"
              className="input-field"
              value={selectedRoomId}
              onChange={(event) => setSelectedRoomId(event.target.value)}
            >
              {draftConfig.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} ({room.id})
                </option>
              ))}
            </select>
          </div>

          {activeRoom ? (
            <div className="settings-form">
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label" htmlFor="roomId">
                    Room id
                  </label>
                  <input
                    id="roomId"
                    className="input-field"
                    value={activeRoom.id}
                    onChange={(event) => {
                      updateRoom((room) => ({
                        ...room,
                        id: event.target.value,
                      }));
                      setSelectedRoomId(event.target.value);
                    }}
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="roomName">
                    Room name
                  </label>
                  <input
                    id="roomName"
                    className="input-field"
                    value={activeRoom.name}
                    onChange={(event) =>
                      updateRoom((room) => ({
                        ...room,
                        name: event.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="field-row">
                <div className="field-group">
                  <label className="field-label" htmlFor="spawnX">
                    Spawn x
                  </label>
                  <input
                    id="spawnX"
                    className="input-field"
                    type="number"
                    value={activeRoom.spawnPoint.x}
                    onChange={(event) =>
                      updateRoom((room) => ({
                        ...room,
                        spawnPoint: {
                          ...room.spawnPoint,
                          x: Number(event.target.value),
                        },
                      }))
                    }
                  />
                </div>
                <div className="field-group">
                  <label className="field-label" htmlFor="spawnY">
                    Spawn y
                  </label>
                  <input
                    id="spawnY"
                    className="input-field"
                    type="number"
                    value={activeRoom.spawnPoint.y}
                    onChange={(event) =>
                      updateRoom((room) => ({
                        ...room,
                        spawnPoint: {
                          ...room.spawnPoint,
                          y: Number(event.target.value),
                        },
                      }))
                    }
                  />
                </div>
              </div>

              <div className="field-row">
                <button className="button button-secondary" type="button" onClick={addRoom}>
                  Add room
                </button>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    if (!activeRoom) {
                      return;
                    }

                    const duplicate = createRoomCopy(activeRoom, draftConfig.rooms);
                    updateDraftConfig((current) => ({
                      ...current,
                      rooms: [...current.rooms, duplicate],
                    }));
                    setSelectedRoomId(duplicate.id);
                    setBuilderStatus(`Duplicated ${activeRoom.name}.`);
                  }}
                >
                  Duplicate room
                </button>
              </div>
            </div>
          ) : null}
        </article>
      </section>

      <section className="card-grid two-up map-builder-layout">
        <article className="feature-card">
          <span className="eyebrow">Object Definitions</span>
          <h3>Artefact palette sourced from JSON</h3>
          <div className="field-row">
            <div className="field-group">
              <button className="button button-secondary" type="button" onClick={addDefinition}>
                Add definition
              </button>
            </div>
          </div>
          <div className="stack-list">{draftConfig.objects.map((definition, index) => renderDefinitionFields(definition, index))}</div>
        </article>

        <article className="feature-card">
          <span className="eyebrow">Placement Grid</span>
          <h3>Click to place or remove artefacts</h3>
          <div className="map-grid-shell">
            <div className="map-grid-header">20 x 12 placement cells</div>
            <div
              className="map-grid"
              style={{
                gridTemplateColumns: `repeat(${GRID_COLUMNS}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: GRID_ROWS * GRID_COLUMNS }, (_, index) => {
                const col = index % GRID_COLUMNS;
                const row = Math.floor(index / GRID_COLUMNS);
                const key = `${col}-${row}`;
                const occupant = cellOccupancy.get(key);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`map-grid-cell ${occupant ? `map-grid-cell-occupied map-grid-cell-${occupant.objectType}` : ""} ${occupant?.isAnchor === false ? "map-grid-cell-secondary" : ""}`}
                    onClick={() => handleCellClick(col, row)}
                    title={
                      occupant
                        ? `${occupant.objectType} at row ${row + 1}, col ${col + 1}`
                        : `Place ${selectedDefinitionType} at row ${row + 1}, col ${col + 1}`
                    }
                  >
                    {occupant ? occupant.objectType.slice(0, 2).toUpperCase() : ""}
                  </button>
                );
              })}
            </div>
          </div>

          {activeRoom ? (
            <div className="stack-list" style={{ marginTop: 20 }}>
              {activeRoom.objects.map((object, index) => {
                const definition = draftConfig.objects.find((entry) => entry.type === object.type);
                const parameterNames = definition?.parameters ?? ["x", "y"];

                return (
                  <article key={object.id} className="feature-card">
                    <div className="field-row">
                      <div className="field-group">
                        <label className="field-label" htmlFor={`object-type-${index}`}>
                          Type
                        </label>
                        <select
                          id={`object-type-${index}`}
                          className="input-field"
                          value={object.type}
                          onChange={(event) =>
                            updateRoom((room) => ({
                              ...room,
                              objects: room.objects.map((entry, objectIndex) =>
                                objectIndex === index
                                  ? {
                                      ...entry,
                                      type: event.target.value,
                                    }
                                  : entry,
                              ),
                            }))
                          }
                        >
                          {draftConfig.objects.map((entry) => (
                            <option key={entry.type} value={entry.type}>
                              {entry.type}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field-group">
                        <label className="field-label" htmlFor={`object-id-${index}`}>
                          Object id
                        </label>
                        <input
                          id={`object-id-${index}`}
                          className="input-field"
                          value={object.id}
                          onChange={(event) =>
                            updateRoom((room) => ({
                              ...room,
                              objects: room.objects.map((entry, objectIndex) =>
                                objectIndex === index
                                  ? {
                                      ...entry,
                                      id: event.target.value,
                                    }
                                  : entry,
                              ),
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="field-row">
                      <div className="field-group">
                        <label className="field-label" htmlFor={`object-x-${index}`}>
                          x
                        </label>
                        <input
                          id={`object-x-${index}`}
                          className="input-field"
                          type="number"
                          value={getRoomObjectValue(object, "x")}
                          onChange={(event) =>
                            updateRoom((room) => ({
                              ...room,
                              objects: room.objects.map((entry, objectIndex) =>
                                objectIndex === index
                                  ? {
                                      ...entry,
                                      x: Number(event.target.value),
                                    }
                                  : entry,
                              ),
                            }))
                          }
                        />
                      </div>
                      <div className="field-group">
                        <label className="field-label" htmlFor={`object-y-${index}`}>
                          y
                        </label>
                        <input
                          id={`object-y-${index}`}
                          className="input-field"
                          type="number"
                          value={getRoomObjectValue(object, "y")}
                          onChange={(event) =>
                            updateRoom((room) => ({
                              ...room,
                              objects: room.objects.map((entry, objectIndex) =>
                                objectIndex === index
                                  ? {
                                      ...entry,
                                      y: Number(event.target.value),
                                    }
                                  : entry,
                              ),
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div className="field-row">
                      {parameterNames
                        .filter((parameter) => parameter !== "x" && parameter !== "y")
                        .map((parameter) => (
                          <div className="field-group" key={parameter}>
                            <label className="field-label" htmlFor={`object-${parameter}-${index}`}>
                              {parameter}
                            </label>
                            <input
                              id={`object-${parameter}-${index}`}
                              className="input-field"
                              type={parameter === "radius" ? "number" : "text"}
                              value={getRoomObjectValue(object, parameter)}
                              onChange={(event) =>
                                updateRoom((room) => ({
                                  ...room,
                                  objects: room.objects.map((entry, objectIndex) =>
                                    objectIndex === index
                                      ? {
                                          ...entry,
                                          [parameter]: normalizeRoomObjectValue(parameter, event.target.value),
                                        }
                                      : entry,
                                  ),
                                }))
                              }
                            />
                          </div>
                        ))}
                    </div>

                    <div className="field-row">
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => {
                          updateRoom((room) => ({
                            ...room,
                            objects: room.objects.filter((_, objectIndex) => objectIndex !== index),
                          }));
                          setBuilderStatus(`Removed ${object.type} ${object.id}.`);
                        }}
                      >
                        Remove object
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </article>
      </section>

      <section className="panel-surface">
        <div className="section-header">
          <div>
            <span className="eyebrow">Live Preview</span>
            <h3>Scene view with your current draft</h3>
          </div>
        </div>
        <ScenePreview roomLabel={`${roomId} builder preview`} environmentConfig={activeRuntimeConfig} />
      </section>

      <section className="panel-surface">
        <div className="section-header">
          <div>
            <span className="eyebrow">Generated Snapshot</span>
            <h3>Live config output</h3>
          </div>
        </div>
        {isValid ? null : (
          <div className="schema-alert" role="status">
            <strong>Validation issues detected</strong>
            <ul>
              {validationMessages.map((message) => (
                <li key={message}>{message}</li>
              ))}
              {schemaValidation.errors.map((issue) => (
                <li key={`${issue.path}-${issue.message}`}>
                  {issue.path}: {issue.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        <pre className="code-block">{JSON.stringify(draftConfig, null, 2)}</pre>
      </section>
    </div>
  );
}
