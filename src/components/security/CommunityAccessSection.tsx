import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Users, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { THEME_COLORS } from '../../theme/colors';

const TYPE_SCALE = {
  xs: 10,
  sm: 13,
  lg: 18,
  xl: 20,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  md: 10,
  lg: 12,
  xl: 16,
  s24: 24,
  s40: 40,
  s48: 48,
};
const RADIUS = {
  lg: 16,
  xl: 20,
  panel: 24,
};
const LETTER_SPACING = {
  wide: 1,
};

export const CommunityAccessSection: React.FC = () => {
  const router = useRouter();
  const { communities, setCurrentCommunity } = useCommunity();

  return (
    <View style={{ backgroundColor: THEME_COLORS.white, borderRadius: RADIUS.panel, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft, padding: SPACE.s24, gap: SPACE.xl }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg }}>
        <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.infoTintSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Users size={22} color={THEME_COLORS.brandBlueText} />
        </View>
        <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary }}>Community Access</Text>
      </View>

      <View style={{ gap: SPACE.md }}>
        {communities.map((community) => (
          <TouchableOpacity
            key={community.id}
            onPress={() => {
              setCurrentCommunity(community.id);
              // Navigate to community dashboard if that route exists
              // router.push(`/community/${community.id}`);
            }}
            style={{
              backgroundColor: THEME_COLORS.surfaceContainerLow,
              borderRadius: RADIUS.xl,
              padding: SPACE.xl,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg }}>
              <View style={{
                width: SPACE.s48, height: SPACE.s48, borderRadius: RADIUS.lg,
                backgroundColor: THEME_COLORS.successTintSoft,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.primary }}>
                  {community.name.charAt(0)}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>{community.name}</Text>
                <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }}>
                  {community.userRole || 'Member'}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={THEME_COLORS.neutralTextSoft} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
