import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, UserState } from "./types.js";

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const PORT = Number(process.env.PORT ?? 8080);
const LOG_POSITION_UPDATES = process.env.LOG_POSITION_UPDATES === "true";

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
const socketToUser = new Map<WebSocket, { userId: string; roomId: string }>();
const userToSocket = new Map<string, WebSocket>();

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

wss.on("connection", (socket) => {
  log("ws.connection_opened", { clients: wss.clients.size });

  socket.on("message", (buffer) => {
    const message = safeParse(buffer.toString());
    if (!message) return;

    if (message.type === "join_room") {
      const room = rooms.get(message.roomId) ?? new Map<string, UserState>();
      if (!rooms.has(message.roomId)) {
        rooms.set(message.roomId, room);
      }

      room.set(message.userId, {
        userId: message.userId,
        roomId: message.roomId,
        x: 0,
        y: 0,
        direction: 0,
        lastSeen: Date.now(),
      });

      socketToUser.set(socket, { userId: message.userId, roomId: message.roomId });
      userToSocket.set(message.userId, socket);

      log("room.user_joined", {
        roomId: message.roomId,
        userId: message.userId,
        roomSize: room.size,
      });

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

      const previous = room.get(message.userId);
      room.set(message.userId, {
        userId: message.userId,
        roomId: info.roomId,
        x: message.x,
        y: message.y,
        direction: message.direction,
        lastSeen: message.timestamp,
      });

      if (previous) {
        if (LOG_POSITION_UPDATES) {
          log("room.position_update", {
            roomId: info.roomId,
            userId: message.userId,
            x: message.x,
            y: message.y,
            direction: message.direction,
          });
        }
        broadcastToRoom(info.roomId, message);
      }
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
    }
  });

  socket.on("close", () => {
    const info = socketToUser.get(socket);
    if (!info) {
      log("ws.connection_closed", { clients: wss.clients.size });
      return;
    }

    socketToUser.delete(socket);
    userToSocket.delete(info.userId);

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
      log("room.deleted", { roomId: info.roomId });
    }

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
  });
});
