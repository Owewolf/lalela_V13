/**
 * src/components/call/IncomingCallOverlay.tsx
 *
 * Global modal shown when `incomingCall` is set in CallContext.
 * Rendered in the root layout so it appears on every screen.
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Vibration,
} from 'react-native';
import { Phone, PhoneOff, Video } from 'lucide-react-native';
import { useCall } from '../../context/CallContext';
import { THEME_COLORS } from '../../theme/colors';

const TYPE_SCALE = {
  xs: 11,
  sm: 14,
  lg: 22,
  hero: 36,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  xs: 4,
  sm: 6,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  s72: 72,
  s88: 88,
};
const RADIUS = {
  panel: 24,
  xl: 36,
  full: 44,
};

// Pulse the device while ringing
const VIBRATION_PATTERN = [0, 1000, 500];

export function IncomingCallOverlay() {
  const { incomingCall, callState, acceptCall, rejectCall } = useCall();

  const visible = callState === 'ringing' && incomingCall !== null;

  // Vibrate while visible
  React.useEffect(() => {
    if (visible) {
      Vibration.vibrate(VIBRATION_PATTERN, true);
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [visible]);

  // Auto-decline after 30 seconds
  React.useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => rejectCall(), 30000);
    return () => clearTimeout(timeout);
  }, [visible, rejectCall]);

  if (!visible || !incomingCall) return null;

  const isVideo = incomingCall.type === 'video';

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={rejectCall}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Caller avatar */}
          {incomingCall.callerAvatar ? (
            <Image source={{ uri: incomingCall.callerAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>
                {(incomingCall.callerName ?? '?')[0].toUpperCase()}
              </Text>
            </View>
          )}

          <Text style={styles.callerName}>{incomingCall.callerName}</Text>
          <Text style={styles.callTypeLabel}>
            {isVideo ? 'Incoming video call…' : 'Incoming voice call…'}
          </Text>

          {/* Actions */}
          <View style={styles.actions}>
            {/* Reject */}
            <TouchableOpacity style={[styles.btn, styles.btnReject]} onPress={rejectCall}>
              <PhoneOff size={28} color={THEME_COLORS.white} />
              <Text style={styles.btnLabel}>Decline</Text>
            </TouchableOpacity>

            {/* Accept audio (always available) */}
            <TouchableOpacity
              style={[styles.btn, styles.btnAccept]}
              onPress={() => acceptCall('audio')}
            >
              <Phone size={28} color={THEME_COLORS.white} />
              <Text style={styles.btnLabel}>Audio</Text>
            </TouchableOpacity>

            {/* Accept video (only shown when offer is a video call) */}
            {isVideo && (
              <TouchableOpacity
                style={[styles.btn, styles.btnVideo]}
                onPress={() => acceptCall('video')}
              >
                <Video size={28} color={THEME_COLORS.white} />
                <Text style={styles.btnLabel}>Video</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_75,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: THEME_COLORS.primary,
    borderTopLeftRadius: RADIUS.panel,
    borderTopRightRadius: RADIUS.panel,
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.xxl,
    paddingBottom: SPACE.xxxl,
    alignItems: 'center',
  },
  avatar: {
    width: SPACE.s88,
    height: SPACE.s88,
    borderRadius: RADIUS.full,
    marginBottom: SPACE.md,
    borderWidth: 3,
    borderColor: THEME_COLORS.secondaryContainer,
  },
  avatarPlaceholder: {
    backgroundColor: THEME_COLORS.aliasHex_1a5c6e,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: TYPE_SCALE.hero,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.surface,
  },
  callerName: {
    fontSize: TYPE_SCALE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.surface,
    marginBottom: SPACE.sm,
  },
  callTypeLabel: {
    fontSize: TYPE_SCALE.sm,
    color: THEME_COLORS.tealMuted,
    marginBottom: SPACE.xxl,
  },
  actions: {
    flexDirection: 'row',
    gap: SPACE.lg,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: SPACE.s72,
    height: SPACE.s72,
    borderRadius: RADIUS.xl,
    gap: SPACE.xs,
  },
  btnReject: {
    backgroundColor: THEME_COLORS.errorStrong,
  },
  btnAccept: {
    backgroundColor: THEME_COLORS.aliasHex_22c55e,
  },
  btnVideo: {
    backgroundColor: THEME_COLORS.brandBlue,
  },
  btnLabel: {
    fontSize: TYPE_SCALE.xs,
    color: THEME_COLORS.white,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
