import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

// ─── List businesses ──────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
  const { communityId, category, status } = req.query;
  const businesses = await prisma.business.findMany({
    where: {
      ...(communityId ? { community_ids: { has: communityId as string } } : {}),
      ...(category ? { category: category as string } : {}),
      ...(status ? { status: status as never } : { status: 'ACTIVE' }),
    },
    include: { owner: { select: { id: true, name: true } } },
    orderBy: { created_at: 'desc' },
  });
  return res.json(businesses);
});

router.get('/mine', async (req, res) => {
  const businesses = await prisma.business.findMany({
    where: { owner_id: req.auth!.userId },
    orderBy: { created_at: 'desc' },
  });
  return res.json(businesses);
});

router.get('/:id', async (req, res) => {
  const business = await prisma.business.findUnique({ where: { id: req.params.id } });
  if (!business) return res.status(404).json({ error: 'Business not found' });
  return res.json(business);
});

router.post('/', async (req, res) => {
  const { name, category, description, community_ids, latitude, longitude, address, phone, website, image_url, charity_id } = req.body;
  if (!name?.trim() || !category) return res.status(400).json({ error: 'name and category are required' });

  const business = await prisma.business.create({
    data: {
      owner_id: req.auth!.userId,
      name: name.trim(),
      category,
      description,
      community_ids: community_ids ?? [],
      latitude,
      longitude,
      address,
      phone,
      website,
      image_url,
      charity_id,
    },
  });
  return res.status(201).json(business);
});

router.put('/:id', async (req, res) => {
  const existing = await prisma.business.findFirst({ where: { id: req.params.id, owner_id: req.auth!.userId } });
  if (!existing) return res.status(403).json({ error: 'Not found or unauthorized' });

  const business = await prisma.business.update({ where: { id: req.params.id }, data: req.body });
  return res.json(business);
});

router.delete('/:id', async (req, res) => {
  await prisma.business.deleteMany({ where: { id: req.params.id, owner_id: req.auth!.userId } });
  return res.json({ message: 'Business deleted' });
});

// ─── Bulk import (admin) ──────────────────────────────────────────────────────

router.post('/import', async (req, res) => {
  const { businesses, community_id } = req.body as {
    businesses: Array<{
      name: string; category: string; description?: string;
      latitude?: number; longitude?: number; address?: string;
      phone?: string; website?: string;
    }>;
    community_id?: string;
  };

  if (!Array.isArray(businesses) || businesses.length === 0) {
    return res.status(400).json({ error: 'businesses array is required' });
  }

  const created = await prisma.business.createMany({
    data: businesses.map((b) => ({
      owner_id: req.auth!.userId,
      name: b.name,
      category: b.category,
      description: b.description,
      latitude: b.latitude,
      longitude: b.longitude,
      address: b.address,
      phone: b.phone,
      website: b.website,
      community_ids: community_id ? [community_id] : [],
    })),
    skipDuplicates: true,
  });

  return res.status(201).json({ created: created.count });
});

export default router;
