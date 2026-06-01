import { Router } from 'express';
import { Client as MinioClient } from 'minio';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../db.js';
import type { Prisma } from '../generated/prisma/index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

type BusinessWithOwner = Prisma.BusinessGetPayload<{ include: { owner: { select: { id: true; name: true } } } }>;
type BusinessPlain = Prisma.BusinessGetPayload<Record<string, never>>;

const BUSINESS_PLACEHOLDER_IMAGE = '/defaults/business-placeholder.png';
const PLACE_MEDIA_MAX_HEIGHT = 720;

type GooglePlacePhoto = { name?: string | null };
type GooglePlaceDetails = {
  displayName?: { text?: string | null } | null;
  formattedAddress?: string | null;
  websiteUri?: string | null;
  nationalPhoneNumber?: string | null;
  iconMaskBaseUri?: string | null;
  photos?: GooglePlacePhoto[] | null;
};

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

function buildStoredMediaUrl(bucket: string, objectName: string): string {
  const explicitBase = process.env.MINIO_PUBLIC_URL?.replace(/\/$/, '');
  return explicitBase
    ? `${explicitBase}/${bucket}/${objectName}`
    : `/api/media/${bucket}/${objectName}`;
}

function encodePathSegments(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function normalizeGooglePlaceId(raw?: string | null): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  return trimmed.startsWith('places/') ? trimmed : `places/${trimmed}`;
}

function normalizeBusinessImageUrl(...candidates: Array<string | null | undefined>): string {
  for (const candidate of candidates) {
    const trimmed = String(candidate ?? '').trim();
    if (trimmed) return trimmed;
  }
  return BUSINESS_PLACEHOLDER_IMAGE;
}

function extensionForContentType(contentType?: string | null): string {
  const lower = String(contentType ?? '').toLowerCase();
  if (lower.includes('png')) return 'png';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('gif')) return 'gif';
  return 'jpg';
}

async function fetchGooglePlaceDetails(placeId: string, apiKey: string): Promise<GooglePlaceDetails | null> {
  const encoded = encodePathSegments(placeId);
  try {
    const response = await fetch(`https://places.googleapis.com/v1/${encoded}`, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': [
          'id',
          'displayName',
          'formattedAddress',
          'websiteUri',
          'nationalPhoneNumber',
          'iconMaskBaseUri',
          'photos',
        ].join(','),
      },
    });

    if (!response.ok) {
      const payload = await response.text().catch(() => '');
      console.error('[businesses/import] place details lookup failed', {
        placeId,
        status: response.status,
        payload,
      });
      return null;
    }

    return await response.json() as GooglePlaceDetails;
  } catch (error) {
    console.error('[businesses/import] place details request failed', { placeId, error });
    return null;
  }
}

async function fetchGooglePlacePhotoUrl(photoName: string, apiKey: string): Promise<string | null> {
  const encoded = encodePathSegments(photoName);
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/${encoded}/media?maxHeightPx=${PLACE_MEDIA_MAX_HEIGHT}&skipHttpRedirect=true`,
      {
        headers: {
          'X-Goog-Api-Key': apiKey,
        },
      }
    );

    if (!response.ok) {
      const payload = await response.text().catch(() => '');
      console.error('[businesses/import] place photo metadata failed', {
        photoName,
        status: response.status,
        payload,
      });
      return null;
    }

    const payload = await response.json() as { photoUri?: string };
    return payload.photoUri || null;
  } catch (error) {
    console.error('[businesses/import] place photo metadata request failed', { photoName, error });
    return null;
  }
}

async function uploadPlacePhotoToMinio(photoUrl: string): Promise<string | null> {
  const minio = getMinioClient();
  if (!minio) {
    console.error('[businesses/import] storage unavailable: MINIO_ENDPOINT missing');
    return null;
  }

  const bucket = process.env.MINIO_BUCKET ?? 'lalela';

  try {
    const response = await fetch(photoUrl);
    if (!response.ok) {
      console.error('[businesses/import] place photo download failed', {
        status: response.status,
        photoUrl,
      });
      return null;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const ext = extensionForContentType(contentType);
    const objectName = `businesses/${uuidv4()}/cover.${ext}`;
    const buffer = Buffer.from(await response.arrayBuffer());

    const exists = await minio.bucketExists(bucket);
    if (!exists) await minio.makeBucket(bucket, 'us-east-1');

    await minio.putObject(bucket, objectName, buffer, buffer.length, {
      'Content-Type': contentType,
    });

    return buildStoredMediaUrl(bucket, objectName);
  } catch (error) {
    console.error('[businesses/import] place photo upload failed', { photoUrl, error });
    return null;
  }
}

async function deleteMinioObjectIfManaged(imageUrl?: string | null): Promise<void> {
  const raw = String(imageUrl ?? '').trim();
  if (!raw) return;

  const minio = getMinioClient();
  if (!minio) return;

  const parsePath = (value: string): string => {
    if (/^https?:\/\//i.test(value)) {
      try {
        return new URL(value).pathname;
      } catch {
        return value;
      }
    }
    return value;
  };

  const path = parsePath(raw);

  // Path-style URL emitted by API: /api/media/<bucket>/<objectName>
  const apiPrefix = '/api/media/';
  if (path.startsWith(apiPrefix)) {
    const remainder = path.slice(apiPrefix.length);
    const [bucket, ...objectParts] = remainder.split('/').filter(Boolean);
    if (!bucket || objectParts.length === 0) return;
    await minio.removeObject(bucket, objectParts.join('/')).catch((error) => {
      console.error('[businesses/image] failed to remove old MinIO object', { imageUrl, error });
    });
    return;
  }

  // Explicit public URL style: <MINIO_PUBLIC_URL>/<bucket>/<objectName>
  const explicitBase = process.env.MINIO_PUBLIC_URL?.replace(/\/$/, '');
  if (!explicitBase || !raw.startsWith(explicitBase)) return;

  const remainder = raw.slice(explicitBase.length).replace(/^\//, '');
  const [bucket, ...objectParts] = remainder.split('/').filter(Boolean);
  if (!bucket || objectParts.length === 0) return;

  await minio.removeObject(bucket, objectParts.join('/')).catch((error) => {
    console.error('[businesses/image] failed to remove old MinIO object', { imageUrl, error });
  });
}

async function ensureAdminForAnyCommunity(userId: string, communityIds: string[]): Promise<boolean> {
  if (!Array.isArray(communityIds) || communityIds.length === 0) return false;
  const adminMembership = await prisma.communityMember.findFirst({
    where: {
      userId,
      communityId: { in: communityIds },
      role: { in: ['ADMIN', 'OWNER'] },
      status: 'ACTIVE',
    },
    select: { communityId: true },
  });
  return Boolean(adminMembership);
}

async function resolveBusinessImportImage(googlePlaceId?: string | null): Promise<{
  imageUrl: string;
  imageImportedAt: Date | null;
  details: GooglePlaceDetails | null;
  didImport: boolean;
}> {
  const fallback = {
    imageUrl: BUSINESS_PLACEHOLDER_IMAGE,
    imageImportedAt: null,
    details: null,
    didImport: false,
  };

  const normalizedPlaceId = normalizeGooglePlaceId(googlePlaceId);
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!normalizedPlaceId || !apiKey) return fallback;

  const details = await fetchGooglePlaceDetails(normalizedPlaceId, apiKey);
  if (!details) return fallback;

  const secondSourceCandidates: string[] = (() => {
    const base = String(details.iconMaskBaseUri ?? '').trim();
    if (!base) return [];
    if (/\.(png|jpg|jpeg|webp|gif|svg)(\?.*)?$/i.test(base)) return [base];
    return [`${base}.png`, `${base}.svg`, base];
  })();

  const firstPhotoName = details.photos?.find((photo) => typeof photo?.name === 'string' && photo.name.trim().length > 0)?.name;
  if (!firstPhotoName) {
    for (const candidateUrl of secondSourceCandidates) {
      const uploadedSecondSource = await uploadPlacePhotoToMinio(candidateUrl);
      if (uploadedSecondSource) {
        return {
          imageUrl: uploadedSecondSource,
          imageImportedAt: new Date(),
          details,
          didImport: true,
        };
      }
    }
    return { ...fallback, details };
  }

  const photoUrl = await fetchGooglePlacePhotoUrl(firstPhotoName, apiKey);
  if (!photoUrl) {
    return { ...fallback, details };
  }

  const uploadedImageUrl = await uploadPlacePhotoToMinio(photoUrl);
  if (!uploadedImageUrl) {
    for (const candidateUrl of secondSourceCandidates) {
      const uploadedSecondSource = await uploadPlacePhotoToMinio(candidateUrl);
      if (uploadedSecondSource) {
        return {
          imageUrl: uploadedSecondSource,
          imageImportedAt: new Date(),
          details,
          didImport: true,
        };
      }
    }
    return { ...fallback, details };
  }

  return {
    imageUrl: uploadedImageUrl,
    imageImportedAt: new Date(),
    details,
    didImport: true,
  };
}

// Map DB snake_case → client camelCase
function toClient(b: BusinessWithOwner | BusinessPlain) {
  const normalizedImageUrl = normalizeBusinessImageUrl(b.imageUrl);
  return {
    id: b.id,
    ownerId: b.ownerId,
    name: b.name,
    category: b.category,
    description: b.description,
    address: b.address,
    latitude: b.latitude,
    longitude: b.longitude,
    communityIds: b.communityIds ?? [],
    contactPhone: b.phone,
    contactEmail: b.website,
    image: normalizedImageUrl,
    imageUrl: normalizedImageUrl,
    imageImportedAt: b.imageImportedAt,
    googlePlaceId: b.googlePlaceId,
    charityId: b.charityId,
    status: b.status,
    source: b.source ?? 'MEMBER',
    subcategory: b.subcategory,
    charityPercentage: b.charityPercentage,
    rating: b.rating,
  };
}

// ─── List businesses ──────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const { communityId, category, status } = req.query;
  const businesses = await prisma.business.findMany({
    where: {
      ...(communityId ? { communityIds: { has: communityId as string } } : {}),
      ...(category ? { category: category as string } : {}),
      ...(status ? { status: status as never } : { status: 'ACTIVE' }),
    },
    include: { owner: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(businesses.map(toClient));
});

router.get('/mine', async (req, res) => {
  const businesses = await prisma.business.findMany({
    where: { ownerId: req.auth!.userId },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(businesses.map(toClient));
});

router.get('/:id', async (req, res) => {
  const business = await prisma.business.findUnique({ where: { id: req.params.id } });
  if (!business) return res.status(404).json({ error: 'Business not found' });
  return res.json(toClient(business));
});

router.post('/', async (req, res) => {
  const {
    name, category, description, address, latitude, longitude,
    communityIds,
    contactPhone,
    contactEmail,
    image,
    imageUrl,
    charityId,
    status,
    googlePlaceId,
  } = req.body;
  if (!name?.trim() || !category) return res.status(400).json({ error: 'name and category are required' });

  const business = await prisma.business.create({
    data: {
      ownerId: req.auth!.userId,
      name: name.trim(),
      category,
      description,
      communityIds: communityIds ?? [],
      latitude,
      longitude,
      address,
      phone: contactPhone,
      website: contactEmail,
      imageUrl: normalizeBusinessImageUrl(imageUrl, image),
      googlePlaceId: normalizeGooglePlaceId(googlePlaceId),
      charityId,
      status: status ?? 'ACTIVE',
    },
  });
  return res.status(201).json(toClient(business));
});

router.put('/:id', async (req, res) => {
  const existing = await prisma.business.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Business not found' });

  const isOwner = existing.ownerId === req.auth!.userId;
  let isCommunityAdmin = false;
  if (!isOwner) {
    isCommunityAdmin = await ensureAdminForAnyCommunity(req.auth!.userId, existing.communityIds);
  }

  if (!isOwner && !isCommunityAdmin) {
    return res.status(403).json({ error: 'Not found or unauthorized' });
  }

  const {
    name, category, description, address,
    latitude, longitude,
    communityIds,
    contactPhone,
    contactEmail,
    image,
    imageUrl,
    status,
    charityId,
    subcategory,
    googlePlaceId,
  } = req.body;

  const business = await prisma.business.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(address !== undefined ? { address } : {}),
      ...(latitude !== undefined ? { latitude: Number(latitude) } : {}),
      ...(longitude !== undefined ? { longitude: Number(longitude) } : {}),
      ...(status !== undefined ? { status } : {}),
      communityIds: communityIds ?? existing.communityIds,
      phone: contactPhone ?? existing.phone,
      website: contactEmail ?? existing.website,
      imageUrl: normalizeBusinessImageUrl(imageUrl, image, existing.imageUrl),
      googlePlaceId: normalizeGooglePlaceId(googlePlaceId) ?? existing.googlePlaceId,
      charityId: charityId ?? existing.charityId,
    },
  });
  return res.json(toClient(business));
});

router.delete('/:id', async (req, res) => {
  const existing = await prisma.business.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: 'Business not found' });

  const isOwner = existing.ownerId === req.auth!.userId;
  let isCommunityAdmin = false;
  if (!isOwner) {
    isCommunityAdmin = await ensureAdminForAnyCommunity(req.auth!.userId, existing.communityIds);
  }

  if (!isOwner && !isCommunityAdmin) {
    return res.status(403).json({ error: 'Not found or unauthorized' });
  }

  await prisma.business.delete({ where: { id: req.params.id } });
  return res.json({ message: 'Business deleted' });
});

// ─── Bulk import (admin) ──────────────────────────────────────────────────────

router.post('/import', async (req, res) => {
  const { businesses, communityId } = req.body as {
    businesses: Array<{
      name: string; category: string; description?: string;
      latitude?: number; longitude?: number; address?: string;
      phone?: string; website?: string; imageUrl?: string;
      googlePlaceId?: string;
    }>;
    communityId?: string;
  };

  if (!Array.isArray(businesses) || businesses.length === 0) {
    return res.status(400).json({ error: 'businesses array is required' });
  }

  let created = 0;
  let failed = 0;

  for (const b of businesses) {
    try {
      const normalizedPlaceId = normalizeGooglePlaceId(b.googlePlaceId);
      const imageResult = await resolveBusinessImportImage(normalizedPlaceId);
      const details = imageResult.details;

      await prisma.business.create({
        data: {
          ownerId: req.auth!.userId,
          name: String(b.name || details?.displayName?.text || '').trim() || 'Untitled Business',
          category: b.category,
          description: b.description,
          latitude: b.latitude,
          longitude: b.longitude,
          address: b.address ?? details?.formattedAddress ?? undefined,
          phone: b.phone ?? details?.nationalPhoneNumber ?? undefined,
          website: b.website ?? details?.websiteUri ?? undefined,
          imageUrl: normalizeBusinessImageUrl(imageResult.imageUrl, b.imageUrl),
          imageImportedAt: imageResult.imageImportedAt,
          googlePlaceId: normalizedPlaceId,
          status: 'ACTIVE',
          source: 'IMPORT',
          communityIds: communityId ? [communityId] : [],
        },
      });

      created += 1;
    } catch (error) {
      failed += 1;
      console.error('[businesses/import] failed to create business', {
        name: b?.name,
        googlePlaceId: b?.googlePlaceId,
        error,
      });
    }
  }

  return res.status(201).json({ created, failed });
});

router.post('/:id/reload-image', async (req, res) => {
  const business = await prisma.business.findUnique({ where: { id: req.params.id } });
  if (!business) return res.status(404).json({ error: 'Business not found' });

  const isOwner = business.ownerId === req.auth!.userId;
  const isCommunityAdmin = isOwner
    ? false
    : await ensureAdminForAnyCommunity(req.auth!.userId, business.communityIds);

  if (!isOwner && !isCommunityAdmin) {
    return res.status(403).json({ error: 'Not found or unauthorized' });
  }

  if (!business.googlePlaceId) {
    return res.status(400).json({ error: 'Business has no Google Place ID to reload from' });
  }

  const imageResult = await resolveBusinessImportImage(business.googlePlaceId);
  if (!imageResult.didImport) {
    return res.status(502).json({ error: 'Failed to reload business image from Google Places' });
  }

  const previousImage = business.imageUrl;
  const updated = await prisma.business.update({
    where: { id: business.id },
    data: {
      imageUrl: imageResult.imageUrl,
      imageImportedAt: imageResult.imageImportedAt,
    },
  });

  if (previousImage && previousImage !== imageResult.imageUrl) {
    await deleteMinioObjectIfManaged(previousImage);
  }

  return res.json(toClient(updated));
});

export default router;
