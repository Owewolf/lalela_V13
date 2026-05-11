import { useLocalSearchParams, useRouter } from 'expo-router';
import { BackHandler } from 'react-native';
import React, { useEffect } from 'react';
import { CallScreen } from '../../src/components/call/CallScreen';
import { useCall } from '../../src/context/CallContext';

/**
 * app/call/[id].tsx
 *
 * Route params:
 *   id            — conversationId (used as the route segment)
 *   remoteUserId  — app user id of the remote party
 *   remoteName    — Display name shown in the call UI
 *   remoteAvatar  — (optional) profile image URL
 *   callType      — 'audio' | 'video'
 *   isIncoming    — '1' if this is an answered incoming call, '0' for outgoing
 */
export default function CallRoute() {
  const { remoteName, remoteAvatar, callType } = useLocalSearchParams<{
    id: string;
    remoteUserId: string;
    remoteName: string;
    remoteAvatar?: string;
    callType: 'audio' | 'video';
    isIncoming: '0' | '1';
  }>();

  const { endCall } = useCall();
  const router = useRouter();

  // Hardware back button hangs up rather than navigating back mid-call
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      endCall();
      return true;
    });
    return () => sub.remove();
  }, [endCall]);

  return (
    <CallScreen
      remoteName={remoteName ?? 'Unknown'}
      remoteAvatar={remoteAvatar}
      callType={callType ?? 'audio'}
    />
  );
}
