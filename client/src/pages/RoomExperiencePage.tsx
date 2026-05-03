import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { runtimeConfig } from "../config/runtime";
import { loadEnvironmentForRoom, resolveEnvironmentRuntimeConfig } from "../config/environmentConfig";
import { ScenePreview } from "../components/ScenePreview";
import { roomExperience } from "../data/appData";
import type { UserState } from "../types";
import { useRoomSync } from "../hooks/useRoomSync";
import { useProximityEngine } from "../hooks/useProximityEngine";
import { useRtcAudio } from "../hooks/useRtcAudio";

type PositionTransportMode = "auto" | "server" | "client";
type ResearchStudioMapVariant = "main" | "prototype";

const WHITEBOARD_URL =
  "https://app.mural.co/t/akashmit6988/m/akashmit6988/1724847876537/8c964b56effa4f9e830f8e693bc78c083ef096b0?sender=u5fc25cdb7e29f89263482987";

export function RoomExperiencePage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";
  const environmentRuntime = useMemo(() => loadEnvironmentForRoom(roomId), [roomId]);
  const [localPosition, setLocalPosition] = useState<{ x: number; y: number } | null>(null);
  const [positionTransportMode, setPositionTransportMode] = useState<PositionTransportMode>("auto");
  const [researchStudioMapVariant, setResearchStudioMapVariant] = useState<ResearchStudioMapVariant>("main");
  const [activeChatSurface, setActiveChatSurface] = useState<"whiteboard" | "notebook">("notebook");
  const [chatDraft, setChatDraft] = useState("");
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const isResearchStudioRoom = (roomId ?? "").startsWith("research-studio");
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  const roomSync = useRoomSync(
    runtimeConfig.wsUrl,
    runtimeConfig.enableRealtime,
    roomId ?? "research-studio",
  );

  useEffect(() => {
    chatLogRef.current?.scrollTo({ top: chatLogRef.current.scrollHeight, behavior: "smooth" });
  }, [roomSync.roomChatMessages, activeChatSurface]);

  const activeEnvironmentConfig = useMemo(() => {
    const liveConfig = roomSync.roomEnvironment ?? environmentRuntime.config;

    if (!isResearchStudioRoom || researchStudioMapVariant === "main") {
      return resolveEnvironmentRuntimeConfig(liveConfig, environmentRuntime.activeRoomId);
    }

    return resolveEnvironmentRuntimeConfig(liveConfig, "research-studio-prototype");
  }, [environmentRuntime.activeRoomId, environmentRuntime.config, isResearchStudioRoom, researchStudioMapVariant, roomSync.roomEnvironment]);

  const sceneRoomLabel = activeEnvironmentConfig.activeRoom.name ?? roomExperience.roomName;

  const proximity = useProximityEngine({
    enabled: roomSync.status.state === "connected",
    localPosition,
    // Keep RTC peer selection anchored to stable room presence.
    remoteUsers: roomSync.remoteUsers,
    talkRadius: activeEnvironmentConfig.communication.talkRadius,
    maxPeers: activeEnvironmentConfig.communication.maxPeers,
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

  const activeChatLabel = activeChatSurface === "whiteboard" ? "Whiteboard" : "Notebook";

  const handleChatSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const message = chatDraft.trim();
    if (!message) {
      return;
    }

    roomSync.sendRoomChatMessage(message, activeChatSurface);
    setChatDraft("");
  };

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
          {(() => {
            const builderRoomId = isResearchStudioRoom
              ? researchStudioMapVariant === "prototype"
                ? "research-studio-prototype"
                : "research-studio"
              : roomId ?? "research-studio";

            return (
              <Link className="button button-secondary" to={`/builder?roomId=${builderRoomId}`}>
                Edit map
              </Link>
            );
          })()}
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
            roomLabel={sceneRoomLabel}
            environmentConfig={activeEnvironmentConfig}
            validationState={{
              isValid: environmentRuntime.isValid,
              usedFallback: environmentRuntime.usedFallback,
              errors: environmentRuntime.errors,
            }}
            remoteUsers={remoteUsersForScene}
            onObjectInteract={(interaction) => {
              if (interaction.objectType === "whiteboard") {
                window.open(WHITEBOARD_URL, "_blank", "noopener,noreferrer");
                return;
              }

              if (interaction.objectType === "notebook") {
                setActiveChatSurface(interaction.objectType);
                setIsChatModalOpen(true);
                // focus composer after state update/render
                window.requestAnimationFrame(() => chatInputRef.current?.focus());
                return;
              }

              if (!isResearchStudioRoom || interaction.objectType !== "door") {
                return;
              }

              if (interaction.targetRoomId === "research-studio-prototype") {
                setResearchStudioMapVariant("prototype");
                return;
              }

              if (interaction.targetRoomId === "research-studio-main") {
                setResearchStudioMapVariant("main");
              }
            }}
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

          {isChatModalOpen ? (
            <div className="chat-modal-overlay" role="dialog" aria-modal="true">
              <div className="chat-modal panel-surface">
                <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span className="eyebrow">Shared {activeChatLabel}</span>
                    <h3>Room chat</h3>
                  </div>
                  <div>
                    <button className="button button-ghost" type="button" onClick={() => setIsChatModalOpen(false)}>
                      Close
                    </button>
                  </div>
                </div>

                <div className="chat-message-list" aria-live="polite" style={{ maxHeight: 360, overflow: "auto", marginBottom: 12 }}>
                  {roomSync.roomChatMessages.filter((m) => m.surface === activeChatSurface).length === 0 ? (
                    <div className="chat-empty-state">
                      <strong>No messages yet</strong>
                      <p>Post the first message to this surface.</p>
                    </div>
                  ) : (
                    roomSync.roomChatMessages
                      .filter((m) => m.surface === activeChatSurface)
                      .map((message) => (
                        <article key={message.messageId} className="chat-message-card">
                          <div className="chat-message-header">
                            <strong>{message.authorName}</strong>
                            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                          </div>
                          <div className="chat-message-meta">
                            <span className={`status-pill ${message.surface === "whiteboard" ? "status-pill-accent" : ""}`}>
                              {message.surface === "whiteboard" ? "Whiteboard" : "Notebook"}
                            </span>
                            <span>{message.authorId}</span>
                          </div>
                          <p>{message.body}</p>
                        </article>
                      ))
                  )}
                </div>

                <form className="chat-composer" onSubmit={(e) => { handleChatSubmit(e); setIsChatModalOpen(false); }}>
                  <div className="field-group">
                    <label className="field-label" htmlFor="roomChatMessage">
                      Post as {roomSync.displayName}
                    </label>
                    <textarea
                      id="roomChatMessage"
                      ref={chatInputRef}
                      className="input-field chat-input"
                      value={chatDraft}
                      onChange={(event) => setChatDraft(event.target.value)}
                      placeholder={`Write to the ${activeChatLabel.toLowerCase()}...`}
                      rows={4}
                    />
                  </div>
                  <div className="chat-composer-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                    <span className="section-copy">Visible to everyone currently in the room.</span>
                    <div>
                      <button className="button button-secondary" type="button" onClick={() => setIsChatModalOpen(false)} style={{ marginRight: 8 }}>
                        Cancel
                      </button>
                      <button className="button button-primary" type="submit" disabled={!chatDraft.trim()}>
                        Send message
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

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

          <section className="panel-surface chat-panel">
            <div className="section-header chat-panel-header">
              <div>
                <span className="eyebrow">Shared {activeChatLabel}</span>
                <h3>Room chat</h3>
              </div>
              <div className="chat-surface-toggle" role="tablist" aria-label="Chat surface">
                <button
                  type="button"
                  className={`chat-surface-button ${activeChatSurface === "notebook" ? "chat-surface-button-active" : ""}`}
                  onClick={() => setActiveChatSurface("notebook")}
                >
                  Notebook
                </button>
                <button
                  type="button"
                  className={`chat-surface-button ${activeChatSurface === "whiteboard" ? "chat-surface-button-active" : ""}`}
                  onClick={() => setActiveChatSurface("whiteboard")}
                >
                  Whiteboard
                </button>
              </div>
            </div>

            <p className="section-copy">
              Messages are shared with everyone in the room and cleared when the room closes.
            </p>

            <div ref={chatLogRef} className="chat-message-list" aria-live="polite">
              {roomSync.roomChatMessages.filter((m) => m.surface === activeChatSurface).length === 0 ? (
                <div className="chat-empty-state">
                  <strong>No messages yet</strong>
                  <p>Open the notebook or whiteboard and post the first room message.</p>
                </div>
              ) : (
                roomSync.roomChatMessages
                  .filter((m) => m.surface === activeChatSurface)
                  .map((message) => (
                    <article key={message.messageId} className="chat-message-card">
                      <div className="chat-message-header">
                        <strong>{message.authorName}</strong>
                        <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                      </div>
                      <div className="chat-message-meta">
                        <span className={`status-pill ${message.surface === "whiteboard" ? "status-pill-accent" : ""}`}>
                          {message.surface === "whiteboard" ? "Whiteboard" : "Notebook"}
                        </span>
                        <span>{message.authorId}</span>
                      </div>
                      <p>{message.body}</p>
                    </article>
                  ))
              )}
            </div>

            <form className="chat-composer" onSubmit={handleChatSubmit}>
              <div className="field-group">
                <label className="field-label" htmlFor="roomChatMessage">
                  Post as {roomSync.displayName}
                </label>
                <textarea
                  id="roomChatMessage"
                  ref={chatInputRef}
                  className="input-field chat-input"
                  value={chatDraft}
                  onChange={(event) => setChatDraft(event.target.value)}
                  placeholder={`Write to the ${activeChatLabel.toLowerCase()}...`}
                  rows={4}
                />
              </div>
              <div className="chat-composer-footer">
                <span className="section-copy">Visible to everyone currently in the room.</span>
                <button className="button button-primary" type="submit" disabled={!chatDraft.trim()}>
                  Send message
                </button>
              </div>
            </form>
          </section>
        </aside>
      </section>
    </div>
  );
}
