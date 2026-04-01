import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { runtimeConfig } from "../config/runtime";
import { loadEnvironmentForRoom } from "../config/environmentConfig";
import { ScenePreview } from "../components/ScenePreview";
import { roomExperience } from "../data/appData";
import { useRoomSync } from "../hooks/useRoomSync";
import { useProximityEngine } from "../hooks/useProximityEngine";
import { useRtcAudio } from "../hooks/useRtcAudio";

export function RoomExperiencePage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";
  const environmentRuntime = useMemo(() => loadEnvironmentForRoom(roomId), [roomId]);
  const [localPosition, setLocalPosition] = useState<{ x: number; y: number } | null>(null);

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

  const rtcAudio = useRtcAudio({
    enabled: roomSync.status.state === "connected",
    selfUserId: roomSync.userId,
    selectedPeerIds: proximity.selectedPeerIds,
    lastSignal: roomSync.lastSignal,
    sendSignal: roomSync.sendSignal,
  });

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
            <span>RTC links: {rtcAudio.peers.filter((peer) => peer.state === "connected").length}</span>
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
            onPlayerMove={(x, y, direction) => {
              setLocalPosition({ x, y });
              roomSync.sendPositionUpdate(x, y, direction);
            }}
          />

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
                </div>
              </article>
            ))}
          </section>
        </aside>
      </section>
    </div>
  );
}