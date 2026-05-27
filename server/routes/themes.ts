import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import {
  FOUNDATION_THEMES,
  getFoundationTheme,
  isFoundationThemePresetId,
  type FoundationThemePresetId,
} from '../lib/foundationThemes.js';

const router = Router();

router.use(requireAuth);

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const DEFAULT_THEME = getFoundationTheme('lalela-light');

function isUnknownPrismaArgument(error: unknown, argument: string): boolean {
  const message = (error as any)?.message;
  return typeof message === 'string' && message.includes(`Unknown argument \`${argument}\``);
}

type ThemePayload = {
  presetId?: FoundationThemePresetId;
  mode?: 'light' | 'dark';
  name?: string;
  primaryColor?: string;
  secondaryColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  cardSurfaceColor?: string;
  cardSurfaceMutedColor?: string;
  cardBorderColor?: string;
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

function normalizeThemeName(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_THEME.name;
  const trimmed = value.trim();
  if (!trimmed) return DEFAULT_THEME.name;

  const lower = trimmed.toLowerCase();
  if (lower === 'lalela light' || lower === 'lalela (baseline)') {
    return DEFAULT_THEME.name;
  }

  return trimmed;
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
  const presetId = (theme.presetId ?? 'lalela-light') as FoundationThemePresetId;
  const preset = getFoundationTheme(presetId);
  const mode = 'light';
  const fallbackCardSurface = preset.cardSurfaceColor;
  const fallbackCardSurfaceMuted = preset.cardSurfaceMutedColor;
  const fallbackCardBorder = preset.cardBorderColor;

  return {
    id: theme.id,
    communityId: theme.communityId ?? null,
    presetId,
    mode,
    name: normalizeThemeName(theme.name),
    primaryColor: theme.primaryColor,
    secondaryColor: theme.secondaryColor,
    backgroundColor: theme.backgroundColor,
    surfaceColor: theme.surfaceColor,
    cardSurfaceColor: theme.cardSurfaceColor ?? fallbackCardSurface,
    cardSurfaceMutedColor: theme.cardSurfaceMutedColor ?? fallbackCardSurfaceMuted,
    cardBorderColor: theme.cardBorderColor ?? fallbackCardBorder,
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
  let dbDefault: any = null;

  try {
    dbDefault = await prisma.theme.findFirst({
      where: { isDefault: true, presetId: 'lalela-light' } as any,
      orderBy: { updatedAt: 'desc' },
    } as any);
  } catch (error) {
    if (!isUnknownPrismaArgument(error, 'presetId')) throw error;

    // Backward compatibility for deployments where Theme model has not been
    // regenerated yet and preset_id is unavailable in Prisma Client.
    dbDefault = await prisma.theme.findFirst({
      where: { isDefault: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  if (dbDefault) return dbDefault;

  return {
    id: 'system-default-theme',
    communityId: null,
    ...DEFAULT_THEME,
    presetId: DEFAULT_THEME.presetId,
    mode: DEFAULT_THEME.mode,
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
    return res.json({
      source: 'community',
      theme: toClientTheme(theme),
      presets: Object.values(FOUNDATION_THEMES),
    });
  }

  const fallback = await getFallbackTheme();
  return res.json({
    source: 'fallback',
    theme: toClientTheme(fallback),
    presets: Object.values(FOUNDATION_THEMES),
  });
});

router.put('/community/:communityId', async (req, res) => {
  const communityId = req.params.communityId;
  const userId = req.auth!.userId;
  const body = req.body as ThemePayload;

  const role = await getCommunityRole(communityId, userId);
  if (!isAdminRole(role)) {
    return res.status(403).json({ error: 'Only community admins can edit themes' });
  }

  const community = await prisma.community.findUnique({ where: { id: communityId }, select: { id: true, name: true } });
  if (!community) {
    return res.status(404).json({ error: 'Community not found' });
  }

  const existing = await prisma.theme.findUnique({ where: { communityId } });
  const fallback = await getFallbackTheme();

  let presetId: FoundationThemePresetId = (existing?.presetId as FoundationThemePresetId) || 'lalela-light';
  if (body.presetId !== undefined) {
    if (!isFoundationThemePresetId(body.presetId)) {
      return res.status(400).json({ error: 'Invalid presetId; expected lalela-light' });
    }
    presetId = body.presetId;
  }

  const preset = getFoundationTheme(presetId);
  const baseTheme = existing ?? fallback;
  const derivedMode: 'light' = 'light';

  const initialName = normalizeThemeName(body.name?.trim() ?? baseTheme.name ?? preset.name);
  const isCustomizedFromBaseline = (
    (body.primaryColor?.trim() ?? baseTheme.primaryColor ?? preset.primaryColor) !== preset.primaryColor ||
    (body.secondaryColor?.trim() ?? baseTheme.secondaryColor ?? preset.secondaryColor) !== preset.secondaryColor ||
    (body.backgroundColor?.trim() ?? baseTheme.backgroundColor ?? preset.backgroundColor) !== preset.backgroundColor ||
    (body.surfaceColor?.trim() ?? baseTheme.surfaceColor ?? preset.surfaceColor) !== preset.surfaceColor ||
    (body.textPrimary?.trim() ?? baseTheme.textPrimary ?? preset.textPrimary) !== preset.textPrimary ||
    (body.textSecondary?.trim() ?? baseTheme.textSecondary ?? preset.textSecondary) !== preset.textSecondary ||
    (body.borderRadius?.trim() ?? baseTheme.borderRadius ?? preset.borderRadius) !== preset.borderRadius ||
    (body.fontFamily?.trim() ?? baseTheme.fontFamily ?? preset.fontFamily) !== preset.fontFamily ||
    (body.iconUrl !== undefined ? normalizeIconUrl(body.iconUrl) : (baseTheme.iconUrl ?? preset.iconUrl)) !== (preset.iconUrl ?? null)
  );

  const shouldAutoName =
    isCustomizedFromBaseline &&
    (!body.name?.trim() || normalizeThemeName(initialName).toLowerCase() === preset.name.trim().toLowerCase());

  const autoName = `${community.name} Theme`.slice(0, 80);

  const candidate = {
    presetId,
    mode: derivedMode,
    name: shouldAutoName ? autoName : normalizeThemeName(initialName),
    primaryColor: body.primaryColor?.trim() ?? baseTheme.primaryColor ?? preset.primaryColor,
    secondaryColor: body.secondaryColor?.trim() ?? baseTheme.secondaryColor ?? preset.secondaryColor,
    backgroundColor: body.backgroundColor?.trim() ?? baseTheme.backgroundColor ?? preset.backgroundColor,
    surfaceColor: body.surfaceColor?.trim() ?? baseTheme.surfaceColor ?? preset.surfaceColor,
    cardSurfaceColor: body.cardSurfaceColor?.trim() ?? baseTheme.cardSurfaceColor ?? preset.cardSurfaceColor,
    cardSurfaceMutedColor: body.cardSurfaceMutedColor?.trim() ?? baseTheme.cardSurfaceMutedColor ?? preset.cardSurfaceMutedColor,
    cardBorderColor: body.cardBorderColor?.trim() ?? baseTheme.cardBorderColor ?? preset.cardBorderColor,
    textPrimary: body.textPrimary?.trim() ?? baseTheme.textPrimary ?? preset.textPrimary,
    textSecondary: body.textSecondary?.trim() ?? baseTheme.textSecondary ?? preset.textSecondary,
    borderRadius: body.borderRadius?.trim() ?? baseTheme.borderRadius ?? preset.borderRadius,
    fontFamily: body.fontFamily?.trim() ?? baseTheme.fontFamily ?? preset.fontFamily,
    iconUrl: body.iconUrl !== undefined ? normalizeIconUrl(body.iconUrl) : (baseTheme.iconUrl ?? preset.iconUrl),
  };

  if (!isValidShortString(candidate.name, 80)) {
    return res.status(400).json({ error: 'Theme name is required and must be under 80 characters' });
  }
  if (!isValidColor(candidate.primaryColor)) return res.status(400).json({ error: 'Invalid primaryColor format' });
  if (!isValidColor(candidate.secondaryColor)) return res.status(400).json({ error: 'Invalid secondaryColor format' });
  if (!isValidColor(candidate.backgroundColor)) return res.status(400).json({ error: 'Invalid backgroundColor format' });
  if (!isValidColor(candidate.surfaceColor)) return res.status(400).json({ error: 'Invalid surfaceColor format' });
  if (!isValidColor(candidate.cardSurfaceColor)) return res.status(400).json({ error: 'Invalid cardSurfaceColor format' });
  if (!isValidColor(candidate.cardSurfaceMutedColor)) return res.status(400).json({ error: 'Invalid cardSurfaceMutedColor format' });
  if (!isValidColor(candidate.cardBorderColor)) return res.status(400).json({ error: 'Invalid cardBorderColor format' });
  if (!isValidColor(candidate.textPrimary)) return res.status(400).json({ error: 'Invalid textPrimary format' });
  if (!isValidColor(candidate.textSecondary)) return res.status(400).json({ error: 'Invalid textSecondary format' });
  if (!isValidShortString(candidate.borderRadius, 24)) return res.status(400).json({ error: 'Invalid borderRadius value' });
  if (!isValidShortString(candidate.fontFamily, 120)) return res.status(400).json({ error: 'Invalid fontFamily value' });
  if (body.iconUrl !== undefined && body.iconUrl !== null && normalizeIconUrl(body.iconUrl) === null) {
    return res.status(400).json({ error: 'iconUrl must be a valid http/https URL' });
  }

  const baseCreate = {
    community: { connect: { id: communityId } },
    isDefault: false,
    name: candidate.name,
    primaryColor: candidate.primaryColor,
    secondaryColor: candidate.secondaryColor,
    backgroundColor: candidate.backgroundColor,
    surfaceColor: candidate.surfaceColor,
    textPrimary: candidate.textPrimary,
    textSecondary: candidate.textSecondary,
    borderRadius: candidate.borderRadius,
    fontFamily: candidate.fontFamily,
    iconUrl: candidate.iconUrl,
  };
  const baseUpdate = {
    name: candidate.name,
    primaryColor: candidate.primaryColor,
    secondaryColor: candidate.secondaryColor,
    backgroundColor: candidate.backgroundColor,
    surfaceColor: candidate.surfaceColor,
    textPrimary: candidate.textPrimary,
    textSecondary: candidate.textSecondary,
    borderRadius: candidate.borderRadius,
    fontFamily: candidate.fontFamily,
    iconUrl: candidate.iconUrl,
  };

  const extendedCreate = {
    ...baseCreate,
    presetId: candidate.presetId,
    mode: candidate.mode,
    cardSurfaceColor: candidate.cardSurfaceColor,
    cardSurfaceMutedColor: candidate.cardSurfaceMutedColor,
    cardBorderColor: candidate.cardBorderColor,
  };
  const extendedUpdate = {
    ...baseUpdate,
    presetId: candidate.presetId,
    mode: candidate.mode,
    cardSurfaceColor: candidate.cardSurfaceColor,
    cardSurfaceMutedColor: candidate.cardSurfaceMutedColor,
    cardBorderColor: candidate.cardBorderColor,
  };

  let theme: any;
  try {
    theme = await prisma.theme.upsert({
      where: { communityId },
      create: extendedCreate as any,
      update: extendedUpdate as any,
    });
  } catch (error) {
    if (
      !isUnknownPrismaArgument(error, 'presetId') &&
      !isUnknownPrismaArgument(error, 'mode') &&
      !isUnknownPrismaArgument(error, 'cardSurfaceColor') &&
      !isUnknownPrismaArgument(error, 'cardSurfaceMutedColor') &&
      !isUnknownPrismaArgument(error, 'cardBorderColor')
    ) {
      throw error;
    }

    // Backward compatibility fallback for old Prisma Client schema.
    theme = await prisma.theme.upsert({
      where: { communityId },
      create: baseCreate,
      update: baseUpdate,
    });
  }

  return res.json({
    source: 'community',
    theme: toClientTheme(theme),
    presets: Object.values(FOUNDATION_THEMES),
  });
});

export default router;
