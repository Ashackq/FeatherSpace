import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { runtimeConfig } from "../config/runtime";
import { loadEnvironmentForRoom } from "../config/environmentConfig";
import { ScenePreview } from "../components/ScenePreview";
import { roomExperience } from "../data/appData";
import type { UserState } from "../types";
import { useRoomSync } from "../hooks/useRoomSync";
import { useProximityEngine } from "../hooks/useProximityEngine";
import { useRtcAudio } from "../hooks/useRtcAudio";

type PositionTransportMode = "auto" | "server" | "client";

export function RoomExperiencePage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";
  const environmentRuntime = useMemo(() => loadEnvironmentForRoom(roomId), [roomId]);
  const [localPosition, setLocalPosition] = useState<{ x: number; y: number } | null>(null);
  const [positionTransportMode, setPositionTransportMode] = useState<PositionTransportMode>("auto");

  const roomSync = useRoomSync(
    runtimeConfig.wsUrl,
    runtimeConfig.enableRealtime,
    roomId ?? "research-studio",
  );

  const proximity = useProximityEngine({
    enabled: roomSync.status.state === "connected",
    localPosition,
    // Keep RTC peer selection anchored to stable room presence.
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

  const meshUsersForScene = useMemo<UserState[]>(() => {
    return rtcAudio.meshRemoteUsers.map((user) => ({
      userId: user.userId,
      roomId: roomId ?? "research-studio",
      x: user.x,
      y: user.y,
      direction: user.direction,
      lastSeen: user.lastSeen,
    }));
  }, [roomId, rtcAudio.meshRemoteUsers]);

  const remoteUsersForScene = useMemo(() => {
    if (positionTransportMode === "server") {
      return roomSync.remoteUsers;
    }

    if (positionTransportMode === "client") {
      if (rtcAudio.openMeshChannelCount === 0) {
        return roomSync.remoteUsers;
      }
      return meshUsersForScene;
    }

    if (rtcAudio.meshRemoteUsers.length === 0) {
      return roomSync.remoteUsers;
    }

    const meshByUserId = new Map(rtcAudio.meshRemoteUsers.map((user) => [user.userId, user]));
    const merged = roomSync.remoteUsers.map((user) => {
      const mesh = meshByUserId.get(user.userId);
      if (!mesh || mesh.lastSeen < user.lastSeen) {
        return user;
      }

      return {
        ...user,
        x: mesh.x,
        y: mesh.y,
        direction: mesh.direction,
        lastSeen: mesh.lastSeen,
      };
    });

    const knownUsers = new Set(merged.map((user) => user.userId));
    const meshOnlyUsers: UserState[] = meshUsersForScene.filter((user) => !knownUsers.has(user.userId));

    return [...merged, ...meshOnlyUsers];
  }, [
    meshUsersForScene,
    positionTransportMode,
    roomSync.remoteUsers,
    rtcAudio.meshRemoteUsers,
    rtcAudio.openMeshChannelCount,
  ]);

  const positionTransportLabel =
    positionTransportMode === "auto"
      ? "Auto (mesh preferred, server fallback)"
      : positionTransportMode === "client"
        ? rtcAudio.openMeshChannelCount > 0
          ? "Client mesh only"
          : "Client requested (fallback server until mesh ready)"
        : "Server relay only";

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
          <div className="transport-toggle-group presentation-hide" role="group" aria-label="Position transport mode">
            <button
              type="button"
              className={`transport-toggle-button ${positionTransportMode === "auto" ? "transport-toggle-button-active" : ""}`}
              onClick={() => setPositionTransportMode("auto")}
            >
              Auto
            </button>
            <button
              type="button"
              className={`transport-toggle-button ${positionTransportMode === "server" ? "transport-toggle-button-active" : ""}`}
              onClick={() => setPositionTransportMode("server")}
            >
              Server
            </button>
            <button
              type="button"
              className={`transport-toggle-button ${positionTransportMode === "client" ? "transport-toggle-button-active" : ""}`}
              onClick={() => setPositionTransportMode("client")}
            >
              Client
            </button>
          </div>
          <div className="room-sync-debug presentation-hide">
            <span>User: {roomSync.userId}</span>
            <span>Remote peers: {remoteUsersForScene.length}</span>
            <span>State: {roomSync.status.state}</span>
            <span>Position mode: {positionTransportLabel}</span>
            <span>Nearby: {proximity.nearbyUserIds.length}</span>
            <span>Selected peers: {proximity.selectedPeerIds.length}</span>
            <span>RTC links: {rtcAudio.peers.filter((peer) => peer.state === "connected").length}</span>
            <span>Open mesh channels: {rtcAudio.openMeshChannelCount}</span>
            <span>Mesh positions: {rtcAudio.meshRemoteUsers.length}</span>
          </div>
        </div>
        <div className="room-hero-actions">
          <Link className="button button-secondary" to="/rooms">
            Exit to directory
          </Link>
          <Link className="button button-secondary" to={`/builder?roomId=${roomId ?? "research-studio"}`}>
            Edit map
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
            remoteUsers={remoteUsersForScene}
            onPlayerMove={(x, y, direction) => {
              setLocalPosition({ x, y });

              if (positionTransportMode !== "server") {
                const sentViaMesh = rtcAudio.sendMeshPosition(x, y, direction);
                if (positionTransportMode === "client" && !sentViaMesh) {
                  roomSync.sendPositionUpdate(x, y, direction);
                  return;
                }
              }

              if (positionTransportMode !== "client") {
                roomSync.sendPositionUpdate(x, y, direction);
              }
            }}
          />

          <div className="media-control-dock presentation-hide">
            <button
              className={`media-control ${rtcAudio.isMicEnabled ? "media-control-active" : ""}`}
              type="button"
              data-tip={rtcAudio.isMicEnabled ? "Mute your microphone" : "Unmute your microphone"}
              title={rtcAudio.isMicEnabled ? "Mute your microphone" : "Unmute your microphone"}
              aria-pressed={rtcAudio.isMicEnabled}
              onClick={() => rtcAudio.setMicEnabled(!rtcAudio.isMicEnabled)}
            >
              <span>Mic</span>
              <strong>{rtcAudio.isMicEnabled ? "Live" : "Muted"}</strong>
            </button>

            <button
              className={`media-control ${rtcAudio.isSpeakerEnabled ? "media-control-active" : ""}`}
              type="button"
              data-tip={rtcAudio.isSpeakerEnabled ? "Mute room audio output" : "Enable room audio output"}
              title={rtcAudio.isSpeakerEnabled ? "Mute room audio output" : "Enable room audio output"}
              aria-pressed={rtcAudio.isSpeakerEnabled}
              onClick={() => rtcAudio.setSpeakerEnabled(!rtcAudio.isSpeakerEnabled)}
            >
              <span>Speaker</span>
              <strong>{rtcAudio.isSpeakerEnabled ? "On" : "Off"}</strong>
            </button>

            <button
              className={`media-control ${rtcAudio.isPushToTalkEnabled ? "media-control-active" : ""}`}
              type="button"
              data-tip={
                rtcAudio.isPushToTalkEnabled
                  ? "Push-to-talk enabled. Hold Space to transmit voice"
                  : "Enable push-to-talk (hold Space to talk)"
              }
              title={
                rtcAudio.isPushToTalkEnabled
                  ? "Push-to-talk enabled. Hold Space to transmit voice"
                  : "Enable push-to-talk (hold Space to talk)"
              }
              aria-pressed={rtcAudio.isPushToTalkEnabled}
              onClick={() => rtcAudio.setPushToTalkEnabled(!rtcAudio.isPushToTalkEnabled)}
            >
              <span>Push-to-talk</span>
              <strong>
                {rtcAudio.isPushToTalkEnabled
                  ? rtcAudio.isPushToTalkPressed
                    ? "Talking"
                    : "Standby"
                  : "Off"}
              </strong>
            </button>

            <div className="media-control media-control-static" aria-live="polite">
              <span>Audio status</span>
              <strong>
                {rtcAudio.audioAutoplayBlocked
                  ? "Click Speaker to unlock"
                  : `${rtcAudio.peers.filter((peer) => peer.state === "connected").length} connected`}
              </strong>
            </div>
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
