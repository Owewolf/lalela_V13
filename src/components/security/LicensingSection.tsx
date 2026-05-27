import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { CreditCard, ShieldAlert, Star, Calendar, CheckCircle2 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useCommunity } from '../../context/CommunityContext';
import { useRouter } from 'expo-router';
import { THEME_COLORS } from '../../theme/colors';

const PRIMARY = THEME_COLORS.primary;
const TYPE_SCALE = {
  xs: 9,
  sm: 10,
  md: 11,
  lg: 13,
  xl: 18,
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
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 16,
  s20: 20,
  s24: 24,
  s40: 40,
  s44: 44,
};
const RADIUS = {
  chip: 6,
  md: 12,
  lg: 14,
  xl: 16,
  panel: 20,
  card: 24,
};
const LETTER_SPACING = {
  normal: 1,
};
const LINE_HEIGHT = {
  compact: 16,
};

export const LicensingSection: React.FC = () => {
  const { userProfile } = useAuth();
  const { communities, setCurrentCommunity } = useCommunity();
  const router = useRouter();

  const now = new Date();
  const licenseStatus = userProfile?.licenseStatus ?? 'TRIAL';
  const trialExpiresAt = userProfile?.trialExpiresAt ? new Date(userProfile.trialExpiresAt) : null;
  const renewalDate = userProfile?.subscriptionRenewalDate ? new Date(userProfile.subscriptionRenewalDate) : null;

  const isActive = licenseStatus === 'ACTIVE' && userProfile?.subscriptionActive && renewalDate && renewalDate > now;
  const isTrial = licenseStatus === 'TRIAL' && trialExpiresAt && trialExpiresAt > now;
  const isExpired = licenseStatus === 'EXPIRED' || (!isActive && !isTrial);

  const daysLeft = trialExpiresAt && isTrial
    ? Math.max(0, Math.ceil((trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const overallStatus = isActive ? 'Active Subscription' : isTrial ? 'Free Trial' : 'Expired';
  const statusColor = isActive ? THEME_COLORS.successStrongAlt : isTrial ? THEME_COLORS.warning : THEME_COLORS.errorStrong;
  const statusBg = isActive ? THEME_COLORS.successTintSoftAlt : isTrial ? THEME_COLORS.warningTintSoft : THEME_COLORS.errorTintSoft;
  const statusBorder = isActive ? THEME_COLORS.successTintStrongAlt : isTrial ? THEME_COLORS.alias_rgba_245_158_11_0_2 : THEME_COLORS.alias_rgba_239_68_68_0_2;

  const handleCheckout = (type: 'membership' | 'community', targetId?: string) => {
    let path = `/checkout?type=${type}`;
    if (targetId) path += `&targetId=${targetId}`;
    router.push(path as any);
  };

  const getCommunityStatus = (community: any) => {
    if (community.type === 'ACTIVE' || community.isPaid) {
      return { label: 'Active', color: THEME_COLORS.success, bg: THEME_COLORS.successTintSoftAlt };
    }
    const trialEnd = community.trialExpiresAt ? new Date(community.trialExpiresAt) : null;
    if (!trialEnd || trialEnd < now) {
      return { label: 'Expired', color: THEME_COLORS.errorStrong, bg: THEME_COLORS.errorTintSoft };
    }
    const days = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return { label: `Trial (${days}d left)`, color: THEME_COLORS.warningStrong, bg: THEME_COLORS.warningTintSoft };
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString();
  };

  return (
    <View style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.card, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft, padding: SPACE.s24, gap: SPACE.s20 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xl }}>
          <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.xl, backgroundColor: THEME_COLORS.infoTintSoft, alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={22} color={THEME_COLORS.brandBlueText} />
          </View>
          <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold, color: PRIMARY }}>Licensing & Access</Text>
        </View>
        <View style={{ paddingHorizontal: SPACE.xl, paddingVertical: SPACE.sm, borderRadius: RADIUS.panel, borderWidth: 1, backgroundColor: statusBg, borderColor: statusBorder }}>
          <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal, color: statusColor }}>
            {overallStatus}
          </Text>
        </View>
      </View>

      {/* Membership status card */}
      <View style={{ backgroundColor: THEME_COLORS.neutralBg, borderRadius: RADIUS.panel, padding: SPACE.xxl, gap: SPACE.lg, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft }}>
        <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>Platform Membership</Text>
        {isActive && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
            <CheckCircle2 size={16} color={THEME_COLORS.success} />
            <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong }}>
              Active — renews {formatDate(renewalDate)} (R99/year)
            </Text>
          </View>
        )}
        {isTrial && (
          <View style={{ gap: SPACE.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
              <Calendar size={14} color={THEME_COLORS.warning} />
              <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong }}>
                Free trial — {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
              </Text>
            </View>
            <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, lineHeight: LINE_HEIGHT.compact }}>
              Trial ends {formatDate(trialExpiresAt)}. After that, subscribe for R99/year to keep access.
            </Text>
          </View>
        )}
        {isExpired && (
          <View style={{ gap: SPACE.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
              <ShieldAlert size={16} color={THEME_COLORS.errorStrong} />
              <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.aliasHex_b91c1c }}>Access expired</Text>
            </View>
            <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.errorStrong, lineHeight: LINE_HEIGHT.compact }}>
              Your trial or subscription has ended. Subscribe for R99/year to restore access.
            </Text>
            <TouchableOpacity
              onPress={() => handleCheckout('membership')}
              style={{ alignSelf: 'flex-start', backgroundColor: THEME_COLORS.errorStrong, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.lg, borderRadius: RADIUS.md }}
            >
              <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                Subscribe — R99/year
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {isTrial && !isActive && (
          <TouchableOpacity
            onPress={() => handleCheckout('membership')}
            style={{ alignSelf: 'flex-start', backgroundColor: PRIMARY, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.lg, borderRadius: RADIUS.md }}
          >
            <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
              Subscribe Early — R99/year
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Community list */}
      {communities.length > 0 && (
        <View style={{ gap: SPACE.md }}>
          <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
            Community Status
          </Text>
          {communities.map((community) => {
            const statusInfo = getCommunityStatus(community);
            const isOwner = community.ownerId === userProfile?.id;
            return (
              <View key={community.id} style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.panel, padding: SPACE.xxl, gap: SPACE.xl }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xl }}>
                  <View style={{ width: SPACE.s44, height: SPACE.s44, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.successTintSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.extrabold, color: PRIMARY }}>{community.name.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>{community.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginTop: SPACE.xs }}>
                      <View style={{ paddingHorizontal: SPACE.md, paddingVertical: SPACE.xxs, borderRadius: RADIUS.chip, backgroundColor: statusInfo.bg }}>
                        <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, color: statusInfo.color, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                          {statusInfo.label}
                        </Text>
                      </View>
                      <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSoft }}>
                        {community.userRole || 'Member'}
                      </Text>
                    </View>
                  </View>
                </View>
                {/* Activate CTA for TRIAL community owners */}
                {isOwner && community.type === 'TRIAL' && (
                  <TouchableOpacity
                    onPress={() => handleCheckout('community', community.id)}
                    style={{ alignSelf: 'flex-start', backgroundColor: PRIMARY, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.md, borderRadius: RADIUS.md }}
                  >
                    <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                      Activate Community — R999
                    </Text>
                  </TouchableOpacity>
                )}
                {community.type === 'ACTIVE' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                    <CheckCircle2 size={14} color={THEME_COLORS.success} />
                    <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.semibold, color: THEME_COLORS.successStrongAlt }}>
                      Permanently active {community.activatedAt ? `since ${formatDate(new Date(community.activatedAt))}` : ''}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

