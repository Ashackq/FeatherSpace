// useObjectSync: React hook for synchronizing shared object state in a room.
//
// Provides helpers to access, emit, and count object state records for collaborative objects (e.g. whiteboards).
// Designed to be used with the room sync and object event system.

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
  // Count the number of objects in the current state
  const objectCount = useMemo(() => Object.keys(objectStates).length, [objectStates]);

  // Get a specific object's state by ID
  const getObjectState = useCallback(
    (objectId: string) => {
      return objectStates[objectId] ?? null;
    },
    [objectStates],
  );

  // Emit an action for a specific object (if enabled)
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
