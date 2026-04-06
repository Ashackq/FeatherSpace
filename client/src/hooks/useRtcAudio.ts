import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type MeshPositionMessage = {
  kind: "position";
  x: number;
  y: number;
  direction: number;
  timestamp: number;
};

type MeshRemoteUser = {
  userId: string;
  x: number;
  y: number;
  direction: number;
  lastSeen: number;
};

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: ["stun:stun.l.google.com:19302"] },
    { urls: ["stun:stun1.l.google.com:19302"] },
  ],
};

const MESH_POSITION_SEND_INTERVAL_MS = 66;

export function useRtcAudio({
  enabled,
  selfUserId,
  selectedPeerIds,
  lastSignal,
  sendSignal,
}: UseRtcAudioArgs): {
  peers: RtcPeerStatus[];
  meshRemoteUsers: MeshRemoteUser[];
  openMeshChannelCount: number;
  isMicEnabled: boolean;
  isSpeakerEnabled: boolean;
  isPushToTalkEnabled: boolean;
  isPushToTalkPressed: boolean;
  audioAutoplayBlocked: boolean;
  setMicEnabled: (enabled: boolean) => void;
  setSpeakerEnabled: (enabled: boolean) => void;
  setPushToTalkEnabled: (enabled: boolean) => void;
  sendMeshPosition: (x: number, y: number, direction: number) => boolean;
} {
  const [isMicEnabled, setMicEnabled] = useState(false);
  const [isSpeakerEnabled, setSpeakerEnabled] = useState(true);
  const [isPushToTalkEnabled, setPushToTalkEnabled] = useState(false);
  const [isPushToTalkPressed, setPushToTalkPressed] = useState(false);
  const [audioAutoplayBlocked, setAudioAutoplayBlocked] = useState(false);
  const [peerState, setPeerState] = useState<Record<string, RtcPeerStatus>>({});
  const [meshRemoteUsers, setMeshRemoteUsers] = useState<MeshRemoteUser[]>([]);
  const [openMeshChannelCount, setOpenMeshChannelCount] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localStreamPromiseRef = useRef<Promise<MediaStream | null> | null>(null);
  const pcRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const dataChannelRef = useRef<Map<string, RTCDataChannel>>(new Map());
  const hasAudioTrackRef = useRef<Map<string, boolean>>(new Map());
  const activePeerIdsRef = useRef<Set<string>>(new Set());
  const meshRemoteRef = useRef<Map<string, MeshRemoteUser>>(new Map());
  const lastMeshSendAtRef = useRef(0);

  const isMicTrackLive = isMicEnabled && (!isPushToTalkEnabled || isPushToTalkPressed);

  const refreshOpenMeshChannelCount = useCallback(() => {
    let openCount = 0;
    dataChannelRef.current.forEach((channel) => {
      if (channel.readyState === "open") {
        openCount += 1;
      }
    });
    setOpenMeshChannelCount(openCount);
  }, []);

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
        track.enabled = isMicTrackLive;
      });
      return localStreamRef.current;
    }

    if (localStreamPromiseRef.current) {
      return localStreamPromiseRef.current;
    }

    try {
      localStreamPromiseRef.current = navigator.mediaDevices
        .getUserMedia({ audio: true, video: false })
        .then((stream) => {
          localStreamRef.current = stream;
          localStreamRef.current.getAudioTracks().forEach((track) => {
            track.enabled = isMicTrackLive;
          });
          return localStreamRef.current;
        })
        .catch(() => null)
        .finally(() => {
          localStreamPromiseRef.current = null;
        });

      return localStreamPromiseRef.current;
    } catch {
      return null;
    }
  };

  const attachLocalTracks = async (pc: RTCPeerConnection, peerId?: string): Promise<boolean> => {
    const stream = await ensureLocalStream();
    if (!stream) {
      console.debug("[RTC] No audio stream available for peer", peerId);
      return false;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn("[RTC] Stream has no audio tracks for peer", peerId);
      return false;
    }

    let tracksAdded = false;
    audioTracks.forEach((track) => {
      track.enabled = isMicTrackLive;
      const alreadyAttached = pc
        .getSenders()
        .some((sender) => sender.track?.id === track.id);
      if (!alreadyAttached) {
        console.debug("[RTC] Adding audio track to peer connection", { peerId, trackId: track.id });
        pc.addTrack(track, stream);
        tracksAdded = true;
      }
    });

    // If tracks were added after signaling has started, renegotiate
    if (tracksAdded && pc.signalingState !== "stable" && pc.localDescription) {
      console.debug("[RTC] Audio tracks added after signaling started, will renegotiate", {
        peerId,
        signalingState: pc.signalingState,
      });
    }

    if (peerId) {
      hasAudioTrackRef.current.set(peerId, true);
    }
    return tracksAdded;
  };

  const ensurePeerConnection = async (peerId: string): Promise<RTCPeerConnection> => {
    const existing = pcRef.current.get(peerId);
    if (existing) {
      console.debug("[RTC] Reusing peer connection", { peerId });
      return existing;
    }

    console.debug("[RTC] Creating new peer connection", { peerId });
    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current.set(peerId, pc);
    hasAudioTrackRef.current.set(peerId, false);
    updatePeerState(peerId, "connecting");

    const bindDataChannel = (channel: RTCDataChannel) => {
      if (channel.label !== "mesh-position") {
        return;
      }

      dataChannelRef.current.set(peerId, channel);
      refreshOpenMeshChannelCount();

      channel.onmessage = (event) => {
        let payload: MeshPositionMessage;
        try {
          payload = JSON.parse(event.data) as MeshPositionMessage;
        } catch {
          return;
        }

        if (payload.kind !== "position") {
          return;
        }

        const nextUser: MeshRemoteUser = {
          userId: peerId,
          x: payload.x,
          y: payload.y,
          direction: payload.direction,
          lastSeen: payload.timestamp,
        };

        meshRemoteRef.current.set(peerId, nextUser);
        setMeshRemoteUsers(Array.from(meshRemoteRef.current.values()));
      };

      channel.onclose = () => {
        dataChannelRef.current.delete(peerId);
        refreshOpenMeshChannelCount();
      };

      channel.onopen = () => {
        refreshOpenMeshChannelCount();
      };
    };

    if (selfUserId < peerId) {
      bindDataChannel(
        pc.createDataChannel("mesh-position", {
          ordered: false,
          maxRetransmits: 0,
        }),
      );
    }

    pc.ondatachannel = (event) => {
      bindDataChannel(event.channel);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.debug("[RTC] ICE candidate", { peerId, candidate: event.candidate.candidate });
        sendSignal(peerId, {
          kind: "ice",
          candidate: event.candidate.toJSON(),
        });
      } else {
        console.debug("[RTC] ICE gathering complete", { peerId });
      }
    };

    pc.onicegatheringstatechange = () => {
      console.debug("[RTC] ICE gathering state", {
        peerId,
        state: pc.iceGatheringState,
      });
    };

    pc.oniceconnectionstatechange = () => {
      console.debug("[RTC] ICE connection state", {
        peerId,
        state: pc.iceConnectionState,
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.debug("[RTC] Connection state change", { peerId, state, signalingState: pc.signalingState });
      if (state === "connected") {
        console.info("[RTC] ✓ Peer connection CONNECTED", { peerId });
        updatePeerState(peerId, "connected");
      } else if (state === "failed") {
        console.warn("[RTC] ✗ Peer connection FAILED", { peerId, iceConnectionState: pc.iceConnectionState });
        updatePeerState(peerId, "failed");
        console.debug("[RTC] Attempting ICE restart...");
        pc.restartIce();
      } else if (state === "closed" || state === "disconnected") {
        console.warn("[RTC] Peer connection closed/disconnected", { peerId, state });
        updatePeerState(peerId, "closed");
      }
    };

    pc.ontrack = (event) => {
      console.debug("[RTC] Received remote track", { peerId, trackKind: event.track.kind });
      const [stream] = event.streams;
      if (!stream) {
        return;
      }

      let audio = remoteAudioRef.current.get(peerId);
      if (!audio) {
        audio = document.createElement("audio");
        audio.autoplay = true;
        audio.setAttribute("playsinline", "true");
        remoteAudioRef.current.set(peerId, audio);
      }

      audio.srcObject = stream;
      audio.muted = !isSpeakerEnabled;

      if (isSpeakerEnabled) {
        void audio.play().catch((err) => {
          console.warn("[RTC] Audio autoplay failed, browser may require user gesture", {
            peerId,
            error: (err as Error)?.message,
          });
          setAudioAutoplayBlocked(true);
        });
      }
    };

    await attachLocalTracks(pc, peerId);
    return pc;
  };

  const closePeerConnection = (peerId: string) => {
    console.debug("[RTC] Closing peer connection", { peerId });
    const pc = pcRef.current.get(peerId);
    if (!pc) return;

    pc.close();
    pcRef.current.delete(peerId);
    pendingIceRef.current.delete(peerId);
    hasAudioTrackRef.current.delete(peerId);
    dataChannelRef.current.delete(peerId);
    meshRemoteRef.current.delete(peerId);
    setMeshRemoteUsers(Array.from(meshRemoteRef.current.values()));
    refreshOpenMeshChannelCount();

    const audio = remoteAudioRef.current.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      remoteAudioRef.current.delete(peerId);
    }

    updatePeerState(peerId, "closed");
  };

  useEffect(() => {
    if (!enabled) {
      activePeerIdsRef.current = new Set();
      return;
    }

    const normalizedSelected = selectedPeerIds.filter((peerId) => peerId !== selfUserId);
    const selectedSet = new Set(normalizedSelected);
    const previousSet = activePeerIdsRef.current;
    const newPeerIds = normalizedSelected.filter((peerId) => !previousSet.has(peerId));

    const connectOrRefreshPeer = async (peerId: string, isNewPeer: boolean) => {
      const pc = await ensurePeerConnection(peerId);
      const tracksAdded = await attachLocalTracks(pc, peerId);

      const shouldOffer =
        selfUserId < peerId &&
        pc.signalingState === "stable" &&
        (isNewPeer || tracksAdded);

      if (shouldOffer) {
        console.debug("[RTC] Creating offer for peer", {
          peerId,
          isNewPeer,
          tracksAdded,
          hasAudioTrack: hasAudioTrackRef.current.get(peerId),
        });
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
        });
        console.debug("[RTC] Offer SDP generated", {
          peerId,
          hasAudio: offer.sdp?.includes("m=audio"),
          lines: offer.sdp?.split("\n").length,
        });
        await pc.setLocalDescription(offer);
        console.debug("[RTC] Offer set as local description, sending...", { peerId });
        sendSignal(peerId, {
          kind: "offer",
          sdp: offer,
        });
      }
    };

    newPeerIds.forEach((peerId) => {
      void connectOrRefreshPeer(peerId, true);
    });

    Array.from(pcRef.current.keys()).forEach((peerId) => {
      if (!selectedSet.has(peerId)) {
        closePeerConnection(peerId);
      }
    });

    activePeerIdsRef.current = selectedSet;
  }, [enabled, selfUserId, selectedPeerIds]);

  useEffect(() => {
    if (!lastSignal || !enabled) {
      return;
    }

    const handleSignal = async () => {
      const peerId = lastSignal.fromUser;
      const payload = (lastSignal.payload ?? {}) as SignalPayload;
      console.debug("[RTC] Received signal", { peerId, kind: payload.kind });
      const pc = await ensurePeerConnection(peerId);

      if (payload.kind === "offer" && payload.sdp) {
        console.debug("[RTC] Processing offer", {
          peerId,
          hasAudio: payload.sdp.sdp?.includes("m=audio"),
        });
        if (pc.signalingState !== "stable") {
          try {
            await pc.setLocalDescription({ type: "rollback" } as RTCSessionDescriptionInit);
          } catch {
            return;
          }
        }

        await pc.setRemoteDescription(payload.sdp);
        console.debug("[RTC] Remote description set, applying pending ICE candidates", {
          peerId,
          pending: pendingIceRef.current.get(peerId)?.length ?? 0,
        });

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
        console.debug("[RTC] Answer created and set, sending back...", { peerId });
        sendSignal(peerId, {
          kind: "answer",
          sdp: answer,
        });
        return;
      }

      if (payload.kind === "answer" && payload.sdp) {
        console.debug("[RTC] Processing answer", { peerId });
        await pc.setRemoteDescription(payload.sdp);
        console.debug("[RTC] Remote description (answer) set, applying pending ICE candidates", {
          peerId,
          pending: pendingIceRef.current.get(peerId)?.length ?? 0,
        });

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
        console.debug("[RTC] Mic enabled, updating tracks across all connections");
        const stream = await ensureLocalStream();
        if (stream) {
          const audioTracks = stream.getAudioTracks();
          if (audioTracks.length === 0) {
            console.warn("[RTC] Mic enabled but stream has no audio tracks");
            return;
          }

          console.debug("[RTC] Audio stream ready", {
            trackCount: audioTracks.length,
          });

          audioTracks.forEach((track) => {
            track.enabled = isMicTrackLive;
          });

          let needsRenegotiation = false;
          for (const [peerId, pc] of pcRef.current.entries()) {
            const tracksAdded = await attachLocalTracks(pc, peerId);
            if (!tracksAdded) {
              continue;
            }

            if (pc.signalingState === "stable" && selfUserId < peerId) {
              console.debug("[RTC] Tracks added on stable connection, sending renegotiation offer", {
                peerId,
                signalingState: pc.signalingState,
              });
              const offer = await pc.createOffer({
                offerToReceiveAudio: true,
              });
              await pc.setLocalDescription(offer);
              sendSignal(peerId, {
                kind: "offer",
                sdp: offer,
              });
              continue;
            }

            console.debug("[RTC] Tracks added while not stable, will restart ICE", {
              peerId,
              signalingState: pc.signalingState,
            });
            needsRenegotiation = true;
          }

          // If we're the offerer and need renegotiation, restart the connection
          if (needsRenegotiation) {
            console.debug("[RTC] Restarting ICE to trigger renegotiation");
            for (const pc of pcRef.current.values()) {
              if (pc.signalingState !== "stable") {
                pc.restartIce();
              }
            }
          }
        }
        return;
      }

      console.debug("[RTC] Mic disabled, disabling audio tracks");
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
    };

    void updateTracks();
  }, [enabled, isMicEnabled, isMicTrackLive]);

  useEffect(() => {
    remoteAudioRef.current.forEach((audio) => {
      audio.muted = !isSpeakerEnabled;
      if (isSpeakerEnabled) {
        void audio.play().catch(() => {
          setAudioAutoplayBlocked(true);
        });
      }
    });
  }, [isSpeakerEnabled]);

  useEffect(() => {
    if (!enabled || !isPushToTalkEnabled || !isMicEnabled) {
      setPushToTalkPressed(false);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTypingTarget) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        setPushToTalkPressed(true);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        setPushToTalkPressed(false);
      }
    };

    const onBlur = () => {
      setPushToTalkPressed(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, isMicEnabled, isPushToTalkEnabled]);

  useEffect(() => {
    return () => {
      pcRef.current.forEach((pc) => pc.close());
      pcRef.current.clear();
      pendingIceRef.current.clear();
      dataChannelRef.current.forEach((channel) => channel.close());
      dataChannelRef.current.clear();
      setOpenMeshChannelCount(0);
      meshRemoteRef.current.clear();
      setMeshRemoteUsers([]);
      remoteAudioRef.current.forEach((audio) => {
        audio.pause();
        audio.srcObject = null;
      });
      remoteAudioRef.current.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    };
  }, []);

  const peers = useMemo(() => {
    return Object.values(peerState).sort((a, b) => a.peerId.localeCompare(b.peerId));
  }, [peerState]);

  const sendMeshPosition = useCallback(
    (x: number, y: number, direction: number) => {
      if (!enabled) {
        return false;
      }

      const now = Date.now();
      if (now - lastMeshSendAtRef.current < MESH_POSITION_SEND_INTERVAL_MS) {
        return false;
      }
      lastMeshSendAtRef.current = now;

      const payload: MeshPositionMessage = {
        kind: "position",
        x,
        y,
        direction,
        timestamp: now,
      };

      const body = JSON.stringify(payload);
      let sentCount = 0;
      dataChannelRef.current.forEach((channel) => {
        if (channel.readyState === "open") {
          channel.send(body);
          sentCount += 1;
        }
      });

      return sentCount > 0;
    },
    [enabled],
  );

  return {
    peers,
    meshRemoteUsers,
    openMeshChannelCount,
    isMicEnabled,
    isSpeakerEnabled,
    isPushToTalkEnabled,
    isPushToTalkPressed,
    audioAutoplayBlocked,
    setMicEnabled,
    setSpeakerEnabled,
    setPushToTalkEnabled,
    sendMeshPosition,
  };
}
