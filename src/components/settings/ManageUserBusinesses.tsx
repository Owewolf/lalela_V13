import React, { useMemo, useState } from 'react';
import { Alert, Image, Text, TouchableOpacity, View } from 'react-native';
import { Building2, MapPin, Pencil, Plus, Power, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { Community, UserBusiness } from '../../types';
import { THEME_COLORS } from '../../theme/colors';

const TYPE_SCALE = {
  xs: 10,
  sm: 11,
  md: 12,
  lg: 13,
  xl: 16,
  hero: 28,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

const SPACE = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 7,
  lg: 8,
  xl: 10,
  xxl: 12,
  xxxl: 14,
  s16: 16,
  s18: 18,
  s22: 22,
  s42: 42,
  s50: 50,
  s58: 58,
  s78: 78,
};

const RADIUS = {
  md: 12,
  lg: 14,
  xl: 20,
  xxl: 29,
  panel: 24,
  pill: 999,
  action: 21,
};
const LETTER_SPACING = {
  normal: 1,
  wide: 2,
};
const LINE_HEIGHT = {
  body: 18,
};

interface ManageUserBusinessesProps {
  communities: Community[];
  currentCommunity?: Community | null;
}

const ManageUserBusinesses: React.FC<ManageUserBusinessesProps> = ({ communities, currentCommunity }) => {
  const router = useRouter();
  const { userBusinesses, updateUserBusiness, removeUserBusiness, deleteUserBusiness } = useCommunity();
  const [busyBusinessId, setBusyBusinessId] = useState<string | null>(null);

  const sortedBusinesses = useMemo(() => {
    return [...userBusinesses]
      .filter(b => b.source !== 'IMPORT')
      .sort((left, right) => {
        if ((left.status ?? 'ACTIVE') === (right.status ?? 'ACTIVE')) {
          return left.name.localeCompare(right.name);
        }
        return (left.status ?? 'ACTIVE') === 'ACTIVE' ? -1 : 1;
      });
  }, [userBusinesses]);

  const getCommunityNames = (business: UserBusiness) => {
    return communities
      .filter((community) => (business.communityIds ?? []).includes(community.id))
      .map((community) => community.name);
  };

  const openCreate = () => {
    router.push('/create-business');
  };

  const openEdit = (business: UserBusiness) => {
    router.push({ pathname: '/create-business', params: { businessId: business.id } });
  };

  const handleToggleStatus = async (business: UserBusiness) => {
    setBusyBusinessId(business.id);
    try {
      if ((business.status ?? 'ACTIVE') === 'ACTIVE') {
        await removeUserBusiness(business.id);
      } else {
        await updateUserBusiness({ ...business, status: 'ACTIVE' });
      }
    } catch {
      Alert.alert('Update failed', 'We could not update this business status.');
    } finally {
      setBusyBusinessId(null);
    }
  };

  const handleDelete = (business: UserBusiness) => {
    Alert.alert(
      'Delete business',
      `Delete ${business.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusyBusinessId(business.id);
            try {
              await deleteUserBusiness(business.id);
            } catch {
              Alert.alert('Delete failed', 'We could not delete this business.');
            } finally {
              setBusyBusinessId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ gap: SPACE.xxl }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: SPACE.xs, gap: SPACE.xl }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }}>
            My Businesses
          </Text>
          <Text style={{ fontSize: TYPE_SCALE.lg, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.sm }}>
            Create and manage the business profiles attached to your communities.
          </Text>
        </View>
        <TouchableOpacity onPress={openCreate} style={{ width: SPACE.s42, height: SPACE.s42, borderRadius: RADIUS.action, backgroundColor: THEME_COLORS.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: SPACE.xxs }}>
          <Plus size={20} color={THEME_COLORS.white} />
        </TouchableOpacity>
      </View>

      {sortedBusinesses.length === 0 ? (
        <TouchableOpacity
          onPress={openCreate}
          activeOpacity={0.8}
          style={{
            backgroundColor: THEME_COLORS.surfaceContainerLow,
            borderRadius: RADIUS.panel,
            borderWidth: 1,
            borderColor: THEME_COLORS.alias_rgba_13_61_71_0_12,
            borderStyle: 'dashed',
            padding: SPACE.s22,
            gap: SPACE.xxxl,
            alignItems: 'center',
          }}
        >
          <View style={{ width: SPACE.s58, height: SPACE.s58, borderRadius: RADIUS.xxl, backgroundColor: THEME_COLORS.primaryTintSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={28} color={THEME_COLORS.primary} />
          </View>
          <View style={{ alignItems: 'center', gap: SPACE.sm }}>
            <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.primary }}>Add your first business</Text>
            <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, textAlign: 'center', lineHeight: LINE_HEIGHT.body }}>
              Share your service, shop, or project with the communities you belong to.
            </Text>
          </View>
          <View style={{ backgroundColor: THEME_COLORS.primary, paddingHorizontal: SPACE.xxxl, paddingVertical: SPACE.xl, borderRadius: RADIUS.md }}>
            <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
              Create Business
            </Text>
          </View>
        </TouchableOpacity>
      ) : (
        <View style={{ gap: SPACE.xxl }}>
          {sortedBusinesses.map((business) => {
            const communityNames = getCommunityNames(business);
            const isActive = (business.status ?? 'ACTIVE') === 'ACTIVE';
            const isBusy = busyBusinessId === business.id;

            return (
              <View key={business.id} style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.panel, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft, padding: SPACE.s16, gap: SPACE.xxxl }}>
                <View style={{ flexDirection: 'row', gap: SPACE.xxxl }}>
                  <View style={{ width: SPACE.s78, height: SPACE.s78, borderRadius: RADIUS.xl, overflow: 'hidden', backgroundColor: THEME_COLORS.primaryTintSoft, alignItems: 'center', justifyContent: 'center' }}>
                    {business.image ? (
                      <Image source={{ uri: business.image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <Text style={{ fontSize: TYPE_SCALE.hero }}>{business.name.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>

                  <View style={{ flex: 1, gap: SPACE.lg }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.xl }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.onSurface }} numberOfLines={1}>
                          {business.name}
                        </Text>
                        <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xs }}>
                          {business.category}
                        </Text>
                      </View>
                      <View style={{ paddingHorizontal: SPACE.xl, paddingVertical: SPACE.sm, borderRadius: RADIUS.pill, backgroundColor: isActive ? THEME_COLORS.successTintSoftAlt : THEME_COLORS.alias_rgba_107_114_128_0_12 }}>
                        <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, color: isActive ? THEME_COLORS.successStrongAlt : THEME_COLORS.neutralTextSubtle, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                          {isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: TYPE_SCALE.md, lineHeight: LINE_HEIGHT.body, color: THEME_COLORS.neutralTextDefault }} numberOfLines={3}>
                      {business.description}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                      <MapPin size={12} color={THEME_COLORS.neutralTextSubtle} />
                      <Text style={{ flex: 1, fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSubtle }} numberOfLines={1}>
                        {business.address}
                      </Text>
                    </View>
                  </View>
                </View>

                {communityNames.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.lg }}>
                    {communityNames.map((name) => (
                      <View key={`${business.id}-${name}`} style={{ paddingHorizontal: SPACE.xl, paddingVertical: SPACE.md, borderRadius: RADIUS.pill, backgroundColor: THEME_COLORS.alias_rgba_13_61_71_0_07 }}>
                        <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary }}>{name}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={{ flexDirection: 'row', gap: SPACE.xl }}>
                  <TouchableOpacity onPress={() => openEdit(business)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.lg, paddingVertical: SPACE.xxl, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.surfaceContainerLow }}>
                    <Pencil size={16} color={THEME_COLORS.primary} />
                    <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.primary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                      Edit
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => handleToggleStatus(business)} disabled={isBusy} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.lg, paddingVertical: SPACE.xxl, borderRadius: RADIUS.lg, backgroundColor: isActive ? THEME_COLORS.alias_rgba_245_158_11_0_12 : THEME_COLORS.alias_rgba_16_185_129_0_12 }}>
                    <Power size={16} color={isActive ? THEME_COLORS.warning : THEME_COLORS.successStrongAlt} />
                    <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.extrabold, color: isActive ? THEME_COLORS.warning : THEME_COLORS.successStrongAlt, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                      {isBusy ? 'Saving' : isActive ? 'Pause' : 'Activate'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity onPress={() => handleDelete(business)} disabled={isBusy} style={{ width: SPACE.s50, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.errorTintSoft }}>
                    <Trash2 size={16} color={THEME_COLORS.errorStrong} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

export default ManageUserBusinesses;