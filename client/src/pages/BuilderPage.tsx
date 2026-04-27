import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSearchParams } from "react-router-dom";
import { loadEnvironmentForRoom, validateEnvironmentCandidate } from "../config/environmentConfig";
import defaultRoomConfig from "../../../configs/environments/default_room.json";
import portfolioLoungeConfig from "../../../configs/environments/portfolio_lounge.json";
import researchStudioConfig from "../../../configs/environments/research_studio.json";
import { runtimeConfig } from "../config/runtime";
import { ScenePreview } from "../components/ScenePreview";
import { useRoomSync } from "../hooks/useRoomSync";
import type { EnvironmentConfig } from "../types";

type BuilderObjectType = "whiteboard" | "private_room" | "notebook" | "door";

type CellOccupant = {
  objectIndex: number;
  objectType: string;
  isAnchor: boolean;
};

const GRID_COLUMNS = 20;
const GRID_ROWS = 12;

const objectTypeOptions: Array<{ value: BuilderObjectType; label: string }> = [
  { value: "private_room", label: "Table" },
  { value: "whiteboard", label: "Whiteboard" },
  { value: "notebook", label: "Book" },
  { value: "door", label: "Door" },
];

type MapPreset = {
  id: string;
  label: string;
  width: number;
  height: number;
  mapName: string;
  communication: EnvironmentConfig["communication"];
  objects: EnvironmentConfig["objects"];
};

function getMapVisuals(mapName: string): NonNullable<EnvironmentConfig["visuals"]> {
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

function toPresetConfig(config: EnvironmentConfig): {
  width: number;
  height: number;
  communication: EnvironmentConfig["communication"];
  objects: EnvironmentConfig["objects"];
} {
  return {
    width: config.map.width,
    height: config.map.height,
    communication: {
      talkRadius: config.communication.talkRadius,
      maxPeers: config.communication.maxPeers,
    },
    // Clone objects so preset application always replaces placement state cleanly.
    objects: config.objects.map((object) => ({ ...object })),
  };
}

const defaultRoomPresetConfig = toPresetConfig(defaultRoomConfig as EnvironmentConfig);
const portfolioLoungePresetConfig = toPresetConfig(portfolioLoungeConfig as EnvironmentConfig);
const researchStudioPresetConfig = toPresetConfig(researchStudioConfig as EnvironmentConfig);

const mapPresets: MapPreset[] = [
  {
    id: "default_room",
    label: "Default Room (2000 x 1200)",
    width: defaultRoomPresetConfig.width,
    height: defaultRoomPresetConfig.height,
    mapName: "default_room",
    communication: defaultRoomPresetConfig.communication,
    objects: defaultRoomPresetConfig.objects,
  },
  {
    id: "portfolio_lounge",
    label: "Portfolio Lounge (1800 x 1200)",
    width: portfolioLoungePresetConfig.width,
    height: portfolioLoungePresetConfig.height,
    mapName: "portfolio_lounge",
    communication: portfolioLoungePresetConfig.communication,
    objects: portfolioLoungePresetConfig.objects,
  },
  {
    id: "research_studio",
    label: "Research Studio (2400 x 1400)",
    width: researchStudioPresetConfig.width,
    height: researchStudioPresetConfig.height,
    mapName: "research_studio",
    communication: researchStudioPresetConfig.communication,
    objects: researchStudioPresetConfig.objects,
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

function createObjectId(type: BuilderObjectType, objects: EnvironmentConfig["objects"]): string {
  const prefix =
    type === "private_room" ? "table" : type === "whiteboard" ? "whiteboard" : type === "notebook" ? "book" : "door";

  let counter = 1;
  while (objects.some((object) => object.id === `${prefix}_${counter}`)) {
    counter += 1;
  }

  return `${prefix}_${counter}`;
}

function getObjectBadge(type: string, isAnchor: boolean): string {
  if (type === "whiteboard") {
    return isAnchor ? "WB" : "=";
  }

  if (type === "private_room") {
    return "TB";
  }

  if (type === "notebook") {
    return "BK";
  }

  if (type === "door") {
    return "DR";
  }

  return "O";
}

export function BuilderPage() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("roomId") ?? "research-studio";

  const loadedEnvironment = useMemo(() => loadEnvironmentForRoom(roomId), [roomId]);
  const [draftConfig, setDraftConfig] = useState<EnvironmentConfig>(loadedEnvironment.config);
  const [selectedType, setSelectedType] = useState<BuilderObjectType>("private_room");
  const [builderStatus, setBuilderStatus] = useState<string>("");

  const roomSync = useRoomSync(
    runtimeConfig.wsUrl,
    runtimeConfig.enableRealtime,
    roomId,
  );

  useEffect(() => {
    setDraftConfig(loadedEnvironment.config);
    setBuilderStatus("");
  }, [loadedEnvironment.config]);

  useEffect(() => {
    if (!roomSync.roomEnvironment) {
      return;
    }

    setDraftConfig(roomSync.roomEnvironment);
    setBuilderStatus("Loaded environment from active room session.");
  }, [roomSync.roomEnvironment]);

  const cellOccupancy = useMemo(() => {
    const occupancy = new Map<string, CellOccupant>();

    draftConfig.objects.forEach((object, objectIndex) => {
      const objectCell = mapObjectToCell(draftConfig, object.x, object.y);
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
  }, [draftConfig]);

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
    if (draftConfig.objects.length < 0 || draftConfig.objects.length > 200) {
      messages.push("Object count must be between 0 and 100.");
    }

    return messages;
  }, [draftConfig]);

  const schemaValidation = useMemo(
    () => validateEnvironmentCandidate(draftConfig),
    [draftConfig],
  );

  const isValid = validationMessages.length === 0 && schemaValidation.isValid;

  const applyMapPreset = (presetId: string) => {
    const preset = mapPresets.find((entry) => entry.id === presetId);
    if (!preset) {
      return;
    }

    const visuals = getMapVisuals(preset.mapName);

    setDraftConfig((current) => ({
      ...current,
      map: {
        ...current.map,
        width: preset.width,
        height: preset.height,
      },
      communication: {
        talkRadius: preset.communication.talkRadius,
        maxPeers: preset.communication.maxPeers,
      },
      objects: preset.objects.map((object) => ({ ...object })),
      visuals: {
        ...(current.visuals ?? {}),
        ...visuals,
        artifactSprites: {
          ...(current.visuals?.artifactSprites ?? {}),
          ...(visuals.artifactSprites ?? {}),
        },
      },
    }));
    setBuilderStatus(`Applied ${preset.label}.`);
  };

  const handleCellClick = (col: number, row: number) => {
    const key = `${col}-${row}`;
    const occupant = cellOccupancy.get(key);

    if (occupant) {
      const removedObject = draftConfig.objects[occupant.objectIndex];
      setDraftConfig((current) => ({
        ...current,
        objects: current.objects.filter((_, index) => index !== occupant.objectIndex),
      }));
      setBuilderStatus(`Removed ${removedObject.type} from cell ${col + 1},${row + 1}.`);
      return;
    }

    const span = getObjectSpan(selectedType);
    if (col + span > GRID_COLUMNS) {
      setBuilderStatus("Object does not fit at this cell.");
      return;
    }

    const blocked = Array.from({ length: span }).some((_, offset) => {
      return cellOccupancy.has(`${col + offset}-${row}`);
    });

    if (blocked) {
      setBuilderStatus("Cell already occupied by another artefact.");
      return;
    }

    const position = mapCellToObjectPosition(draftConfig, col, row);
    setDraftConfig((current) => ({
      ...current,
      objects: [
        ...current.objects,
        {
          id: createObjectId(selectedType, current.objects),
          type: selectedType,
          x: Math.round(position.x),
          y: Math.round(position.y),
        },
      ],
    }));
    setBuilderStatus(`Placed ${selectedType} at cell ${col + 1},${row + 1}.`);
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
    setBuilderStatus("Environment published to this room session.");
  };

  return (
    <div className="page-stack">
      <section className="panel-surface section-banner">
        <span className="eyebrow">Environment Builder</span>
        <h2>Build room maps by placing artefacts directly on the grid.</h2>
        <p>
          Editing room: <strong>{roomId}</strong> · click cells to place artefacts, click existing
          artefacts to remove them.
        </p>
      </section>

      <section className="card-grid two-up map-builder-layout">
        <article className="feature-card">
          <span className="eyebrow">Builder Controls</span>
          <h3>Map settings and artefact palette</h3>
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
                    setDraftConfig((current) => ({
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
                    setDraftConfig((current) => ({
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
                    setDraftConfig((current) => ({
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
                    setDraftConfig((current) => ({
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
              <label className="field-label" htmlFor="objectType">
                Artefact to place
              </label>
              <select
                id="objectType"
                className="input-field"
                value={selectedType}
                onChange={(event) => setSelectedType(event.target.value as BuilderObjectType)}
              >
                {objectTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group sprite-field-group">
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
              <p className="section-copy">Character sprites are fixed for this session. Only predefined map assets are selectable.</p>
            </div>

            <div className="field-row">
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
                  setDraftConfig(loadedEnvironment.config);
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
          <p className="section-copy">Objects placed: {draftConfig.objects.length}</p>
          {builderStatus ? <p className="section-copy map-builder-status">{builderStatus}</p> : null}
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
                    className={`map-grid-cell ${
                      occupant ? `map-grid-cell-occupied map-grid-cell-${occupant.objectType}` : ""
                    } ${occupant?.isAnchor === false ? "map-grid-cell-secondary" : ""}`}
                    onClick={() => handleCellClick(col, row)}
                    title={
                      occupant
                        ? `${occupant.objectType} at row ${row + 1}, col ${col + 1}`
                        : `Place ${selectedType} at row ${row + 1}, col ${col + 1}`
                    }
                  >
                    {occupant ? getObjectBadge(occupant.objectType, occupant.isAnchor) : ""}
                  </button>
                );
              })}
            </div>
          </div>
        </article>
      </section>

      <section className="panel-surface">
        <div className="section-header">
          <div>
            <span className="eyebrow">Live Preview</span>
            <h3>Scene view with your current draft</h3>
          </div>
        </div>
        <ScenePreview roomLabel={`${roomId} builder preview`} environmentConfig={draftConfig} />
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
