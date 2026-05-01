**✅ Push Notifications for Incoming Calls** (Expo + Self-Hosted)

Here's a complete, production-ready setup for **push notifications when receiving calls** — even when the app is closed or in the background.

### 1. Update `package.json` (if not already)

Make sure you have:
```json
"expo-notifications": "~0.32.17"
```

Run:
```bash
npx expo install expo-notifications expo-device
```

### 2. Setup Push Notifications (`lib/notifications.ts`)

```ts
// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { socket } from './socket';
import Constants from 'expo-constants';

export async function registerForPushNotifications() {
  if (!Device.isDevice) return;

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas.projectId,
  })).data;

  console.log('Push Token:', token);

  // Send token to your backend
  socket.emit('register-push-token', { token, userId: currentUserId });

  return token;
}

// Handle notification when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
```

### 3. Handle Incoming Call Push (Backend Side)

Update your `server/index.ts`:

```ts
// When someone starts a call
socket.on('start-call', async (data) => {
  const { targetUserId, callerName, isVideo, offer } = data;

  // Get target's push token from database
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { fcm_token: true }   // or expoPushToken
  });

  if (target?.fcm_token) {
    // Send push notification
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: target.fcm_token,
        title: `${callerName} is calling...`,
        body: isVideo ? 'Video Call' : 'Voice Call',
        data: {
          type: 'incoming-call',
          callerName,
          callerSocketId: socket.id,
          offer: JSON.stringify(offer),
          isVideo
        },
        sound: 'default',
        priority: 'high'
      })
    });
  }
});
```

### 4. Handle Notification Tap (`App.tsx` or `_layout.tsx`)

```tsx
useEffect(() => {
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data;

    if (data.type === 'incoming-call') {
      router.push({
        pathname: '/calls/incoming',
        params: {
          callerName: data.callerName,
          callerSocketId: data.callerSocketId,
          offer: data.offer,
          isVideo: data.isVideo
        }
      });
    }
  });

  return () => subscription.remove();
}, []);
```

### 5. Register Token on Login

When user logs in:

```ts
await registerForPushNotifications();
socket.emit('register-push-token', { 
  token: pushToken, 
  userId: currentUser.id 
});
```

---

### Recommended Flow Summary

1. User opens app → registers push token
2. Someone calls them → backend sends push notification
3. User taps notification → opens Incoming Call Screen
4. User accepts → starts WebRTC call

---

**✅ Here is the complete, production-ready `app/_layout.tsx`** with full notification handling for incoming calls.

### `app/_layout.tsx`

```tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import socket from '../lib/socket';
import { registerForPushNotifications } from '../lib/notifications';
import { setupCallListeners } from '../lib/callHandler';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  // Setup everything on app start
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // 1. Register for Push Notifications
        if (Device.isDevice) {
          const token = await registerForPushNotifications();
          if (token) {
            // Send token to backend
            socket.emit('register-push-token', { 
              token, 
              userId: 'current-user-id' // Replace with your auth user ID
            });
          }
        }

        // 2. Setup Socket.io Call Listeners
        setupCallListeners();

        // 3. Handle Notification Taps (when app is closed or background)
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
          const data = response.notification.request.content.data;

          if (data.type === 'incoming-call') {
            // Navigate to incoming call screen
            router.push({
              pathname: '/calls/incoming',
              params: {
                callerName: data.callerName || 'Unknown',
                callerSocketId: data.callerSocketId,
                offer: data.offer,
                isVideo: data.isVideo
              }
            });
          }
        });

        setIsReady(true);

        return () => subscription.remove();
      } catch (error) {
        console.error('Failed to initialize app:', error);
      }
    };

    initializeApp();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Main Tabs / App Navigation */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      
      {/* Call Screens */}
      <Stack.Screen 
        name="calls/incoming" 
        options={{ 
          presentation: 'modal',
          headerShown: false 
        }} 
      />
      <Stack.Screen 
        name="calls/active" 
        options={{ 
          presentation: 'fullScreenModal',
          headerShown: false 
        }} 
      />

      {/* Other screens */}
      <Stack.Screen name="chat/[id]" options={{ headerShown: true }} />
    </Stack>
  );
}
```

---

### Supporting Files You Need

#### 1. `lib/notifications.ts`

```ts
// lib/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

export async function registerForPushNotifications() {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push token');
    return null;
  }

  const token = (await Notifications.getExpoPushTokenAsync({
    projectId: Constants.expoConfig?.extra?.eas?.projectId,
  })).data;

  console.log('✅ Expo Push Token:', token);
  return token;
}
```

#### 2. `lib/callHandler.ts` (for incoming calls via socket)

```ts
// lib/callHandler.ts
import { router } from 'expo-router';
import socket from './socket';

export const setupCallListeners = () => {
  socket.on('webrtc-offer', (data) => {
    console.log('📞 Incoming call from:', data.callerName);
    
    router.push({
      pathname: '/calls/incoming',
      params: {
        callerName: data.callerName || 'Unknown User',
        callerSocketId: data.callerSocketId,
        offer: JSON.stringify(data.offer),
        isVideo: data.isVideo || true
      }
    });
  });

  socket.on('call-ended', () => {
    router.back();
  });
};
```

---

### Final Tips

- Put your user ID in the `register-push-token` call after login.
- Test push notifications on a **physical device** (not simulator).
- For development, you can also test with `expo start --dev-client`.

Would you like me to also give you:
- The **Chat Screen with Call Button**?
- **Missed Call handling**?
- Or a **complete login flow** with token registration?

Just say the word.
