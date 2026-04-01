import { useCallback, useMemo } from "react";
import type { ObjectStateRecord } from "../types";

type UseObjectSyncArgs = {
  enabled: boolean;
  objectStates: Record<string, ObjectStateRecord>;
  lastObjectStateUpdate: {
    roomId: string;
    objectId: string;
    action: string;
    updatedAt: number;
    updatedBy: string;
  } | null;
  sendObjectEvent: (objectId: string, action: string, payload?: Record<string, unknown>) => void;
};

export function useObjectSync({
  enabled,
  objectStates,
  lastObjectStateUpdate,
  sendObjectEvent,
}: UseObjectSyncArgs): {
  objectStates: Record<string, ObjectStateRecord>;
  objectCount: number;
  lastObjectStateUpdate: {
    roomId: string;
    objectId: string;
    action: string;
    updatedAt: number;
    updatedBy: string;
  } | null;
  getObjectState: (objectId: string) => ObjectStateRecord | null;
  emitObjectAction: (objectId: string, action: string, payload?: Record<string, unknown>) => void;
} {
  const objectCount = useMemo(() => Object.keys(objectStates).length, [objectStates]);

  const getObjectState = useCallback(
    (objectId: string) => {
      return objectStates[objectId] ?? null;
    },
    [objectStates],
  );

  const emitObjectAction = useCallback(
    (objectId: string, action: string, payload?: Record<string, unknown>) => {
      if (!enabled) {
        return;
      }
      sendObjectEvent(objectId, action, payload);
    },
    [enabled, sendObjectEvent],
  );

  return {
    objectStates,
    objectCount,
    lastObjectStateUpdate,
    getObjectState,
    emitObjectAction,
  };
}
