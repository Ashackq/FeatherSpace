import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type {
  DirectMessage,
  IncomingMessage,
  ObjectStateRecord,
  RoomChatMessage,
  RoomChatPostMessage,
  UserState,
} from "./types.js";

const app = express();
app.use(express.json());
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const PORT = Number(process.env.PORT ?? 8080);
const LOG_POSITION_UPDATES = process.env.LOG_POSITION_UPDATES === "true";
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS ?? 5000);
const WS_HEARTBEAT_INTERVAL_MS = Number(process.env.WS_HEARTBEAT_INTERVAL_MS ?? 10000);

function log(event: string, details: Record<string, unknown> = {}): void {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...details,
  };

  console.log(JSON.stringify(payload));
}

// roomId -> (userId -> user state)
const rooms = new Map<string, Map<string, UserState>>();
const roomObjectStates = new Map<string, Map<string, ObjectStateRecord>>();
const roomChatMessages = new Map<string, RoomChatMessage[]>();
const roomDirectMessages = new Map<string, DirectMessage[]>();
const roomEnvironments = new Map<
  string,
  {
    config: Record<string, unknown>;
    updatedAt: number;
    updatedBy: string;
  }
>();
const socketToUser = new Map<WebSocket, { userId: string; roomId: string }>();
const userToSocket = new Map<string, WebSocket>();
const socketAlive = new WeakMap<WebSocket, boolean>();
const userDisplayNames = new Map<string, string>();
const pendingDisconnects = new Map<string, NodeJS.Timeout>();

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "featherspace-server" });
});

function safeParse(raw: string): IncomingMessage | null {
  try {
    return JSON.parse(raw) as IncomingMessage;
  } catch {
    log("ws.parse_error", { raw });
    return null;
  }
}

function broadcastToRoom(roomId: string, payload: unknown): void {
  const room = rooms.get(roomId);
  if (!room) return;

  const body = JSON.stringify(payload);
  for (const userId of room.keys()) {
    const socket = userToSocket.get(userId);
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(body);
    }
  }
}

function broadcastRoomState(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;

  broadcastToRoom(roomId, {
    type: "room_state",
    users: Array.from(room.values()),
  });
}

function normalizeDisplayName(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (trimmed) {
    return trimmed;
  }

  return fallback;
}

function createMessageId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function ensureRoomChatMessages(roomId: string): RoomChatMessage[] {
  const existing = roomChatMessages.get(roomId);
  if (existing) {
    return existing;
  }

  const created: RoomChatMessage[] = [];
  roomChatMessages.set(roomId, created);
  return created;
}

function sendRoomChatSnapshot(roomId: string, socket: WebSocket): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "room_chat_state",
      roomId,
      messages: ensureRoomChatMessages(roomId),
    }),
  );
}

function ensureRoomDirectMessages(roomId: string): DirectMessage[] {
  const existing = roomDirectMessages.get(roomId);
  if (existing) {
    return existing;
  }

  const created: DirectMessage[] = [];
  roomDirectMessages.set(roomId, created);
  return created;
}

function sendDirectMessageSnapshot(roomId: string, userId: string, socket: WebSocket): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  const visibleMessages = ensureRoomDirectMessages(roomId).filter(
    (message) => message.fromUserId === userId || message.toUserId === userId,
  );

  socket.send(
    JSON.stringify({
      type: "direct_message_state",
      roomId,
      messages: visibleMessages,
    }),
  );
}

function ensureRoomObjectState(roomId: string): Map<string, ObjectStateRecord> {
  const existing = roomObjectStates.get(roomId);
  if (existing) {
    return existing;
  }

  const created = new Map<string, ObjectStateRecord>();
  roomObjectStates.set(roomId, created);
  return created;
}

function sendObjectStateSnapshot(roomId: string, socket: WebSocket): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  const objectState = ensureRoomObjectState(roomId);
  socket.send(
    JSON.stringify({
      type: "object_state_snapshot",
      roomId,
      states: Array.from(objectState.values()),
    }),
  );
}

function sendEnvironmentState(roomId: string, socket: WebSocket): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  const environment = roomEnvironments.get(roomId);
  if (!environment) {
    return;
  }

  socket.send(
    JSON.stringify({
      type: "environment_state",
      roomId,
      config: environment.config,
      updatedAt: environment.updatedAt,
      updatedBy: environment.updatedBy,
    }),
  );
}

function clearPendingDisconnect(userId: string): void {
  const timer = pendingDisconnects.get(userId);
  if (timer) {
    clearTimeout(timer);
    pendingDisconnects.delete(userId);
  }
}

function storeDisplayName(userId: string, displayName: string | undefined): void {
  userDisplayNames.set(userId, normalizeDisplayName(displayName, userId));
}

function getDisplayName(userId: string, fallback?: string): string {
  return userDisplayNames.get(userId) ?? normalizeDisplayName(fallback, userId);
}

wss.on("connection", (socket) => {
  log("ws.connection_opened", { clients: wss.clients.size });
  socketAlive.set(socket, true);

  socket.on("pong", () => {
    socketAlive.set(socket, true);
  });

  socket.on("message", (buffer) => {
    const message = safeParse(buffer.toString());
    if (!message) return;

    if (message.type === "join_room") {
      clearPendingDisconnect(message.userId);

      const previousInfo = socketToUser.get(socket);
      if (previousInfo && previousInfo.roomId !== message.roomId) {
        const previousRoom = rooms.get(previousInfo.roomId);
        if (previousRoom && previousRoom.has(previousInfo.userId)) {
          previousRoom.delete(previousInfo.userId);
          log("room.user_left", {
            roomId: previousInfo.roomId,
            userId: previousInfo.userId,
            roomSize: previousRoom.size,
          });

          broadcastToRoom(previousInfo.roomId, {
            type: "user_left",
            userId: previousInfo.userId,
          });
          broadcastRoomState(previousInfo.roomId);

          if (previousRoom.size === 0) {
            rooms.delete(previousInfo.roomId);
            roomObjectStates.delete(previousInfo.roomId);
            roomChatMessages.delete(previousInfo.roomId);
            roomEnvironments.delete(previousInfo.roomId);
            log("room.deleted", { roomId: previousInfo.roomId });
          }
        }
      }

      const room = rooms.get(message.roomId) ?? new Map<string, UserState>();
      if (!rooms.has(message.roomId)) {
        rooms.set(message.roomId, room);
      }

      const existingState = room.get(message.userId);

      // If the same user reconnects (e.g. refresh), retire previous socket safely.
      const previousSocket = userToSocket.get(message.userId);
      if (previousSocket && previousSocket !== socket) {
        socketToUser.delete(previousSocket);
        try {
          previousSocket.close(1000, "Replaced by newer connection");
        } catch {
          // no-op
        }
      }

      room.set(message.userId, {
        userId: message.userId,
        roomId: message.roomId,
        displayName: normalizeDisplayName(message.displayName, existingState?.displayName ?? message.userId),
        // Client supplies spawn/initial presence; server keeps reconnect continuity.
        x: existingState?.x ?? message.x,
        y: existingState?.y ?? message.y,
        direction: existingState?.direction ?? message.direction,
        lastSeen: Date.now(),
      });

      storeDisplayName(message.userId, message.displayName);

      socketToUser.set(socket, { userId: message.userId, roomId: message.roomId });
      userToSocket.set(message.userId, socket);

      log("room.user_joined", {
        roomId: message.roomId,
        userId: message.userId,
        displayName: normalizeDisplayName(message.displayName, message.userId),
        roomSize: room.size,
        iceServers: "configured",
      });

      sendObjectStateSnapshot(message.roomId, socket);
      sendEnvironmentState(message.roomId, socket);
      sendRoomChatSnapshot(message.roomId, socket);
      sendDirectMessageSnapshot(message.roomId, message.userId, socket);

      broadcastRoomState(message.roomId);
      broadcastToRoom(message.roomId, {
        type: "user_joined",
        userId: message.userId,
      });
      return;
    }

    if (message.type === "position_update") {
      const info = socketToUser.get(socket);
      if (!info) return;

      const room = rooms.get(info.roomId);
      if (!room) return;

      const roomUserId = info.userId;
      const existingState = room.get(roomUserId);

      room.set(roomUserId, {
        userId: roomUserId,
        roomId: info.roomId,
        displayName: existingState?.displayName ?? getDisplayName(roomUserId),
        x: message.x,
        y: message.y,
        direction: message.direction,
        lastSeen: message.timestamp || Date.now(),
      });

      if (!existingState) {
        log("room.user_state_upserted", {
          roomId: info.roomId,
          userId: roomUserId,
        });
      }

      const outbound = {
        ...message,
        userId: roomUserId,
      };

      if (LOG_POSITION_UPDATES) {
        log("room.position_update", {
          roomId: info.roomId,
          userId: roomUserId,
          x: message.x,
          y: message.y,
          direction: message.direction,
        });
      }

      broadcastToRoom(info.roomId, outbound);
      return;
    }

    if (message.type === "signal") {
      const sender = socketToUser.get(socket);
      if (!sender) return;

      const targetSocket = userToSocket.get(message.targetUser);
      const signalKind = (message.payload as Record<string, unknown>).kind as string;
      const delivered = Boolean(targetSocket && targetSocket.readyState === WebSocket.OPEN);
      
      log("rtc.signal_relay", {
        fromUser: sender.userId,
        targetUser: message.targetUser,
        kind: signalKind,
        delivered,
        roomId: sender.roomId,
      });

      if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
        targetSocket.send(
          JSON.stringify({
            type: "signal",
            fromUser: sender.userId,
            payload: message.payload,
          }),
        );
      }

      return;
    }

    if (message.type === "object_event") {
      const sender = socketToUser.get(socket);
      if (!sender) return;

      if (sender.roomId !== message.roomId) {
        log("room.object_event_rejected", {
          reason: "room_mismatch",
          senderRoomId: sender.roomId,
          messageRoomId: message.roomId,
          userId: sender.userId,
          objectId: message.objectId,
          action: message.action,
        });
        return;
      }

      const roomState = ensureRoomObjectState(sender.roomId);
      const updatedAt = message.timestamp || Date.now();
      const nextRecord: ObjectStateRecord = {
        objectId: message.objectId,
        state: message.payload ?? {},
        updatedAt,
        updatedBy: sender.userId,
      };

      roomState.set(message.objectId, nextRecord);

      broadcastToRoom(sender.roomId, {
        type: "object_state_update",
        roomId: sender.roomId,
        objectId: message.objectId,
        action: message.action,
        state: nextRecord.state,
        updatedAt: nextRecord.updatedAt,
        updatedBy: nextRecord.updatedBy,
      });

      log("room.object_state_update", {
        roomId: sender.roomId,
        userId: sender.userId,
        objectId: message.objectId,
        action: message.action,
      });

      return;
    }

    if (message.type === "room_chat_message") {
      const sender = socketToUser.get(socket);
      if (!sender) return;

      if (sender.roomId !== message.roomId) {
        log("room.chat_message_rejected", {
          reason: "room_mismatch",
          senderRoomId: sender.roomId,
          messageRoomId: message.roomId,
          userId: sender.userId,
        });
        return;
      }

      const body = message.body.trim();
      if (!body) {
        return;
      }

      const roomMessages = ensureRoomChatMessages(sender.roomId);
      const nextRecord: RoomChatMessage = {
        type: "room_chat_message",
        roomId: sender.roomId,
        messageId: createMessageId(),
        authorId: sender.userId,
        authorName: getDisplayName(sender.userId, message.displayName),
        body: body.slice(0, 500),
        surface: message.surface,
        objectId: message.objectId,
        timestamp: Date.now(),
      };

      roomMessages.push(nextRecord);
      if (roomMessages.length > 100) {
        roomMessages.splice(0, roomMessages.length - 100);
      }

      broadcastToRoom(sender.roomId, nextRecord);

      log("room.chat_message", {
        roomId: sender.roomId,
        userId: sender.userId,
        surface: message.surface,
        bodyLength: body.length,
        messageCount: roomMessages.length,
      });

      return;
    }

    if (message.type === "direct_message") {
      const sender = socketToUser.get(socket);
      if (!sender) return;

      if (sender.roomId !== message.roomId) {
        log("room.direct_message_rejected", {
          reason: "room_mismatch",
          senderRoomId: sender.roomId,
          messageRoomId: message.roomId,
          fromUserId: sender.userId,
          toUserId: message.toUserId,
        });
        return;
      }

      if (sender.userId === message.toUserId) {
        return;
      }

      const room = rooms.get(sender.roomId);
      if (!room || !room.has(message.toUserId)) {
        log("room.direct_message_rejected", {
          reason: "target_not_in_room",
          roomId: sender.roomId,
          fromUserId: sender.userId,
          toUserId: message.toUserId,
        });
        return;
      }

      const body = message.body.trim();
      if (!body) {
        return;
      }

      const nextRecord: DirectMessage = {
        type: "direct_message",
        roomId: sender.roomId,
        messageId: createMessageId(),
        fromUserId: sender.userId,
        fromUserName: getDisplayName(sender.userId, message.displayName),
        toUserId: message.toUserId,
        body: body.slice(0, 500),
        timestamp: Date.now(),
      };

      const directMessages = ensureRoomDirectMessages(sender.roomId);
      directMessages.push(nextRecord);
      if (directMessages.length > 300) {
        directMessages.splice(0, directMessages.length - 300);
      }

      const senderSocket = userToSocket.get(sender.userId);
      const recipientSocket = userToSocket.get(message.toUserId);
      const payload = JSON.stringify(nextRecord);

      if (senderSocket?.readyState === WebSocket.OPEN) {
        senderSocket.send(payload);
      }

      if (recipientSocket?.readyState === WebSocket.OPEN) {
        recipientSocket.send(payload);
      }

      log("room.direct_message", {
        roomId: sender.roomId,
        bodyLength: body.length,
        messageCount: directMessages.length,
        fromUserId: sender.userId,
        toUserId: message.toUserId,
      });

      return;
    }

    if (message.type === "environment_update") {
      const sender = socketToUser.get(socket);
      if (!sender) return;

      if (sender.roomId !== message.roomId) {
        log("room.environment_update_rejected", {
          reason: "room_mismatch",
          senderRoomId: sender.roomId,
          messageRoomId: message.roomId,
          userId: sender.userId,
        });
        return;
      }

      const updatedAt = message.timestamp || Date.now();
      roomEnvironments.set(sender.roomId, {
        config: message.config,
        updatedAt,
        updatedBy: sender.userId,
      });

      broadcastToRoom(sender.roomId, {
        type: "environment_state",
        roomId: sender.roomId,
        config: message.config,
        updatedAt,
        updatedBy: sender.userId,
      });

      log("room.environment_updated", {
        roomId: sender.roomId,
        userId: sender.userId,
      });

      return;
    }
  });

  socket.on("close", () => {
    socketAlive.delete(socket);
    const info = socketToUser.get(socket);
    if (!info) {
      log("ws.connection_closed", { clients: wss.clients.size });
      return;
    }

    socketToUser.delete(socket);

    // Only clear mapping if this closing socket is still the active one.
    const activeSocket = userToSocket.get(info.userId);
    if (activeSocket === socket) {
      userToSocket.delete(info.userId);
    }

    // Grace period allows same user to refresh/reconnect without immediate room exit.
    clearPendingDisconnect(info.userId);
    const disconnectTimer = setTimeout(() => {
      pendingDisconnects.delete(info.userId);

      const stillActive = userToSocket.get(info.userId);
      if (stillActive) {
        return;
      }

      const room = rooms.get(info.roomId);
      if (!room) return;

      room.delete(info.userId);
      log("room.user_left", {
        roomId: info.roomId,
        userId: info.userId,
        roomSize: room.size,
      });

      broadcastToRoom(info.roomId, {
        type: "user_left",
        userId: info.userId,
      });
      broadcastRoomState(info.roomId);

      if (room.size === 0) {
        rooms.delete(info.roomId);
        roomObjectStates.delete(info.roomId);
        roomChatMessages.delete(info.roomId);
        roomDirectMessages.delete(info.roomId);
        roomEnvironments.delete(info.roomId);
        log("room.deleted", { roomId: info.roomId });
      }

      userDisplayNames.delete(info.userId);
    }, DISCONNECT_GRACE_MS);
    pendingDisconnects.set(info.userId, disconnectTimer);

    log("ws.connection_closed", { clients: wss.clients.size });
  });

  socket.on("error", (error) => {
    log("ws.connection_error", {
      message: error.message,
    });
  });
});

httpServer.listen(PORT, () => {
  log("server.started", {
    port: PORT,
    logPositionUpdates: LOG_POSITION_UPDATES,
    disconnectGraceMs: DISCONNECT_GRACE_MS,
    wsHeartbeatIntervalMs: WS_HEARTBEAT_INTERVAL_MS,
    environment: process.env.NODE_ENV || "development",
  });
});

const heartbeatTimer = setInterval(() => {
  let deadSockets = 0;
  let activeSockets = 0;
  
  wss.clients.forEach((socket) => {
    const alive = socketAlive.get(socket);
    if (alive === false) {
      socket.terminate();
      deadSockets++;
      return;
    }

    activeSockets++;
    socketAlive.set(socket, false);
    try {
      socket.ping();
    } catch {
      socket.terminate();
    }
  });

  if (activeSockets > 0 || deadSockets > 0) {
    log("ws.heartbeat", {
      activeSockets,
      deadSockets,
      totalClients: wss.clients.size,
      roomsActive: rooms.size,
    });
  }
}, WS_HEARTBEAT_INTERVAL_MS);

wss.on("close", () => {
  clearInterval(heartbeatTimer);
});
