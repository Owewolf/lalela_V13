import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const DEFAULT_THEME = {
  name: 'Lalela Default',
  primaryColor: '#0d3d47',
  secondaryColor: '#9c4421',
  backgroundColor: '#fff8f0',
  surfaceColor: '#efeeeb',
  textPrimary: '#0f172a',
  textSecondary: '#64748b',
  borderRadius: '16px',
  fontFamily: 'System',
  iconUrl: null as string | null,
};

type ThemePayload = {
  name?: string;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textPrimary?: string;
  textSecondary?: string;
  borderRadius?: string;
  fontFamily?: string;
  iconUrl?: string | null;
};

function isValidColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR_RE.test(value.trim());
}

function isValidShortString(value: unknown, max = 120): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
}

function normalizeIconUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function getCommunityRole(communityId: string, userId: string): Promise<string | null> {
  const member = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId, userId } },
    select: { role: true },
  });
  return member?.role ?? null;
}

function isAdminRole(role?: string | null): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

function toClientTheme(theme: any) {
  return {
    id: theme.id,
    communityId: theme.communityId ?? null,
    name: theme.name,
    primaryColor: theme.primaryColor,
    secondaryColor: theme.secondaryColor,
    backgroundColor: theme.backgroundColor,
    surfaceColor: theme.surfaceColor,
    textPrimary: theme.textPrimary,
    textSecondary: theme.textSecondary,
    borderRadius: theme.borderRadius,
    fontFamily: theme.fontFamily,
    iconUrl: theme.iconUrl ?? null,
    isDefault: !!theme.isDefault,
    createdAt: theme.createdAt,
    updatedAt: theme.updatedAt,
  };
}

async function getFallbackTheme() {
  const dbDefault = await prisma.theme.findFirst({
    where: { isDefault: true },
    orderBy: { updatedAt: 'desc' },
  });

  if (dbDefault) return dbDefault;

  return {
    id: 'system-default-theme',
    communityId: null,
    ...DEFAULT_THEME,
    isDefault: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

router.get('/community/:communityId', async (req, res) => {
  const communityId = req.params.communityId;
  const userId = req.auth!.userId;

  const role = await getCommunityRole(communityId, userId);
  if (!role) {
    return res.status(403).json({ error: 'You are not a member of this community' });
  }

  const theme = await prisma.theme.findUnique({ where: { communityId } });
  if (theme) {
    return res.json({ source: 'community', theme: toClientTheme(theme) });
  }

  const fallback = await getFallbackTheme();
  return res.json({ source: 'fallback', theme: toClientTheme(fallback) });
});

router.put('/community/:communityId', async (req, res) => {
  const communityId = req.params.communityId;
  const userId = req.auth!.userId;
  const body = req.body as ThemePayload;

  const role = await getCommunityRole(communityId, userId);
  if (!isAdminRole(role)) {
    return res.status(403).json({ error: 'Only community admins can edit themes' });
  }

  const community = await prisma.community.findUnique({ where: { id: communityId }, select: { id: true } });
  if (!community) {
    return res.status(404).json({ error: 'Community not found' });
  }

  const existing = await prisma.theme.findUnique({ where: { communityId } });
  const fallback = await getFallbackTheme();

  const candidate = {
    name: body.name?.trim() ?? existing?.name ?? fallback.name,
    primaryColor: body.primaryColor?.trim() ?? existing?.primaryColor ?? fallback.primaryColor,
    secondaryColor: body.secondaryColor?.trim() ?? existing?.secondaryColor ?? fallback.secondaryColor,
    backgroundColor: body.backgroundColor?.trim() ?? existing?.backgroundColor ?? fallback.backgroundColor,
    surfaceColor: body.surfaceColor?.trim() ?? existing?.surfaceColor ?? fallback.surfaceColor,
    textPrimary: body.textPrimary?.trim() ?? existing?.textPrimary ?? fallback.textPrimary,
    textSecondary: body.textSecondary?.trim() ?? existing?.textSecondary ?? fallback.textSecondary,
    borderRadius: body.borderRadius?.trim() ?? existing?.borderRadius ?? fallback.borderRadius,
    fontFamily: body.fontFamily?.trim() ?? existing?.fontFamily ?? fallback.fontFamily,
    iconUrl: body.iconUrl !== undefined ? normalizeIconUrl(body.iconUrl) : (existing?.iconUrl ?? fallback.iconUrl),
  };

  if (!isValidShortString(candidate.name, 80)) {
    return res.status(400).json({ error: 'Theme name is required and must be under 80 characters' });
  }
  if (!isValidColor(candidate.primaryColor)) return res.status(400).json({ error: 'Invalid primaryColor format' });
  if (!isValidColor(candidate.secondaryColor)) return res.status(400).json({ error: 'Invalid secondaryColor format' });
  if (!isValidColor(candidate.backgroundColor)) return res.status(400).json({ error: 'Invalid backgroundColor format' });
  if (!isValidColor(candidate.surfaceColor)) return res.status(400).json({ error: 'Invalid surfaceColor format' });
  if (!isValidColor(candidate.textPrimary)) return res.status(400).json({ error: 'Invalid textPrimary format' });
  if (!isValidColor(candidate.textSecondary)) return res.status(400).json({ error: 'Invalid textSecondary format' });
  if (!isValidShortString(candidate.borderRadius, 24)) return res.status(400).json({ error: 'Invalid borderRadius value' });
  if (!isValidShortString(candidate.fontFamily, 120)) return res.status(400).json({ error: 'Invalid fontFamily value' });
  if (body.iconUrl !== undefined && body.iconUrl !== null && normalizeIconUrl(body.iconUrl) === null) {
    return res.status(400).json({ error: 'iconUrl must be a valid http/https URL' });
  }

  const theme = await prisma.theme.upsert({
    where: { communityId },
    create: {
      communityId,
      isDefault: false,
      ...candidate,
    },
    update: {
      ...candidate,
    },
  });

  return res.json({ source: 'community', theme: toClientTheme(theme) });
});

export default router;
