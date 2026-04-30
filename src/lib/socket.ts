import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lalela.net/api';
// Socket.io connects to the root of the server (same host, no /api prefix)
const SOCKET_URL = API_URL.replace(/\/api\/?$/, '');

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
    autoConnect: false,
  });

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
