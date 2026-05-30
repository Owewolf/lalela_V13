import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { THEME_COLORS } from '../../theme/colors';
import { createShadow } from '../../theme/shadows';

type SecurityShieldHeroProps = {
  height?: number;
  borderRadius?: number;
  badgeSize?: number;
  badgeOffset?: number;
  containerStyle?: StyleProp<ViewStyle>;
};

export const SecurityShieldHero: React.FC<SecurityShieldHeroProps> = ({
  height = 170,
  borderRadius = 16,
  badgeSize = 58,
  badgeOffset = 20,
  containerStyle,
}) => {
  return (
    <View
      style={[
        styles.hero,
        {
          height,
          borderRadius,
        },
        containerStyle,
      ]}
    >
      <Image
        source={require('../../../assets/security.jpg')}
        style={styles.heroImage}
        resizeMode="cover"
      />
      <View style={styles.heroTint} />
      <View style={[styles.heroBadgeWrap, { bottom: -badgeOffset }]}>
        <View
          style={[
            styles.heroBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
            },
          ]}
        >
          <Image
            source={require('../../../assets/security.jpg')}
            style={styles.heroBadgeImage}
            resizeMode="cover"
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: {
    overflow: 'hidden',
    backgroundColor: THEME_COLORS.primary,
    ...createShadow(THEME_COLORS.black, 0, 5, 0.16, 10, 5),
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  heroTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME_COLORS.alias_rgba_13_61_71_0_5,
  },
  heroBadgeWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  heroBadge: {
    backgroundColor: THEME_COLORS.primary,
    borderWidth: 2,
    borderColor: THEME_COLORS.whiteOverlay80,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...createShadow(THEME_COLORS.black, 0, 4, 0.2, 8, 4),
  },
  heroBadgeImage: {
    width: '100%',
    height: '100%',
  },
});

export default SecurityShieldHero;