import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IncomingMessage, PositionUpdateMessage, RoomStateMessage, UserState } from "../types";

type RoomSyncState = "disabled" | "connecting" | "connected" | "error";

type RoomSyncStatus = {
  state: RoomSyncState;
  message: string;
};

type UseRoomSyncResult = {
  status: RoomSyncStatus;
  userId: string;
  remoteUsers: UserState[];
  sendPositionUpdate: (x: number, y: number, direction: number) => void;
};

const USER_ID_SESSION_KEY = "featherspace.userId.session";
const POSITION_SEND_INTERVAL_MS = 80;
const MAX_BACKOFF_MS = 8000;
const STALE_USER_THRESHOLD_MS = 12000;
const STALE_SWEEP_INTERVAL_MS = 3000;

function getOrCreateUserId(): string {
  const params = new URLSearchParams(window.location.search);
  const userOverride = params.get("user")?.trim();
  if (userOverride) {
    return userOverride;
  }

  const existing = window.sessionStorage.getItem(USER_ID_SESSION_KEY);
  if (existing) return existing;

  const generated = `user-${Math.random().toString(36).slice(2, 8)}`;
  window.sessionStorage.setItem(USER_ID_SESSION_KEY, generated);
  return generated;
}

function isRoomStateMessage(message: IncomingMessage): message is RoomStateMessage {
  return message.type === "room_state";
}

export function useRoomSync(wsUrl: string, enabled: boolean, roomId: string | undefined): UseRoomSyncResult {
  const [status, setStatus] = useState<RoomSyncStatus>({
    state: enabled && Boolean(wsUrl) && Boolean(roomId) ? "connecting" : "disabled",
    message: enabled
      ? "Connecting to room sync..."
      : "Realtime disabled. Running local simulation mode.",
  });
  const [remoteUsers, setRemoteUsers] = useState<UserState[]>([]);

  const userId = useMemo(() => getOrCreateUserId(), []);
  const socketRef = useRef<WebSocket | null>(null);
  const lastSendAtRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !wsUrl || !roomId) {
      setStatus({
        state: "disabled",
        message: "Realtime disabled. Running local simulation mode.",
      });
      setRemoteUsers([]);
      return;
    }

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    let reconnectAttempts = 0;
    stoppedRef.current = false;

    const connect = () => {
      if (stoppedRef.current) {
        return;
      }

      reconnectAttempts += 1;
      setStatus({
        state: "connecting",
        message:
          reconnectAttempts === 1
            ? "Connecting to room sync..."
            : `Reconnecting to room sync (attempt ${reconnectAttempts})...`,
      });

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttempts = 0;
        clearReconnectTimer();
        setStatus({ state: "connected", message: "Room sync connected." });
        socket.send(
          JSON.stringify({
            type: "join_room",
            roomId,
            userId,
          }),
        );
      };

      socket.onerror = () => {
        setStatus({ state: "error", message: "Room sync connection error." });
      };

      socket.onclose = () => {
        socketRef.current = null;

        if (stoppedRef.current) {
          return;
        }

        const delay = Math.min(1000 * Math.max(1, reconnectAttempts), MAX_BACKOFF_MS);
        setStatus({
          state: "error",
          message: `Room sync disconnected. Retrying in ${Math.round(delay / 1000)}s...`,
        });

        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };

      socket.onmessage = (event) => {
        let message: IncomingMessage;
        try {
          message = JSON.parse(event.data) as IncomingMessage;
        } catch {
          return;
        }

        if (isRoomStateMessage(message)) {
          setRemoteUsers(message.users.filter((user) => user.userId !== userId));
          return;
        }

        if (message.type === "position_update") {
          setRemoteUsers((current) => {
            if (message.userId === userId) return current;

            const next = [...current];
            const index = next.findIndex((user) => user.userId === message.userId);
            const updated: UserState = {
              userId: message.userId,
              roomId,
              x: message.x,
              y: message.y,
              direction: message.direction,
              lastSeen: message.timestamp,
            };

            if (index === -1) {
              next.push(updated);
            } else {
              next[index] = updated;
            }
            return next;
          });
          return;
        }

        if (message.type === "user_left") {
          setRemoteUsers((current) => current.filter((user) => user.userId !== message.userId));
        }
      };
    };

    connect();

    return () => {
      stoppedRef.current = true;
      clearReconnectTimer();
      socketRef.current?.close();
      socketRef.current = null;
      setRemoteUsers([]);
    };
  }, [enabled, roomId, userId, wsUrl]);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const timer = window.setInterval(() => {
      const now = Date.now();
      setRemoteUsers((current) =>
        current.filter((user) => now - user.lastSeen <= STALE_USER_THRESHOLD_MS),
      );
    }, STALE_SWEEP_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, roomId]);

  const sendPositionUpdate = useCallback(
    (x: number, y: number, direction: number) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !roomId) {
        return;
      }

      const now = Date.now();
      if (now - lastSendAtRef.current < POSITION_SEND_INTERVAL_MS) {
        return;
      }
      lastSendAtRef.current = now;

      const payload: PositionUpdateMessage = {
        type: "position_update",
        userId,
        x,
        y,
        direction,
        timestamp: now,
      };

      socket.send(JSON.stringify(payload));
    },
    [roomId, userId],
  );

  return {
    status,
    userId,
    remoteUsers,
    sendPositionUpdate,
  };
}
