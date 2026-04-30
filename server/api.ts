import { Router } from 'express';
import multer from 'multer';
import { Client as MinioClient } from 'minio';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { getPublicCommunities } from './db.js';
import { requireAuth } from './middleware/auth.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import communitiesRouter from './routes/communities.js';
import conversationsRouter from './routes/conversations.js';
import businessesRouter from './routes/businesses.js';

const router = Router();

// ─── Sub-routers ──────────────────────────────────────────────────────────────

router.use('/auth', authRouter);
router.use('/users', usersRouter);
router.use('/communities', communitiesRouter);
router.use('/conversations', conversationsRouter);
router.use('/businesses', businessesRouter);

// ─── Health ───────────────────────────────────────────────────────────────────

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── File Upload (MinIO) ──────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'audio/mpeg', 'audio/mp4'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not allowed'));
  },
});

function getMinioClient(): MinioClient | null {
  const endpoint = process.env.MINIO_ENDPOINT;
  if (!endpoint) return null;
  return new MinioClient({
    endPoint: endpoint,
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'lalela',
    secretKey: process.env.MINIO_SECRET_KEY ?? '',
  });
}

router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const minio = getMinioClient();
  if (!minio) return res.status(503).json({ error: 'Storage not configured (MINIO_ENDPOINT missing)' });

  const bucket = (req.body.bucket as string) || 'uploads';
  const ext = path.extname(req.file.originalname) || '.bin';
  const objectName = `${req.auth!.userId}/${uuidv4()}${ext}`;

  // Ensure bucket exists
  const exists = await minio.bucketExists(bucket);
  if (!exists) await minio.makeBucket(bucket, 'us-east-1');

  await minio.putObject(bucket, objectName, req.file.buffer, req.file.size, {
    'Content-Type': req.file.mimetype,
  });

  const base = process.env.MINIO_PUBLIC_URL ?? `http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT ?? 9000}`;
  const url = `${base}/${bucket}/${objectName}`;
  return res.json({ url });
});

// ─── OG Image Extraction ──────────────────────────────────────────────────────

router.get('/og-image', async (req, res) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).json({ imageUrl: null, error: 'Missing url parameter' });

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return res.status(400).json({ imageUrl: null, error: 'Invalid URL' });
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    return res.status(400).json({ imageUrl: null, error: 'Only http/https URLs are allowed' });
  }
  // Block private/internal IPs (SSRF protection)
  const hostname = parsedUrl.hostname;
  if (/^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|0\.|localhost|::1|\[::1\])/.test(hostname)) {
    return res.status(400).json({ imageUrl: null, error: 'Internal URLs are not allowed' });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Lalela-Bot/1.0 (OG Image Fetcher)' },
      redirect: 'follow',
    });
    clearTimeout(timeout);

    if (!response.ok) return res.json({ imageUrl: null });

    const html = await response.text();

    const ogMatch =
      html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogMatch?.[1]) return res.json({ imageUrl: new URL(ogMatch[1], url).href });

    const touchMatch = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i);
    if (touchMatch?.[1]) return res.json({ imageUrl: new URL(touchMatch[1], url).href });

    const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i);
    if (faviconMatch?.[1]) return res.json({ imageUrl: new URL(faviconMatch[1], url).href });

    return res.json({ imageUrl: null });
  } catch {
    return res.json({ imageUrl: null });
  }
});

// ─── Gemini Search (server-side proxy) ───────────────────────────────────────

router.post('/gemini-search', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'Gemini API key not configured' });

  const { categories, coverageArea } = req.body as {
    categories: string[];
    coverageArea: { location_name: string; latitude: number; longitude: number; radius: number };
  };

  if (!categories?.length || !coverageArea) {
    return res.status(400).json({ error: 'Missing categories or coverageArea' });
  }

  try {
    const { GoogleGenAI, Type } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Search for real, popular, and highly-rated businesses in the following categories: ${categories.join(', ')}.
The search area is ${coverageArea.location_name} (Latitude: ${coverageArea.latitude}, Longitude: ${coverageArea.longitude}) within a ${coverageArea.radius}km radius.
Return a list of businesses with their real names, verified addresses, coordinates, ratings, and descriptions.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              latitude: { type: Type.NUMBER },
              longitude: { type: Type.NUMBER },
              rating: { type: Type.NUMBER },
              description: { type: Type.STRING },
              category: { type: Type.STRING },
              phone: { type: Type.STRING },
              website: { type: Type.STRING },
            },
            required: ['name', 'address', 'latitude', 'longitude'],
          },
        },
      },
    });

    return res.json(JSON.parse(response.text || '[]'));
  } catch (err) {
    console.error('[gemini-search]', err);
    return res.status(500).json({ error: 'Gemini search failed' });
  }
});

// ─── Public communities (unauthenticated) ─────────────────────────────────────

router.get('/public/communities', async (_req, res) => {
  try {
    const communities = await getPublicCommunities();
    return res.json(communities);
  } catch (err) {
    console.error('[public/communities]', err);
    return res.status(500).json({ error: 'Failed to fetch communities' });
  }
});

// ─── Moderation & Reports ──────────────────────────────────────────────────────

router.post('/reports', requireAuth, async (req, res) => {
  // TODO: persist to moderation_reports table
  console.log('[report]', req.body);
  return res.status(201).json({ message: 'Report submitted' });
});

router.get('/admin/reports', requireAuth, async (_req, res) => {
  return res.json([]);
});

// ─── Stripe mock ──────────────────────────────────────────────────────────────

router.post('/stripe/webhook-mock', (req, res) => {
  const { type, targetId } = req.body;
  console.log(`[Stripe Mock] ${type} ${targetId ?? ''}`);
  return res.json({ message: 'Webhook processed', status: 'LICENSED' });
});

export default router;
