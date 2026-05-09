/**
 * debug.ts: Structured debug logging utilities for FeatherSpace client.
 *
 * Provides per-module log namespaces (RTC, WS, PROXIMITY, APP) with
 * consistent formatting, timestamps, and log levels.
 * All logs are written to the browser console with a [FS] prefix.
 */

/**
 * Debug logging utilities for FeatherSpace testing
 * Provides structured, timestamped logging across client modules
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  [key: string]: unknown;
}

const LOG_PREFIX = "[FS]";

// Format a log entry as a structured string with timestamp and module prefix
// FormatLog: format log.
function formatLog(level: LogLevel, module: string, event: string, payload?: LogPayload): string {
  const timestamp = new Date().toISOString();
  const details = payload ? JSON.stringify(payload) : "";
  return `${LOG_PREFIX} ${timestamp} [${level.toUpperCase()}] ${module} > ${event} ${details}`;
}

// Write a formatted log to the appropriate console method based on level
// LogToConsole: log to console.
function logToConsole(level: LogLevel, module: string, event: string, payload?: LogPayload): void {
  const message = formatLog(level, module, event, payload);
  const consoleMethod = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  consoleMethod(message);
}

// Namespaced logger for each subsystem - import Debug and use Debug.rtc.*, Debug.ws.*, etc.
export const Debug = {
  // --- RTC Audio logging (peer connections, ICE, signaling, mesh) ---
  rtc: {
    peerCreated: (peerId: string, config?: Record<string, unknown>) => {
      logToConsole("info", "RTC", "peer_created", { peerId, ...config });
    },
    peerState: (peerId: string, state: string, details?: Record<string, unknown>) => {
      logToConsole("debug", "RTC", "peer_state_change", { peerId, state, ...details });
    },
    offerGenerated: (peerId: string, offerSdp?: string) => {
      logToConsole("info", "RTC", "offer_generated", {
        peerId,
        sdpLines: offerSdp?.split("\n").length ?? 0,
      });
    },
    offerSent: (peerId: string, inFlightCount: number) => {
      logToConsole("info", "RTC", "offer_sent", { peerId, offersInFlight: inFlightCount });
    },
    answerReceived: (peerId: string, answerSdp?: string) => {
      logToConsole("info", "RTC", "answer_received", {
        peerId,
        sdpLines: answerSdp?.split("\n").length ?? 0,
      });
    },
    iceCandidate: (peerId: string, candidate: string, type?: string) => {
      logToConsole("debug", "RTC", "ice_candidate", {
        peerId,
        candidateType: type || "unknown",
        candidatePrefix: candidate.substring(0, 50),
      });
    },
    iceGatheringState: (peerId: string, state: string) => {
      logToConsole("debug", "RTC", "ice_gathering_state", { peerId, state });
    },
    iceConnectionState: (peerId: string, state: string) => {
      logToConsole("info", "RTC", "ice_connection_state", { peerId, state });
    },
    connectionState: (peerId: string, state: string, elapsed?: number) => {
      logToConsole("info", "RTC", "connection_state", { peerId, state, elapsedMs: elapsed });
    },
    staleConnectionDetected: (peerId: string, state: string, timeoutMs: number) => {
      logToConsole("warn", "RTC", "stale_connection_detected", {
        peerId,
        state,
        timeoutMs,
      });
    },
    connectionRecoveryAttempt: (peerId: string, reason: string) => {
      logToConsole("warn", "RTC", "connection_recovery_attempt", { peerId, reason });
    },
    peerConnectionClosed: (peerId: string, reason?: string) => {
      logToConsole("info", "RTC", "peer_connection_closed", { peerId, reason });
    },
    meshChannelOpened: (peerId: string) => {
      logToConsole("info", "RTC", "mesh_channel_opened", { peerId });
    },
    meshChannelClosed: (peerId: string) => {
      logToConsole("debug", "RTC", "mesh_channel_closed", { peerId });
    },
    meshPositionSent: (peerId: string, x: number, y: number, direction: number) => {
      logToConsole("debug", "RTC", "mesh_position_sent", { peerId, x, y, direction });
    },
    meshPositionReceived: (peerId: string, x: number, y: number, direction: number) => {
      logToConsole("debug", "RTC", "mesh_position_received", { peerId, x, y, direction });
    },
    signalError: (peerId: string, error: string) => {
      logToConsole("error", "RTC", "signal_error", { peerId, error });
    },
  },

  // --- WebSocket/room sync logging ---
  ws: {
    connecting: (wsUrl: string) => {
      logToConsole("info", "WS", "connecting", { wsUrl });
    },
    connected: (userId: string) => {
      logToConsole("info", "WS", "connected", { userId });
    },
    disconnected: (reason?: string) => {
      logToConsole("info", "WS", "disconnected", { reason });
    },
    reconnecting: (attempt: number, delayMs: number) => {
      logToConsole("info", "WS", "reconnecting", { attempt, delayMs });
    },
    joinRoomSent: (roomId: string, userId: string, x: number, y: number) => {
      logToConsole("info", "WS", "join_room_sent", { roomId, userId, x, y });
    },
    roomStateReceived: (roomId: string, userCount: number) => {
      logToConsole("info", "WS", "room_state_received", { roomId, userCount });
    },
    positionUpdateSent: (x: number, y: number, direction: number) => {
      logToConsole("debug", "WS", "position_update_sent", { x, y, direction });
    },
    positionUpdateReceived: (userId: string, x: number, y: number) => {
      logToConsole("debug", "WS", "position_update_received", { userId, x, y });
    },
    chatMessageSent: (surface: string, body: string) => {
      logToConsole("info", "WS", "chat_message_sent", {
        surface,
        bodyLength: body.length,
      });
    },
    chatMessageReceived: (authorId: string, surface: string, bodyLength: number) => {
      logToConsole("info", "WS", "chat_message_received", {
        authorId,
        surface,
        bodyLength,
      });
    },
    directMessageSent: (toUserId: string, body: string) => {
      logToConsole("info", "WS", "direct_message_sent", {
        toUserId,
        bodyLength: body.length,
      });
    },
    directMessageReceived: (fromUserId: string, body: string) => {
      logToConsole("info", "WS", "direct_message_received", {
        fromUserId,
        bodyLength: body.length,
      });
    },
    signalSent: (targetUser: string, kind: string) => {
      logToConsole("debug", "WS", "signal_sent", { targetUser, kind });
    },
    signalReceived: (fromUser: string, kind: string) => {
      logToConsole("debug", "WS", "signal_received", { fromUser, kind });
    },
    messageReceived: (type: string, count?: number) => {
      logToConsole("debug", "WS", "message_received", { type, count });
    },
    error: (error: string) => {
      logToConsole("error", "WS", "error", { error });
    },
  },

  // --- Proximity engine logging (grid cells, peer selection) ---
  proximity: {
    gridCellCalculated: (userId: string, x: number, y: number, col: number, row: number) => {
      logToConsole("debug", "PROXIMITY", "grid_cell_calculated", {
        userId,
        x,
        y,
        col,
        row,
      });
    },
    peerSelectionChanged: (
      selectedIds: string[],
      newIds: string[],
      lostIds: string[],
      maxPeers: number
    ) => {
      logToConsole("info", "PROXIMITY", "peer_selection_changed", {
        selectedCount: selectedIds.length,
        newCount: newIds.length,
        lostCount: lostIds.length,
        maxPeers,
        selectedIds: selectedIds.join(","),
        newIds: newIds.join(","),
        lostIds: lostIds.join(","),
      });
    },
    peerAdded: (peerId: string, totalPeers: number) => {
      logToConsole("info", "PROXIMITY", "peer_added", { peerId, totalPeers });
    },
    peerLost: (peerId: string, missCount: number) => {
      logToConsole("info", "PROXIMITY", "peer_lost", { peerId, missCount });
    },
    snapshotTaken: (timestamp: number, nearbyCount: number, selectedCount: number) => {
      logToConsole("debug", "PROXIMITY", "snapshot_taken", {
        timestamp,
        nearbyCount,
        selectedCount,
      });
    },
  },

  // --- Application-level logging (page load, user actions, errors) ---
  app: {
    pageLoad: (pageName: string, roomId?: string) => {
      logToConsole("info", "APP", "page_load", { pageName, roomId });
    },
    userAction: (action: string, details?: Record<string, unknown>) => {
      logToConsole("debug", "APP", "user_action", { action, ...details });
    },
    error: (error: string, context?: Record<string, unknown>) => {
      logToConsole("error", "APP", "error", { error, ...context });
    },
  },
};

/**
 * Get current system status summary for debugging
 */
export function getDebugStatus(): Record<string, unknown> {
  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    memory: (performance as unknown as Record<string, unknown>).memory,
  };
}

/**
 * Log full system state snapshot
 */
export function logSystemSnapshot(
  userId: string,
  roomId: string,
  rtcPeers: Array<{ peerId: string; state: string }>,
  selectedPeerIds: string[]
): void {
  logToConsole("info", "APP", "system_snapshot", {
    userId,
    roomId,
    rtcPeerCount: rtcPeers.length,
    rtcPeerStates: rtcPeers.map((p) => `${p.peerId}:${p.state}`).join(","),
    selectedPeerIds: selectedPeerIds.join(","),
    ...getDebugStatus(),
  });
}
