/**
 * src/components/call/CallScreen.tsx
 *
 * Full-screen active/ringing call UI.
 *
 * States rendered:
 *   ringing   → avatar + "Calling <name>…" + hang-up button
 *   connected → RTCView streams + mute / camera / switch-camera / hang-up controls
 *   ended     → "Call ended" message (auto-dismissed by CallContext after 1.5 s)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import {
  PhoneOff,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  RefreshCw,
} from 'lucide-react-native';
import { useCall } from '../../context/CallContext';

// Lazy-load RTCView so the module doesn't crash in Expo Go (no native WebRTC).
let RTCView: React.ComponentType<any>;
try {
  RTCView = require('react-native-webrtc').RTCView;
} catch {
  // Fallback: plain View used in Expo Go / environments without native WebRTC.
  RTCView = (({ style }: { style?: any }) => <View style={style} />) as React.ComponentType<any>;
}

interface CallScreenProps {
  remoteName: string;
  remoteAvatar?: string;
  callType: 'audio' | 'video';
}

export function CallScreen({ remoteName, remoteAvatar, callType }: CallScreenProps) {
  const {
    callState,
    isMuted,
    isCameraEnabled,
    localStream,
    remoteStream,
    endCall,
    toggleMute,
    toggleCamera,
    switchCamera,
  } = useCall();

  const isVideo = callType === 'video';

  // ── Call duration timer ───────────────────────────────────────────────────
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (callState !== 'connected') {
      setDuration(0);
      return;
    }
    const interval = setInterval(() => setDuration((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [callState]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ── Ringing / calling state ───────────────────────────────────────────────
  if (callState === 'ringing') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0d3d47" />
        <SafeAreaView style={styles.centered}>
          {remoteAvatar ? (
            <Image source={{ uri: remoteAvatar }} style={styles.bigAvatar} />
          ) : (
            <View style={[styles.bigAvatar, styles.bigAvatarPlaceholder]}>
              <Text style={styles.bigAvatarInitial}>
                {(remoteName ?? '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.remoteName}>{remoteName}</Text>
          <Text style={styles.statusLabel}>Calling…</Text>

          <TouchableOpacity style={[styles.controlBtn, styles.btnHangUp]} onPress={endCall}>
            <PhoneOff size={32} color="#fff" />
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Ended state ───────────────────────────────────────────────────────────
  if (callState === 'ended') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0d3d47" />
        <SafeAreaView style={styles.centered}>
          <Text style={styles.endedLabel}>Call ended</Text>
        </SafeAreaView>
      </View>
    );
  }

  // ── Connected state ───────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="black" />

      {/* Remote stream (full screen for video, black bg for audio) */}
      {/* Duration timer (video call — shown over remote stream) */}
      {isVideo && callState === 'connected' && (
        <View style={styles.videoTimerWrapper} pointerEvents="none">
          <Text style={styles.videoTimerLabel}>{formatDuration(duration)}</Text>
        </View>
      )}

      {isVideo && remoteStream ? (
        <RTCView
          streamURL={(remoteStream as any).toURL()}
          style={StyleSheet.absoluteFill}
          objectFit="cover"
          mirror={false}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.audioBackground]}>
          <SafeAreaView style={styles.centered}>
            {remoteAvatar ? (
              <Image source={{ uri: remoteAvatar }} style={styles.bigAvatar} />
            ) : (
              <View style={[styles.bigAvatar, styles.bigAvatarPlaceholder]}>
                <Text style={styles.bigAvatarInitial}>
                  {(remoteName ?? '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.remoteName}>{remoteName}</Text>
          <Text style={styles.timerLabel}>{formatDuration(duration)}</Text>
          </SafeAreaView>
        </View>
      )}

      {/* Local preview (video only, picture-in-picture) */}
      {isVideo && localStream && isCameraEnabled && (
        <RTCView
          streamURL={(localStream as any).toURL()}
          style={styles.localPreview}
          objectFit="cover"
          mirror
        />
      )}

      {/* Controls bar */}
      <SafeAreaView style={styles.controlsWrapper} pointerEvents="box-none">
        <View style={styles.controls}>
          {/* Mute */}
          <TouchableOpacity
            style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
            onPress={toggleMute}
          >
            {isMuted ? (
              <MicOff size={26} color="#fff" />
            ) : (
              <Mic size={26} color="#fff" />
            )}
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          {/* Hang up */}
          <TouchableOpacity style={[styles.controlBtn, styles.btnHangUp]} onPress={endCall}>
            <PhoneOff size={32} color="#fff" />
            <Text style={styles.controlLabel}>End</Text>
          </TouchableOpacity>

          {/* Camera toggle (video only) */}
          {isVideo && (
            <TouchableOpacity
              style={[styles.controlBtn, !isCameraEnabled && styles.controlBtnActive]}
              onPress={toggleCamera}
            >
              {isCameraEnabled ? (
                <Camera size={26} color="#fff" />
              ) : (
                <CameraOff size={26} color="#fff" />
              )}
              <Text style={styles.controlLabel}>{isCameraEnabled ? 'Camera' : 'Off'}</Text>
            </TouchableOpacity>
          )}

          {/* Switch camera (video only) */}
          {isVideo && isCameraEnabled && (
            <TouchableOpacity style={styles.controlBtn} onPress={switchCamera}>
              <RefreshCw size={26} color="#fff" />
              <Text style={styles.controlLabel}>Flip</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  audioBackground: {
    backgroundColor: '#0d3d47',
  },
  bigAvatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    borderColor: '#fc7127',
  },
  bigAvatarPlaceholder: {
    backgroundColor: '#1a5c6e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigAvatarInitial: {
    fontSize: 44,
    fontWeight: '700',
    color: '#fff8f0',
  },
  remoteName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff8f0',
  },
  statusLabel: {
    fontSize: 15,
    color: '#a8c4cb',
    marginTop: -8,
  },
  endedLabel: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff8f0',
  },
  localPreview: {
    position: 'absolute',
    bottom: 120,
    right: 16,
    width: 108,
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#fc7127',
    overflow: 'hidden',
  },
  controlsWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 24,
    paddingVertical: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    gap: 4,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(252,113,39,0.6)',
  },
  btnHangUp: {
    backgroundColor: '#ef4444',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  controlLabel: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  timerLabel: {
    fontSize: 14,
    color: '#a8c4cb',
    fontWeight: '500',
  },
  videoTimerWrapper: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  videoTimerLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
