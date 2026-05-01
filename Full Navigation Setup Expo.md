**✅ Full Navigation Setup for WebRTC Calls** (using Expo Router)

Here’s the complete integration for handling incoming and outgoing calls with proper navigation.

### 1. Update Your Socket Listener (Central Place)

Create or update `lib/callHandler.ts`:

```ts
// lib/callHandler.ts
import socket from './socket';
import { router } from 'expo-router';
import { startCall } from './webrtc';

export const setupCallListeners = () => {
  // Incoming Call
  socket.on('webrtc-offer', (data) => {
    router.push({
      pathname: '/calls/incoming',
      params: {
        callerName: data.callerName || 'Unknown',
        callerSocketId: data.callerSocketId,
        offer: JSON.stringify(data.offer),
        isVideo: data.isVideo
      }
    });
  });

  // Call Accepted
  socket.on('webrtc-answer', (data) => {
    router.push({
      pathname: '/calls/active',
      params: {
        targetSocketId: data.target,
        isVideo: true,
        callerName: data.callerName || 'User'
      }
    });
  });

  // Call Ended / Declined
  socket.on('call-ended', () => {
    router.back(); // or router.push('/chats')
  });

  socket.on('call-declined', () => {
    alert('Call was declined');
    router.back();
  });
};
```

### 2. Call This Listener Early

In your root layout or `_layout.tsx`:

```tsx
// app/_layout.tsx
import { useEffect } from 'react';
import { setupCallListeners } from '../lib/callHandler';

export default function RootLayout() {
  useEffect(() => {
    setupCallListeners();
  }, []);

  return <Stack />;
}
```

### 3. Incoming Call Screen Route

Create folder: `app/calls/incoming.tsx`

```tsx
// app/calls/incoming.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import { useLocalSearchParams, router } from 'expo-router';
import { answerCall } from '../../lib/webrtc';
import socket from '../../lib/socket';

export default function IncomingCall() {
  const { callerName, callerSocketId, offer, isVideo } = useLocalSearchParams();

  const accept = async () => {
    const parsedOffer = JSON.parse(offer as string);
    await answerCall(parsedOffer, callerSocketId as string);
    
    router.push({
      pathname: '/calls/active',
      params: { targetSocketId: callerSocketId, isVideo, callerName }
    });
  };

  const decline = () => {
    socket.emit('call-declined', { target: callerSocketId });
    router.back();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Incoming Call</Text>
      <Text style={styles.caller}>{callerName}</Text>
      <Text style={styles.type}>{isVideo === 'true' ? '📹 Video Call' : '📞 Voice Call'}</Text>

      <View style={styles.buttons}>
        <Button mode="contained" buttonColor="#4CAF50" onPress={accept} style={styles.btn}>
          Accept
        </Button>
        <Button mode="contained" buttonColor="#f44336" onPress={decline} style={styles.btn}>
          Decline
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },
  title: { color: '#fff', fontSize: 22, marginBottom: 10 },
  caller: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  type: { color: '#aaa', fontSize: 18, marginBottom: 80 },
  buttons: { flexDirection: 'row', gap: 30 }
});
```

### 4. Active Call Screen Route

Create folder: `app/calls/active.tsx`

(Use the full ActiveCallScreen from previous message)

### 5. How to Start an Outgoing Call

```tsx
// Example from Chat Screen
const startOutgoingCall = (targetSocketId: string, isVideo: boolean) => {
  router.push({
    pathname: '/calls/active',
    params: {
      targetSocketId,
      isVideo,
      callerName: 'You'
    }
  });

  startCall(targetSocketId, isVideo);   // from webrtc.ts
};
```

---

### Final Folder Structure

```
app/
├── calls/
│   ├── incoming.tsx
│   └── active.tsx
├── _layout.tsx
└── chat/[id].tsx     ← where you trigger calls
```

