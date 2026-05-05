import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Animated, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, Shield, ShieldCheck, AlertCircle, ArrowLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';

const APP_LOGO_PATH = require('../../../assets/lalela_logo.png');
const PRIMARY = '#0d3d47';

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
  const isLicensed = isActive || isTrial || communityActive;
  const ringColor = isLicensed ? '#10b981' : '#dc2626';
  // Read-only only if the user's own license is expired AND the community itself is not active
  const isReadOnly = licenseStatus === 'EXPIRED' || ((!isActive && !isTrial) && !communityActive);
  // Warn when trial expires within 5 days
  const daysUntilTrialExpiry = trialExpiresAt && isTrial
    ? Math.ceil((trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const showTrialWarning = daysUntilTrialExpiry !== null && daysUntilTrialExpiry <= 5;

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (unreadCount > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      pulseAnim.setValue(0);
    }
  }, [unreadCount, pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2],
  });
  
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.4, 0],
  });

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      if (router.canGoBack()) router.back(); else router.replace("/");
    }
  };

  const roleColors: Record<string, { bg: string; text: string }> = {
    Admin: { bg: '#fef2f2', text: '#dc2626' },
    Moderator: { bg: '#f5f3ff', text: '#6750a4' },
    Member: { bg: '#f0fdf4', text: PRIMARY },
  };
  const roleColor = roleColors[userRole] ?? roleColors.Member;

  const communityType = currentCommunity?.type;
  const typeBadgeBg = communityActive ? '#ecfdf5' : '#fffbeb';
  const typeBadgeText = communityActive ? '#1e5667' : '#b45309';
  const typeBadgeBorder = communityActive ? '#ffddb9' : '#fde68a';

  const profileImageUri =
    userProfile?.profileImage ||
    `https://picsum.photos/seed/${userProfile?.id ?? 'user'}/100/100`;

  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        {/* Left: back or logo */}
        <View style={styles.leftSection}>
          {showBack ? (
            <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
              <ArrowLeft size={24} color={PRIMARY} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.logoBtn}
              onPress={onOpenSidebar}
              activeOpacity={0.85}
            >
              <Image source={APP_LOGO_PATH} style={styles.logoImg} resizeMode="contain" />
            </TouchableOpacity>
          )}

          <View style={styles.divider} />

          <View style={styles.communityInfo}>
            <Text style={styles.communityName} numberOfLines={1}>
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
                {communityActive ? (
                  <ShieldCheck size={9} color={typeBadgeText} />
                ) : (
                  <AlertCircle size={9} color={typeBadgeText} />
                )}
                <Text style={[styles.badgeText, { color: typeBadgeText }]}>
                  {communityActive ? 'Active' : communityType === 'TRIAL' ? 'Trial' : 'Inactive'}
                </Text>
              </View>
              {/* Role badge */}
              <View style={[styles.badge, { backgroundColor: roleColor.bg, borderColor: 'transparent' }]}>
                <Text style={[styles.badgeText, { color: roleColor.text }]}>{userRole}</Text>
              </View>
              {/* Read-only badge */}
              {isReadOnly && (
                <View style={[styles.badge, { backgroundColor: '#fef2f2', borderColor: '#fecaca' }]}>
                  <AlertCircle size={9} color="#dc2626" />
                  <Text style={[styles.badgeText, { color: '#dc2626' }]}>Read-Only</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Right: bell + avatar */}
        <View style={styles.rightSection}>
          <TouchableOpacity style={styles.bellBtn} onPress={onToggleNotifications} activeOpacity={0.7}>
            {unreadCount > 0 && (
              <Animated.View
                style={[
                  styles.bellPulse,
                  {
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity,
                  },
                ]}
              />
            )}
            <Bell size={24} color={unreadCount > 0 ? '#ef4444' : PRIMARY} />
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
              <View
                style={[
                  styles.shieldBadge,
                  { backgroundColor: isLicensed ? '#fc7127' : '#dc2626' },
                ]}
              >
                <Shield size={8} color="#fff" />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    zIndex: 50,
  },
  inner: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
  },
  logoBtn: {
    width: 40,
    height: 40,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: 32,
    height: 32,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 4,
  },
  communityInfo: {
    flex: 1,
  },
  communityName: {
    fontSize: 13,
    fontWeight: '900',
    color: PRIMARY,
    letterSpacing: -0.3,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bellBtn: {
    position: 'relative',
    padding: 8,
    borderRadius: 20,
  },
  bellPulse: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
  },
  avatarWrapper: {
    paddingLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: '#e2e8f0',
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    padding: 1,
    position: 'relative',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#fff',
    backgroundColor: '#e2e8f0',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  shieldBadge: {
    position: 'absolute',
    bottom: -3,
    right: -3,
    padding: 3,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#fff',
  },
});
