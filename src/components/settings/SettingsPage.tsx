import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  BellRing,
  ChevronRight,
  ShieldCheck,
  MapPin,
  AlertCircle,
  Shield,
  Sparkles,
  Scale,
  ChevronDown,
  CheckCircle2,
  Plus,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { isCommunityActive, isCommunityTrial, isCommunityLicensed, isUserLicensed } from '../../lib/licensing';
import { NotificationPreferences } from '../../types';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../theme/colors';
import { getCardBorderColor, getCardShadow, getCardSurfaceColor } from '../../theme/cardStyles';

type NotificationTypeKey =
  | 'generalNotices'
  | 'listingUpdates'
  | 'communityActivity'
  | 'businessActivity'
  | 'charitySuggestions'
  | 'securityAlerts';

const NOTIFICATION_TYPE_KEYS: NotificationTypeKey[] = [
  'generalNotices',
  'listingUpdates',
  'communityActivity',
  'businessActivity',
  'charitySuggestions',
  'securityAlerts',
];

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  globalEnabled: true,
  generalNotices: true,
  listingUpdates: true,
  communityActivity: true,
  businessActivity: true,
  charitySuggestions: true,
  securityAlerts: true,
  priorityCommunityIds: [],
  communityOverrides: {},
};

const APP_LOGO = require('../../../assets/lalela_logo.png');
const APP_LOGO_SELECTED = require('../../../assets/lalela_logo_transparent.png');
import ManageCommunityCharity from './ManageCommunityCharity';

const TYPE_SCALE = {
  xs: 9,
  sm: 10,
  md: 11,
  body: 12,
  lg: 13,
  xl: 13,
  h2: 17,
  h0: 22,
  h1: 19,
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
  xs: 3,
  sm: 4,
  md: 5,
  lg: 6,
  xl: 8,
  xxl: 10,
  xxxl: 12,
  s14: 14,
  s16: 16,
  s20: 20,
  s32: 32,
  s40: 40,
  s72: 72,
  s80: 80,
  s48: 48,
};

const RADIUS = {
  sm: 3,
  md: 4,
  s14: 14,
  lg: 8,
  xl: 10,
  xxl: 12,
  card: 16,
  panel: 20,
  hero: 24,
  avatar: 40,
};
const LETTER_SPACING = {
  normal: 1,
  wide: 2,
};
const LINE_HEIGHT = {
  compact: 17,
};

const AVATAR_SIZE = 84;
const AVATAR_RADIUS = AVATAR_SIZE / 2;

const SETTINGS_SHADOW_HERO = getCardShadow('hero');
const SETTINGS_SHADOW_SOFT = getCardShadow('soft');
const SETTINGS_CARD_SURFACE = {
  backgroundColor: getCardSurfaceColor('default'),
  borderWidth: 1,
  borderColor: getCardBorderColor('default'),
};

const SettingsPage: React.FC = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ charityMode?: string | string[] }>();
  const { userProfile, updateUserProfile, refreshProfile } = useAuth();
  const { currentCommunity, communities, setCurrentCommunity, updateNotificationPreferences } = useCommunity();

  const routeCharityMode = Array.isArray(params.charityMode)
    ? params.charityMode[0]
    : params.charityMode;
  const initialCharityMode =
    routeCharityMode === 'manage' || routeCharityMode === 'suggest'
      ? routeCharityMode
      : null;

  const [globalNotificationsEnabled, setGlobalNotificationsEnabled] = useState(true);
  const [showCommunitySwitcher, setShowCommunitySwitcher] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState('');

  const getMergedNotificationPreferences = (): NotificationPreferences => ({
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...((userProfile as any)?.notificationPreferences ?? {}),
  });

  const getSelectedCommunityAnyNotificationsEnabled = (basePrefs: NotificationPreferences): boolean => {
    const selectedCommunityId = currentCommunity?.id;
    const selectedOverride = selectedCommunityId
      ? (basePrefs.communityOverrides?.[selectedCommunityId] ?? {})
      : {};

    return NOTIFICATION_TYPE_KEYS.some((key) => (selectedOverride as any)[key] ?? (basePrefs as any)[key]);
  };

  // Sync toggle with selected community notification state
  useEffect(() => {
    const enabled = getSelectedCommunityAnyNotificationsEnabled(getMergedNotificationPreferences());
    setGlobalNotificationsEnabled(enabled);
  }, [(userProfile as any)?.notificationPreferences, currentCommunity?.id]);

  const handleNotificationToggle = async (val: boolean) => {
    const selectedCommunityId = currentCommunity?.id;
    if (!selectedCommunityId) return;

    const currentPrefs = getMergedNotificationPreferences();
    const previousValue = getSelectedCommunityAnyNotificationsEnabled(currentPrefs);
    setGlobalNotificationsEnabled(val);

    const nextOverride: Record<string, boolean> = {};
    NOTIFICATION_TYPE_KEYS.forEach((key) => {
      if ((currentPrefs as any)[key] !== val) {
        nextOverride[key] = val;
      }
    });

    const updatedOverrides = { ...(currentPrefs.communityOverrides ?? {}) };
    if (Object.keys(nextOverride).length === 0) {
      delete updatedOverrides[selectedCommunityId];
    } else {
      updatedOverrides[selectedCommunityId] = nextOverride;
    }

    try {
      await updateNotificationPreferences({
        ...currentPrefs,
        communityOverrides: updatedOverrides,
      });
      await refreshProfile();
      if (val) {
        router.push('/notifications-settings');
      }
    } catch {
      setGlobalNotificationsEnabled(previousValue);
    }
  };

  const avatarUri = userProfile?.profileImage
    ? userProfile.profileImage
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.id}`;

  const roleColor = () => {
    switch (currentCommunity?.userRole) {
      case 'ADMIN': return { bg: THEME_COLORS.errorTintSoft, text: THEME_COLORS.errorStrong, dot: THEME_COLORS.errorStrong };
      case 'MODERATOR': return { bg: THEME_COLORS.infoTintSoft, text: THEME_COLORS.brandBlueText, dot: THEME_COLORS.brandBlueText };
      default: return { bg: THEME_COLORS.successTintSoft, text: THEME_COLORS.primary, dot: THEME_COLORS.primary };
    }
  };

  // Per pricing model: only a pending TRIAL community blocks creating another.
  // Aligned with the sidebar gate so both surfaces stay consistent.
  const hasTrialCommunity = (communities || []).some(
    (c: any) => c.ownerId === userProfile?.id && isCommunityTrial(c)
  );
  const canCreateNewCommunity = !hasTrialCommunity;
  const canAccessModerationCenter = currentCommunity?.userRole === 'ADMIN';

  const rc = roleColor();

  const isLicensed = isUserLicensed(userProfile, currentCommunity);
  const ringColor = isLicensed ? THEME_COLORS.success : THEME_COLORS.error;

  return (
    <View style={{ flex: 1, backgroundColor: APP_SHELL_COLORS.body }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={{
          padding: SPACE.s16,
          paddingBottom: Math.max(SPACE.s48, insets.bottom + 120),
          gap: SPACE.s20,
        }}
        scrollIndicatorInsets={{ bottom: Math.max(SPACE.s48, insets.bottom + 120) }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Identity Card ── */}
        <View style={{ ...SETTINGS_CARD_SURFACE, position: 'relative', marginTop: SPACE.s32, borderRadius: 34, padding: SPACE.s14, paddingTop: 0, gap: SPACE.md, ...SETTINGS_SHADOW_SOFT }}>
          {/* Avatar centered and overlapping the card edge */}
          <TouchableOpacity
            onPress={() => router.push('/security')}
            activeOpacity={0.85}
            style={{ position: 'relative', alignItems: 'center', gap: SPACE.md }}
          >
            <View style={{ position: 'absolute', top: -AVATAR_RADIUS, left: '50%', marginLeft: -AVATAR_RADIUS }}>
              <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_RADIUS, overflow: 'hidden', borderWidth: 4, borderColor: ringColor, backgroundColor: THEME_COLORS.surface }}>
                <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </View>
            </View>
            <View style={{ alignItems: 'center', width: '100%', marginTop: SPACE.s48 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <Text style={{ fontSize: TYPE_SCALE.h0, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }} numberOfLines={1}>
                  {userProfile?.name}
                </Text>
              </View>

              {/* Community name */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs, marginTop: SPACE.xs }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
                  <MapPin size={12} color={THEME_COLORS.neutralTextSubtle} />
                  <Text style={{ fontSize: TYPE_SCALE.h2, color: THEME_COLORS.neutralTextDefault }}>{currentCommunity?.name}</Text>
                </View>
              </View>

              {/* License + role badges */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: SPACE.sm, marginTop: SPACE.md }}>
                {(() => {
                  // Profile pill is binary: ACTIVE (paid) vs UNLICENSED (trial /
                  // expired / never-paid). The community-switcher row below shows
                  // the finer-grained Active/Trial/Expired distinction.
                  const licensed = isCommunityLicensed(currentCommunity);
                  const label = licensed ? 'Active' : 'Unlicensed';
                  const palette = licensed
                    ? { bg: THEME_COLORS.successTintSoftAlt, border: THEME_COLORS.successTintStrongAlt, fg: THEME_COLORS.successStrongAlt }
                    : { bg: THEME_COLORS.warningTintSoft, border: THEME_COLORS.alias_rgba_245_158_11_0_2, fg: THEME_COLORS.warning };
                  const Icon = licensed ? ShieldCheck : AlertCircle;
                  return (
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: SPACE.xs,
                      paddingHorizontal: SPACE.md, paddingVertical: 2, borderRadius: RADIUS.panel, borderWidth: 1,
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                    }}>
                      <Icon size={11} color={palette.fg} />
                      <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal, color: palette.fg }}>
                        {label}
                      </Text>
                    </View>
                  );
                })()}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.xl, paddingVertical: 4, borderRadius: 18, backgroundColor: rc.bg }}>
                  <View style={{ width: 9, height: 9, borderRadius: RADIUS.sm, backgroundColor: rc.dot }} />
                  <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: rc.text, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                    {currentCommunity?.userRole || 'MEMBER'}
                  </Text>
                </View>
                {currentCommunity?.isSecurityMember && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, paddingHorizontal: SPACE.xl, paddingVertical: 4, borderRadius: 18, backgroundColor: THEME_COLORS.infoTintSoft, borderWidth: 1, borderColor: THEME_COLORS.alias_rgba_37_99_235_0_2 }}>
                    <Shield size={11} color={THEME_COLORS.brandBlueText} />
                    <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.brandBlueText, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>Security Responder</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Community Switcher */}
          <View style={{ borderTopWidth: 1, borderTopColor: THEME_COLORS.overlayBorderSoft, paddingTop: SPACE.xl, gap: SPACE.lg }}>
            <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }}>
              Community Switcher
            </Text>

            <TouchableOpacity
              onPress={() => setShowCommunitySwitcher(!showCommunitySwitcher)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                padding: SPACE.s14, backgroundColor: THEME_COLORS.surface, borderRadius: 24, borderWidth: 1,
                borderColor: getCardBorderColor('default'),
                ...SETTINGS_SHADOW_SOFT,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, flex: 1, minWidth: 0 }}>
                <Image source={APP_LOGO_SELECTED} style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.xxl }} resizeMode="cover" />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }} numberOfLines={1}>
                    {currentCommunity?.name || 'Select Community'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md, marginLeft: SPACE.sm }}>
                {currentCommunity && (
                  <TouchableOpacity
                    onPress={() => router.push('/admin')}
                    style={{ paddingHorizontal: SPACE.s14, paddingVertical: SPACE.sm, backgroundColor: THEME_COLORS.primary, borderRadius: 18 }}
                  >
                    <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                      Dashboard
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={{ transform: [{ rotate: showCommunitySwitcher ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={20} color={THEME_COLORS.neutralTextSubtle} />
                </View>
              </View>
            </TouchableOpacity>

            {showCommunitySwitcher && (
              <View style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: 24, borderWidth: 1, borderColor: getCardBorderColor('default'), overflow: 'hidden', ...SETTINGS_SHADOW_SOFT }}>
                {(communities || []).map((c, idx) => {
                  const isActive = c.id === currentCommunity?.id;
                  const isAdminOrMod = c.ownerId === userProfile?.id || c.userRole === 'ADMIN' || c.userRole === 'MODERATOR';
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => { setCurrentCommunity(c.id); setShowCommunitySwitcher(false); }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        padding: SPACE.s14, borderBottomWidth: idx < (communities?.length || 1) - 1 ? 1 : 0, borderBottomColor: THEME_COLORS.alias_rgba_0_0_0_0_05,
                        backgroundColor: isActive ? THEME_COLORS.successTintSofter : THEME_COLORS.surfaceContainerLow,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xxl, flex: 1, minWidth: 0 }}>
                        <Image source={isActive ? APP_LOGO_SELECTED : APP_LOGO} style={{ width: SPACE.s32, height: SPACE.s32, borderRadius: RADIUS.xl }} resizeMode="cover" />
                        <Text style={{ fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.bold, color: isActive ? THEME_COLORS.primary : THEME_COLORS.onSurface, flex: 1 }} numberOfLines={1}>
                          {c.name}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, marginLeft: SPACE.md }}>
                        <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, color: isAdminOrMod ? THEME_COLORS.brandBlueText : THEME_COLORS.primary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                          {c.userRole || 'MEMBER'}
                        </Text>
                        {(() => {
                          const active = isCommunityLicensed(c);
                          const trial = isCommunityTrial(c);
                          const label = active ? 'Active' : trial ? 'Trial' : 'Expired';
                          const color = active ? THEME_COLORS.successStrongAlt : trial ? THEME_COLORS.warning : THEME_COLORS.error;
                          return (
                            <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal, color }}>
                              {label}
                            </Text>
                          );
                        })()}
                        {isActive && <CheckCircle2 size={18} color={THEME_COLORS.success} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* ── General Settings ── */}
        <View style={{ gap: SPACE.xs }}>
          <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide, paddingHorizontal: SPACE.xs, paddingBottom: SPACE.md }}>
            General Settings
          </Text>

          <View style={{ flexDirection: canAccessModerationCenter ? 'row' : 'column', gap: SPACE.s14 }}>
            {/* Notifications */}
            <View style={{
              flex: canAccessModerationCenter ? 1 : undefined,
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: SPACE.s14,
              minHeight: 100,
              borderRadius: 24,
              backgroundColor: THEME_COLORS.surface,
              borderWidth: 1,
              borderColor: getCardBorderColor('default'),
              ...SETTINGS_SHADOW_SOFT,
            }}>
              <TouchableOpacity
                onPress={() => currentCommunity?.id && router.push('/notifications-settings')}
                activeOpacity={0.85}
                style={{ flex: 1, minWidth: 0, justifyContent: 'space-between' }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.panel, backgroundColor: THEME_COLORS.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <BellRing size={20} color={globalNotificationsEnabled ? THEME_COLORS.primary : THEME_COLORS.neutralTextSoft} />
                  </View>
                  <Switch
                    value={globalNotificationsEnabled}
                    onValueChange={handleNotificationToggle}
                    trackColor={{ false: THEME_COLORS.neutralBorderMuted, true: THEME_COLORS.primary }}
                    thumbColor={THEME_COLORS.white}
                  />
                </View>
                <Text style={{ fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.semibold, color: THEME_COLORS.onSurface, marginTop: SPACE.md }} numberOfLines={1}>
                  Notifications
                </Text>
              </TouchableOpacity>
            </View>

            {/* Moderation Center (Admin only) */}
            {canAccessModerationCenter && (
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/admin', params: { view: 'moderation', tab: 'members' } })}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  padding: SPACE.s14,
                  minHeight: 100,
                  borderRadius: 24,
                  backgroundColor: THEME_COLORS.surface,
                  borderWidth: 1,
                  borderColor: getCardBorderColor('default'),
                  ...SETTINGS_SHADOW_SOFT,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.panel, backgroundColor: THEME_COLORS.surface, alignItems: 'center', justifyContent: 'center' }}>
                    <Scale size={20} color={THEME_COLORS.primary} />
                  </View>
                  <View style={{ width: SPACE.s40, height: SPACE.s40, alignItems: 'center', justifyContent: 'center' }}>
                    <ChevronRight size={20} color={THEME_COLORS.neutralTextSoft} />
                  </View>
                </View>
                  <Text style={{ fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.semibold, color: THEME_COLORS.onSurface, marginTop: SPACE.md }} numberOfLines={1}>
                    Moderation Center
                </Text>
              </TouchableOpacity>
            )}
          </View>

        </View>

        {initialCharityMode && (
          <ManageCommunityCharity
            initialMode={initialCharityMode}
            clearInitialMode={() => {
              router.replace('/settings');
            }}
          />
        )}

        {/* ── Community License Card (Only for Trial) ── */}
        {currentCommunity?.type === 'TRIAL' && (currentCommunity.ownerId === userProfile?.id) && (
          <View style={{ backgroundColor: THEME_COLORS.primaryContainer, borderRadius: RADIUS.hero, padding: SPACE.s16, gap: SPACE.s14 }}>
            <View style={{ backgroundColor: THEME_COLORS.alias_rgba_255_255_255_0_1, borderRadius: RADIUS.card, padding: SPACE.s14, borderWidth: 1, borderColor: THEME_COLORS.whiteOverlay20, gap: SPACE.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md }}>
                <Sparkles size={18} color={THEME_COLORS.warningBorderStrong} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.white }}>Unlock Full Potential</Text>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: SPACE.lg,
                      paddingHorizontal: SPACE.xxxl, paddingVertical: SPACE.xs, borderRadius: RADIUS.panel,
                      borderWidth: 1, borderColor: THEME_COLORS.whiteOverlay20,
                      backgroundColor: THEME_COLORS.alias_rgba_245_158_11_0_25,
                    }}>
                      <View style={{ width: SPACE.xl, height: SPACE.xl, borderRadius: RADIUS.md, backgroundColor: THEME_COLORS.warningBorderStrong }} />
                      <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                        Trial
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.whiteOverlay70, marginTop: SPACE.xs, lineHeight: LINE_HEIGHT.compact }}>
                    License your community to remove member limits, enable advanced moderation tools, and unlock all features.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/checkout', params: { type: 'community', targetId: currentCommunity.id } })}
                style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, paddingVertical: SPACE.xxxl, borderRadius: RADIUS.s14, alignItems: 'center' }}
              >
                <Text style={{ fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.primaryContainer, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                  License Community (R999)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Create New Community ──
            Hidden when the owner still has a TRIAL community (pricing rule:
            one trial per owner). Server enforces this via TRIAL_EXISTS as
            the backstop. */}
        {canCreateNewCommunity && (
          <View style={{ backgroundColor: THEME_COLORS.primaryContainer, borderRadius: RADIUS.hero, padding: SPACE.s16, gap: SPACE.s14, ...SETTINGS_SHADOW_SOFT }}>
            <View style={{ backgroundColor: THEME_COLORS.alias_rgba_255_255_255_0_1, borderRadius: RADIUS.card, padding: SPACE.s14, borderWidth: 1, borderColor: THEME_COLORS.whiteOverlay20, gap: SPACE.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.md }}>
                <Plus size={18} color={THEME_COLORS.success} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.md, flexWrap: 'wrap' }}>
                    <Text style={{ fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.white }}>Create New Community</Text>
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: SPACE.lg,
                      paddingHorizontal: SPACE.xxxl, paddingVertical: SPACE.xs, borderRadius: RADIUS.panel,
                      borderWidth: 1, borderColor: THEME_COLORS.whiteOverlay20,
                      backgroundColor: THEME_COLORS.successTintSoft,
                    }}>
                      <View style={{ width: SPACE.xl, height: SPACE.xl, borderRadius: RADIUS.md, backgroundColor: THEME_COLORS.success }} />
                      <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                        Ready
                      </Text>
                    </View>
                  </View>
                  <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.whiteOverlay70, marginTop: SPACE.xs, lineHeight: LINE_HEIGHT.compact }}>
                    Start a new community space with its own members, moderation, and activity feed in minutes.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/onboarding-create')}
                activeOpacity={0.8}
                style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, paddingVertical: SPACE.xxxl, borderRadius: RADIUS.s14, alignItems: 'center' }}
              >
                <Text style={{ fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.primaryContainer, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                  Create Community
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default SettingsPage;
