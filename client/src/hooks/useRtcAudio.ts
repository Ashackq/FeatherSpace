import { useEffect, useMemo, useRef, useState } from "react";
import type { IncomingSignalEvent } from "./useRoomSync";

export type PeerConnectionState = "idle" | "connecting" | "connected" | "failed" | "closed";

export type RtcPeerStatus = {
  peerId: string;
  state: PeerConnectionState;
  updatedAt: number;
};

type UseRtcAudioArgs = {
  enabled: boolean;
  selfUserId: string;
  selectedPeerIds: string[];
  lastSignal: IncomingSignalEvent | null;
  sendSignal: (targetUser: string, payload: Record<string, unknown>) => void;
};

type SignalPayload = {
  kind?: "offer" | "answer" | "ice";
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
};

export function useRtcAudio({
  enabled,
  selfUserId,
  selectedPeerIds,
  lastSignal,
  sendSignal,
}: UseRtcAudioArgs): {
  peers: RtcPeerStatus[];
  isMicEnabled: boolean;
  setMicEnabled: (enabled: boolean) => void;
} {
  const [isMicEnabled, setMicEnabled] = useState(false);
  const [peerState, setPeerState] = useState<Record<string, RtcPeerStatus>>({});

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());

  const updatePeerState = (peerId: string, state: PeerConnectionState) => {
    setPeerState((current) => ({
      ...current,
      [peerId]: {
        peerId,
        state,
        updatedAt: Date.now(),
      },
    }));
  };

  const ensureLocalStream = async (): Promise<MediaStream | null> => {
    if (!isMicEnabled || !enabled) {
      return null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMicEnabled;
      });
      return localStreamRef.current;
    }

    try {
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMicEnabled;
      });
      return localStreamRef.current;
    } catch {
      return null;
    }
  };

  const attachLocalTracks = async (pc: RTCPeerConnection) => {
    const stream = await ensureLocalStream();
    if (!stream) return;

    stream.getAudioTracks().forEach((track) => {
      track.enabled = isMicEnabled;
      const alreadyAttached = pc
        .getSenders()
        .some((sender) => sender.track?.id === track.id);
      if (!alreadyAttached) {
        pc.addTrack(track, stream);
      }
    });
  };

  const ensurePeerConnection = async (peerId: string): Promise<RTCPeerConnection> => {
    const existing = pcRef.current.get(peerId);
    if (existing) {
      return existing;
    }

    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current.set(peerId, pc);
    updatePeerState(peerId, "connecting");

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal(peerId, {
          kind: "ice",
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") {
        updatePeerState(peerId, "connected");
      } else if (state === "failed") {
        updatePeerState(peerId, "failed");
        pc.restartIce();
      } else if (state === "closed" || state === "disconnected") {
        updatePeerState(peerId, "closed");
      }
    };

    await attachLocalTracks(pc);
    return pc;
  };

  const closePeerConnection = (peerId: string) => {
    const pc = pcRef.current.get(peerId);
    if (!pc) return;

    pc.close();
    pcRef.current.delete(peerId);
    pendingIceRef.current.delete(peerId);
    updatePeerState(peerId, "closed");
  };

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const selectedSet = new Set(selectedPeerIds);

    selectedPeerIds.forEach(async (peerId) => {
      if (peerId === selfUserId) return;
      const pc = await ensurePeerConnection(peerId);
      await attachLocalTracks(pc);

      if (selfUserId < peerId && pc.signalingState === "stable") {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
        });
        await pc.setLocalDescription(offer);
        sendSignal(peerId, {
          kind: "offer",
          sdp: offer,
        });
      }
    });

    Array.from(pcRef.current.keys()).forEach((peerId) => {
      if (!selectedSet.has(peerId)) {
        closePeerConnection(peerId);
      }
    });
  }, [enabled, selfUserId, selectedPeerIds]);

  useEffect(() => {
    if (!lastSignal || !enabled) {
      return;
    }

    const handleSignal = async () => {
      const peerId = lastSignal.fromUser;
      const payload = (lastSignal.payload ?? {}) as SignalPayload;
      const pc = await ensurePeerConnection(peerId);

      if (payload.kind === "offer" && payload.sdp) {
        if (pc.signalingState !== "stable") {
          try {
            await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
          } catch {
            return;
          }
        }

        await pc.setRemoteDescription(payload.sdp);

        const pendingCandidates = pendingIceRef.current.get(peerId) ?? [];
        for (const candidate of pendingCandidates) {
          try {
            await pc.addIceCandidate(candidate);
          } catch {
            // ignore per-candidate failures
          }
        }
        pendingIceRef.current.delete(peerId);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal(peerId, {
          kind: "answer",
          sdp: answer,
        });
        return;
      }

      if (payload.kind === "answer" && payload.sdp) {
        await pc.setRemoteDescription(payload.sdp);

        const pendingCandidates = pendingIceRef.current.get(peerId) ?? [];
        for (const candidate of pendingCandidates) {
          try {
            await pc.addIceCandidate(candidate);
          } catch {
            // ignore per-candidate failures
          }
        }
        pendingIceRef.current.delete(peerId);
        return;
      }

      if (payload.kind === "ice" && payload.candidate) {
        if (!pc.remoteDescription) {
          const pending = pendingIceRef.current.get(peerId) ?? [];
          pending.push(payload.candidate);
          pendingIceRef.current.set(peerId, pending);
          return;
        }

        try {
          await pc.addIceCandidate(payload.candidate);
        } catch {
          // Ignore transient ICE ordering issues while peer setup stabilizes.
        }
      }
    };

    void handleSignal();
  }, [enabled, lastSignal]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const updateTracks = async () => {
      if (isMicEnabled) {
        const stream = await ensureLocalStream();
        if (stream) {
          stream.getAudioTracks().forEach((track) => {
            track.enabled = true;
          });

          for (const pc of pcRef.current.values()) {
            await attachLocalTracks(pc);
          }
        }
        return;
      }

      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    };

    void updateTracks();
  }, [enabled, isMicEnabled]);

  useEffect(() => {
    return () => {
      pcRef.current.forEach((pc) => pc.close());
      pcRef.current.clear();
      pendingIceRef.current.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    };
  }, []);

  const peers = useMemo(() => {
    return Object.values(peerState).sort((a, b) => a.peerId.localeCompare(b.peerId));
  }, [peerState]);

  return {
    peers,
    isMicEnabled,
    setMicEnabled,
  };
}
