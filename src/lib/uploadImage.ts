import api from './api';

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export type UploadFolder = 'profiles' | 'posts' | 'chat' | 'businesses';

/**
 * Uploads an image to MinIO via the backend /api/upload endpoint.
 * The URI comes from expo-image-picker. We fetch it, convert to FormData,
 * then POST to the server which proxies to MinIO and returns the public URL.
 */
export async function uploadImage(
  uri: string,
  folder: UploadFolder,
  _userId: string,
  _existingUrl?: string,
): Promise<string> {
  // Fetch the URI and convert to blob
  const response = await fetch(uri);
  const blob = await response.blob();

  if (blob.size > MAX_SIZE) {
    throw new Error('Image must be smaller than 10MB');
  }

  // Derive extension from MIME type or fallback to jpg
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
  };
  const ext = mimeToExt[blob.type] ?? 'jpg';
  const fileName = `${Date.now()}.${ext}`;

  const form = new FormData();
  form.append('file', { uri, name: fileName, type: blob.type || 'image/jpeg' } as any);
  form.append('folder', folder);

  const { data } = await api.post('/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return data.url as string;
}

