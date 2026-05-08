import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IncomingSignalEvent } from "./useRoomSync";
import { runtimeConfig } from "../config/runtime";
import { Debug } from "../utils/debug";

export type PeerConnectionState = "idle" | "connecting" | "connected" | "failed" | "closed";

export type RtcPeerStatus = {
  peerId: string;
  state: PeerConnectionState;
  updatedAt: number;
};

type UseRtcAudioArgs = {
  enabled: boolean;
  selfUserId: string;
  roomScopeId: string;
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

const MESH_POSITION_SEND_INTERVAL_MS = 66;
const RTC_REPAIR_INTERVAL_MS = 4000;
const RTC_OFFER_RETRY_COOLDOWN_MS = 12000;
const RTC_STALE_CONNECTION_TIMEOUT_MS = 15000;

export function useRtcAudio({
  enabled,
  selfUserId,
  roomScopeId,
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
  const offerInFlightRef = useRef<Set<string>>(new Set());
  const lastOfferAtRef = useRef<Map<string, number>>(new Map());
  const missingAudioLoggedRef = useRef<Set<string>>(new Set());
  const peerCreatedAtRef = useRef<Map<string, number>>(new Map());

  // Refs to avoid stale closures in long-lived callbacks (ontrack, ensureLocalStream, etc.)
  const isMicEnabledRef = useRef(isMicEnabled);
  const isSpeakerEnabledRef = useRef(isSpeakerEnabled);
  const isMicTrackLiveRef = useRef(false);

  const rtcConfig = useMemo<RTCConfiguration>(() => {
    return {
      iceServers: runtimeConfig.rtcIceServers,
      iceTransportPolicy: runtimeConfig.rtcIceTransportPolicy,
      iceCandidatePoolSize: runtimeConfig.rtcIceCandidatePoolSize,
    };
  }, []);

  const isMicTrackLive = isMicEnabled && (!isPushToTalkEnabled || isPushToTalkPressed);

  // Keep refs in sync every render so long-lived callbacks always see current values
  isMicEnabledRef.current = isMicEnabled;
  isSpeakerEnabledRef.current = isSpeakerEnabled;
  isMicTrackLiveRef.current = isMicTrackLive;

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
    if (!isMicEnabledRef.current || !enabled) {
      return null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMicTrackLiveRef.current;
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
            track.enabled = isMicTrackLiveRef.current;
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
      if (peerId && !missingAudioLoggedRef.current.has(peerId)) {
        console.debug("[RTC] No audio stream available for peer", peerId);
        missingAudioLoggedRef.current.add(peerId);
      }
      return false;
    }

    if (peerId) {
      missingAudioLoggedRef.current.delete(peerId);
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn("[RTC] Stream has no audio tracks for peer", peerId);
      return false;
    }

    let tracksAdded = false;
    audioTracks.forEach((track) => {
      track.enabled = isMicTrackLiveRef.current;
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
      Debug.rtc.peerState(peerId, "reused");
      return existing;
    }

    Debug.rtc.peerCreated(peerId, { iceServers: runtimeConfig.rtcIceServers.length });
    const pc = new RTCPeerConnection(rtcConfig);
    pc.addTransceiver("audio", { direction: "sendrecv" });
    pcRef.current.set(peerId, pc);
    peerCreatedAtRef.current.set(peerId, Date.now());
    hasAudioTrackRef.current.set(peerId, false);
    updatePeerState(peerId, "connecting");
    hasAudioTrackRef.current.set(peerId, false);

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
        Debug.rtc.meshPositionReceived(peerId, payload.x, payload.y, payload.direction);
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
        Debug.rtc.meshChannelClosed(peerId);
        dataChannelRef.current.delete(peerId);
        refreshOpenMeshChannelCount();
      };

      channel.onopen = () => {
        Debug.rtc.meshChannelOpened(peerId);
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
        Debug.rtc.iceCandidate(peerId, event.candidate.candidate, event.candidate.candidate.split(" ")[7]);
        sendSignal(peerId, {
          kind: "ice",
          candidate: event.candidate.toJSON(),
        });
      } else {
        Debug.rtc.iceGatheringState(peerId, "complete");
      }
    };

    pc.onicegatheringstatechange = () => {
      Debug.rtc.iceGatheringState(peerId, pc.iceGatheringState);
    };

    pc.oniceconnectionstatechange = () => {
      Debug.rtc.iceConnectionState(peerId, pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      const createdAt = peerCreatedAtRef.current.get(peerId) ?? Date.now();
      const elapsed = Date.now() - createdAt;
      Debug.rtc.connectionState(peerId, state, elapsed);
      
      if (state === "connected") {
        updatePeerState(peerId, "connected");
      } else if (state === "failed") {
        updatePeerState(peerId, "failed");
        Debug.rtc.signalError(peerId, "connection_failed");
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
        // Append to DOM so browsers honour autoplay after user gesture
        audio.style.display = "none";
        document.body.appendChild(audio);
        remoteAudioRef.current.set(peerId, audio);
      }

      audio.srcObject = stream;
      // Read from ref to avoid stale closure
      audio.muted = !isSpeakerEnabledRef.current;

      void audio.play().catch((err) => {
        console.error("[RTC] Audio play error", peerId, (err as Error).message);
        setAudioAutoplayBlocked(true);
      });
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
    Debug.rtc.peerConnectionClosed(peerId, pc.connectionState);
    hasAudioTrackRef.current.delete(peerId);
    dataChannelRef.current.delete(peerId);
    meshRemoteRef.current.delete(peerId);
    setMeshRemoteUsers(Array.from(meshRemoteRef.current.values()));
    refreshOpenMeshChannelCount();

    // Clear all per-peer throttle/guard state so re-entering proximity
    // triggers a fresh connection cycle instead of being blocked by stale timers.
    lastOfferAtRef.current.delete(peerId);
    offerInFlightRef.current.delete(peerId);
    peerCreatedAtRef.current.delete(peerId);
    missingAudioLoggedRef.current.delete(peerId);

    const audio = remoteAudioRef.current.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      remoteAudioRef.current.delete(peerId);
    }

    updatePeerState(peerId, "closed");
  };

  const connectOrRefreshPeer = useCallback(
    async (peerId: string, isNewPeer: boolean) => {
      if (offerInFlightRef.current.has(peerId)) {
        return;
      }

      const pc = await ensurePeerConnection(peerId);
      const tracksAdded = await attachLocalTracks(pc, peerId);
      const hasLocalAudioTrack = hasAudioTrackRef.current.get(peerId) === true;

      const shouldOffer =
        selfUserId < peerId &&
        pc.signalingState === "stable" &&
        (isNewPeer || tracksAdded || pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected");

      if (!shouldOffer) {
        return;
      }

      // Allow throttled retries even without local audio so datachannel and remote audio setup can recover.
      // Mic tracks can still be attached later once user enables microphone.

      const lastOfferAt = lastOfferAtRef.current.get(peerId) ?? 0;
      if (Date.now() - lastOfferAt < RTC_OFFER_RETRY_COOLDOWN_MS) {
        return;
      }

      offerInFlightRef.current.add(peerId);
      lastOfferAtRef.current.set(peerId, Date.now());

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
        });
        Debug.rtc.offerGenerated(peerId, offer.sdp);
        await pc.setLocalDescription(offer);
        Debug.rtc.offerSent(peerId, offerInFlightRef.current.size);
        sendSignal(peerId, {
          kind: "offer",
          sdp: offer,
        });
      } catch (error) {
        Debug.rtc.signalError(peerId, (error as Error).message);
      } finally {
        offerInFlightRef.current.delete(peerId);
      }
    },
    [selfUserId, sendSignal],
  );

  useEffect(() => {
    activePeerIdsRef.current = new Set();
    pcRef.current.forEach((pc) => pc.close());
    pcRef.current.clear();
    pendingIceRef.current.clear();
    dataChannelRef.current.forEach((channel) => channel.close());
    dataChannelRef.current.clear();
    meshRemoteRef.current.clear();
    setMeshRemoteUsers([]);
    refreshOpenMeshChannelCount();

    remoteAudioRef.current.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    remoteAudioRef.current.clear();

    setPeerState({});
  }, [roomScopeId, refreshOpenMeshChannelCount]);

  useEffect(() => {
    if (!enabled) {
      activePeerIdsRef.current = new Set();
      return;
    }

    const normalizedSelected = selectedPeerIds.filter((peerId) => peerId !== selfUserId);
    const selectedSet = new Set(normalizedSelected);
    const previousSet = activePeerIdsRef.current;
    const newPeerIds = normalizedSelected.filter((peerId) => !previousSet.has(peerId));
    const lostPeerIds = Array.from(previousSet).filter((peerId) => !selectedSet.has(peerId));

    if (newPeerIds.length > 0) {
      console.debug("[RTC] Peers entered proximity", { newPeerIds, totalSelected: normalizedSelected.length });
    }

    if (lostPeerIds.length > 0) {
      console.debug("[RTC] Peers left proximity", { lostPeerIds, totalSelected: normalizedSelected.length });
    }

    newPeerIds.forEach((peerId) => {
      void connectOrRefreshPeer(peerId, true);
    });

    Array.from(pcRef.current.keys()).forEach((peerId) => {
      if (!selectedSet.has(peerId)) {
        closePeerConnection(peerId);
      }
    });

    activePeerIdsRef.current = selectedSet;
  }, [enabled, selfUserId, selectedPeerIds, connectOrRefreshPeer]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const tickRepair = () => {
      const normalizedSelected = selectedPeerIds.filter((peerId) => peerId !== selfUserId);

      normalizedSelected.forEach((peerId) => {
        const pc = pcRef.current.get(peerId);
        if (!pc) {
          void connectOrRefreshPeer(peerId, true);
          return;
        }

        const createdAt = peerCreatedAtRef.current.get(peerId) ?? Date.now();
        const timeElapsed = Date.now() - createdAt;
        const isStaleNewConnection =
          pc.connectionState === "new" &&
          !pc.remoteDescription &&
          timeElapsed > RTC_STALE_CONNECTION_TIMEOUT_MS;
        const isStaleConnectingConnection =
          pc.connectionState === "connecting" &&
          timeElapsed > RTC_STALE_CONNECTION_TIMEOUT_MS;

        if (isStaleNewConnection || isStaleConnectingConnection) {
          Debug.rtc.staleConnectionDetected(peerId, pc.connectionState, RTC_STALE_CONNECTION_TIMEOUT_MS);
          Debug.rtc.connectionRecoveryAttempt(peerId, "stale_connection_timeout");
          closePeerConnection(peerId);
          void connectOrRefreshPeer(peerId, true);
          return;
        }

        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          Debug.rtc.connectionRecoveryAttempt(peerId, pc.connectionState);
          closePeerConnection(peerId);
          void connectOrRefreshPeer(peerId, true);
          return;
        }

        if (pc.connectionState === "disconnected") {
          Debug.rtc.connectionRecoveryAttempt(peerId, "restart_ice");
          pc.restartIce();
        }
      });
    };

    const timer = window.setInterval(tickRepair, RTC_REPAIR_INTERVAL_MS);
    tickRepair();

    return () => {
      window.clearInterval(timer);
    };
  }, [enabled, selfUserId, selectedPeerIds, connectOrRefreshPeer]);

  useEffect(() => {
    if (!lastSignal || !enabled) {
      return;
    }

    const handleSignal = async () => {
      const peerId = lastSignal.fromUser;
      const payload = (lastSignal.payload ?? {}) as SignalPayload;
      console.debug("[RTC] Received signal", { peerId, kind: payload.kind });
      Debug.ws.signalReceived(peerId, payload.kind ?? "unknown");
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
        Debug.rtc.answerReceived(peerId, answer.sdp);
        sendSignal(peerId, {
          kind: "answer",
          sdp: answer,
        });
        return;
      }

      if (payload.kind === "answer" && payload.sdp) {
        await pc.setRemoteDescription(payload.sdp);

        // Drain any ICE candidates that arrived before the answer
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

            if (pc.signalingState === "stable") {
              console.debug("[RTC] Tracks added on stable connection, sending renegotiation offer", {
                peerId,
                signalingState: pc.signalingState,
              });

              try {
                const offer = await pc.createOffer({
                  offerToReceiveAudio: true,
                });
                await pc.setLocalDescription(offer);
                sendSignal(peerId, {
                  kind: "offer",
                  sdp: offer,
                });
                continue;
              } catch (error) {
                Debug.rtc.signalError(peerId, (error as Error).message);
              }
            }

            console.debug("[RTC] Tracks added while not stable, will restart ICE", {
              peerId,
              signalingState: pc.signalingState,
            });
            needsRenegotiation = true;
          }

          // If signaling is already in progress, restart ICE so negotiation can recover.
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
        audio.remove();
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
      dataChannelRef.current.forEach((channel, peerId) => {
        if (channel.readyState === "open") {
          Debug.rtc.meshPositionSent(peerId, x, y, direction);
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
