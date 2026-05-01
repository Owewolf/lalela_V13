/**
 * Web stub for react-native-webrtc.
 * WebRTC calls are native-only; this prevents Metro from bundling the native
 * module on the web platform where requireNativeComponent is unavailable.
 */
import React from 'react';
import { View } from 'react-native';

export const RTCPeerConnection = typeof window !== 'undefined' ? window.RTCPeerConnection : null;
export const RTCIceCandidate = typeof window !== 'undefined' ? window.RTCIceCandidate : null;
export const RTCSessionDescription = typeof window !== 'undefined' ? window.RTCSessionDescription : null;
export const mediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
export class MediaStream {}
export class MediaStreamTrack {}

export const RTCView = ({ style }) => React.createElement(View, { style });
export const RTCPIPView = ({ style }) => React.createElement(View, { style });
