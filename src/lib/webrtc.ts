/**
 * src/lib/webrtc.ts — P2P voice/video calls using react-native-webrtc.
 *
 * Signalling is done via Socket.io (server/index.ts):
 *   webrtc:offer    → SDP offer to remote peer (routed via user:<id> room)
 *   webrtc:answer   → SDP answer back
 *   webrtc:ice      → ICE candidate exchange
 *   call:ring       → notify recipient before offer (shows ringing state)
 *   call:ended      → hang up notification
 *   call:rejected   → callee declined
 *
 * TURN server is Coturn running on the Axxess VPS (docker-compose.yml).
 *
 * Usage:
 *   const call = new WebRTCCall(socket, localUserId);
 *   await call.startCall(remoteUserId, callerName, onLocalStream, onRemoteStream);
 *   // ...
 *   call.endCall();
 */

import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  MediaStream,
} from 'react-native-webrtc';
import type { Socket } from 'socket.io-client';

// ICE servers — STUN (public) + TURN (self-hosted Coturn on VPS)
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: `turn:${process.env.EXPO_PUBLIC_TURN_HOST ?? 'lalela.net'}:3478`,
    username: process.env.EXPO_PUBLIC_TURN_USER ?? 'lalela',
    credential: process.env.EXPO_PUBLIC_TURN_PASS ?? 'lalela',
  },
];

export type CallType = 'audio' | 'video';

export class WebRTCCall {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private socket: Socket;
  private localUserId: string;
  private remoteUserId: string | null = null;

  constructor(socket: Socket, localUserId: string) {
    this.socket = socket;
    this.localUserId = localUserId;
  }

  // ── Start an outgoing call ──────────────────────────────────────────────────
  async startCall(
    remoteUserId: string,
    callerName: string,
    onLocalStream: (stream: MediaStream) => void,
    onRemoteStream: (stream: MediaStream) => void,
    type: CallType = 'audio',
  ) {
    this.remoteUserId = remoteUserId;
    this.pc = this._createPeerConnection(onRemoteStream);

    // Notify recipient that a call is incoming (shows ringing UI before SDP arrives)
    this.socket.emit('call:ring', {
      target: remoteUserId,
      callerName,
      type,
    });

    this.localStream = await this._getLocalStream(type);
    onLocalStream(this.localStream);
    this.localStream.getTracks().forEach((track) =>
      (this.pc as RTCPeerConnection).addTrack(track, this.localStream as MediaStream)
    );

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: type === 'video',
    } as any);
    await this.pc.setLocalDescription(offer);

    this.socket.emit('webrtc:offer', {
      target: remoteUserId,
      caller: this.localUserId,
      callerName,
      sdp: this.pc.localDescription,
      type,
    });
  }

  // ── Answer an incoming call ─────────────────────────────────────────────────
  async answerCall(
    callerUserId: string,
    offerSdp: any,
    onLocalStream: (stream: MediaStream) => void,
    onRemoteStream: (stream: MediaStream) => void,
    type: CallType = 'audio',
  ) {
    this.remoteUserId = callerUserId;
    this.pc = this._createPeerConnection(onRemoteStream);

    this.localStream = await this._getLocalStream(type);
    onLocalStream(this.localStream);
    this.localStream.getTracks().forEach((track) =>
      (this.pc as RTCPeerConnection).addTrack(track, this.localStream as MediaStream)
    );

    await this.pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.socket.emit('webrtc:answer', {
      target: callerUserId,
      sdp: this.pc.localDescription,
    });
  }

  // ── Handle incoming answer ──────────────────────────────────────────────────
  async handleAnswer(answerSdp: any) {
    if (!this.pc) return;
    await this.pc.setRemoteDescription(new RTCSessionDescription(answerSdp));
  }

  // ── Handle incoming ICE candidate ───────────────────────────────────────────
  async handleIceCandidate(candidate: any) {
    if (!this.pc) return;
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      console.error('Error adding ICE candidate:', e);
    }
  }

  // ── Hang up / cleanup ───────────────────────────────────────────────────────
  endCall() {
    if (this.remoteUserId) {
      this.socket.emit('call:ended', { target: this.remoteUserId });
    }
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.localStream = null;
    this.pc = null;
    this.remoteUserId = null;
  }

  // ── Reject an incoming call before answering ────────────────────────────────
  rejectCall(callerUserId: string) {
    this.socket.emit('call:rejected', { target: callerUserId });
  }

  // ── Toggle mute ────────────────────────────────────────────────────────────
  setMuted(muted: boolean) {
    this.localStream?.getAudioTracks().forEach((t) => { t.enabled = !muted; });
  }

  // ── Toggle camera ──────────────────────────────────────────────────────────
  setCameraEnabled(enabled: boolean) {
    this.localStream?.getVideoTracks().forEach((t) => { t.enabled = enabled; });
  }

  // ── Switch front / back camera ──────────────────────────────────────────────
  switchCamera() {
    const track = this.localStream?.getVideoTracks()[0] as any;
    if (track?._switchCamera) {
      track._switchCamera();
    }
  }

  // ── Register socket event listeners for this call session ──────────────────
  registerSocketHandlers(
    onIncomingRing: (data: { caller: string; callerName: string; type: CallType }) => void,
    onIncomingCall: (data: { caller: string; callerName: string; sdp: any; type: CallType }) => void,
    onCallEnded: () => void,
    onCallRejected: () => void,
  ) {
    this.socket.on('call:ring', (data: any) => {
      onIncomingRing({ caller: data.from ?? data.caller, callerName: data.callerName, type: data.type ?? 'audio' });
    });
    this.socket.on('webrtc:offer', (data: any) => {
      onIncomingCall({ caller: data.caller, callerName: data.callerName, sdp: data.sdp, type: data.type ?? 'audio' });
    });
    this.socket.on('webrtc:answer', (data: any) => {
      this.handleAnswer(data.sdp);
    });
    this.socket.on('webrtc:ice', (data: any) => {
      this.handleIceCandidate(data.candidate);
    });
    this.socket.on('call:ended', () => {
      onCallEnded();
    });
    this.socket.on('call:rejected', () => {
      onCallRejected();
    });
  }

  unregisterSocketHandlers() {
    this.socket.off('call:ring');
    this.socket.off('webrtc:offer');
    this.socket.off('webrtc:answer');
    this.socket.off('webrtc:ice');
    this.socket.off('call:ended');
    this.socket.off('call:rejected');
  }

  // ── Internals ───────────────────────────────────────────────────────────────
  private _createPeerConnection(onRemoteStream: (stream: MediaStream) => void): RTCPeerConnection {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS } as any);

    pc.addEventListener('icecandidate', (event: any) => {
      if (event.candidate && this.remoteUserId) {
        this.socket.emit('webrtc:ice', {
          target: this.remoteUserId,
          candidate: event.candidate,
        });
      }
    });

    pc.addEventListener('track', (event: any) => {
      if (event.streams?.[0]) onRemoteStream(event.streams[0]);
    });

    return pc;
  }

  private async _getLocalStream(type: CallType): Promise<MediaStream> {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video' ? { facingMode: 'user' } : false,
    });
    return stream as MediaStream;
  }
}
