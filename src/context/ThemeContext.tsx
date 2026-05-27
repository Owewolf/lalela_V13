import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import api from '../lib/api';
import { useAuth } from './AuthContext';
import { useCommunity } from './CommunityContext';
import { APP_SHELL_COLORS, THEME_COLORS } from '../theme/colors';
import { FOUNDATION_THEMES, LALELA_LIGHT_THEME, type FoundationThemePresetId } from '../theme/foundationThemes';

type ThemeSource = 'community' | 'fallback';

type ThemeConfig = {
  id?: string;
  communityId?: string | null;
  presetId?: FoundationThemePresetId;
  mode?: 'light' | 'dark';
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  cardSurfaceColor?: string;
  cardSurfaceMutedColor?: string;
  cardBorderColor?: string;
  textPrimary: string;
  textSecondary: string;
  borderRadius: string;
  fontFamily: string;
  iconUrl?: string | null;
};

type ThemeResponse = {
  source: ThemeSource;
  theme: ThemeConfig;
  presets?: Array<(typeof FOUNDATION_THEMES)[keyof typeof FOUNDATION_THEMES]>;
};

type ThemeContextValue = {
  theme: ThemeConfig;
  source: ThemeSource;
  loading: boolean;
  refreshTheme: () => Promise<void>;
  updateTheme: (patch: Partial<ThemeConfig>) => Promise<ThemeConfig>;
};

const DEFAULT_THEME: ThemeConfig = {
  ...LALELA_LIGHT_THEME,
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const sanitized = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(sanitized)) {
    return null;
  }

  const r = parseInt(sanitized.slice(0, 2), 16);
  const g = parseInt(sanitized.slice(2, 4), 16);
  const b = parseInt(sanitized.slice(4, 6), 16);
  return { r, g, b };
}

function relativeLuminance(hex: string): number | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;

  const channel = (value: number): number => {
    const srgb = value / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  };

  const r = channel(rgb.r);
  const g = channel(rgb.g);
  const b = channel(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function resolveBodyAndCardColors(theme: ThemeConfig): { bodyColor: string; cardColor: string } {
  const backgroundColor = theme.backgroundColor;
  const surfaceColor = theme.surfaceColor;

  if (theme.mode !== 'light') {
    return { bodyColor: backgroundColor, cardColor: surfaceColor };
  }

  const bgLum = relativeLuminance(backgroundColor);
  const surfaceLum = relativeLuminance(surfaceColor);

  if (bgLum === null || surfaceLum === null || surfaceLum >= bgLum) {
    return { bodyColor: backgroundColor, cardColor: surfaceColor };
  }

  // Light-mode safeguard: cards should never end up darker than page body.
  return { bodyColor: surfaceColor, cardColor: backgroundColor };
}

function applyThemeToRuntime(theme: ThemeConfig): void {
  const mutableThemeColors = THEME_COLORS as unknown as Record<string, string>;
  const mutableShellColors = APP_SHELL_COLORS as unknown as Record<string, string>;

  const { bodyColor, cardColor: resolvedCardColor } = resolveBodyAndCardColors(theme);
  const cardColor = theme.cardSurfaceColor ?? resolvedCardColor;
  const cardMutedColor = theme.cardSurfaceMutedColor ?? resolvedCardColor;
  const cardBorderColor = theme.cardBorderColor ?? (theme.mode === 'dark' ? '#3A3F36' : '#E2D7C3');
  const chromeColor = cardColor;

  mutableThemeColors.primary = theme.primaryColor;
  mutableThemeColors.secondary = theme.secondaryColor;
  mutableThemeColors.surface = cardColor;
  mutableThemeColors.surfaceContainer = cardMutedColor;
  mutableThemeColors.surfaceContainerLow = cardColor;
  mutableThemeColors.neutralBg = bodyColor;
  mutableThemeColors.neutralBgSoft = bodyColor;
  mutableThemeColors.neutralBorderSoft = cardBorderColor;
  mutableThemeColors.neutralBgSofter = cardMutedColor;
  mutableThemeColors.pageBgSoft = bodyColor;
  mutableThemeColors.neutralTextStrong = theme.textPrimary;
  mutableThemeColors.neutralTextDefault = theme.textSecondary;

  mutableShellColors.chrome = chromeColor;
  mutableShellColors.body = bodyColor;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', theme.primaryColor);
    root.style.setProperty('--theme-secondary', theme.secondaryColor);
    root.style.setProperty('--theme-background', bodyColor);
    root.style.setProperty('--theme-surface', theme.surfaceColor);
    root.style.setProperty('--theme-card-surface', cardColor);
    root.style.setProperty('--theme-card-surface-muted', cardMutedColor);
    root.style.setProperty('--theme-card-border', cardBorderColor);
    root.style.setProperty('--theme-text-primary', theme.textPrimary);
    root.style.setProperty('--theme-text-secondary', theme.textSecondary);
    root.style.setProperty('--theme-radius', theme.borderRadius);
    root.style.setProperty('--theme-font-family', theme.fontFamily);
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthReady, loading: authLoading } = useAuth();
  const { currentCommunity } = useCommunity();
  const communityId = currentCommunity?.id || null;

  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [source, setSource] = useState<ThemeSource>('fallback');
  const [loading, setLoading] = useState<boolean>(true);

  const refreshTheme = useCallback(async () => {
    if (!isAuthReady) {
      return;
    }

    if (!communityId) {
      setTheme(DEFAULT_THEME);
      setSource('fallback');
      applyThemeToRuntime(DEFAULT_THEME);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get<ThemeResponse>(`/themes/community/${communityId}`);
      const nextTheme = data?.theme ?? DEFAULT_THEME;
      setTheme(nextTheme);
      setSource(data?.source ?? 'fallback');
      applyThemeToRuntime(nextTheme);
    } catch (error) {
      const status = (error as any)?.response?.status;
      setTheme(DEFAULT_THEME);
      setSource('fallback');
      applyThemeToRuntime(DEFAULT_THEME);
      if (status !== 401 && status !== 403) {
        console.error('[ThemeProvider] failed to load theme, using fallback', error);
      }
    } finally {
      setLoading(false);
    }
  }, [communityId, isAuthReady]);

  useEffect(() => {
    if (!isAuthReady) return;
    refreshTheme();
  }, [refreshTheme, isAuthReady]);

  const updateTheme = useCallback(async (patch: Partial<ThemeConfig>) => {
    if (!communityId) {
      throw new Error('Cannot update theme without an active community');
    }

    const { data } = await api.put<ThemeResponse>(`/themes/community/${communityId}`, patch);
    const nextTheme = data.theme;
    setTheme(nextTheme);
    setSource(data.source ?? 'community');
    applyThemeToRuntime(nextTheme);
    return nextTheme;
  }, [communityId]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    source,
    loading: loading || authLoading || !isAuthReady,
    refreshTheme,
    updateTheme,
  }), [theme, source, loading, authLoading, isAuthReady, refreshTheme, updateTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
