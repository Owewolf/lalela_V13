import '../global.css';
import { useEffect, useRef } from 'react';
import { Platform, Alert, View, StyleSheet, LogBox } from 'react-native';

// GooglePlacesAutocomplete uses a FlatList internally (nestedScrollEnabled is already set).
// This warning is a false positive in the form layout context.
LogBox.ignoreLogs(['VirtualizedLists should never be nested']);
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { CommunityProvider, useCommunity } from '../src/context/CommunityContext';
import { GoogleMapsProvider } from '../src/context/GoogleMapsContext';
import { CallProvider } from '../src/context/CallContext';
import { IncomingCallOverlay } from '../src/components/call/IncomingCallOverlay';


// ─── Parse lalela://join?join=<code> ────────────────────────────────────────

function parseJoinCode(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = Linking.parse(url);
    return (parsed.queryParams?.join as string) ?? (parsed.queryParams?.code as string) ?? null;
  } catch {
    return null;
  }
}

function getNotificationsModule() {
  return require('expo-notifications');
}

// ─── Push notification token registration ───────────────────────────────────

async function registerForPushNotifications(): Promise<string | null> {
  try {
    const Notifications = getNotificationsModule();
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'LaLela',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#fc7127',
      });
    }

    const tokenData = await Notifications.getDevicePushTokenAsync();
    return tokenData.data;
  } catch {
    return null;
  }
}

// ─── Inner guard — runs inside all context providers ────────────────────────

function AppGuard() {
  const { userProfile, loading, registerPushToken, signOut } = useAuth();
  // Map to legacy `user` shape used in this component
  const user = userProfile ? { uid: userProfile.id, email: userProfile.email, emailVerified: true, providerData: [] as any[] } : null;
  const { joinViaInviteLink } = useCommunity();
  const segments = useSegments();
  const router = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const inLanding = segments[0] === 'landing';
  const inOnboarding = segments[0] === 'onboarding' || segments[0] === 'onboarding-create';
  const inAuthGroup = inLanding || inOnboarding;

  // Set notification handler once on mount
  useEffect(() => {
    if (inAuthGroup) return;

    const Notifications = getNotificationsModule();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }, [inAuthGroup]);

  // ── Auth routing ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (loading) return;

    if (!user) {
      if (!inAuthGroup) router.replace('/landing');
      return;
    }

    // (Email verification enforced server-side via JWT — no client-side check needed)

    if (userProfile === null) return;

    const onboardingComplete = userProfile.profile_completed === true;

    if (!onboardingComplete && !inOnboarding) {
      // Carry any pending invite code in the URL to avoid AsyncStorage race conditions
      AsyncStorage.getItem('pending_onboarding_invite')
        .catch(() => null)
        .then((pendingCode) => {
          router.replace(pendingCode ? (`/onboarding?join=${pendingCode}` as any) : '/onboarding');
        });
    } else if (onboardingComplete && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [user, userProfile, loading, segments]);

  // ── Deep link handler (foreground only) ──────────────────────────────────
  // Cold-start invite links are handled by app/join.tsx via Expo Router's
  // native routing. This listener only handles links received while the app
  // is already open and running in the foreground.
  useEffect(() => {
    if (loading) return;

    const handleUrl = async (url: string | null) => {
      const code = parseJoinCode(url);
      if (!code) return;

      if (user && userProfile?.profile_completed) {
        // Already onboarded — join immediately
        try {
          await joinViaInviteLink(code);
          await AsyncStorage.removeItem('pending_onboarding_invite');
          Alert.alert('Joined!', 'You have successfully joined the community.');
        } catch (e: any) {
          Alert.alert('Could not join', e?.message ?? 'Invalid or expired invite link.');
        }
      } else {
        await AsyncStorage.setItem('pending_onboarding_invite', code);
        if (user) {
          router.replace('/onboarding');
        }
      }
    };

    // Foreground only — cold-start URLs are handled by app/join.tsx
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [user, userProfile, loading]);

  // ── Push notifications ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || inAuthGroup) return;

    const Notifications = getNotificationsModule();

    // Register and store token
    registerForPushNotifications().then(async (token) => {
      if (!token) return;
      try {
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';
        await registerPushToken(token, platform);
      } catch {
        // Non-critical — token will register on next open
      }
    });

    // Foreground notification received
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (_notification: any) => {
        // Foreground display is handled by setNotificationHandler above
      }
    );

    // Notification tapped
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = response.notification.request.content.data as Record<string, any>;
        if (data?.type === 'incoming-call') {
          router.push('/(tabs)' as any);
        } else if (data?.route) {
          router.push(data.route as any);
        } else if (data?.chatId) {
          router.push(`/chat/${data.chatId}` as any);
        } else if (data?.emergencyId) {
          router.push(`/emergency/${data.emergencyId}` as any);
        }
      }
    );

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [inAuthGroup, user]);

  return null;
}

// ─── Loading overlay ──────────────────────────────────────────────────────────
// Sits on top of the Stack and blocks content until the AppGuard redirect
// has settled on the correct destination screen.

function LoadingOverlay() {
  const { loading, userProfile } = useAuth();
  const user = userProfile ? { uid: userProfile.id } : null;
  const segments = useSegments();

  // While Firebase is reading auth state or Firestore profile
  if (loading) return <View style={styles.overlay} />;

  // Unauthenticated: hold overlay until /landing is visible
  // Also allow /join so the invite link handler can redirect before the overlay blocks
  if (!user && segments[0] !== 'landing' && segments[0] !== 'onboarding' && segments[0] !== 'join') {
    return <View style={styles.overlay} />;
  }

  // Authenticated but profile not yet complete: hold overlay until an onboarding route is visible
  if (user && userProfile && !userProfile.profile_completed && segments[0] !== 'onboarding' && segments[0] !== 'onboarding-create') {
    return <View style={styles.overlay} />;
  }

  return null;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0d3d47',
    zIndex: 999,
  },
});

// ─── Root layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CommunityProvider>
            <GoogleMapsProvider>
              <CallProvider>
                <AppGuard />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="landing" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="onboarding-create" />
                  <Stack.Screen name="admin" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="security" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="notifications-settings" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="checkout" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="pricing" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="create-post" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="join" options={{ headerShown: false }} />
                  <Stack.Screen name="chat/[id]" />
                  <Stack.Screen name="emergency/[id]" />
                  <Stack.Screen name="call/[id]" options={{ animation: 'fade' }} />
                </Stack>
                <IncomingCallOverlay />
                <LoadingOverlay />
              </CallProvider>
            </GoogleMapsProvider>
          </CommunityProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
