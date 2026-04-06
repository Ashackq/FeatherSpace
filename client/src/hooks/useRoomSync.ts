import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  IncomingMessage,
  ObjectEventMessage,
  ObjectStateRecord,
  PositionUpdateMessage,
  RoomStateMessage,
  UserState,
} from "../types";

type RoomSyncState = "disabled" | "connecting" | "connected" | "error";

type RoomSyncStatus = {
  state: RoomSyncState;
  message: string;
};

export type IncomingSignalEvent = {
  fromUser: string;
  payload: Record<string, unknown>;
  receivedAt: number;
};

type UseRoomSyncResult = {
  status: RoomSyncStatus;
  userId: string;
  remoteUsers: UserState[];
  lastSignal: IncomingSignalEvent | null;
  objectStates: Record<string, ObjectStateRecord>;
  lastObjectStateUpdate: {
    roomId: string;
    objectId: string;
    action: string;
    updatedAt: number;
    updatedBy: string;
  } | null;
  sendPositionUpdate: (x: number, y: number, direction: number) => void;
  sendSignal: (targetUser: string, payload: Record<string, unknown>) => void;
  sendObjectEvent: (objectId: string, action: string, payload?: Record<string, unknown>) => void;
};

const USER_ID_SESSION_KEY = "featherspace.userId.session";
const PRESENCE_SESSION_KEY = "featherspace.presence.session";
const POSITION_SEND_INTERVAL_MS = 80;
const MAX_BACKOFF_MS = 8000;
const DEFAULT_DIRECTION = 0;

type PresenceBootstrap = {
  x: number;
  y: number;
  direction: number;
};

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deriveDefaultSpawn(roomId: string | undefined, userId: string): PresenceBootstrap {
  const seed = hashSeed(`${roomId ?? "default"}:${userId}`);
  const x = 140 + (seed % 360);
  const y = 120 + ((seed >>> 8) % 240);
  return { x, y, direction: DEFAULT_DIRECTION };
}

function getStoredPresence(roomId: string | undefined, userId: string): PresenceBootstrap | null {
  try {
    const raw = window.sessionStorage.getItem(PRESENCE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      roomId?: string;
      userId?: string;
      x?: number;
      y?: number;
      direction?: number;
    };

    if (parsed.roomId !== roomId || parsed.userId !== userId) {
      return null;
    }

    if (
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      typeof parsed.direction !== "number"
    ) {
      return null;
    }

    return {
      x: parsed.x,
      y: parsed.y,
      direction: parsed.direction,
    };
  } catch {
    return null;
  }
}

function storePresence(roomId: string | undefined, userId: string, presence: PresenceBootstrap): void {
  try {
    window.sessionStorage.setItem(
      PRESENCE_SESSION_KEY,
      JSON.stringify({
        roomId,
        userId,
        ...presence,
      }),
    );
  } catch {
    // Best-effort cache only.
  }
}

function getOrCreateUserId(): string {
  const params = new URLSearchParams(window.location.search);
  const userOverride = params.get("user")?.trim();
  if (userOverride) {
    window.sessionStorage.setItem(USER_ID_SESSION_KEY, userOverride);
    return userOverride;
  }

  const existing = window.sessionStorage.getItem(USER_ID_SESSION_KEY);
  if (existing) {
    return existing;
  }

  const generated = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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
  const [lastSignal, setLastSignal] = useState<IncomingSignalEvent | null>(null);
  const [objectStates, setObjectStates] = useState<Record<string, ObjectStateRecord>>({});
  const [lastObjectStateUpdate, setLastObjectStateUpdate] = useState<{
    roomId: string;
    objectId: string;
    action: string;
    updatedAt: number;
    updatedBy: string;
  } | null>(null);

  const userId = useMemo(() => getOrCreateUserId(), []);
  const socketRef = useRef<WebSocket | null>(null);
  const lastSendAtRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);
  const bootstrapPresenceRef = useRef<PresenceBootstrap>(
    getStoredPresence(roomId, userId) ?? deriveDefaultSpawn(roomId, userId),
  );

  useEffect(() => {
    bootstrapPresenceRef.current =
      getStoredPresence(roomId, userId) ?? deriveDefaultSpawn(roomId, userId);
  }, [roomId, userId]);

  useEffect(() => {
    if (!enabled || !wsUrl || !roomId) {
      setStatus({
        state: "disabled",
        message: "Realtime disabled. Running local simulation mode.",
      });
      setRemoteUsers([]);
      setObjectStates({});
      setLastObjectStateUpdate(null);
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
            x: bootstrapPresenceRef.current.x,
            y: bootstrapPresenceRef.current.y,
            direction: bootstrapPresenceRef.current.direction,
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
          return;
        }

        if (message.type === "signal") {
          setLastSignal({
            fromUser: message.fromUser,
            payload: message.payload,
            receivedAt: Date.now(),
          });
          return;
        }

        if (message.type === "object_state_snapshot") {
          const nextState: Record<string, ObjectStateRecord> = {};
          message.states.forEach((entry) => {
            nextState[entry.objectId] = entry;
          });
          setObjectStates(nextState);
          return;
        }

        if (message.type === "object_state_update") {
          setObjectStates((current) => ({
            ...current,
            [message.objectId]: {
              objectId: message.objectId,
              state: message.state,
              updatedAt: message.updatedAt,
              updatedBy: message.updatedBy,
            },
          }));
          setLastObjectStateUpdate({
            roomId: message.roomId,
            objectId: message.objectId,
            action: message.action,
            updatedAt: message.updatedAt,
            updatedBy: message.updatedBy,
          });
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
      setLastSignal(null);
      setObjectStates({});
      setLastObjectStateUpdate(null);
    };
  }, [enabled, roomId, userId, wsUrl]);

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

      bootstrapPresenceRef.current = { x, y, direction };
      storePresence(roomId, userId, bootstrapPresenceRef.current);

      socket.send(JSON.stringify(payload));
    },
    [roomId, userId],
  );

  const sendSignal = useCallback((targetUser: string, payload: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }

    socket.send(
      JSON.stringify({
        type: "signal",
        targetUser,
        payload,
      }),
    );
  }, []);

  const sendObjectEvent = useCallback(
    (objectId: string, action: string, payload?: Record<string, unknown>) => {
      const socket = socketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !roomId) {
        return;
      }

      const event: ObjectEventMessage = {
        type: "object_event",
        roomId,
        objectId,
        action,
        payload,
        timestamp: Date.now(),
      };

      socket.send(JSON.stringify(event));
    },
    [roomId],
  );

  return {
    status,
    userId,
    remoteUsers,
    lastSignal,
    objectStates,
    lastObjectStateUpdate,
    sendPositionUpdate,
    sendSignal,
    sendObjectEvent,
  };
}
