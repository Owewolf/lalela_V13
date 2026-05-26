import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import api from '../lib/api';
import { useCommunity } from './CommunityContext';
import { THEME_COLORS } from '../theme/colors';

type ThemeSource = 'community' | 'fallback';

type ThemeConfig = {
  id?: string;
  communityId?: string | null;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textPrimary: string;
  textSecondary: string;
  borderRadius: string;
  fontFamily: string;
  iconUrl?: string | null;
};

type ThemeContextValue = {
  theme: ThemeConfig;
  source: ThemeSource;
  loading: boolean;
  refreshTheme: () => Promise<void>;
  updateTheme: (patch: Partial<ThemeConfig>) => Promise<ThemeConfig>;
};

const DEFAULT_THEME: ThemeConfig = {
  name: 'Lalela Default',
  primaryColor: THEME_COLORS.primary,
  secondaryColor: THEME_COLORS.secondary,
  backgroundColor: THEME_COLORS.surface,
  surfaceColor: THEME_COLORS.surfaceContainer,
  textPrimary: THEME_COLORS.neutralTextStrong,
  textSecondary: THEME_COLORS.neutralTextSubtle,
  borderRadius: '1rem',
  fontFamily: 'System',
  iconUrl: null,
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeToRuntime(theme: ThemeConfig): void {
  const mutableThemeColors = THEME_COLORS as unknown as Record<string, string>;

  mutableThemeColors.primary = theme.primaryColor;
  mutableThemeColors.secondary = theme.secondaryColor;
  mutableThemeColors.surface = theme.backgroundColor;
  mutableThemeColors.surfaceContainer = theme.surfaceColor;
  mutableThemeColors.neutralTextStrong = theme.textPrimary;
  mutableThemeColors.neutralTextDefault = theme.textSecondary;

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--theme-primary', theme.primaryColor);
    root.style.setProperty('--theme-secondary', theme.secondaryColor);
    root.style.setProperty('--theme-background', theme.backgroundColor);
    root.style.setProperty('--theme-surface', theme.surfaceColor);
    root.style.setProperty('--theme-text-primary', theme.textPrimary);
    root.style.setProperty('--theme-text-secondary', theme.textSecondary);
    root.style.setProperty('--theme-radius', theme.borderRadius);
    root.style.setProperty('--theme-font-family', theme.fontFamily);
  }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentCommunity } = useCommunity();
  const communityId = currentCommunity?.id || null;

  const [theme, setTheme] = useState<ThemeConfig>(DEFAULT_THEME);
  const [source, setSource] = useState<ThemeSource>('fallback');
  const [loading, setLoading] = useState<boolean>(true);

  const refreshTheme = useCallback(async () => {
    if (!communityId) {
      setTheme(DEFAULT_THEME);
      setSource('fallback');
      applyThemeToRuntime(DEFAULT_THEME);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get<{ source: ThemeSource; theme: ThemeConfig }>(`/themes/community/${communityId}`);
      const nextTheme = data?.theme ?? DEFAULT_THEME;
      setTheme(nextTheme);
      setSource(data?.source ?? 'fallback');
      applyThemeToRuntime(nextTheme);
    } catch (error) {
      console.error('[ThemeProvider] failed to load theme, using fallback', error);
      setTheme(DEFAULT_THEME);
      setSource('fallback');
      applyThemeToRuntime(DEFAULT_THEME);
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => {
    refreshTheme();
  }, [refreshTheme]);

  const updateTheme = useCallback(async (patch: Partial<ThemeConfig>) => {
    if (!communityId) {
      throw new Error('Cannot update theme without an active community');
    }

    const { data } = await api.put<{ source: ThemeSource; theme: ThemeConfig }>(`/themes/community/${communityId}`, patch);
    const nextTheme = data.theme;
    setTheme(nextTheme);
    setSource(data.source ?? 'community');
    applyThemeToRuntime(nextTheme);
    return nextTheme;
  }, [communityId]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    source,
    loading,
    refreshTheme,
    updateTheme,
  }), [theme, source, loading, refreshTheme, updateTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
