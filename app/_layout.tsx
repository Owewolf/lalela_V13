import '../global.css';
import { useEffect, useRef, useState } from 'react';
import { Platform, Alert, View, StyleSheet, LogBox, Animated, AppState } from 'react-native';

// GooglePlacesAutocomplete uses a FlatList internally (nestedScrollEnabled is already set).
// This warning is a false positive in the form layout context.
LogBox.ignoreLogs(['VirtualizedLists should never be nested']);
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { CommunityProvider, useCommunity } from '../src/context/CommunityContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { GoogleMapsProvider } from '../src/context/GoogleMapsContext';
import { CallProvider } from '../src/context/CallContext';
import { IncomingCallOverlay } from '../src/components/call/IncomingCallOverlay';
import { TopicChatGateProvider } from '../src/components/chat/TopicChatGateProvider';
import { THEME_COLORS } from '../src/theme/colors';
import { queryClient } from '../src/lib/queryClient';
import { useRealtimeSync } from '../src/hooks/useRealtimeSync';


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
function parseVerifiedFlag(url: string | null): boolean {
  if (!url) return false;
  try {
    const parsed = Linking.parse(url);
    const v = parsed.queryParams?.verified;
    return v === '1' || v === 'true';
  } catch {
    return false;
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
        lightColor: THEME_COLORS.secondaryContainer,
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
  const { userProfile, loading, registerPushToken, signOut, refreshProfile } = useAuth();
  // Map to legacy `user` shape used in this component
  const user = userProfile ? { uid: userProfile.id, email: userProfile.email, emailVerified: true, providerData: [] as any[] } : null;
  const { joinViaInviteLink } = useCommunity();
  const segments = useSegments();
  const router = useRouter();
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);
  const inLanding = segments[0] === 'landing';
  const inOnboarding = segments[0] === 'onboarding';
  // onboarding-create is accessible by both new users AND authenticated users
  // creating a second community — do NOT treat it as an auth-only group
  const inOnboardingCreate = segments[0] === 'onboarding-create';
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

    const inTabs = segments[0] === '(tabs)';

    if (!user) {
      if (!inAuthGroup && !inOnboardingCreate) router.replace('/landing');
      return;
    }

    // (Email verification enforced server-side via JWT — no client-side check needed)

    if (userProfile === null) return;

    const onboardingComplete = userProfile.profileCompleted === true;

    if (!onboardingComplete && !inOnboarding && !inOnboardingCreate) {
      // Carry any pending invite code in the URL to avoid AsyncStorage race conditions
      AsyncStorage.getItem('pendingOnboardingInvite')
        .catch(() => null)
        .then((pendingCode) => {
          router.replace(pendingCode ? (`/onboarding?join=${pendingCode}` as any) : '/onboarding');
        });
    } else if (onboardingComplete && !['(tabs)', 'admin', 'checkout', 'pricing', 'create-post', 'create-business', 'chat', 'emergency', 'call', 'notifications-settings', 'security', 'onboarding-create'].includes(segments[0] as string)) {
      // Navigate to tabs whenever authenticated+onboarded and not already there.
      // Do NOT gate on inAuthGroup — on web, segments may not reflect the current
      // URL at the exact moment setUserProfile fires (static rendering hydration),
      // causing silent navigation failure.
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
      // After email verification the server redirects to APP_DEEP_LINK with ?verified=1.
      // Refresh the cached profile so emailVerified / community wiring is up to date.
      if (parseVerifiedFlag(url)) {
        try {
          const fresh = await refreshProfile();
          // If the account still has no password (e.g. user added an email to a
          // phone-only account but never set a password), send them to the
          // Login & Authentication tab so they can set one — otherwise they
          // would never be able to log in with the email they just verified.
          if (fresh && fresh.hasPassword === false) {
            router.replace('/security?tab=security' as any);
          }
        } catch {
          // Non-fatal
        }
      }

      const code = parseJoinCode(url);
      if (!code) return;

      if (user && userProfile?.profileCompleted) {
        // Already onboarded — join immediately
        try {
          await joinViaInviteLink(code);
          await AsyncStorage.removeItem('pendingOnboardingInvite');
          Alert.alert('Joined!', 'You have successfully joined the community.');
        } catch (e: any) {
          Alert.alert('Could not join', e?.message ?? 'Invalid or expired invite link.');
        }
      } else {
        await AsyncStorage.setItem('pendingOnboardingInvite', code);
        if (user) {
          router.replace('/onboarding');
        }
      }
    };

    // Foreground only — cold-start URLs are handled by app/join.tsx
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [user, userProfile, loading]);

  // ── App resume → refresh profile when email is unverified ──────────────
  // Covers the case where a user verifies their email in a web browser (e.g.
  // desktop inbox) while the mobile app is still open in the background. On
  // resume we re-fetch /users/me so emailVerified flips to true and the
  // CommunityContext re-resolves the correct community/role.
  useEffect(() => {
    if (loading || !user) return;
    if (userProfile?.emailVerified !== false) return;

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshProfile().catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [user, userProfile?.emailVerified, loading, refreshProfile]);

  // ── Push notifications ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || inAuthGroup || Platform.OS === 'web') return;

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
  const opacity = useRef(new Animated.Value(1)).current;
  const [hidden, setHidden] = useState(false);

  const shouldShow =
    loading ||
    (!user && segments[0] !== 'landing' && segments[0] !== 'onboarding' && segments[0] !== 'join') ||
    (!!user && !!userProfile && !userProfile.profileCompleted &&
      segments[0] !== 'onboarding' && segments[0] !== 'onboarding-create');

  useEffect(() => {
    if (!shouldShow) {
      // Fade out once, then permanently hide — never flash back in
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setHidden(true));
    }
  }, [shouldShow]);

  if (hidden) return null;

  return <Animated.View style={[styles.overlay, { opacity }]} />;
}

function RealtimeSyncGate() {
  useRealtimeSync();
  return null;
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME_COLORS.aliasHex_17341d,
    zIndex: 999,
  },
});

// ─── Root layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <CommunityProvider>
              <ThemeProvider>
                <GoogleMapsProvider>
                  <CallProvider>
                    <TopicChatGateProvider>
                      <RealtimeSyncGate />
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
                        <Stack.Screen name="create-business" options={{ presentation: 'modal' }} />
                        <Stack.Screen name="join" options={{ headerShown: false }} />
                        <Stack.Screen name="chat/[id]" />
                        <Stack.Screen name="emergency/[id]" />
                        <Stack.Screen name="call/[id]" options={{ animation: 'fade' }} />
                      </Stack>
                      <IncomingCallOverlay />
                      <LoadingOverlay />
                    </TopicChatGateProvider>
                  </CallProvider>
                </GoogleMapsProvider>
              </ThemeProvider>
            </CommunityProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
