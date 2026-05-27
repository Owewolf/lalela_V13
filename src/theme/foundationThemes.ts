import { THEME_COLORS } from './colors';

export type FoundationThemePresetId = 'lalela-light';

export type FoundationTheme = {
  presetId: FoundationThemePresetId;
  mode: 'light' | 'dark';
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  cardSurfaceColor: string;
  cardSurfaceMutedColor: string;
  cardBorderColor: string;
  textPrimary: string;
  textSecondary: string;
  borderRadius: string;
  fontFamily: string;
  iconUrl: string | null;
};

export const LALELA_LIGHT_THEME: FoundationTheme = {
  presetId: 'lalela-light',
  mode: 'light',
  name: 'Lalela',
  primaryColor: THEME_COLORS.primary,
  secondaryColor: THEME_COLORS.secondary,
  backgroundColor: THEME_COLORS.surfaceContainer,
  surfaceColor: THEME_COLORS.surfaceContainerLow,
  cardSurfaceColor: THEME_COLORS.surfaceContainerLow,
  cardSurfaceMutedColor: THEME_COLORS.surface,
  cardBorderColor: THEME_COLORS.neutralBorderSoft,
  textPrimary: THEME_COLORS.onSurface,
  textSecondary: THEME_COLORS.aliasHex_5a655d,
  borderRadius: '14px',
  fontFamily: 'Manrope',
  iconUrl: null,
};

export const FOUNDATION_THEMES: Record<FoundationThemePresetId, FoundationTheme> = {
  'lalela-light': LALELA_LIGHT_THEME,
};
