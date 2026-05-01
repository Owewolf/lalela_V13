import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SOCKET_URL } from './config';

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket?.connected) return socket;

  const token = await AsyncStorage.getItem('access_token');

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 10000,
    autoConnect: false,
  });

  socket.on('connect', () => console.log('✅ Socket connected to backend'));
  socket.on('disconnect', () => console.log('❌ Socket disconnected'));

  socket.connect();
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

/** Re-authenticate an already-connected socket after token refresh */
export function updateSocketAuth(token: string) {
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) socket.connect();
  }
}
