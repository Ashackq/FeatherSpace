import { useEffect, useMemo, useRef, useState } from "react";
import type { UserState } from "../types";

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
const RETAIN_RADIUS_FACTOR = 1.15;
const DROP_MISS_THRESHOLD = 3;

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
  const radiusSquared = useMemo(() => talkRadius * talkRadius, [talkRadius]);
  const retainRadiusSquared = useMemo(
    () => talkRadius * talkRadius * RETAIN_RADIUS_FACTOR * RETAIN_RADIUS_FACTOR,
    [talkRadius],
  );

  useEffect(() => {
    if (!enabled || !localPosition) {
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
          const dx = user.x - localPosition.x;
          const dy = user.y - localPosition.y;
          const distanceSquared = dx * dx + dy * dy;
          return {
            userId: user.userId,
            distanceSquared,
          };
        })
        .filter((item) => {
          if (item.distanceSquared <= radiusSquared) {
            return true;
          }

          // Keep previously selected peers slightly beyond radius to reduce edge flapping.
          return previousSet.has(item.userId) && item.distanceSquared <= retainRadiusSquared;
        })
        .sort((a, b) => a.distanceSquared - b.distanceSquared);

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
    radiusSquared,
    remoteUsers,
    retainRadiusSquared,
    talkRadius,
  ]);

  return snapshot;
}
