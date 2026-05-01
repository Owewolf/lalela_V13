**✅ WebRTC Integration Guide** for your Expo React Native app (Self-hosted P2P Calls)

This guide shows you how to add **voice and video calls** using `react-native-webrtc` + Socket.io signaling.

### 1. Install WebRTC (Already Done Earlier)

Make sure you have these:

```bash
npx expo install react-native-webrtc @config-plugins/react-native-webrtc expo-dev-client
```

### 2. Create WebRTC Helper (`lib/webrtc.ts`)

```ts
// lib/webrtc.ts
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices, MediaStream } from 'react-native-webrtc';
import socket from './socket';

let peerConnection: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;

const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:192.168.31.96:3478' },           // Your local TURN/STUN
    {
      urls: 'turn:192.168.31.96:3478',
      username: 'lalela',
      credential: 'StrongPassword123!ChangeMe'
    }
  ]
};

export const startCall = async (targetSocketId: string, isVideo: boolean = true) => {
  localStream = await mediaDevices.getUserMedia({
    audio: true,
    video: isVideo ? { facingMode: 'user' } : false,
  });

  peerConnection = new RTCPeerConnection(configuration);

  // Add local tracks
  localStream.getTracks().forEach(track => {
    peerConnection?.addTrack(track, localStream!);
  });

  // Create Offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // Send offer to target user via Socket.io
  socket.emit('webrtc-offer', {
    target: targetSocketId,
    offer: peerConnection.localDescription,
    isVideo
  });
};

export const answerCall = async (offer: any, callerSocketId: string) => {
  localStream = await mediaDevices.getUserMedia({ audio: true, video: true });

  peerConnection = new RTCPeerConnection(configuration);
  localStream.getTracks().forEach(track => peerConnection!.addTrack(track, localStream!));

  await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);

  socket.emit('webrtc-answer', {
    target: callerSocketId,
    answer: peerConnection.localDescription
  });
};

// Handle incoming ICE candidates
socket.on('ice-candidate', (data) => {
  if (peerConnection) {
    peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  }
});
```

### 3. WebRTC Call Screen Example (`screens/CallScreen.tsx`)

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import socket from '../lib/socket';
import { startCall, answerCall } from '../lib/webrtc';

export default function CallScreen({ route }: any) {
  const { targetSocketId, isIncoming, offer } = route.params;
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (isIncoming && offer) {
      answerCall(offer, targetSocketId);
    } else {
      startCall(targetSocketId, true);
    }

    // Listen for remote stream
    if (peerConnection) {
      peerConnection.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
        setIsConnected(true);
      };
    }

    return () => {
      // Cleanup on hang up
      if (peerConnection) peerConnection.close();
      if (localStream) localStream.release();
    };
  }, []);

  const hangUp = () => {
    if (peerConnection) peerConnection.close();
    socket.emit('call-ended', { target: targetSocketId });
  };

  return (
    <View style={styles.container}>
      <RTCView streamURL={remoteStream?.toURL()} style={styles.remoteVideo} />
      <RTCView streamURL={localStream?.toURL()} style={styles.localVideo} mirror />

      <View style={styles.controls}>
        <Button title="Hang Up" onPress={hangUp} color="red" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  remoteVideo: { flex: 1 },
  localVideo: { position: 'absolute', bottom: 20, right: 20, width: 120, height: 180 },
  controls: { position: 'absolute', bottom: 40, alignSelf: 'center' }
});
```

### 4. Socket.io Signaling (Add to `server/index.ts`)

Add these handlers:

```ts
socket.on('webrtc-offer', (data) => {
  socket.to(data.target).emit('webrtc-offer', data);
});

socket.on('webrtc-answer', (data) => {
  socket.to(data.target).emit('webrtc-answer', data);
});

socket.on('ice-candidate', (data) => {
  socket.to(data.target).emit('ice-candidate', data);
});

socket.on('call-ended', (data) => {
  socket.to(data.target).emit('call-ended', data);
});
```

---



