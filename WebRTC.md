**✅ Here’s the complete WebRTC enhancement** with all three parts

### 1. Incoming Call UI + Ringing Logic

Create a new screen: `screens/IncomingCallScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { Button } from 'react-native-paper';
import { answerCall } from '../lib/webrtc';
import socket from '../lib/socket';

export default function IncomingCallScreen({ route, navigation }: any) {
  const { callerName, callerSocketId, offer, isVideo } = route.params;
  const [ringing, setRinging] = useState(true);

  useEffect(() => {
    // Auto decline after 30 seconds
    const timeout = setTimeout(() => {
      if (ringing) declineCall();
    }, 30000);

    return () => clearTimeout(timeout);
  }, []);

  const acceptCall = async () => {
    setRinging(false);
    await answerCall(offer, callerSocketId);
    navigation.navigate('ActiveCall', { 
      targetSocketId: callerSocketId, 
      isVideo 
    });
  };

  const declineCall = () => {
    setRinging(false);
    socket.emit('call-declined', { target: callerSocketId });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.callerName}>{callerName}</Text>
      <Text style={styles.callType}>{isVideo ? '📹 Video Call' : '📞 Voice Call'}</Text>

      <View style={styles.buttons}>
        <Button mode="contained" buttonColor="green" onPress={acceptCall} style={styles.button}>
          Accept
        </Button>
        <Button mode="contained" buttonColor="red" onPress={declineCall} style={styles.button}>
          Decline
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  callerName: { fontSize: 28, color: 'white', marginBottom: 8 },
  callType: { fontSize: 18, color: '#aaa', marginBottom: 60 },
  buttons: { flexDirection: 'row', gap: 20 },
  button: { paddingHorizontal: 30 }
});
```

---

### 2. Active Call Screen with States (Ringing → Connected → Ended)

Create `screens/ActiveCallScreen.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { Button } from 'react-native-paper';
import socket from '../lib/socket';
import { peerConnection, localStream } from '../lib/webrtc'; // export these from webrtc.ts

export default function ActiveCallScreen({ route, navigation }: any) {
  const { targetSocketId, isVideo } = route.params;
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected' | 'ended'>('connecting');
  const [remoteStream, setRemoteStream] = useState<any>(null);

  useEffect(() => {
    // Listen for remote stream
    if (peerConnection) {
      peerConnection.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        setCallStatus('connected');
      };
    }

    // Listen for call ended
    socket.on('call-ended', () => {
      setCallStatus('ended');
      setTimeout(() => navigation.goBack(), 1500);
    });

    return () => socket.off('call-ended');
  }, []);

  const hangUp = () => {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.release();
    socket.emit('call-ended', { target: targetSocketId });
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {callStatus === 'connecting' && <Text style={styles.status}>Calling...</Text>}
      {callStatus === 'connected' && <Text style={styles.status}>Connected</Text>}

      {/* Remote Video */}
      {remoteStream && (
        <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} />
      )}

      {/* Local Video (Picture-in-Picture) */}
      {localStream && (
        <RTCView 
          streamURL={localStream.toURL()} 
          style={styles.localVideo} 
          mirror 
        />
      )}

      <View style={styles.controls}>
        <Button mode="contained" buttonColor="red" onPress={hangUp}>
          End Call
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  remoteVideo: { flex: 1 },
  localVideo: { position: 'absolute', bottom: 100, right: 20, width: 120, height: 180, borderRadius: 12 },
  status: { position: 'absolute', top: 60, alignSelf: 'center', color: 'white', fontSize: 18 },
  controls: { position: 'absolute', bottom: 50, alignSelf: 'center' }
});
```

---

### 3. Camera Switch + Mute Controls

Add these functions to `lib/webrtc.ts`:

```ts
export const toggleMute = (isMuted: boolean) => {
  if (localStream) {
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !isMuted;
    });
  }
};

export const toggleCamera = async () => {
  if (!localStream) return;

  const videoTrack = localStream.getVideoTracks()[0];
  if (videoTrack) {
    const newStream = await mediaDevices.getUserMedia({
      video: { facingMode: videoTrack.getSettings().facingMode === 'user' ? 'environment' : 'user' }
    });

    const newVideoTrack = newStream.getVideoTracks()[0];
    if (peerConnection) {
      const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
      sender?.replaceTrack(newVideoTrack);
    }
    videoTrack.stop();
  }
};
```


###########ADD ENHANCMENTS FOR FURTHER INTEGRATION ############**✅ Here’s everything** — the complete enhanced WebRTC 


### 1. Updated `lib/webrtc.ts` (with mute, camera switch, and better state management)

```ts
// lib/webrtc.ts
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, MediaStream } from 'react-native-webrtc';
import socket from './socket';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
let ringSound: Audio.Sound | null = null;

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'turn:192.168.31.96:3478', username: 'lalela', credential: 'StrongPassword123!ChangeMe' }
  ]
};

export const startCall = async (targetSocketId: string, isVideo: boolean = true) => {
  localStream = await mediaDevices.getUserMedia({ audio: true, video: isVideo });
  peerConnection = new RTCPeerConnection(configuration);

  localStream.getTracks().forEach(track => peerConnection!.addTrack(track, localStream!));

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit('webrtc-offer', { target: targetSocketId, offer, isVideo });
};

export const answerCall = async (offer: any, callerSocketId: string) => {
  localStream = await mediaDevices.getUserMedia({ audio: true, video: true });
  peerConnection = new RTCPeerConnection(configuration);

  localStream.getTracks().forEach(track => peerConnection!.addTrack(track, localStream!));

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('webrtc-answer', { target: callerSocketId, answer });
};

// Mute / Unmute
export const toggleMute = (muted: boolean) => {
  if (localStream) {
    localStream.getAudioTracks().forEach(track => track.enabled = !muted);
  }
};

// Switch Camera
export const switchCamera = async () => {
  if (!localStream) return;
  const videoTrack = localStream.getVideoTracks()[0];
  if (!videoTrack) return;

  const newStream = await mediaDevices.getUserMedia({
    video: { facingMode: videoTrack.getSettings().facingMode === 'user' ? 'environment' : 'user' }
  });

  const newVideoTrack = newStream.getVideoTracks()[0];
  if (peerConnection) {
    const sender = peerConnection.getSenders().find(s => s.track?.kind === 'video');
    await sender?.replaceTrack(newVideoTrack);
  }
  videoTrack.stop();
};

// Hang Up
export const hangUp = () => {
  if (peerConnection) peerConnection.close();
  if (localStream) localStream.release();
  socket.emit('call-ended', { target: 'current-target' }); // replace with actual ID
};
```

---

### 2. Active Call Screen with Timer + Controls

```tsx
// screens/ActiveCallScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { Button, IconButton } from 'react-native-paper';
import { toggleMute, switchCamera, hangUp } from '../lib/webrtc';
import socket from '../lib/socket';

export default function ActiveCallScreen({ route, navigation }: any) {
  const { targetSocketId, isVideo, callerName } = route.params;
  const [callStatus, setCallStatus] = useState<'connecting' | 'connected'>('connecting');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [localStream, setLocalStream] = useState<any>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (callStatus === 'connected') setDuration(prev => prev + 1);
    }, 1000);

    // Listen for remote stream
    if (peerConnection) {
      peerConnection.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        setCallStatus('connected');
      };
    }

    socket.on('call-ended', () => navigation.goBack());

    return () => {
      clearInterval(interval);
      socket.off('call-ended');
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.caller}>{callerName}</Text>
      <Text style={styles.timer}>{formatDuration(duration)}</Text>

      {/* Remote Video */}
      {remoteStream && <RTCView streamURL={remoteStream.toURL()} style={styles.remote} />}

      {/* Local Video (PiP) */}
      {localStream && (
        <RTCView streamURL={localStream.toURL()} style={styles.local} mirror />
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <IconButton icon={isMuted ? "microphone-off" : "microphone"} 
                    size={32} onPress={() => { toggleMute(!isMuted); setIsMuted(!isMuted); }} />

        {isVideo && (
          <IconButton icon="camera-flip" size={32} onPress={switchCamera} />
        )}

        <IconButton icon="phone-hangup" size={40} mode="contained" 
                    buttonColor="red" onPress={hangUp} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  caller: { color: '#fff', fontSize: 24, textAlign: 'center', marginTop: 60 },
  timer: { color: '#0f0', fontSize: 18, textAlign: 'center', marginVertical: 10 },
  remote: { flex: 1 },
  local: { position: 'absolute', bottom: 120, right: 20, width: 100, height: 180, borderRadius: 12 },
  controls: { position: 'absolute', bottom: 40, flexDirection: 'row', justifyContent: 'center', gap: 30, width: '100%' }
});
```

---

### 3. Ringing Sound + Vibration (Add to IncomingCallScreen)

Add this to your `IncomingCallScreen.tsx`:

```tsx
useEffect(() => {
  const playRingtone = async () => {
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/ringtone.mp3'), // put a ringtone file in assets
      { isLooping: true }
    );
    ringSound = sound;
    await sound.playAsync();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  playRingtone();

  return () => {
    if (ringSound) ringSound.unloadAsync();
  };
}, []);
```

---

**All three features are now included**:
- Ringing sound + vibration
- Call duration timer
- Switch camera + mute buttons

Would you like me to give you the **full navigation setup** (how to navigate to these screens when receiving a call) next?
