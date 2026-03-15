import { useEffect, useRef, useState } from "react";

type RealtimeState = "disabled" | "connecting" | "connected" | "reconnecting" | "error";

type RealtimeStatus = {
  state: RealtimeState;
  message: string;
  attempts: number;
};

const MAX_BACKOFF_MS = 8000;

export function useRealtimeStatus(wsUrl: string, enabled: boolean): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>({
    state: enabled ? "connecting" : "disabled",
    message: enabled ? "Connecting to realtime backend..." : "Realtime disabled for this deployment",
    attempts: 0,
  });

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !wsUrl) {
      setStatus({
        state: "disabled",
        message: "Realtime unavailable. Running in local workspace mode.",
        attempts: 0,
      });
      return;
    }

    let attempts = 0;

    const clearReconnectTimer = () => {
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };

    const connect = () => {
      if (stoppedRef.current) return;

      attempts += 1;
      setStatus((current) => ({
        state: attempts === 1 ? "connecting" : "reconnecting",
        message:
          attempts === 1
            ? "Connecting to realtime backend..."
            : `Reconnecting to realtime backend (attempt ${attempts})...`,
        attempts,
      }));

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus({
          state: "connected",
          message: "Realtime backend connected",
          attempts,
        });
      };

      socket.onerror = () => {
        setStatus({
          state: "error",
          message: "Realtime connection error. Retrying...",
          attempts,
        });
      };

      socket.onclose = () => {
        if (stoppedRef.current) return;

        const delay = Math.min(1000 * attempts, MAX_BACKOFF_MS);
        setStatus((current) => ({
          state: current.state === "connected" ? "reconnecting" : "error",
          message: `Realtime disconnected. Retrying in ${Math.round(delay / 1000)}s...`,
          attempts,
        }));

        clearReconnectTimer();
        reconnectTimerRef.current = window.setTimeout(connect, delay);
      };
    };

    stoppedRef.current = false;
    connect();

    return () => {
      stoppedRef.current = true;
      clearReconnectTimer();
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [enabled, wsUrl]);

  return status;
}
