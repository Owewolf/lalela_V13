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
import { THEME_COLORS } from '../../theme/colors';

const TYPE_SCALE = {
  xs: 10,
  sm: 14,
  md: 15,
  lg: 20,
  xl: 24,
  hero: 44,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  zero: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  s60: 60,
  s72: 72,
  s108: 108,
  s112: 112,
  s120: 120,
  s160: 160,
};
const RADIUS = {
  md: 12,
  lg: 32,
  xl: 36,
  full: 56,
};

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
        <StatusBar barStyle="light-content" backgroundColor={THEME_COLORS.primary} />
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
            <PhoneOff size={32} color={THEME_COLORS.white} />
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    );
  }

  // ── Ended state ───────────────────────────────────────────────────────────
  if (callState === 'ended') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={THEME_COLORS.primary} />
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
              <MicOff size={26} color={THEME_COLORS.white} />
            ) : (
              <Mic size={26} color={THEME_COLORS.white} />
            )}
            <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>

          {/* Hang up */}
          <TouchableOpacity style={[styles.controlBtn, styles.btnHangUp]} onPress={endCall}>
            <PhoneOff size={32} color={THEME_COLORS.white} />
            <Text style={styles.controlLabel}>End</Text>
          </TouchableOpacity>

          {/* Camera toggle (video only) */}
          {isVideo && (
            <TouchableOpacity
              style={[styles.controlBtn, !isCameraEnabled && styles.controlBtnActive]}
              onPress={toggleCamera}
            >
              {isCameraEnabled ? (
                <Camera size={26} color={THEME_COLORS.white} />
              ) : (
                <CameraOff size={26} color={THEME_COLORS.white} />
              )}
              <Text style={styles.controlLabel}>{isCameraEnabled ? 'Camera' : 'Off'}</Text>
            </TouchableOpacity>
          )}

          {/* Switch camera (video only) */}
          {isVideo && isCameraEnabled && (
            <TouchableOpacity style={styles.controlBtn} onPress={switchCamera}>
              <RefreshCw size={26} color={THEME_COLORS.white} />
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
    backgroundColor: THEME_COLORS.black,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.lg,
  },
  audioBackground: {
    backgroundColor: THEME_COLORS.primary,
  },
  bigAvatar: {
    width: SPACE.s112,
    height: SPACE.s112,
    borderRadius: RADIUS.full,
    borderWidth: 3,
    borderColor: THEME_COLORS.secondaryContainer,
  },
  bigAvatarPlaceholder: {
    backgroundColor: THEME_COLORS.aliasHex_1a5c6e,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bigAvatarInitial: {
    fontSize: TYPE_SCALE.hero,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.surface,
  },
  remoteName: {
    fontSize: TYPE_SCALE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.surface,
  },
  statusLabel: {
    fontSize: TYPE_SCALE.md,
    color: THEME_COLORS.tealMuted,
    marginTop: -8,
  },
  endedLabel: {
    fontSize: TYPE_SCALE.lg,
    fontWeight: FONT_WEIGHT.semibold,
    color: THEME_COLORS.surface,
  },
  localPreview: {
    position: 'absolute',
    bottom: SPACE.s120,
    right: SPACE.lg,
    width: SPACE.s108,
    height: SPACE.s160,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: THEME_COLORS.secondaryContainer,
    overflow: 'hidden',
  },
  controlsWrapper: {
    position: 'absolute',
    bottom: SPACE.zero,
    left: SPACE.zero,
    right: SPACE.zero,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACE.xl,
    paddingHorizontal: SPACE.xxl,
    paddingVertical: SPACE.xxl,
    backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_55,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: TYPE_SCALE.hero,
    height: TYPE_SCALE.hero,
    borderRadius: RADIUS.lg,
    backgroundColor: THEME_COLORS.alias_rgba_255_255_255_0_15,
    gap: SPACE.xs,
  },
  controlBtnActive: {
    backgroundColor: THEME_COLORS.alias_rgba_252_113_39_0_6,
  },
  btnHangUp: {
    backgroundColor: THEME_COLORS.errorStrong,
    width: SPACE.s72,
    height: SPACE.s72,
    borderRadius: RADIUS.xl,
  },
  controlLabel: {
    fontSize: TYPE_SCALE.xs,
    color: THEME_COLORS.white,
    fontWeight: FONT_WEIGHT.semibold,
  },
  timerLabel: {
    fontSize: TYPE_SCALE.sm,
    color: THEME_COLORS.tealMuted,
    fontWeight: FONT_WEIGHT.medium,
  },
  videoTimerWrapper: {
    position: 'absolute',
    top: SPACE.s60,
    alignSelf: 'center',
    zIndex: 10,
    backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_45,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
  },
  videoTimerLabel: {
    color: THEME_COLORS.white,
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
