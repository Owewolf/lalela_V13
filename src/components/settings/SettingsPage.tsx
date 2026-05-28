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
  xl: 14,
  h2: 18,
  h1: 20,
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

const CARD_DEPTH_HERO = getCardShadow('hero');
const CARD_DEPTH_SOFT = getCardShadow('soft');
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

  // Sync notification toggle with userProfile changes
  useEffect(() => {
    const enabled = (userProfile as any)?.notificationPreferences?.globalEnabled ?? true;
    setGlobalNotificationsEnabled(enabled);
  }, [(userProfile as any)?.notificationPreferences?.globalEnabled]);

  const handleNotificationToggle = async (val: boolean) => {
    setGlobalNotificationsEnabled(val);
    const currentPrefs: NotificationPreferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...((userProfile as any)?.notificationPreferences ?? {}),
    };

    try {
      await updateNotificationPreferences({
        ...currentPrefs,
        globalEnabled: val,
      });
      await refreshProfile();
      if (val) {
        router.push('/notifications-settings');
      }
    } catch {
      setGlobalNotificationsEnabled(currentPrefs.globalEnabled);
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
        <View style={{ ...SETTINGS_CARD_SURFACE, borderRadius: 34, padding: SPACE.s20, gap: SPACE.s20, ...CARD_DEPTH_SOFT }}>
          {/* Avatar + Name row (primary account entry point) */}
          <TouchableOpacity
            onPress={() => router.push('/security')}
            activeOpacity={0.85}
            style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s16 }}
          >
            <View style={{ position: 'relative' }}>
              <View style={{ width: 92, height: 92, borderRadius: 46, overflow: 'hidden', borderWidth: 4, borderColor: ringColor }}>
                <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xl }}>
                <Text style={{ fontSize: TYPE_SCALE.h1, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface, flex: 1 }} numberOfLines={1}>
                  {userProfile?.name}
                </Text>
              </View>

              {/* Community + license badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: SPACE.xl, marginTop: SPACE.lg }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}>
                  <MapPin size={14} color={THEME_COLORS.neutralTextSubtle} />
                  <Text style={{ fontSize: TYPE_SCALE.xl, color: THEME_COLORS.neutralTextDefault }}>{currentCommunity?.name}</Text>
                </View>
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
                      paddingHorizontal: SPACE.xl, paddingVertical: SPACE.xs, borderRadius: RADIUS.panel, borderWidth: 1,
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
              </View>

              {/* Role badges */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.lg, marginTop: SPACE.xl }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, paddingHorizontal: SPACE.xxxl, paddingVertical: SPACE.md, borderRadius: 18, backgroundColor: rc.bg }}>
                  <View style={{ width: SPACE.lg, height: SPACE.lg, borderRadius: RADIUS.sm, backgroundColor: rc.dot }} />
                  <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: rc.text, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                    {currentCommunity?.userRole || 'MEMBER'}
                  </Text>
                </View>
                {currentCommunity?.isSecurityMember && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, paddingHorizontal: SPACE.xxxl, paddingVertical: SPACE.md, borderRadius: 18, backgroundColor: THEME_COLORS.infoTintSoft, borderWidth: 1, borderColor: THEME_COLORS.alias_rgba_37_99_235_0_2 }}>
                    <Shield size={11} color={THEME_COLORS.brandBlueText} />
                    <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.brandBlueText, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>Security Responder</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Community Switcher */}
          <View style={{ borderTopWidth: 1, borderTopColor: THEME_COLORS.overlayBorderSoft, paddingTop: SPACE.s20, gap: SPACE.xxl }}>
            <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide }}>
              Community Switcher
            </Text>

            <TouchableOpacity
              onPress={() => setShowCommunitySwitcher(!showCommunitySwitcher)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                padding: SPACE.s14, backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: 24, borderWidth: 1,
                borderColor: showCommunitySwitcher ? THEME_COLORS.alias_rgba_22_163_74_0_3 : getCardBorderColor('default'),
                ...CARD_DEPTH_SOFT,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xxxl }}>
                <Image source={APP_LOGO_SELECTED} style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.xxl }} resizeMode="cover" />
                <View>
                  <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>Active Community</Text>
                  <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface, marginTop: SPACE.xxs }}>
                    {currentCommunity?.name || 'Select Community'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xxl }}>
                {currentCommunity && (
                  <TouchableOpacity
                    onPress={() => router.push('/admin')}
                    style={{ paddingHorizontal: SPACE.s16, paddingVertical: SPACE.lg, backgroundColor: THEME_COLORS.primary, borderRadius: 18 }}
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
              <View style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: 24, borderWidth: 1, borderColor: getCardBorderColor('default'), overflow: 'hidden', ...CARD_DEPTH_SOFT }}>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xxl, flex: 1 }}>
                        <Image source={isActive ? APP_LOGO_SELECTED : APP_LOGO} style={{ width: SPACE.s32, height: SPACE.s32, borderRadius: RADIUS.xl }} resizeMode="cover" />
                        <View>
                          <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: isActive ? THEME_COLORS.primary : THEME_COLORS.onSurface }}>{c.name}</Text>
                          <View style={{ flexDirection: 'row', gap: SPACE.lg, marginTop: SPACE.xxs }}>
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
                          </View>
                        </View>
                      </View>
                      {isActive && <CheckCircle2 size={18} color={THEME_COLORS.success} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* ── General Settings ── */}
        <View style={{ gap: SPACE.xs }}>
          <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.wide, paddingHorizontal: SPACE.xs, paddingBottom: SPACE.lg }}>
            General Settings
          </Text>

          {/* Notifications */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: SPACE.s20, borderRadius: 24, backgroundColor: THEME_COLORS.surface, borderWidth: 1, borderColor: getCardBorderColor('default'),
            ...CARD_DEPTH_SOFT,
          }}>
            <TouchableOpacity
              onPress={() => globalNotificationsEnabled && router.push('/notifications-settings')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s14, flex: 1 }}
            >
              <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.panel, backgroundColor: THEME_COLORS.surface, alignItems: 'center', justifyContent: 'center' }}>
                <BellRing size={20} color={globalNotificationsEnabled ? THEME_COLORS.primary : THEME_COLORS.neutralTextSoft} />
              </View>
              <View>
                <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.semibold, color: THEME_COLORS.onSurface }}>Notifications</Text>
                <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSoft }}>
                  {globalNotificationsEnabled ? 'Tap to manage' : 'All non-emergency paused'}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xl }}>
              <Switch
                value={globalNotificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: THEME_COLORS.neutralBorderMuted, true: THEME_COLORS.primary }}
                thumbColor={THEME_COLORS.white}
              />
              {globalNotificationsEnabled && (
                <TouchableOpacity onPress={() => router.push('/notifications-settings')}>
                  <ChevronRight size={20} color={THEME_COLORS.neutralTextSoft} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Moderation Center (Admin only) */}
          {canAccessModerationCenter && (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/admin', params: { view: 'moderation', tab: 'members' } })}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                padding: SPACE.s20, borderRadius: 24, backgroundColor: THEME_COLORS.surface, borderWidth: 1, borderColor: getCardBorderColor('default'),
                ...CARD_DEPTH_SOFT,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.s14 }}>
                <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.panel, backgroundColor: THEME_COLORS.surface, alignItems: 'center', justifyContent: 'center' }}>
                  <Scale size={20} color={THEME_COLORS.primary} />
                </View>
                <View>
                  <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.semibold, color: THEME_COLORS.onSurface }}>Moderation Center</Text>
                  <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSoft }}>Open member management and moderation controls</Text>
                </View>
              </View>
              <ChevronRight size={20} color={THEME_COLORS.neutralTextSoft} />
            </TouchableOpacity>
          )}

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
          <View style={{ backgroundColor: THEME_COLORS.primaryContainer, borderRadius: RADIUS.hero, padding: SPACE.s20, gap: SPACE.s16, ...CARD_DEPTH_HERO }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, flex: 1 }} numberOfLines={1}>
                {currentCommunity?.name || 'Community'}
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: SPACE.lg,
                paddingHorizontal: SPACE.xxxl, paddingVertical: SPACE.lg, borderRadius: RADIUS.panel,
                borderWidth: 1, borderColor: THEME_COLORS.whiteOverlay20,
                backgroundColor: THEME_COLORS.alias_rgba_245_158_11_0_25,
                marginLeft: SPACE.xxxl,
              }}>
                <View style={{ width: SPACE.xl, height: SPACE.xl, borderRadius: RADIUS.md, backgroundColor: THEME_COLORS.warningBorderStrong }} />
                <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                  Trial Mode
                </Text>
              </View>
            </View>

            <View style={{ backgroundColor: THEME_COLORS.alias_rgba_255_255_255_0_1, borderRadius: RADIUS.card, padding: SPACE.s16, borderWidth: 1, borderColor: THEME_COLORS.whiteOverlay20, gap: SPACE.xl, ...CARD_DEPTH_SOFT }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xxl }}>
                <Sparkles size={18} color={THEME_COLORS.warningBorderStrong} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.white }}>Unlock Full Potential</Text>
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
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              padding: SPACE.s16,
              borderRadius: RADIUS.card,
              borderWidth: 1,
              borderColor: THEME_COLORS.success,
              borderStyle: 'dashed',
              backgroundColor: THEME_COLORS.alias_rgba_16_185_129_0_05,
              gap: SPACE.xl,
              ...CARD_DEPTH_SOFT,
            }}
            onPress={() => router.push('/onboarding-create')}
            activeOpacity={0.7}
          >
            <Plus size={20} color={THEME_COLORS.success} />
            <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.success }}>Create New Community</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default SettingsPage;
