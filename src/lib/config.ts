// Single source of truth for API + Socket URLs.
// Values come from EXPO_PUBLIC_API_URL in .env (e.g. http://10.0.2.2:4000/api for emulator,
// or http://192.168.31.96:4000/api for a physical device on the same network).
// On web, 10.0.2.2 is unreachable (Android emulator alias); fall back to localhost.
import { Platform } from 'react-native';

const rawUrl = process.env.EXPO_PUBLIC_API_URL ?? 'https://api.wolfslair.cc/api';

export const API_BASE_URL =
  Platform.OS === 'web' && rawUrl.includes('10.0.2.2')
    ? rawUrl.replace('10.0.2.2', 'localhost')
    : rawUrl;

// Socket.io connects to the server root — strip the /api suffix
export const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

/**
 * Resolve a media URL returned by the API. The server returns path-only URLs
 * like "/api/media/lalela/..." so they are portable across clients (web,
 * Android emulator, production). This helper prepends the client's own API
 * origin so the resulting absolute URL is reachable from THIS device.
 *
 * Pass-through for already-absolute http(s) URLs and for falsy values.
 */
export function resolveMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/')) return `${SOCKET_URL}${url}`;
  return url;
}
