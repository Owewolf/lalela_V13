import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Shield, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { getCommunityLicenseStatus, isUserPaidMembershipActive } from '../../lib/licensing';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../theme/colors';

const APP_LOGO_PATH = require('../../../assets/icon.png');
const PRIMARY = THEME_COLORS.primary;
const TYPE_SCALE = {
  xs: 8,
  sm: 10,
  md: 13,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  xxs: 1,
  xs: 2,
  sm: 3,
  md: 4,
  lg: 6,
  xl: 8,
  xxl: 10,
  s16: 16,
  s18: 18,
  s32: 32,
  s40: 40,
  s64: 64,
};
const RADIUS = {
  sm: 8,
  md: 9,
  lg: 12,
  pill: 20,
  full: 99,
  avatar: 18,
};
const LETTER_SPACING = {
  tightNegative: -0.3,
  compact: 0.8,
};
const LINE_HEIGHT = {
  compact: 12,
};

interface HeaderProps {
  onBack?: () => void;
  showBack?: boolean;
  title?: string;
  onToggleNotifications?: () => void;
  onOpenSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onBack,
  showBack,
  title,
  onToggleNotifications,
  onOpenSidebar,
}) => {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentCommunity, notifications } = useCommunity();
  const { userProfile } = useAuth();
  const primaryColor = THEME_COLORS.primary;
  const headerChromeColor = APP_SHELL_COLORS.chrome;
  const headerBorderColor = THEME_COLORS.neutralBorder;
  const isSecurityMemberForSelectedCommunity = !!currentCommunity?.isSecurityMember;

  const userRole = currentCommunity?.userRole || 'Member';
  const now = new Date();
  const licenseStatus = userProfile?.licenseStatus;
  const trialExpiresAt = userProfile?.trialExpiresAt ? new Date(userProfile.trialExpiresAt) : null;
  const renewalDate = userProfile?.subscriptionRenewalDate ? new Date(userProfile.subscriptionRenewalDate) : null;
  const isActive = licenseStatus === 'ACTIVE' && userProfile?.subscriptionActive && renewalDate && renewalDate > now;
  const isTrial = licenseStatus === 'TRIAL' && trialExpiresAt && trialExpiresAt > now;
  // Community is licensed once it has been paid (R999 once-off) or is in an active trial
  const communityTrialActive =
    currentCommunity?.type === 'TRIAL' &&
    currentCommunity?.trialExpiresAt &&
    new Date(currentCommunity.trialExpiresAt) > now;
  const communityActive =
    currentCommunity?.isPaid === true ||
    currentCommunity?.type === 'ACTIVE' ||
    !!communityTrialActive;
  const communityStatus = getCommunityLicenseStatus(currentCommunity);
  const effectiveTrial = communityStatus === 'TRIAL';
  // Header ring reflects paid platform membership only.
  // Trial and expired accounts keep the red ring.
  const userHasPaidMembership = isUserPaidMembershipActive(userProfile);
  const userIsLicensed = userHasPaidMembership;
  const ringColor = userIsLicensed ? THEME_COLORS.primary : THEME_COLORS.errorStrong;
  // Read-only only if the user's own license is expired AND the community itself is not active
  const isReadOnly = licenseStatus === 'EXPIRED' || ((!isActive && !effectiveTrial) && !communityActive);
  // Warn when trial expires within 5 days
  const daysUntilTrialExpiry = trialExpiresAt && isTrial
    ? Math.ceil((trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const showTrialWarning = daysUntilTrialExpiry !== null && daysUntilTrialExpiry <= 5;

  const unreadCount = notifications.filter((n: any) => !n.read).length;
  const unreadLabel = unreadCount > 99 ? '99+' : String(unreadCount);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      if (router.canGoBack()) router.back(); else router.replace("/");
    }
  };

  const roleColors: Record<string, { bg: string; text: string }> = {
    Admin: { bg: THEME_COLORS.errorSurface, text: THEME_COLORS.errorStrong },
    Moderator: { bg: THEME_COLORS.brandPurpleSurface, text: THEME_COLORS.md3Primary },
    Member: { bg: THEME_COLORS.successSurface, text: primaryColor },
  };
  const roleColor = roleColors[userRole] ?? roleColors.Member;

  // Primary badge in header reflects selected community license status.
  const statusLabel = communityStatus === 'ACTIVE' ? 'Active' : communityStatus === 'TRIAL' ? 'Trial' : 'Expired';
  const typeBadgeBg = communityStatus === 'ACTIVE' ? THEME_COLORS.successSurfaceSoft : communityStatus === 'TRIAL' ? THEME_COLORS.warningSurface : THEME_COLORS.errorSurface;
  const typeBadgeText = communityStatus === 'ACTIVE' ? THEME_COLORS.primaryContainer : communityStatus === 'TRIAL' ? THEME_COLORS.warningText : THEME_COLORS.errorStrong;
  const typeBadgeBorder = communityStatus === 'ACTIVE' ? THEME_COLORS.tertiaryFixed : communityStatus === 'TRIAL' ? THEME_COLORS.warningBorder : THEME_COLORS.errorBorder;

  const profileImageUri =
    userProfile?.profileImage ||
    `https://picsum.photos/seed/${userProfile?.id ?? 'user'}/100/100`;

  return (
    <View style={[styles.header, { paddingTop: insets.top, backgroundColor: headerChromeColor, borderBottomColor: headerBorderColor }]}> 
      <View style={styles.inner}>
        {/* Left: back or logo */}
        <View style={styles.leftSection}>
          {showBack ? (
            <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
              <ArrowLeft size={24} color={primaryColor} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.logoBtn, { backgroundColor: primaryColor }]}
              onPress={onOpenSidebar}
              activeOpacity={0.85}
            >
              <Image source={APP_LOGO_PATH} style={styles.logoImg} resizeMode="contain" />
            </TouchableOpacity>
          )}

          <View style={[styles.divider, { backgroundColor: headerBorderColor }]} />

          <View style={styles.communityInfo}>
            <Text style={[styles.communityName, { color: primaryColor }]} numberOfLines={1}>
              {title || currentCommunity?.name || 'Select Community'}
            </Text>
            <View style={styles.badgeRow}>
              {/* License badge */}
              <View
                style={[
                  styles.badge,
                  { backgroundColor: typeBadgeBg, borderColor: typeBadgeBorder },
                ]}
              >
                {communityStatus === 'ACTIVE' ? (
                  <ShieldCheck size={9} color={typeBadgeText} />
                ) : (
                  <AlertCircle size={9} color={typeBadgeText} />
                )}
                <Text style={[styles.badgeText, { color: typeBadgeText }]}>
                  {statusLabel}
                </Text>
              </View>
              {/* Role badge */}
              <View style={[styles.badge, { backgroundColor: roleColor.bg, borderColor: 'transparent' }]}>
                <Text style={[styles.badgeText, { color: roleColor.text }]}>{userRole}</Text>
              </View>
              {/* Read-only badge */}
              {isReadOnly && (
                <View style={[styles.badge, { backgroundColor: THEME_COLORS.errorSurface, borderColor: THEME_COLORS.errorBorder }]}>
                  <AlertCircle size={9} color={THEME_COLORS.errorStrong} />
                  <Text style={[styles.badgeText, { color: THEME_COLORS.errorStrong }]}>Read-Only</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Right: bell + avatar */}
        <View style={styles.rightSection}>
          <TouchableOpacity style={styles.bellBtn} onPress={onToggleNotifications} activeOpacity={0.7}>
            <Bell size={24} color={primaryColor} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadLabel}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.avatarWrapper}>
            <View style={[styles.avatarRing, { borderColor: ringColor }]}>
              <View style={styles.avatarInner}>
                <Image
                  source={{ uri: profileImageUri }}
                  style={styles.avatarImg}
                  resizeMode="cover"
                />
              </View>
              {isSecurityMemberForSelectedCommunity && (
                <View
                  style={[
                    styles.shieldBadge,
                    { backgroundColor: THEME_COLORS.brandBlueText },
                  ]}
                >
                  <Shield size={8} color={THEME_COLORS.white} />
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: APP_SHELL_COLORS.chrome,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.neutralBorder,
    zIndex: 50,
  },
  inner: {
    height: SPACE.s64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.s16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: SPACE.xxl,
  },
  backBtn: {
    padding: SPACE.xl,
    borderRadius: RADIUS.pill,
  },
  logoBtn: {
    width: SPACE.s40,
    height: SPACE.s40,
    backgroundColor: PRIMARY,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: SPACE.s32,
    height: SPACE.s32,
  },
  divider: {
    width: SPACE.xxs,
    height: SPACE.s32,
    backgroundColor: THEME_COLORS.neutralBorder,
    marginHorizontal: SPACE.md,
  },
  communityInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: TYPE_SCALE.md,
    fontWeight: FONT_WEIGHT.black,
    color: PRIMARY,
    letterSpacing: LETTER_SPACING.tightNegative,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: SPACE.md,
    marginTop: SPACE.xs,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: TYPE_SCALE.xs,
    fontWeight: FONT_WEIGHT.black,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.compact,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
  },
  bellBtn: {
    position: 'relative',
    padding: SPACE.xl,
    borderRadius: RADIUS.pill,
  },
  bellBadge: {
    position: 'absolute',
    top: SPACE.xs,
    right: SPACE.xxs,
    minWidth: 18,
    height: SPACE.s18,
    borderRadius: RADIUS.md,
    backgroundColor: THEME_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACE.md,
    borderWidth: 2,
    borderColor: THEME_COLORS.white,
  },
  bellBadgeText: {
    color: THEME_COLORS.white,
    fontSize: 9,
    fontWeight: FONT_WEIGHT.black,
    lineHeight: LINE_HEIGHT.compact,
  },
  avatarWrapper: {
    paddingLeft: SPACE.md,
    borderLeftWidth: 1,
    borderLeftColor: THEME_COLORS.neutralBorder,
  },
  avatarRing: {
    width: SPACE.s40,
    height: SPACE.s40,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    padding: SPACE.xxs,
    position: 'relative',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: RADIUS.avatar,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: THEME_COLORS.surfaceContainerLow,
    backgroundColor: THEME_COLORS.neutralBorder,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  shieldBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    padding: SPACE.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    borderColor: THEME_COLORS.surfaceContainerLow,
  },
});
