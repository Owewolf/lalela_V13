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
  primaryColor: '#0F4E55',
  secondaryColor: '#D86F41',
  backgroundColor: '#F0E6D9',
  surfaceColor: '#FAF6EF',
  cardSurfaceColor: '#FAF6EF',
  cardSurfaceMutedColor: '#F6EFE4',
  cardBorderColor: '#E2D7C3',
  textPrimary: '#16363C',
  textSecondary: '#5A655D',
  borderRadius: '14px',
  fontFamily: 'Manrope',
  iconUrl: null,
};

export const FOUNDATION_THEMES: Record<FoundationThemePresetId, FoundationTheme> = {
  'lalela-light': LALELA_LIGHT_THEME,
};

export function getFoundationTheme(presetId: FoundationThemePresetId): FoundationTheme {
  return FOUNDATION_THEMES[presetId];
}

export function isFoundationThemePresetId(value: unknown): value is FoundationThemePresetId {
  return value === 'lalela-light';
}
