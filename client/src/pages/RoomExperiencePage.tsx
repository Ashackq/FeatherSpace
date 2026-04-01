import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { runtimeConfig } from "../config/runtime";
import { loadEnvironmentForRoom } from "../config/environmentConfig";
import { ScenePreview } from "../components/ScenePreview";
import { roomExperience } from "../data/appData";
import { useRoomSync } from "../hooks/useRoomSync";
import { useProximityEngine } from "../hooks/useProximityEngine";
import { useRtcAudio } from "../hooks/useRtcAudio";
import { useObjectSync } from "../hooks/useObjectSync";
import type { EnvironmentObject, ObjectInteraction, UserState } from "../types";

type StagePoint = { x: number; y: number };
type TableZone = {
  id: string;
  scopeId: string;
  x: number;
  y: number;
  radius: number;
};

const STAGE_FRAME = {
  x: 60,
  y: 60,
  width: 840,
  height: 420,
};

const WORLD_INSET = 24;

function mapXToStageX(value: number, mapWidth: number): number {
  const ratio = Math.max(0, Math.min(1, value / Math.max(mapWidth, 1)));
  const minX = STAGE_FRAME.x + WORLD_INSET;
  const maxX = STAGE_FRAME.x + STAGE_FRAME.width - WORLD_INSET;
  return minX + ratio * (maxX - minX);
}

function mapYToStageY(value: number, mapHeight: number): number {
  const ratio = Math.max(0, Math.min(1, value / Math.max(mapHeight, 1)));
  const minY = STAGE_FRAME.y + WORLD_INSET;
  const maxY = STAGE_FRAME.y + STAGE_FRAME.height - WORLD_INSET;
  return minY + ratio * (maxY - minY);
}

function mapRadiusToStage(radius: number, mapWidth: number, mapHeight: number): number {
  const drawableWidth = STAGE_FRAME.width - WORLD_INSET * 2;
  const drawableHeight = STAGE_FRAME.height - WORLD_INSET * 2;
  const scale = Math.min(drawableWidth / Math.max(mapWidth, 1), drawableHeight / Math.max(mapHeight, 1));
  return Math.max(20, radius * scale);
}

function isTableObject(object: EnvironmentObject): boolean {
  return object.type === "private_room" || object.type === "table";
}

function findZoneForPoint(point: StagePoint, zones: TableZone[]): TableZone | null {
  for (const zone of zones) {
    const dx = point.x - zone.x;
    const dy = point.y - zone.y;
    if (dx * dx + dy * dy <= zone.radius * zone.radius) {
      return zone;
    }
  }
  return null;
}

function filterPeersByActiveTableZone(
  selectedPeerIds: string[],
  remoteUsers: UserState[],
  localPosition: StagePoint | null,
  zones: TableZone[],
): { scopedPeerIds: string[]; activeScopeId: string | null } {
  if (!localPosition || zones.length === 0) {
    return { scopedPeerIds: selectedPeerIds, activeScopeId: null };
  }

  const activeZone = findZoneForPoint(localPosition, zones);
  if (!activeZone) {
    return { scopedPeerIds: selectedPeerIds, activeScopeId: null };
  }

  const byUser = new Map(remoteUsers.map((user) => [user.userId, user]));
  const scopedPeerIds = selectedPeerIds.filter((peerId) => {
    const user = byUser.get(peerId);
    if (!user) return false;
    return findZoneForPoint({ x: user.x, y: user.y }, zones)?.scopeId === activeZone.scopeId;
  });

  return {
    scopedPeerIds,
    activeScopeId: activeZone.scopeId,
  };
}

export function RoomExperiencePage() {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";
  const environmentRuntime = useMemo(() => loadEnvironmentForRoom(roomId), [roomId]);
  const [localPosition, setLocalPosition] = useState<{ x: number; y: number } | null>(null);
  const [selectedInteraction, setSelectedInteraction] = useState<ObjectInteraction | null>(null);
  const [whiteboardDraft, setWhiteboardDraft] = useState("");
  const [notebookDraft, setNotebookDraft] = useState("");

  const roomSync = useRoomSync(
    runtimeConfig.wsUrl,
    runtimeConfig.enableRealtime,
    roomId ?? "research-studio",
  );

  const proximity = useProximityEngine({
    enabled: roomSync.status.state === "connected",
    localPosition,
    remoteUsers: roomSync.remoteUsers,
    talkRadius: environmentRuntime.config.communication.talkRadius,
    maxPeers: environmentRuntime.config.communication.maxPeers,
  });

  const tableZones = useMemo(() => {
    return environmentRuntime.config.objects
      .filter(isTableObject)
      .map((object) => ({
        id: object.id,
        scopeId: object.scopeId ?? object.id,
        x: mapXToStageX(object.x, environmentRuntime.config.map.width),
        y: mapYToStageY(object.y, environmentRuntime.config.map.height),
        radius: mapRadiusToStage(
          object.radius ?? 120,
          environmentRuntime.config.map.width,
          environmentRuntime.config.map.height,
        ),
      }));
  }, [environmentRuntime.config]);

  const scopedSelection = useMemo(
    () =>
      filterPeersByActiveTableZone(
        proximity.selectedPeerIds,
        roomSync.remoteUsers,
        localPosition,
        tableZones,
      ),
    [localPosition, proximity.selectedPeerIds, roomSync.remoteUsers, tableZones],
  );

  const rtcAudio = useRtcAudio({
    enabled: roomSync.status.state === "connected",
    selfUserId: roomSync.userId,
    selectedPeerIds: scopedSelection.scopedPeerIds,
    lastSignal: roomSync.lastSignal,
    sendSignal: roomSync.sendSignal,
  });

  const objectSync = useObjectSync({
    enabled: roomSync.status.state === "connected",
    objectStates: roomSync.objectStates,
    lastObjectStateUpdate: roomSync.lastObjectStateUpdate,
    sendObjectEvent: roomSync.sendObjectEvent,
  });

  const selectedObjectState = selectedInteraction
    ? objectSync.getObjectState(selectedInteraction.objectId)
    : null;

  useEffect(() => {
    if (!selectedInteraction) {
      return;
    }

    const state = objectSync.getObjectState(selectedInteraction.objectId)?.state ?? {};
    if (selectedInteraction.objectType === "whiteboard") {
      setWhiteboardDraft(typeof state.text === "string" ? state.text : "");
    }
    if (selectedInteraction.objectType === "notebook") {
      setNotebookDraft(typeof state.text === "string" ? state.text : "");
    }
  }, [objectSync, selectedInteraction]);

  const realtimeLabel =
    roomSync.status.state === "connected"
      ? "Realtime connected"
      : roomSync.status.state === "disabled"
        ? "Local mode"
        : "Realtime degraded";

  return (
    <div className="page-stack room-page">
      {demoMode ? (
        <section className="panel-surface split-callout demo-flow-panel">
          <div>
            <span className="eyebrow">Guided Demo</span>
            <h3>Step 2 of 2: present runtime state, participants, and connection health.</h3>
          </div>
          <div className="hero-actions">
            <Link className="button button-secondary" to="/ops">
              Open operations board
            </Link>
          </div>
        </section>
      ) : null}

      <section className="panel-surface room-hero-panel">
        <div className="room-hero-copy">
          <div className="hero-actions-inline">
            {roomExperience.sceneBadges.map((badge) => (
              <span key={badge} className="status-pill">
                {badge}
              </span>
            ))}
            <span
              className={`status-pill ${roomSync.status.state === "connected" ? "status-pill-accent" : "status-pill-warning"}`}
              title={roomSync.status.message}
            >
              {realtimeLabel}
            </span>
          </div>
          <h2>{roomExperience.roomName}</h2>
          <p>
            {roomExperience.hostLabel} · Route: <strong>/{roomId}</strong>
          </p>
          <p className="realtime-status-copy">{roomSync.status.message}</p>
          <div className="room-sync-debug presentation-hide">
            <span>User: {roomSync.userId}</span>
            <span>Remote peers: {roomSync.remoteUsers.length}</span>
            <span>State: {roomSync.status.state}</span>
            <span>Nearby: {proximity.nearbyUserIds.length}</span>
            <span>Selected peers: {proximity.selectedPeerIds.length}</span>
            <span>Scoped peers: {scopedSelection.scopedPeerIds.length}</span>
            <span>Table scope: {scopedSelection.activeScopeId ?? "none"}</span>
            <span>RTC links: {rtcAudio.peers.filter((peer) => peer.state === "connected").length}</span>
            <span>Object states: {objectSync.objectCount}</span>
          </div>
        </div>
        <div className="room-hero-actions">
          <Link className="button button-secondary" to="/rooms">
            Exit to directory
          </Link>
          <button className="button button-primary presentation-hide" type="button">
            Invite participant
          </button>
        </div>
      </section>

      <section className="room-layout">
        <div className="room-stage panel-surface">
          <div className="room-stage-topbar">
            {roomExperience.overlays.map((overlay) => (
              <article key={overlay.title} className="overlay-chip">
                <span className="eyebrow">{overlay.title}</span>
                <strong>{overlay.value}</strong>
                <p>{overlay.detail}</p>
              </article>
            ))}
          </div>

          <ScenePreview
            interactive
            localSimulation={roomSync.status.state !== "connected"}
            roomLabel={roomExperience.roomName}
            environmentConfig={environmentRuntime.config}
            validationState={{
              isValid: environmentRuntime.isValid,
              usedFallback: environmentRuntime.usedFallback,
              errors: environmentRuntime.errors,
            }}
            remoteUsers={roomSync.remoteUsers}
            onObjectInteract={(interaction) => {
              setSelectedInteraction(interaction);
            }}
            onPlayerMove={(x, y, direction) => {
              setLocalPosition({ x, y });
              roomSync.sendPositionUpdate(x, y, direction);
            }}
          />

          {selectedInteraction ? (
            <section className="panel-surface object-interaction-panel presentation-hide">
              <div className="section-header">
                <span className="eyebrow">Interactive Object</span>
                <h3>{selectedInteraction.label}</h3>
                <p className="section-copy">
                  Type: {selectedInteraction.objectType} · id: {selectedInteraction.objectId}
                </p>
              </div>

              {selectedInteraction.objectType === "whiteboard" ? (
                <div className="object-editor-stack">
                  <textarea
                    className="input-field object-textarea"
                    value={whiteboardDraft}
                    onChange={(event) => setWhiteboardDraft(event.target.value)}
                    placeholder="Shared whiteboard notes"
                  />
                  <div className="hero-actions">
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => {
                        objectSync.emitObjectAction(selectedInteraction.objectId, "whiteboard_update", {
                          text: whiteboardDraft,
                          boardId: selectedInteraction.objectId,
                        });
                      }}
                    >
                      Sync whiteboard
                    </button>
                  </div>
                </div>
              ) : null}

              {selectedInteraction.objectType === "notebook" ? (
                <div className="object-editor-stack">
                  <textarea
                    className="input-field object-textarea"
                    value={notebookDraft}
                    onChange={(event) => setNotebookDraft(event.target.value)}
                    placeholder="Shared notebook entry"
                  />
                  <div className="hero-actions">
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => {
                        objectSync.emitObjectAction(selectedInteraction.objectId, "notebook_update", {
                          text: notebookDraft,
                          noteId: selectedInteraction.objectId,
                        });
                      }}
                    >
                      Sync notebook
                    </button>
                  </div>
                </div>
              ) : null}

              {selectedInteraction.objectType === "door" ? (
                <div className="object-editor-stack">
                  <p className="section-copy">
                    Target room: {selectedInteraction.targetRoomId ?? "not configured"}
                  </p>
                  <div className="hero-actions">
                    <button
                      className="button button-secondary"
                      type="button"
                      disabled={!selectedInteraction.targetRoomId}
                      onClick={() => {
                        if (!selectedInteraction.targetRoomId) {
                          return;
                        }

                        objectSync.emitObjectAction(selectedInteraction.objectId, "door_enter", {
                          targetRoomId: selectedInteraction.targetRoomId,
                        });

                        navigate(`/rooms/${selectedInteraction.targetRoomId}`);
                      }}
                    >
                      Enter linked room
                    </button>
                  </div>
                </div>
              ) : null}

              <p className="section-copy">
                Last synced state: {selectedObjectState ? new Date(selectedObjectState.updatedAt).toLocaleTimeString() : "none"}
              </p>
            </section>
          ) : null}

          <div className="media-control-dock presentation-hide">
            {roomExperience.mediaControls.map((control) => (
              <button
                key={control.label}
                className="media-control"
                type="button"
                onClick={
                  control.label === "Mic"
                    ? () => rtcAudio.setMicEnabled(!rtcAudio.isMicEnabled)
                    : undefined
                }
              >
                <span>{control.label}</span>
                <strong>
                  {control.label === "Mic"
                    ? rtcAudio.isMicEnabled
                      ? "Live"
                      : "Muted"
                    : control.state}
                </strong>
              </button>
            ))}
          </div>
        </div>

        <aside className="room-side-rail">
          <section className="panel-surface participant-rail">
            <div className="section-header">
              <div>
                <span className="eyebrow">Participants</span>
                <h3>Live room rail</h3>
              </div>
            </div>

            <div className="participant-list">
              {roomExperience.participants.map((participant) => (
                <article key={participant.name} className="participant-card">
                  <div className={`participant-avatar participant-avatar-${participant.accent}`}>
                    {participant.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <strong>{participant.name}</strong>
                    <p>{participant.role}</p>
                  </div>
                  <span className="participant-status">{participant.status}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="panel-surface live-panels-stack">
            {roomExperience.livePanels.map((panel) => (
              <article key={panel.title} className="live-panel-card">
                <h3>{panel.title}</h3>
                <div className="live-panel-rows">
                  {panel.title === "Connection Health" ? (
                    <div className="live-panel-row">
                      <span>Realtime status</span>
                      <strong>{roomSync.status.state}</strong>
                    </div>
                  ) : null}
                  {panel.rows.map((row) => (
                    <div key={`${panel.title}-${row.label}`} className="live-panel-row">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                  {panel.title === "Connection Health" ? (
                    <>
                      <div className="live-panel-row">
                        <span>Object sync state</span>
                        <strong>{roomSync.status.state === "connected" ? "Live" : "Standby"}</strong>
                      </div>
                      <div className="live-panel-row">
                        <span>Last object update</span>
                        <strong>
                          {objectSync.lastObjectStateUpdate
                            ? `${objectSync.lastObjectStateUpdate.objectId} · ${objectSync.lastObjectStateUpdate.action}`
                            : "none"}
                        </strong>
                      </div>
                    </>
                  ) : null}
                  {panel.title === "Environment Objects" ? (
                    <>
                      <div className="live-panel-row">
                        <span>Active table scope</span>
                        <strong>{scopedSelection.activeScopeId ?? "none"}</strong>
                      </div>
                      <div className="live-panel-row">
                        <span>Selected object</span>
                        <strong>{selectedInteraction?.objectId ?? "none"}</strong>
                      </div>
                    </>
                  ) : null}
                </div>
              </article>
            ))}
          </section>
        </aside>
      </section>
    </div>
  );
}