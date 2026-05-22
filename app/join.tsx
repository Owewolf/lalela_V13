import { useEffect } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../src/context/AuthContext';
import { useCommunity } from '../src/context/CommunityContext';

// Handles "lalela://join?join=<code>" deep links routed by Expo Router.
// - Existing fully-onboarded users: join immediately and go back to tabs.
// - New / incomplete users: save the code and proceed to onboarding/landing.
export default function JoinRoute() {
  const { join, code } = useLocalSearchParams<{ join?: string; code?: string }>();
  const inviteCode = (join ?? code ?? null) as string | null;
  const { userProfile, loading } = useAuth();
  const user = userProfile ? { uid: userProfile.id } : null;
  const { joinViaInviteLink } = useCommunity();
  const router = useRouter();

  // ── Step 1: Save the code immediately on mount, before loading resolves ──
  // This ensures AppGuard routing to /onboarding finds the code in AsyncStorage
  // even if it fires before Step 2 below.
  useEffect(() => {
    if (inviteCode) {
      AsyncStorage.setItem('pendingOnboardingInvite', inviteCode);
    }
  }, [inviteCode]);

  // ── Step 2: Once auth resolves, decide the final route ────────────────────
  useEffect(() => {
    if (loading) return;

    const process = async () => {
      if (!inviteCode) {
        router.replace(user ? '/(tabs)' : '/landing');
        return;
      }

      if (user && userProfile?.profileCompleted) {
        // Existing onboarded user — join silently, then drop back to tabs
        try {
          await joinViaInviteLink(inviteCode);
          await AsyncStorage.removeItem('pendingOnboardingInvite');
          Alert.alert('Joined!', 'You have successfully joined the community.');
        } catch (e: any) {
          Alert.alert('Could not join', e?.message ?? 'Invalid or expired invite link.');
        }
        router.replace('/(tabs)');
      } else {
        // New or incomplete user — carry the code in the URL so Onboarding.tsx
        // reads it synchronously from params (eliminates AsyncStorage race condition)
        if (user) {
          router.replace(`/onboarding?join=${inviteCode}` as any);
        } else {
          router.replace(`/landing?join=${inviteCode}` as any);
        }
      }
    };

    process();
  }, [loading, user, userProfile, inviteCode]);

  return <View style={{ flex: 1, backgroundColor: '#0d3d47' }} />;
}
