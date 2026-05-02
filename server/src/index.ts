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
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const PORT = Number(process.env.PORT ?? 8080);
const LOG_POSITION_UPDATES = process.env.LOG_POSITION_UPDATES === "true";
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS ?? 5000);
const INVITE_TTL_MS = Number(process.env.INVITE_TTL_MS ?? 1000 * 60 * 60 * 12);

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

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
const roomDirectMessages = new Map<string, Map<string, DirectMessage[]>>();
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
const userDisplayNames = new Map<string, string>();
const pendingDisconnects = new Map<string, NodeJS.Timeout>();
const inviteTokens = new Map<
  string,
  {
    roomId: string;
    hostUserId: string;
    createdAt: number;
    expiresAt: number;
  }
>();

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "featherspace-server" });
});

app.post("/invites", (req, res) => {
  const roomId = typeof req.body?.roomId === "string" ? req.body.roomId.trim() : "";
  const hostUserId = typeof req.body?.hostUserId === "string" ? req.body.hostUserId.trim() : "";

  if (!roomId || !hostUserId) {
    res.status(400).json({ ok: false, message: "roomId and hostUserId are required." });
    return;
  }

  const now = Date.now();
  sanitizeInviteStore(now);

  const token = createInviteToken();
  const expiresAt = now + INVITE_TTL_MS;
  inviteTokens.set(token, {
    roomId,
    hostUserId,
    createdAt: now,
    expiresAt,
  });

  const host = req.get("origin") || `${req.protocol}://${req.get("host")}`;
  const inviteUrl = `${host}/join/${token}`;

  res.status(201).json({
    ok: true,
    token,
    roomId,
    hostUserId,
    inviteUrl,
    expiresAt,
  });
});

app.get("/invites/:token", (req, res) => {
  const token = req.params.token.trim();
  const now = Date.now();
  sanitizeInviteStore(now);
  const invite = inviteTokens.get(token);

  if (!invite) {
    res.status(404).json({ ok: false, message: "Invite not found or expired." });
    return;
  }

  res.json({
    ok: true,
    token,
    roomId: invite.roomId,
    hostUserId: invite.hostUserId,
    expiresAt: invite.expiresAt,
  });
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

function createInviteToken(): string {
  return `${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function sanitizeInviteStore(now: number): void {
  for (const [token, invite] of inviteTokens.entries()) {
    if (invite.expiresAt <= now) {
      inviteTokens.delete(token);
    }
  }
}

function getConversationKey(userA: string, userB: string): string {
  return [userA, userB].sort().join("::");
}

function ensureRoomDirectMessages(roomId: string): Map<string, DirectMessage[]> {
  const existing = roomDirectMessages.get(roomId);
  if (existing) {
    return existing;
  }

  const created = new Map<string, DirectMessage[]>();
  roomDirectMessages.set(roomId, created);
  return created;
}

function ensureConversationMessages(roomId: string, userA: string, userB: string): DirectMessage[] {
  const conversations = ensureRoomDirectMessages(roomId);
  const key = getConversationKey(userA, userB);
  const existing = conversations.get(key);
  if (existing) {
    return existing;
  }

  const created: DirectMessage[] = [];
  conversations.set(key, created);
  return created;
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

function sendDirectMessageSnapshot(roomId: string, userId: string, socket: WebSocket): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  const conversationMap = roomDirectMessages.get(roomId);
  const messages = conversationMap
    ? Array.from(conversationMap.values())
        .flat()
        .filter((entry) => entry.fromUserId === userId || entry.toUserId === userId)
        .sort((left, right) => left.timestamp - right.timestamp)
    : [];

  socket.send(
    JSON.stringify({
      type: "direct_message_state",
      roomId,
      messages,
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

  socket.on("message", (buffer) => {
    const message = safeParse(buffer.toString());
    if (!message) return;

    if (message.type === "join_room") {
      clearPendingDisconnect(message.userId);

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
        displayName: getDisplayName(message.userId, message.displayName),
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
        roomSize: room.size,
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
      log("rtc.signal_relay", {
        fromUser: sender.userId,
        targetUser: message.targetUser,
        delivered: Boolean(targetSocket && targetSocket.readyState === WebSocket.OPEN),
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
          userId: sender.userId,
        });
        return;
      }

      const body = message.body.trim();
      if (!body) {
        return;
      }

      const room = rooms.get(sender.roomId);
      if (!room || !room.has(message.toUserId)) {
        return;
      }

      const conversationMessages = ensureConversationMessages(sender.roomId, sender.userId, message.toUserId);
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

      conversationMessages.push(nextRecord);
      if (conversationMessages.length > 100) {
        conversationMessages.splice(0, conversationMessages.length - 100);
      }

      const senderSocket = userToSocket.get(sender.userId);
      const receiverSocket = userToSocket.get(message.toUserId);
      const payload = JSON.stringify(nextRecord);

      if (senderSocket && senderSocket.readyState === WebSocket.OPEN) {
        senderSocket.send(payload);
      }

      if (receiverSocket && receiverSocket.readyState === WebSocket.OPEN && receiverSocket !== senderSocket) {
        receiverSocket.send(payload);
      }

      log("room.direct_message", {
        roomId: sender.roomId,
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
  });
});
