import type { ViewStyle } from 'react-native';

export type ShadowStyle = ViewStyle;

const KEY_COLOR = 'shadowColor' as const;
const KEY_OFFSET = 'shadowOffset' as const;
const KEY_OPACITY = 'shadowOpacity' as const;
const KEY_RADIUS = 'shadowRadius' as const;

export const createShadow = (
  color: string,
  offsetX: number,
  offsetY: number,
  opacity: number,
  radius: number,
  elevation: number
): ShadowStyle => ({
  [KEY_COLOR]: color,
  [KEY_OFFSET]: { width: offsetX, height: offsetY },
  [KEY_OPACITY]: opacity,
  [KEY_RADIUS]: radius,
  elevation,
});
