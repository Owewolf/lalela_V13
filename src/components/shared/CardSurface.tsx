import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import {
  getCardBorderColor,
  getCardShadow,
  getCardSurfaceColor,
  type CardBorderVariant,
  type CardShadowVariant,
  type CardSurfaceVariant,
} from '../../theme/cardStyles';

type CardSurfaceProps = ViewProps & {
  surfaceVariant?: CardSurfaceVariant;
  borderVariant?: CardBorderVariant;
  shadowVariant?: CardShadowVariant;
  radius?: number;
};

export const CardSurface: React.FC<CardSurfaceProps> = ({
  surfaceVariant = 'default',
  borderVariant = 'default',
  shadowVariant = 'soft',
  radius = 20,
  style,
  children,
  ...rest
}) => {
  const baseStyle: ViewStyle = {
    backgroundColor: getCardSurfaceColor(surfaceVariant),
    borderWidth: borderVariant === 'none' ? 0 : 1,
    borderColor: getCardBorderColor(borderVariant),
    borderRadius: radius,
  };

  return (
    <View style={[baseStyle, getCardShadow(shadowVariant), style]} {...rest}>
      {children}
    </View>
  );
};

export default CardSurface;
