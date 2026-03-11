import express from "express";
import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, UserState } from "./types.js";

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const PORT = Number(process.env.PORT ?? 8080);

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
  } catch {``
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

wss.on("connection", (socket) => {
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

      socket.send(
        JSON.stringify({
          type: "room_state",
          users: Array.from(room.values()),
        }),
      );

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
        broadcastToRoom(info.roomId, message);
      }
      return;
    }

    if (message.type === "signal") {
      const sender = socketToUser.get(socket);
      if (!sender) return;

      const targetSocket = userToSocket.get(message.targetUser);
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
    if (!info) return;

    socketToUser.delete(socket);
    userToSocket.delete(info.userId);

    const room = rooms.get(info.roomId);
    if (!room) return;

    room.delete(info.userId);
    broadcastToRoom(info.roomId, {
      type: "user_left",
      userId: info.userId,
    });

    if (room.size === 0) {
      rooms.delete(info.roomId);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
