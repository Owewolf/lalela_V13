import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import api from './api';
import { API_BASE_URL } from './config';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const UPLOAD_TIMEOUT_MS = 60_000; // 60s — large images over slow networks

export type UploadFolder = 'profiles' | 'posts' | 'chat' | 'businesses';

/**
 * Uploads an image to MinIO via the backend /api/upload endpoint.
 *
 * - On native (iOS / Android) we use expo-file-system's `uploadAsync` so the
 *   file streams directly from disk without being loaded into a JS blob.
 *   The RN fetch + Blob path frequently fails with a generic "Network Error"
 *   on Android for larger images, which is why we avoid it here.
 * - On web we read the URI as a Blob and POST it via axios — this works
 *   reliably in the browser.
 */
export async function uploadImage(
  uri: string,
  folder: UploadFolder,
  _userId: string,
  _existingUrl?: string,
): Promise<string> {
  if (Platform.OS !== 'web') {
    return uploadImageNative(uri, folder);
  }
  return uploadImageWeb(uri, folder);
}

async function uploadImageNative(uri: string, folder: UploadFolder): Promise<string> {
  // Peek at the file size without loading the bytes into memory.
  try {
    const info = await FileSystem.getInfoAsync(uri, { size: true });
    if (!info.exists) {
      throw new Error('Image file not found on device');
    }
    if (typeof info.size === 'number') {
      if (info.size === 0) throw new Error('Image is empty');
      if (info.size > MAX_SIZE) throw new Error('Image must be smaller than 10MB');
    }
  } catch (err: any) {
    // If we can't stat the file we still try the upload — the server will
    // reject anything oversized via multer's limits.
    if (err?.message?.startsWith('Image')) throw err;
  }

  const mimeType = guessMimeFromUri(uri);
  const token = await AsyncStorage.getItem('accessToken');

  try {
    const result = await FileSystem.uploadAsync(`${API_BASE_URL}/upload`, uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType,
      parameters: { folder },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (result.status < 200 || result.status >= 300) {
      let detail = result.body;
      try {
        const parsed = JSON.parse(result.body);
        detail = parsed.error || parsed.detail || result.body;
      } catch {
        // body wasn't JSON
      }
      throw new Error(`Upload failed (${result.status}): ${detail}`);
    }
    const data = JSON.parse(result.body);
    if (!data?.url) throw new Error('Upload succeeded but server returned no URL');
    return data.url as string;
  } catch (err: any) {
    if (err?.message?.startsWith('Upload failed')) throw err;
    throw new Error(
      `Network error reaching the upload server: ${err?.message ?? 'unknown error'}`
    );
  }
}

function guessMimeFromUri(uri: string): string {
  const lower = uri.split('?')[0].toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic')) return 'image/heic';
  if (lower.endsWith('.heif')) return 'image/heif';
  return 'image/jpeg';
}

async function uploadImageWeb(uri: string, folder: UploadFolder): Promise<string> {
  // Fetch the URI and convert to blob
  let response: Response;
  try {
    response = await fetch(uri);
  } catch (err) {
    throw new Error(`Could not read image from device: ${(err as Error).message}`);
  }
  if (!response.ok) {
    throw new Error(`Could not read image from device (status ${response.status})`);
  }
  const blob = await response.blob();

  if (blob.size === 0) {
    throw new Error('Image is empty');
  }
  if (blob.size > MAX_SIZE) {
    throw new Error('Image must be smaller than 10MB');
  }

  // Pick a sane MIME type. expo-image-picker on web sometimes yields blobs
  // with an empty `.type`, which the server's multer fileFilter rejects.
  const mimeType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';

  // Derive extension from MIME type or fallback to jpg
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  const ext = mimeToExt[mimeType] ?? 'jpg';
  const fileName = `${Date.now()}.${ext}`;

  const form = new FormData();
  // On the web, prefer `File` over `Blob` so the multipart part carries
  // both filename and an explicit Content-Type. Some browsers (and some
  // intermediate proxies) drop blob parts that lack a Content-Type.
  const fileLike: Blob =
    typeof File !== 'undefined'
      ? new File([blob], fileName, { type: mimeType })
      : new Blob([blob], { type: mimeType });
  form.append('file', fileLike, fileName);
  form.append('folder', folder);

  // Do NOT set Content-Type manually — the HTTP client must add the
  // multipart boundary itself. Setting it explicitly strips the boundary
  // and the server fails to parse the body.
  try {
    const { data } = await api.post('/upload', form, { timeout: UPLOAD_TIMEOUT_MS });
    return data.url as string;
  } catch (err: any) {
    // Surface a more actionable message than axios's bare "Network Error".
    if (err?.code === 'ECONNABORTED') {
      throw new Error('Upload timed out — check your connection and try again');
    }
    if (err?.response) {
      const serverMsg = err.response.data?.error || err.response.statusText || 'Upload failed';
      throw new Error(`Upload failed (${err.response.status}): ${serverMsg}`);
    }
    if (err?.message === 'Network Error') {
      throw new Error(
        'Network error reaching the upload server. The image may be too large, ' +
          'or the connection was interrupted.'
      );
    }
    throw err;
  }
}


