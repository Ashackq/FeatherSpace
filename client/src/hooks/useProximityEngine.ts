import { useEffect, useMemo, useRef, useState } from "react";
import type { UserState } from "../types";

const GRID_FRAME_X = 60;
const GRID_FRAME_Y = 60;
const GRID_FRAME_WIDTH = 1800;
const GRID_FRAME_HEIGHT = 960;
const GRID_COLUMNS = 20;
const GRID_ROWS = 12;

export type ProximitySnapshot = {
  timestamp: number;
  nearbyUserIds: string[];
  selectedPeerIds: string[];
  newPeerIds: string[];
  lostPeerIds: string[];
  talkRadius: number;
  maxPeers: number;
};

type Position = {
  x: number;
  y: number;
};

type UseProximityEngineArgs = {
  enabled: boolean;
  localPosition: Position | null;
  remoteUsers: UserState[];
  talkRadius: number;
  maxPeers: number;
  intervalMs?: number;
};

const DEFAULT_INTERVAL_MS = 200;
const DROP_MISS_THRESHOLD = 3;

type GridCell = {
  col: number;
  row: number;
};

function positionToCell(x: number, y: number): GridCell {
  const cellWidth = GRID_FRAME_WIDTH / GRID_COLUMNS;
  const cellHeight = GRID_FRAME_HEIGHT / GRID_ROWS;
  const normalizedX = Math.min(Math.max(x, GRID_FRAME_X), GRID_FRAME_X + GRID_FRAME_WIDTH) - GRID_FRAME_X;
  const normalizedY = Math.min(Math.max(y, GRID_FRAME_Y), GRID_FRAME_Y + GRID_FRAME_HEIGHT) - GRID_FRAME_Y;
  const col = Math.min(GRID_COLUMNS - 1, Math.max(0, Math.floor(normalizedX / cellWidth)));
  const row = Math.min(GRID_ROWS - 1, Math.max(0, Math.floor(normalizedY / cellHeight)));

  return { col, row };
}

export function useProximityEngine({
  enabled,
  localPosition,
  remoteUsers,
  talkRadius,
  maxPeers,
  intervalMs = DEFAULT_INTERVAL_MS,
}: UseProximityEngineArgs): ProximitySnapshot {
  const [snapshot, setSnapshot] = useState<ProximitySnapshot>({
    timestamp: Date.now(),
    nearbyUserIds: [],
    selectedPeerIds: [],
    newPeerIds: [],
    lostPeerIds: [],
    talkRadius,
    maxPeers,
  });

  const selectedRef = useRef<string[]>([]);
  const missCountsRef = useRef<Map<string, number>>(new Map());
  const localCell = useMemo(() => {
    if (!localPosition) {
      return null;
    }

    return positionToCell(localPosition.x, localPosition.y);
  }, [localPosition]);

  useEffect(() => {
    if (!enabled || !localPosition || !localCell) {
      selectedRef.current = [];
      missCountsRef.current.clear();
      setSnapshot((current) => ({
        ...current,
        timestamp: Date.now(),
        nearbyUserIds: [],
        selectedPeerIds: [],
        newPeerIds: [],
        lostPeerIds: current.selectedPeerIds,
        talkRadius,
        maxPeers,
      }));
      return;
    }

    const tick = () => {
      const previousSelected = selectedRef.current;
      const previousSet = new Set(previousSelected);

      const ranked = remoteUsers
        .map((user) => {
          const userCell = positionToCell(user.x, user.y);
          const sameCell = userCell.col === localCell.col && userCell.row === localCell.row;
          return {
            userId: user.userId,
            sameCell,
          };
        })
        .filter((item) => item.sameCell);

      const nearbyUserIds = ranked.map((item) => item.userId);
      const immediateSelected = ranked.slice(0, maxPeers).map((item) => item.userId);

      const missCounts = missCountsRef.current;
      const immediateSet = new Set(immediateSelected);
      const selectedPeerIds = [...immediateSelected];

      previousSelected.forEach((peerId) => {
        if (immediateSet.has(peerId)) {
          missCounts.set(peerId, 0);
          return;
        }

        const misses = (missCounts.get(peerId) ?? 0) + 1;
        missCounts.set(peerId, misses);

        if (misses < DROP_MISS_THRESHOLD && selectedPeerIds.length < maxPeers) {
          selectedPeerIds.push(peerId);
        }
      });

      selectedPeerIds.forEach((peerId) => {
        if (immediateSet.has(peerId)) {
          missCounts.set(peerId, 0);
        }
      });

      const selectedSet = new Set(selectedPeerIds);
      Array.from(missCounts.keys()).forEach((peerId) => {
        if (!selectedSet.has(peerId) && !previousSet.has(peerId)) {
          missCounts.delete(peerId);
        }
      });

      const currentSet = new Set(selectedPeerIds);

      const newPeerIds = selectedPeerIds.filter((id) => !previousSet.has(id));
      const lostPeerIds = previousSelected.filter((id) => !currentSet.has(id));

      selectedRef.current = selectedPeerIds;

      setSnapshot({
        timestamp: Date.now(),
        nearbyUserIds,
        selectedPeerIds,
        newPeerIds,
        lostPeerIds,
        talkRadius,
        maxPeers,
      });
    };

    tick();
    const timer = window.setInterval(tick, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    enabled,
    intervalMs,
    localPosition,
    maxPeers,
    remoteUsers,
    talkRadius,
    localCell,
  ]);

  return snapshot;
}
