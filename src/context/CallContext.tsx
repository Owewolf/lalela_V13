/**
 * src/context/CallContext.tsx
 *
 * Global call state for WebRTC P2P calls.
 * Wraps the WebRTCCall class and exposes:
 *   - incomingCall  — populated when a remote user rings us
 *   - callState     — 'idle' | 'ringing' | 'connected' | 'ended'
 *   - localStream / remoteStream  — live MediaStream references
 *   - startCall / acceptCall / rejectCall / endCall
 *   - toggleMute / toggleCamera / switchCamera
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useRouter } from 'expo-router';
import type { MediaStream } from 'react-native-webrtc';
import { getSocket } from '../lib/socket';
import { WebRTCCall, type CallType } from '../lib/webrtc';
import { useAuth } from './AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IncomingCall {
  caller: string;       // remote userId
  callerName: string;
  callerAvatar?: string;
  sdp: any;
  type: CallType;
}

export type CallState = 'idle' | 'ringing' | 'connected' | 'ended';

interface CallContextValue {
  incomingCall: IncomingCall | null;
  callState: CallState;
  activeCallType: CallType;
  isMuted: boolean;
  isCameraEnabled: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** Initiate an outgoing call */
  startCall: (
    remoteUserId: string,
    remoteName: string,
    type: CallType,
    conversationId: string,
  ) => Promise<void>;
  /** Accept an incoming call (navigates to CallScreen) */
  acceptCall: (type?: CallType) => Promise<void>;
  /** Reject an incoming call without answering */
  rejectCall: () => void;
  /** Hang up an active or outgoing call */
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const CallContext = createContext<CallContextValue | undefined>(undefined);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used inside <CallProvider>');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userProfile } = useAuth();
  const router = useRouter();

  const webrtcRef = useRef<WebRTCCall | null>(null);

  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [activeCallType, setActiveCallType] = useState<CallType>('audio');
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  // Pending incoming offer — stored here until user accepts
  const pendingOffer = useRef<IncomingCall | null>(null);

  // ── Socket + WebRTC initialisation ────────────────────────────────────────
  useEffect(() => {
    if (!userProfile?.id) return;

    let mounted = true;

    const setup = async () => {
      try {
        const socket = await getSocket();
        if (!mounted) return;

        const call = new WebRTCCall(socket, userProfile.id);
        webrtcRef.current = call;

        call.registerSocketHandlers(
          // onIncomingRing — show ringing UI before SDP arrives
          (data) => {
            if (!mounted) return;
            setIncomingCall({
              caller: data.caller,
              callerName: data.callerName,
              sdp: null,
              type: data.type,
            });
            setCallState('ringing');
          },
          // onIncomingCall — SDP offer received, update with full offer
          (data) => {
            if (!mounted) return;
            const full: IncomingCall = {
              caller: data.caller,
              callerName: data.callerName,
              sdp: data.sdp,
              type: data.type,
            };
            pendingOffer.current = full;
            setIncomingCall(full);
            setCallState('ringing');
          },
          // onCallEnded — remote hung up
          () => {
            if (!mounted) return;
            cleanupStreams();
            setCallState('ended');
          },
          // onCallRejected — remote rejected
          () => {
            if (!mounted) return;
            cleanupStreams();
            setCallState('ended');
          },
        );
      } catch (e) {
        console.warn('[CallContext] socket init error:', e);
      }
    };

    setup();

    return () => {
      mounted = false;
      webrtcRef.current?.unregisterSocketHandlers();
    };
  }, [userProfile?.id]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const cleanupStreams = useCallback(() => {
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraEnabled(true);
    pendingOffer.current = null;
  }, []);

  // ── Public API ─────────────────────────────────────────────────────────────

  const startCall = useCallback(
    async (
      remoteUserId: string,
      remoteName: string,
      type: CallType,
      conversationId: string,
    ) => {
      if (!webrtcRef.current || !userProfile?.id) return;
      if (callState !== 'idle') return;

      setActiveCallType(type);
      setCallState('ringing'); // "Calling…" state for the caller

      try {
        await webrtcRef.current.startCall(
          remoteUserId,
          remoteName,
          (stream) => setLocalStream(stream),
          (stream) => {
            setRemoteStream(stream);
            setCallState('connected');
          },
          type,
        );

        router.push({
          pathname: '/call/[id]',
          params: {
            id: conversationId,
            remoteUserId,
            remoteName,
            callType: type,
            isIncoming: '0',
          },
        } as any);
      } catch (e) {
        console.error('[CallContext] startCall error:', e);
        cleanupStreams();
        setCallState('idle');
      }
    },
    [callState, userProfile, router, cleanupStreams],
  );

  const acceptCall = useCallback(
    async (overrideType?: CallType) => {
      const offer = pendingOffer.current;
      if (!offer || !webrtcRef.current) return;

      const type = overrideType ?? offer.type;
      setActiveCallType(type);
      setIncomingCall(null);

      try {
        await webrtcRef.current.answerCall(
          offer.caller,
          offer.sdp,
          (stream) => setLocalStream(stream),
          (stream) => {
            setRemoteStream(stream);
            setCallState('connected');
          },
          type,
        );

        router.push({
          pathname: '/call/[id]',
          params: {
            id: offer.caller,
            remoteUserId: offer.caller,
            remoteName: offer.callerName,
            callType: type,
            isIncoming: '1',
          },
        } as any);
      } catch (e) {
        console.error('[CallContext] acceptCall error:', e);
        cleanupStreams();
        setCallState('idle');
      }
    },
    [router, cleanupStreams],
  );

  const rejectCall = useCallback(() => {
    const offer = pendingOffer.current ?? incomingCall;
    if (offer?.caller) {
      webrtcRef.current?.rejectCall(offer.caller);
    }
    setIncomingCall(null);
    pendingOffer.current = null;
    setCallState('idle');
  }, [incomingCall]);

  const endCall = useCallback(() => {
    webrtcRef.current?.endCall();
    cleanupStreams();
    setCallState('ended');
    // Brief pause so CallScreen can show "Call ended" before navigating away
    setTimeout(() => {
      setCallState('idle');
      router.canGoBack() && router.back();
    }, 1500);
  }, [router, cleanupStreams]);

  const toggleMute = useCallback(() => {
    const next = !isMuted;
    webrtcRef.current?.setMuted(next);
    setIsMuted(next);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    const next = !isCameraEnabled;
    webrtcRef.current?.setCameraEnabled(next);
    setIsCameraEnabled(next);
  }, [isCameraEnabled]);

  const switchCamera = useCallback(() => {
    webrtcRef.current?.switchCamera();
  }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <CallContext.Provider
      value={{
        incomingCall,
        callState,
        activeCallType,
        isMuted,
        isCameraEnabled,
        localStream,
        remoteStream,
        startCall,
        acceptCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
        switchCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
