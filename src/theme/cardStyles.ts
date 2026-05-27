import type { ViewStyle } from 'react-native';
import { THEME_COLORS } from './colors';
import { createShadow } from './shadows';

export type CardSurfaceVariant = 'default' | 'muted' | 'subtle';
export type CardBorderVariant = 'default' | 'strong' | 'none';
export type CardShadowVariant = 'none' | 'soft' | 'default' | 'hero';

export function getCardSurfaceColor(variant: CardSurfaceVariant = 'default'): string {
  if (variant === 'muted') return THEME_COLORS.surfaceContainer;
  if (variant === 'subtle') return THEME_COLORS.surfaceContainerLow;
  return THEME_COLORS.surface;
}

export function getCardBorderColor(variant: CardBorderVariant = 'default'): string {
  if (variant === 'none') return 'transparent';
  if (variant === 'strong') return THEME_COLORS.neutralBorder;
  return THEME_COLORS.neutralBorderSoft;
}

export function getCardShadow(variant: CardShadowVariant = 'soft'): ViewStyle {
  if (variant === 'none') return {};
  if (variant === 'hero') return createShadow(THEME_COLORS.black, 0, 10, 0.16, 18, 8);
  if (variant === 'default') return createShadow(THEME_COLORS.black, 0, 7, 0.12, 14, 5);
  return createShadow(THEME_COLORS.black, 0, 4, 0.08, 10, 3);
}
