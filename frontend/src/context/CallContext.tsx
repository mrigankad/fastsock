import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';
import type { WSEvent } from '../types';
import { chatApi } from '../services/api';

type CallStatus = 'idle' | 'incoming' | 'outgoing' | 'active';

type RTCSessionDescriptionJSON = {
  type: RTCSdpType;
  sdp?: string;
};

type RTCIceCandidateJSON = {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
};

type IncomingCall = {
  callId: string;
  fromUserId: number;
  roomId?: number;
  offer: RTCSessionDescriptionJSON;
};

type CallAcceptOptions = {
  video?: boolean;
};

interface CallContextType {
  status: CallStatus;
  peerUserId: number | null;
  callId: string | null;
  incomingCall: IncomingCall | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (toUserId: number, roomId?: number) => Promise<void>;
  acceptCall: (options?: CallAcceptOptions) => Promise<void>;
  rejectCall: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  isAccepting: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
}

const CallContext = createContext<CallContextType | null>(null);

const defaultIceServers: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302'] },
];

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Unknown error';
};

const getMediaErrorMessage = (err: unknown) => {
  const name = err instanceof DOMException ? err.name : undefined;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Permission denied for camera/microphone';
  if (name === 'NotFoundError') return 'No camera/microphone found';
  if (name === 'NotReadableError') return 'Device in use (close other apps using camera/mic)';
  if (name === 'AbortError') return 'Could not start video source';
  return getErrorMessage(err);
};

const acquireMedia = async (wantVideo: boolean) => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo });
    return { stream, video: wantVideo };
  } catch (err) {
    if (wantVideo) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        return { stream, video: false };
      } catch {
        throw err;
      }
    }
    throw err;
  }
};

export const CallProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { send, subscribe, isConnected } = useChat();

  const [status, setStatus] = useState<CallStatus>('idle');
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [peerUserId, setPeerUserId] = useState<number | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [iceServers, setIceServers] = useState<RTCIceServer[]>(defaultIceServers);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingRemoteCandidatesRef = useRef<RTCIceCandidateJSON[]>([]);
  const callIdRef = useRef<string | null>(null);
  const peerUserIdRef = useRef<number | null>(null);
  const isAcceptingRef = useRef(false);

  const resetMediaAndPeer = useCallback(() => {
    pendingRemoteCandidatesRef.current = [];

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
  }, [localStream]);

  const cleanup = useCallback(() => {
    pendingRemoteCandidatesRef.current = [];
    callIdRef.current = null;
    peerUserIdRef.current = null;

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
    }

    setLocalStream(null);
    setRemoteStream(null);
    setIncomingCall(null);
    setCallId(null);
    setPeerUserId(null);
    setStatus('idle');
    setIsMuted(false);
    setIsCameraOff(false);
  }, [localStream]);

  const ensurePeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({ iceServers });
    pcRef.current = pc;

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      if (!callIdRef.current || !peerUserIdRef.current) return;

      const candidate = ev.candidate.toJSON() as RTCIceCandidateJSON;
      send('call.ice', { call_id: callIdRef.current, to_user_id: peerUserIdRef.current, candidate });
    };

    pc.ontrack = (ev) => {
      const stream = ev.streams[0];
      if (stream) setRemoteStream(stream);
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'failed' || st === 'closed' || st === 'disconnected') {
        if (status !== 'idle') {
          cleanup();
        }
      }
    };

    return pc;
  }, [iceServers, send, status, cleanup]);

  const startCall = useCallback(async (toUserId: number, roomId?: number) => {
    if (!user) return;
    if (!isConnected) {
      toast.error('Not connected');
      return;
    }
    if (status !== 'idle') {
      toast.error('Already in a call');
      return;
    }
    try {
      const newCallId = crypto.randomUUID();
      callIdRef.current = newCallId;
      peerUserIdRef.current = toUserId;
      setCallId(newCallId);
      setStatus('outgoing');
      setPeerUserId(toUserId);

      const { stream, video } = await acquireMedia(true);
      setLocalStream(stream);
      setIsCameraOff(!video);

      if (!video) {
        toast.error('Camera is busy/unavailable. Starting an audio-only call.');
      }

      const pc = ensurePeerConnection();
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const payload = {
        call_id: newCallId,
        to_user_id: toUserId,
        room_id: roomId,
        sdp_offer: { type: offer.type, sdp: offer.sdp } as RTCSessionDescriptionJSON,
        media: { audio: true, video },
      };

      send('call.invite', payload);
    } catch (err) {
      toast.error(`Could not start call: ${getMediaErrorMessage(err)}`);
      cleanup();
    }
  }, [cleanup, ensurePeerConnection, isConnected, send, status, user]);

  const acceptCall = useCallback(async (options?: CallAcceptOptions) => {
    if (!user) return;
    if (!incomingCall) return;
    if (!isConnected) {
      toast.error('Not connected');
      return;
    }
    if (status !== 'incoming') return;

    if (isAcceptingRef.current) return;
    isAcceptingRef.current = true;
    setIsAccepting(true);

    try {
      callIdRef.current = incomingCall.callId;
      peerUserIdRef.current = incomingCall.fromUserId;
      setCallId(incomingCall.callId);
      setPeerUserId(incomingCall.fromUserId);

      const pc = ensurePeerConnection();

      const wantVideo = options?.video !== false;
      const { stream, video } = await acquireMedia(wantVideo);
      setLocalStream(stream);
      setIsCameraOff(!video);

      if (wantVideo && !video) {
        toast.error('Camera is busy/unavailable. Accepting as audio-only.');
      }
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(incomingCall.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      while (pendingRemoteCandidatesRef.current.length > 0) {
        const c = pendingRemoteCandidatesRef.current.shift();
        if (!c) continue;
        await pc.addIceCandidate(c);
      }

      send('call.accept', {
        call_id: incomingCall.callId,
        to_user_id: incomingCall.fromUserId,
        sdp_answer: { type: answer.type, sdp: answer.sdp } as RTCSessionDescriptionJSON,
        media: { audio: true, video },
      });

      setIncomingCall(null);
      setStatus('active');
    } catch (err) {
      toast.error(`Could not accept call: ${getMediaErrorMessage(err)}`);
      resetMediaAndPeer();
    } finally {
      isAcceptingRef.current = false;
      setIsAccepting(false);
    }
  }, [ensurePeerConnection, incomingCall, isConnected, resetMediaAndPeer, send, status, user]);

  const rejectCall = useCallback(() => {
    if (!incomingCall) return;
    send('call.reject', { call_id: incomingCall.callId, to_user_id: incomingCall.fromUserId });
    cleanup();
  }, [cleanup, incomingCall, send]);

  const hangup = useCallback(() => {
    if (callId && peerUserId) {
      send('call.hangup', { call_id: callId, to_user_id: peerUserId });
    } else if (incomingCall) {
      send('call.hangup', { call_id: incomingCall.callId, to_user_id: incomingCall.fromUserId });
    }
    cleanup();
  }, [callId, cleanup, incomingCall, peerUserId, send]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      if (localStream) localStream.getAudioTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  }, [localStream]);

  const toggleCamera = useCallback(() => {
    setIsCameraOff(prev => {
      const next = !prev;
      if (localStream) localStream.getVideoTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  }, [localStream]);

  useEffect(() => {
    if (!user) cleanup();
  }, [cleanup, user]);

  useEffect(() => {
    if (!user) return;
    chatApi.getIceServers()
      .then(({ data }) => {
        if (Array.isArray(data.ice_servers) && data.ice_servers.length > 0) {
          setIceServers(data.ice_servers);
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    const unsub = subscribe((msg: WSEvent) => {
      if (typeof msg.event !== 'string') return;
      if (!msg.event.startsWith('call.')) return;

      const data = msg.data as Record<string, unknown>;

      if (msg.event === 'call.error') {
        const message = typeof data.message === 'string' ? data.message : 'Call failed';
        toast.error(message);
        cleanup();
        return;
      }

      const incomingCallId = data.call_id as string | undefined;
      const fromUserId = data.from_user_id as number | undefined;

      if (msg.event === 'call.invite') {
        if (typeof incomingCallId !== 'string' || typeof fromUserId !== 'number') return;
        const offer = data.sdp_offer as RTCSessionDescriptionJSON | undefined;
        if (!offer) return;

        if (status !== 'idle') {
          send('call.busy', { call_id: incomingCallId, to_user_id: fromUserId });
          return;
        }

        callIdRef.current = incomingCallId;
        peerUserIdRef.current = fromUserId;
        setIncomingCall({
          callId: incomingCallId,
          fromUserId,
          roomId: typeof data.room_id === 'number' ? data.room_id : undefined,
          offer,
        });
        setStatus('incoming');
        setCallId(incomingCallId);
        setPeerUserId(fromUserId);
        return;
      }

      if (typeof incomingCallId !== 'string') return;
      if (callId && incomingCallId !== callId) return;

      if (msg.event === 'call.accept') {
        const answer = data.sdp_answer as RTCSessionDescriptionJSON | undefined;
        if (!answer) return;
        const pc = ensurePeerConnection();
        pc.setRemoteDescription(answer)
          .then(async () => {
            while (pendingRemoteCandidatesRef.current.length > 0) {
              const c = pendingRemoteCandidatesRef.current.shift();
              if (!c) continue;
              await pc.addIceCandidate(c);
            }
          })
          .catch((err) => {
            toast.error(`Call setup failed: ${getErrorMessage(err)}`);
            cleanup();
          });
        setStatus('active');
        return;
      }

      if (msg.event === 'call.ice') {
        const candidate = data.candidate as RTCIceCandidateJSON | undefined;
        if (!candidate) return;
        const pc = pcRef.current;
        if (!pc || !pc.remoteDescription) {
          pendingRemoteCandidatesRef.current.push(candidate);
          return;
        }
        pc.addIceCandidate(candidate).catch((err) => {
          toast.error(`ICE candidate failed: ${getErrorMessage(err)}`);
        });
        return;
      }

      if (msg.event === 'call.reject' || msg.event === 'call.hangup' || msg.event === 'call.busy') {
        cleanup();
        return;
      }
    });

    return () => unsub();
  }, [callId, cleanup, ensurePeerConnection, send, status, subscribe]);

  const value = useMemo<CallContextType>(() => ({
    status,
    peerUserId,
    callId,
    incomingCall,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    rejectCall,
    hangup,
    toggleMute,
    toggleCamera,
    isAccepting,
    isMuted,
    isCameraOff,
  }), [
    acceptCall,
    callId,
    hangup,
    incomingCall,
    isAccepting,
    isCameraOff,
    isMuted,
    localStream,
    peerUserId,
    rejectCall,
    remoteStream,
    startCall,
    status,
    toggleCamera,
    toggleMute,
  ]);

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within a CallProvider');
  return context;
};
