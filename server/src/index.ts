import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, ObjectStateRecord, UserState } from "./types.js";

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const PORT = Number(process.env.PORT ?? 8080);
const LOG_POSITION_UPDATES = process.env.LOG_POSITION_UPDATES === "true";
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS ?? 5000);

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
const socketToUser = new Map<WebSocket, { userId: string; roomId: string }>();
const userToSocket = new Map<string, WebSocket>();
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

function clearPendingDisconnect(userId: string): void {
  const timer = pendingDisconnects.get(userId);
  if (timer) {
    clearTimeout(timer);
    pendingDisconnects.delete(userId);
  }
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
        // Client supplies spawn/initial presence; server keeps reconnect continuity.
        x: existingState?.x ?? message.x,
        y: existingState?.y ?? message.y,
        direction: existingState?.direction ?? message.direction,
        lastSeen: Date.now(),
      });

      socketToUser.set(socket, { userId: message.userId, roomId: message.roomId });
      userToSocket.set(message.userId, socket);

      log("room.user_joined", {
        roomId: message.roomId,
        userId: message.userId,
        roomSize: room.size,
      });

      sendObjectStateSnapshot(message.roomId, socket);

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
        log("room.deleted", { roomId: info.roomId });
      }
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
