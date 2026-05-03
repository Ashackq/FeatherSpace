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
type InviteStatus =
  | { state: "idle" }
  | { state: "creating" }
  | { state: "ready"; url: string; expiresAt?: number }
  | { state: "error"; message: string };

type ActivityEvent = {
  at: number;
  label: string;
};

function resolveTemplateRoomId(roomId: string | undefined): string {
  if (!roomId) {
    return "research-studio";
  }

  if (roomId === "research-studio-main" || roomId === "research-studio-prototype") {
    return "research-studio";
  }

  return roomId;
}

const WHITEBOARD_URL =
  "https://app.mural.co/t/akashmit6988/m/akashmit6988/1724847876537/8c964b56effa4f9e830f8e693bc78c083ef096b0?sender=u5fc25cdb7e29f89263482987";

export function RoomExperiencePage() {
  const { roomId } = useParams();
  const [searchParams] = useSearchParams();
  const demoMode = searchParams.get("demo") === "1";
  const templateRoomId = useMemo(() => resolveTemplateRoomId(roomId), [roomId]);
  const environmentRuntime = useMemo(() => loadEnvironmentForRoom(templateRoomId), [templateRoomId]);
  const [localPosition, setLocalPosition] = useState<{ x: number; y: number } | null>(null);
  const [positionTransportMode, setPositionTransportMode] = useState<PositionTransportMode>("auto");
  const [researchStudioMapVariant, setResearchStudioMapVariant] = useState<ResearchStudioMapVariant>("main");
  const [activeChatSurface, setActiveChatSurface] = useState<"whiteboard" | "notebook">("notebook");
  const [chatDraft, setChatDraft] = useState("");
  const [isChatModalOpen, setIsChatModalOpen] = useState(false);
  const [isDmModalOpen, setIsDmModalOpen] = useState(false);
  const [dmDraft, setDmDraft] = useState("");
  const [activeDmUserId, setActiveDmUserId] = useState<string | null>(null);
  const [namePromptValue, setNamePromptValue] = useState("");
  const [namePromptDismissed, setNamePromptDismissed] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>({ state: "idle" });
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const prevRemoteUserIdsRef = useRef<Set<string>>(new Set());
  const isResearchStudioRoom = (roomId ?? "").startsWith("research-studio");
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const dmLogRef = useRef<HTMLDivElement | null>(null);
  const dmInputRef = useRef<HTMLTextAreaElement | null>(null);
  const seededEnvironmentRoomsRef = useRef<Set<string>>(new Set());

  const roomSync = useRoomSync(
    runtimeConfig.wsUrl,
    runtimeConfig.enableRealtime,
    templateRoomId,
  );

  useEffect(() => {
    chatLogRef.current?.scrollTo({ top: chatLogRef.current.scrollHeight, behavior: "smooth" });
  }, [roomSync.roomChatMessages, activeChatSurface]);

  useEffect(() => {
    dmLogRef.current?.scrollTo({ top: dmLogRef.current.scrollHeight, behavior: "smooth" });
  }, [activeDmUserId, roomSync.directMessages]);

  useEffect(() => {
    if (activeDmUserId && !roomSync.remoteUsers.some((user) => user.userId === activeDmUserId)) {
      setActiveDmUserId(null);
      setIsDmModalOpen(false);
    }
  }, [activeDmUserId, roomSync.remoteUsers]);

  // Track user join/leave events for activity feed
  useEffect(() => {
    const currentIds = new Set(roomSync.remoteUsers.map((u) => u.userId));
    const prev = prevRemoteUserIdsRef.current;

    const pushEvent = (label: string) =>
      setActivityFeed((feed) => [...feed.slice(-19), { at: Date.now(), label }]);

    roomSync.remoteUsers.forEach((u) => {
      if (!prev.has(u.userId)) {
        pushEvent(`${u.displayName?.trim() || u.userId.slice(0, 8)} joined`);
      }
    });

    prev.forEach((id) => {
      if (!currentIds.has(id)) {
        pushEvent(`${id.slice(0, 8)} left the room`);
      }
    });

    prevRemoteUserIdsRef.current = currentIds;
  }, [roomSync.remoteUsers]);

  const getUserDisplayLabel = (user: UserState) => {
    return user.displayName?.trim() || user.userId;
  };

  // Track object state interactions for activity feed
  useEffect(() => {
    if (!roomSync.lastObjectStateUpdate) return;
    const { objectId, action, updatedBy } = roomSync.lastObjectStateUpdate;
    const actor = updatedBy.slice(0, 8);
    setActivityFeed((feed) => [
      ...feed.slice(-19),
      { at: Date.now(), label: `${actor} — ${objectId} ${action}` },
    ]);
  }, [roomSync.lastObjectStateUpdate]);

  const isNameAutoGenerated = roomSync.displayName.startsWith("Guest ");
  const showNamePrompt = isNameAutoGenerated && !namePromptDismissed;

  const participants = useMemo(() => {
    const self = {
      userId: roomSync.userId,
      roomId: templateRoomId,
      displayName: roomSync.displayName,
      displayLabel: roomSync.displayName,
      x: 0,
      y: 0,
      direction: 0,
      lastSeen: Date.now(),
      isSelf: true as const,
    };
    const remote = roomSync.remoteUsers
      .map((user) => ({
        ...user,
        displayLabel: getUserDisplayLabel(user),
        isSelf: false as const,
      }))
      .sort((left, right) => left.displayLabel.localeCompare(right.displayLabel));
    return [self, ...remote];
  }, [roomSync.remoteUsers, roomSync.userId, roomSync.displayName, templateRoomId]);

  const activeDmUser = useMemo(() => {
    return participants.find((participant) => participant.userId === activeDmUserId && !participant.isSelf) ?? null;
  }, [activeDmUserId, participants]);

  const activeDmMessages = useMemo(() => {
    if (!activeDmUserId) {
      return [];
    }

    return roomSync.directMessages.filter(
      (message) =>
        (message.fromUserId === roomSync.userId && message.toUserId === activeDmUserId) ||
        (message.fromUserId === activeDmUserId && message.toUserId === roomSync.userId),
    );
  }, [activeDmUserId, roomSync.directMessages, roomSync.userId]);

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

  const handleDirectMessageSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!activeDmUserId) {
      return;
    }

    const message = dmDraft.trim();
    if (!message) {
      return;
    }

    roomSync.sendDirectMessage(activeDmUserId, message);
    setDmDraft("");
  };

  const handleInvite = () => {
    const url = window.location.href;
    setInviteStatus({ state: "creating" });
    navigator.clipboard.writeText(url).then(
      () => {
        setInviteStatus({ state: "ready", url });
        setTimeout(() => setInviteStatus({ state: "idle" }), 2500);
      },
      () => {
        setInviteStatus({ state: "error", message: "Could not copy to clipboard" });
        setTimeout(() => setInviteStatus({ state: "idle" }), 3000);
      },
    );
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
          <button
            className="button button-primary presentation-hide"
            type="button"
            onClick={handleInvite}
            disabled={inviteStatus.state === "creating"}
          >
            {inviteStatus.state === "ready"
              ? "Link copied!"
              : inviteStatus.state === "error"
                ? inviteStatus.message
                : "Invite participant"}
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

          {showNamePrompt ? (
            <div className="chat-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="name-prompt-title">
              <div className="chat-modal panel-surface" style={{ maxWidth: 440 }}>
                <div className="section-header">
                  <div>
                    <span className="eyebrow">Welcome</span>
                    <h3 id="name-prompt-title">What should we call you?</h3>
                  </div>
                </div>
                <p className="section-copy">Your display name is visible to everyone in the room.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const name = namePromptValue.trim();
                    if (!name) return;
                    localStorage.setItem("featherspace.displayName", name);
                    window.location.reload();
                  }}
                >
                  <div className="field-group">
                    <label className="field-label" htmlFor="namePromptInput">Display name</label>
                    <input
                      id="namePromptInput"
                      className="input-field"
                      value={namePromptValue}
                      onChange={(e) => setNamePromptValue(e.target.value)}
                      placeholder="Your name"
                      autoFocus
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                    <button className="button button-secondary" type="button" onClick={() => setNamePromptDismissed(true)}>
                      Skip for now
                    </button>
                    <button className="button button-primary" type="submit" disabled={!namePromptValue.trim()}>
                      Set name
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {isDmModalOpen && activeDmUser ? (
            <div className="chat-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dm-modal-title">
              <div className="chat-modal panel-surface">
                <div className="section-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span className="eyebrow">Direct Message</span>
                    <h3 id="dm-modal-title">Chat with {activeDmUser.displayLabel}</h3>
                  </div>
                  <button className="button button-ghost" type="button" onClick={() => setIsDmModalOpen(false)}>Close</button>
                </div>
                <p className="section-copy">Private between you and {activeDmUser.displayLabel}.</p>

                <div ref={dmLogRef} className="chat-message-list" aria-live="polite" style={{ maxHeight: 340, overflow: "auto", marginBottom: 12 }}>
                  {activeDmMessages.length === 0 ? (
                    <div className="chat-empty-state">
                      <strong>No direct messages yet</strong>
                      <p>Send the first personal message.</p>
                    </div>
                  ) : (
                    activeDmMessages.map((message) => (
                      <article key={message.messageId} className="chat-message-card">
                        <div className="chat-message-header">
                          <strong>{message.fromUserId === roomSync.userId ? "You" : message.fromUserName}</strong>
                          <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                        </div>
                        <div className="chat-message-meta">
                          <span className="status-pill">Direct</span>
                        </div>
                        <p>{message.body}</p>
                      </article>
                    ))
                  )}
                </div>

                <form className="chat-composer" onSubmit={(e) => { handleDirectMessageSubmit(e); }}>
                  <div className="field-group">
                    <label className="field-label" htmlFor="dmModalInput">
                      Message as {roomSync.displayName}
                    </label>
                    <textarea
                      id="dmModalInput"
                      ref={dmInputRef}
                      className="input-field chat-input"
                      value={dmDraft}
                      onChange={(event) => setDmDraft(event.target.value)}
                      placeholder={`Message ${activeDmUser.displayLabel}...`}
                      rows={3}
                    />
                  </div>
                  <div className="chat-composer-footer" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                    <span className="section-copy">Only visible to this participant.</span>
                    <button className="button button-primary" type="submit" disabled={!dmDraft.trim()}>
                      Send DM
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

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
              {participants.map((participant, index) => {
                const accent = participant.isSelf ? "accent" : index % 2 === 0 ? "secondary" : "default";
                const isEnvHost = participant.userId === roomSync.environmentOriginatorId;

                return (
                  <article
                    key={participant.userId}
                    className="participant-card"
                  >
                    <div className={`participant-avatar participant-avatar-${accent}`}>
                      {participant.displayLabel.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>
                        {participant.displayLabel}
                        {participant.isSelf ? " (You)" : ""}
                      </strong>
                      <p style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{participant.userId}</p>
                      {isEnvHost ? (
                        <span className="status-pill status-pill-accent" style={{ fontSize: "0.68rem", padding: "3px 8px", marginTop: 4 }}>
                          ENV Host
                        </span>
                      ) : null}
                    </div>
                    {!participant.isSelf ? (
                      <button
                        className="button button-secondary"
                        style={{ padding: "5px 12px", fontSize: "0.78rem", minHeight: 0 }}
                        type="button"
                        onClick={() => {
                          setActiveDmUserId(participant.userId);
                          setIsDmModalOpen(true);
                        }}
                      >
                        DM
                      </button>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="panel-surface live-panels-stack">
            {/* Connection Health */}
            <article className="live-panel-card">
              <h3>Connection Health</h3>
              <div className="live-panel-rows">
                <div className="live-panel-row">
                  <span>Realtime status</span>
                  <strong>{roomSync.status.state}</strong>
                </div>
                <div className="live-panel-row">
                  <span>WebSocket</span>
                  <strong>
                    {roomSync.status.state === "connected"
                      ? "Stable"
                      : roomSync.status.state === "connecting"
                        ? "Connecting…"
                        : roomSync.status.state === "disabled"
                          ? "Offline"
                          : "Degraded"}
                  </strong>
                </div>
                <div className="live-panel-row">
                  <span>RTC peers</span>
                  <strong>
                    {rtcAudio.peers.filter((p) => p.state === "connected").length} active
                    {rtcAudio.openMeshChannelCount > 0
                      ? ` · ${rtcAudio.openMeshChannelCount} mesh`
                      : ""}
                  </strong>
                </div>
                <div className="live-panel-row">
                  <span>Nearby peers</span>
                  <strong>{proximity.nearbyUserIds.length} in radius</strong>
                </div>
                <div className="live-panel-row">
                  <span>Mic</span>
                  <strong>{rtcAudio.isMicEnabled ? "Live" : "Muted"}</strong>
                </div>
              </div>
            </article>

            {/* Environment Objects */}
            <article className="live-panel-card">
              <h3>Environment Objects</h3>
              <div className="live-panel-rows">
                {(() => {
                  const objects = activeEnvironmentConfig.activeRoom.objects;
                  const count = (type: string | string[]) => {
                    const types = Array.isArray(type) ? type : [type];
                    return objects.filter((o) => types.includes(o.type)).length;
                  };
                  return (
                    <>
                      <div className="live-panel-row">
                        <span>Total objects</span>
                        <strong>{objects.length}</strong>
                      </div>
                      <div className="live-panel-row">
                        <span>Whiteboards</span>
                        <strong>{count("whiteboard")} mounted</strong>
                      </div>
                      <div className="live-panel-row">
                        <span>Tables</span>
                        <strong>{count(["table_cluster", "table", "private_room"])} ready</strong>
                      </div>
                      <div className="live-panel-row">
                        <span>Notebooks</span>
                        <strong>{count("notebook")} synced</strong>
                      </div>
                      <div className="live-panel-row">
                        <span>Doors</span>
                        <strong>{count("door")}</strong>
                      </div>
                    </>
                  );
                })()}
              </div>
            </article>

            {/* Activity Feed */}
            <article className="live-panel-card">
              <h3>Activity Feed</h3>
              <div className="live-panel-rows">
                {activityFeed.length === 0 ? (
                  <div className="live-panel-row">
                    <span style={{ color: "var(--muted)" }}>No activity yet</span>
                    <strong>—</strong>
                  </div>
                ) : (
                  [...activityFeed].reverse().slice(0, 8).map((event) => (
                    <div key={event.at} className="live-panel-row">
                      <span>
                        {new Date(event.at).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      <strong style={{ textAlign: "right", maxWidth: "60%", wordBreak: "break-word" }}>
                        {event.label}
                      </strong>
                    </div>
                  ))
                )}
              </div>
            </article>
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
