import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// Map DB snake_case → client camelCase
function toClient(b: any) {
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
    image: b.imageUrl,
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
    communityIds, community_ids,
    contactPhone, phone,
    contactEmail, website,
    image, image_url,
    charity_id, charityId,
    status,
  } = req.body;
  if (!name?.trim() || !category) return res.status(400).json({ error: 'name and category are required' });

  const business = await prisma.business.create({
    data: {
      ownerId: req.auth!.userId,
      name: name.trim(),
      category,
      description,
      communityIds: communityIds ?? communityIds ?? [],
      latitude,
      longitude,
      address,
      phone: contactPhone ?? phone,
      website: contactEmail ?? website,
      imageUrl: image ?? image_url,
      charityId: charityId ?? charity_id,
      status: status ?? 'ACTIVE',
    },
  });
  return res.status(201).json(toClient(business));
});

router.put('/:id', async (req, res) => {
  const existing = await prisma.business.findFirst({ where: { id: req.params.id, ownerId: req.auth!.userId } });
  if (!existing) return res.status(403).json({ error: 'Not found or unauthorized' });

  const {
    name, category, description, address,
    latitude, longitude,
    // client sends camelCase aliases
    communityIds, community_ids,
    contactPhone, phone,
    contactEmail, website,
    image, image_url,
    status,
    charity_id, charityId,
    subcategory,
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
      communityIds: communityIds ?? communityIds ?? existing.communityIds,
      phone: contactPhone ?? phone ?? existing.phone,
      website: contactEmail ?? website ?? existing.website,
      imageUrl: image ?? image_url ?? existing.imageUrl,
      charityId: charityId ?? charityId ?? existing.charityId,
    },
  });
  return res.json(toClient(business));
});

router.delete('/:id', async (req, res) => {
  await prisma.business.deleteMany({ where: { id: req.params.id, ownerId: req.auth!.userId } });
  return res.json({ message: 'Business deleted' });
});

// ─── Bulk import (admin) ──────────────────────────────────────────────────────

router.post('/import', async (req, res) => {
  const { businesses, community_id, communityId } = req.body as {
    businesses: Array<{
      name: string; category: string; description?: string;
      latitude?: number; longitude?: number; address?: string;
      phone?: string; website?: string; image_url?: string;
    }>;
    community_id?: string;
    communityId?: string;
  };

  if (!Array.isArray(businesses) || businesses.length === 0) {
    return res.status(400).json({ error: 'businesses array is required' });
  }

  const cid = communityId ?? communityId;

  const created = await prisma.business.createMany({
    data: businesses.map((b) => ({
      ownerId: req.auth!.userId,
      name: b.name,
      category: b.category,
      description: b.description,
      latitude: b.latitude,
      longitude: b.longitude,
      address: b.address,
      phone: b.phone,
      website: b.website,
      imageUrl: b.image_url,
      status: 'ACTIVE',
      source: 'IMPORT',
      communityIds: cid ? [cid] : [],
    })),
    skipDuplicates: true,
  });

  return res.status(201).json({ created: created.count });
});

export default router;
