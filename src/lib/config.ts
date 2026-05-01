// Single source of truth for API + Socket URLs.
// Values come from EXPO_PUBLIC_API_URL in .env (e.g. http://10.0.2.2:3030/api for emulator,
// or http://192.168.31.96:3030/api for a physical device on the same network).

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://lalela.net/api';

// Socket.io connects to the server root — strip the /api suffix
export const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');
