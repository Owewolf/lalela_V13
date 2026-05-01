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
              <PhoneOff size={28} color="#fff" />
              <Text style={styles.btnLabel}>Decline</Text>
            </TouchableOpacity>

            {/* Accept audio (always available) */}
            <TouchableOpacity
              style={[styles.btn, styles.btnAccept]}
              onPress={() => acceptCall('audio')}
            >
              <Phone size={28} color="#fff" />
              <Text style={styles.btnLabel}>Audio</Text>
            </TouchableOpacity>

            {/* Accept video (only shown when offer is a video call) */}
            {isVideo && (
              <TouchableOpacity
                style={[styles.btn, styles.btnVideo]}
                onPress={() => acceptCall('video')}
              >
                <Video size={28} color="#fff" />
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
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#0d3d47',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
    alignItems: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#fc7127',
  },
  avatarPlaceholder: {
    backgroundColor: '#1a5c6e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff8f0',
  },
  callerName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff8f0',
    marginBottom: 6,
  },
  callTypeLabel: {
    fontSize: 14,
    color: '#a8c4cb',
    marginBottom: 32,
  },
  actions: {
    flexDirection: 'row',
    gap: 20,
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
    borderRadius: 36,
    gap: 4,
  },
  btnReject: {
    backgroundColor: '#ef4444',
  },
  btnAccept: {
    backgroundColor: '#22c55e',
  },
  btnVideo: {
    backgroundColor: '#3b82f6',
  },
  btnLabel: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
});
