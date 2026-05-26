import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Animated,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import {
  Home,
  FileText,
  MessageSquare,
  Store,
  Users,
  ChevronDown,
  ChevronRight,
  LogOut,
  LogIn,
  Plus,
  ShieldCheck,
  AlertCircle,
  X,
  Check,
} from 'lucide-react-native';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { isCommunityActive, isCommunityTrial, isCommunityLicensed, isUserLicensed } from '../../lib/licensing';
import { THEME_COLORS } from '../../theme/colors';
import { createShadow } from '../../theme/shadows';

const PRIMARY = THEME_COLORS.primary;
const APP_LOGO = require('../../../assets/icon.png');
const SCREEN_WIDTH = Dimensions.get('window').width;
const PANEL_WIDTH = Math.min(320, SCREEN_WIDTH * 0.85);
const TYPE_SCALE = {
  xxs: 7,
  xs: 8,
  sm: 9,
  md: 12,
  lg: 13,
  xl: 14,
  xxl: 16,
  title: 18,
};
const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  zero: 0,
  xxs: 2,
  xs: 4,
  s5: 5,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  s16: 16,
  s20: 20,
  s28: 28,
  s32: 32,
  s36: 36,
  s40: 40,
  s24: 24,
  s52: 52,
};
const RADIUS = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  pill: 20,
  full: 99,
};
const LINE_HEIGHT = {
  compact: 13,
};
const LETTER_SPACING = {
  tightNegative: -0.3,
  tight: 0.5,
  normal: 1,
  wide: 1.5,
};

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onNavigate: (tab: string) => void;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  onNavigate,


}) => {
  const router = useRouter();
  const { currentCommunity, communities, setCurrentCommunity, createCommunity, refreshCommunities } = useCommunity();
  const { userProfile, signOut } = useAuth();
  const [communitiesExpanded, setCommunitiesExpanded] = useState(false);

  // Animations
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const chevronRotate = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  const isLicensed = isUserLicensed(userProfile, currentCommunity);
  // Per pricing model: a TRIAL community must be activated (R999) before its
  // owner can create another one. Communities in ACTIVE state don't block.
  const hasTrialCommunity = (communities || []).some(
    (c: any) => c.ownerId === userProfile?.id && isCommunityTrial(c)
  );
  const canCreateNewCommunity = !hasTrialCommunity;

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      // Refresh from server so badges/gates reflect latest license state.
      refreshCommunities?.().catch(() => {});
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.spring(translateX, {
          toValue: 0,
          damping: 28,
          stiffness: 320,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -PANEL_WIDTH, duration: 220, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }
  }, [isOpen]);

  useEffect(() => {
    Animated.timing(chevronRotate, {
      toValue: communitiesExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [communitiesExpanded]);

  const chevronAngle = chevronRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'posts', label: 'Posts', icon: FileText },
    { id: 'chat', label: 'Chat', icon: MessageSquare },
    { id: 'market', label: 'Market', icon: Store },
  ];

  const handleNavigate = (tab: string) => {
    onNavigate(tab);
    onClose();
  };

  const handleCommunitySelect = (communityId: string) => {
    setCurrentCommunity(communityId);
    setCommunitiesExpanded(false);
  };

  const handleCreateCommunity = () => {
    // Per pricing model: a user may only own one TRIAL community at a time.
    // The wizard backs this up server-side via TRIAL_EXISTS, but block here
    // first so the user gets immediate feedback.
    if (canCreateNewCommunity) {
      router.push('/onboarding-create');
      onClose();
    } else {
      Alert.alert(
        'License Required',
        'License your current trial community before creating another.'
      );
    }
  };

  const handleOpenAdmin = () => {
    if (!currentCommunity) return;
    router.push("/admin");
    onClose();
  };

  const handleOpenSettings = () => {
    router.push("/(tabs)/settings");
    onClose();
  };

  const handleSignOut = async () => {
    onClose();
    await signOut();
  };

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: backdropOpacity }]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>

      {/* Sidebar Panel */}
      <Animated.View style={[styles.panel, { transform: [{ translateX }] }]}>
        {/* Panel Header */}
        <View style={styles.panelHeader}>
          <View style={styles.panelHeaderLeft}>
            <View style={styles.logoBox}>
              <Image source={APP_LOGO} style={styles.logoImg} resizeMode="contain" />
            </View>
            <Text style={styles.menuLabel}>Menu</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color={THEME_COLORS.neutralTextMuted} />
          </TouchableOpacity>
        </View>

        {/* Scrollable Body */}
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
          {/* Section A: Navigation */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Navigation</Text>
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.navItem, isActive && styles.navItemActive]}
                  onPress={() => handleNavigate(item.id)}
                  activeOpacity={0.7}
                >
                  <item.icon size={20} color={isActive ? PRIMARY : THEME_COLORS.neutralTextHeading} />
                  <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.separator} />

          {/* Section B: Communities */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.communitiesHeader}
              onPress={() => setCommunitiesExpanded(!communitiesExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.communitiesLeft}>
                <Users size={20} color={THEME_COLORS.neutralTextHeading} />
                <Text style={styles.navLabel}>Communities</Text>
              </View>
              <Animated.View style={{ transform: [{ rotate: chevronAngle }] }}>
                <ChevronDown size={16} color={THEME_COLORS.neutralTextMuted} />
              </Animated.View>
            </TouchableOpacity>

            {communitiesExpanded && (
              <View style={styles.communitiesList}>
                {(communities || []).map((c: any) => {
                  const isSelected = c.id === currentCommunity?.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.communityItem, isSelected && styles.communityItemActive]}
                      onPress={() => handleCommunitySelect(c.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.communityLogo,
                          { backgroundColor: isSelected ? PRIMARY : THEME_COLORS.neutralBgSoft },
                        ]}
                      >
                        <Image source={APP_LOGO} style={styles.communityLogoImg} resizeMode="contain" />
                      </View>
                      <View style={styles.communityInfo}>
                        <Text style={styles.communityName} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <View style={styles.communityBadges}>
                          {(() => {
                            const active = isCommunityLicensed(c);
                            const trial = isCommunityTrial(c);
                            const label = active ? 'Active' : trial ? 'Trial' : 'Expired';
                            const bg = active ? THEME_COLORS.successSurfaceSoft : trial ? THEME_COLORS.warningSurface : THEME_COLORS.errorSurface;
                            const fg = active ? THEME_COLORS.primaryContainer : trial ? THEME_COLORS.warningText : THEME_COLORS.errorStrong;
                            const Icon = active ? ShieldCheck : AlertCircle;
                            return (
                              <View
                                style={[
                                  styles.smallBadge,
                                  { backgroundColor: bg },
                                ]}
                              >
                                <Icon size={8} color={fg} />
                                <Text style={[styles.smallBadgeText, { color: fg }]}>
                                  {label}
                                </Text>
                              </View>
                            );
                          })()}
                          <View
                            style={[
                              styles.smallBadge,
                              {
                                backgroundColor:
                                  c.userRole === "ADMIN"
                                    ? THEME_COLORS.errorSurface
                                    : c.userRole === "MODERATOR"
                                    ? THEME_COLORS.brandPurpleSurface
                                    : THEME_COLORS.successSurface,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.smallBadgeText,
                                {
                                  color:
                                    c.userRole === "ADMIN"
                                      ? THEME_COLORS.errorStrong
                                      : c.userRole === "MODERATOR"
                                      ? THEME_COLORS.md3Primary
                                      : PRIMARY,
                                },
                              ]}
                            >
                              {c.userRole ?? 'Member'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      {isSelected && (
                        <View style={styles.selectedDot} />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* Create Community */}
                <TouchableOpacity
                  style={[
                    styles.createCommunityBtn,
                    !canCreateNewCommunity && styles.createCommunityBtnDisabled,
                  ]}
                  onPress={handleCreateCommunity}
                  activeOpacity={0.7}
                >
                  <Plus size={16} color={canCreateNewCommunity ? PRIMARY : THEME_COLORS.neutralTextMuted} />
                  <Text
                    style={[
                      styles.createCommunityText,
                      { color: canCreateNewCommunity ? PRIMARY : THEME_COLORS.neutralTextMuted },
                    ]}
                  >
                    + Create Community
                  </Text>
                </TouchableOpacity>

                {!canCreateNewCommunity && (
                  <Text style={styles.upgradeHint}>
                    License your current trial community to unlock more spaces.
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Section C: Active Community Dashboard */}
          {currentCommunity && (
            <>
              <View style={styles.separator} />
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>Active Community</Text>
                <TouchableOpacity
                  style={styles.navItem}
                  onPress={handleOpenAdmin}
                  activeOpacity={0.7}
                >
                  <View style={styles.adminLogo}>
                    <Image source={APP_LOGO} style={styles.communityLogoImg} resizeMode="contain" />
                  </View>
                  <View style={styles.adminInfo}>
                    <Text style={styles.adminName} numberOfLines={1}>
                      {currentCommunity.name}
                    </Text>
                    <Text
                      style={[
                        styles.adminRole,
                        {
                          color:
                            currentCommunity.userRole === "ADMIN"
                              ? THEME_COLORS.errorStrong
                              : currentCommunity.userRole === "MODERATOR"
                              ? THEME_COLORS.md3Primary
                              : THEME_COLORS.neutralTextMuted,
                        },
                      ]}
                    >
                      {(currentCommunity.userRole ?? 'Member').toUpperCase()} DASHBOARD
                    </Text>
                  </View>
                  <ChevronRight size={16} color={THEME_COLORS.neutralTextMuted} style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          {userProfile && (
            <TouchableOpacity style={styles.settingsBtn} onPress={handleOpenSettings} activeOpacity={0.7}>
              <View
                style={[
                  styles.avatarRing,
                  { borderColor: isLicensed ? THEME_COLORS.success : THEME_COLORS.neutralBorder },
                ]}
              >
                <Image
                  source={{ uri: userProfile?.profileImage || `https://picsum.photos/seed/${userProfile?.id}/100/100` }}
                  style={styles.avatarImg}
                />
              </View>
              <View style={styles.settingsInfo}>
                <View style={styles.settingsNameRow}>
                  <Text style={styles.settingsName} numberOfLines={1}>
                    {userProfile?.name ?? 'User'}
                  </Text>
                  {isLicensed && <Check size={14} color={THEME_COLORS.success} />}
                </View>
                <Text style={styles.settingsSubtitle}>Account & Settings</Text>
              </View>
              <ChevronRight size={16} color={THEME_COLORS.neutralTextMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}

          {userProfile ? (
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
              <LogOut size={20} color={THEME_COLORS.errorStrong} />
              <Text style={styles.signOutText}>Logout</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.authBtn}
                onPress={() => handleNavigate('login')}
                activeOpacity={0.7}
              >
                <LogIn size={20} color={PRIMARY} />
                <Text style={[styles.authBtnText, { color: PRIMARY }]}>Login</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.authBtn}
                onPress={handleCreateCommunity}
                activeOpacity={0.7}
              >
                <Plus size={20} color={PRIMARY} />
                <Text style={[styles.authBtnText, { color: PRIMARY }]}>+ Create Community</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>

      {/* Android create-community dialog */}
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: THEME_COLORS.blackOverlay50,
    zIndex: 100,
  },
  panel: {
    position: 'absolute',
    top: SPACE.zero,
    bottom: SPACE.zero,
    left: SPACE.zero,
    width: PANEL_WIDTH,
    backgroundColor: THEME_COLORS.white,
    zIndex: 110,
    ...createShadow(THEME_COLORS.black, SPACE.xs, SPACE.zero, 0.2, 16, 12),
    flexDirection: 'column',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.s20,
    paddingTop: SPACE.s52,
    paddingBottom: SPACE.s20,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.neutralBgSoft,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
  },
  logoBox: {
    width: SPACE.s36,
    height: SPACE.s36,
    backgroundColor: PRIMARY,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: SPACE.s28,
    height: SPACE.s28,
  },
  menuLabel: {
    fontSize: TYPE_SCALE.xxl,
    fontWeight: FONT_WEIGHT.black,
    color: PRIMARY,
    letterSpacing: LETTER_SPACING.tightNegative,
  },
  closeBtn: {
    padding: SPACE.md,
    borderRadius: RADIUS.pill,
  },
  body: {
    flex: 1,
    paddingVertical: SPACE.xl,
  },
  section: {
    paddingHorizontal: SPACE.xl,
    marginBottom: SPACE.md,
  },
  sectionLabel: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.wide,
    paddingHorizontal: SPACE.xl,
    marginBottom: SPACE.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.xl,
    borderRadius: RADIUS.xl,
  },
  navItemActive: {
    backgroundColor: THEME_COLORS.successSurface,
  },
  navLabel: {
    fontSize: TYPE_SCALE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextHeading,
  },
  navLabelActive: {
    fontWeight: FONT_WEIGHT.black,
    color: PRIMARY,
  },
  separator: {
    height: SPACE.xxs,
    backgroundColor: THEME_COLORS.neutralBgSoft,
    marginHorizontal: SPACE.s20,
    marginVertical: SPACE.md,
  },
  communitiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.xl,
    borderRadius: RADIUS.xl,
  },
  communitiesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
  },
  communitiesList: {
    paddingLeft: SPACE.xl,
    paddingTop: SPACE.xs,
    gap: SPACE.xs,
  },
  communityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.lg,
    borderRadius: RADIUS.lg,
  },
  communityItemActive: {
    backgroundColor: THEME_COLORS.successSurface,
  },
  communityLogo: {
    width: SPACE.s32,
    height: SPACE.s32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  communityLogoImg: {
    width: SPACE.s20,
    height: SPACE.s20,
  },
  communityInfo: {
    flex: 1,
    minWidth: 0,
  },
  communityName: {
    fontSize: TYPE_SCALE.md,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.neutralTextHeading,
  },
  communityBadges: {
    flexDirection: 'row',
    gap: SPACE.xs,
    marginTop: SPACE.xxs,
  },
  smallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xxs,
    paddingHorizontal: SPACE.s5,
    paddingVertical: SPACE.xxs,
    borderRadius: RADIUS.full,
  },
  smallBadgeText: {
    fontSize: TYPE_SCALE.xxs,
    fontWeight: FONT_WEIGHT.black,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.tight,
  },
  selectedDot: {
    width: SPACE.md,
    height: SPACE.md,
    borderRadius: RADIUS.xs,
    backgroundColor: PRIMARY,
    flexShrink: 0,
  },
  createCommunityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.lg,
    borderRadius: RADIUS.lg,
  },
  createCommunityBtnDisabled: {
    opacity: 0.5,
  },
  createCommunityText: {
    fontSize: TYPE_SCALE.md,
    fontWeight: FONT_WEIGHT.black,
  },
  upgradeHint: {
    fontSize: TYPE_SCALE.xs,
    color: THEME_COLORS.warningText,
    fontWeight: FONT_WEIGHT.bold,
    paddingHorizontal: SPACE.xl,
    paddingBottom: SPACE.xs,
    lineHeight: LINE_HEIGHT.compact,
  },
  adminLogo: {
    width: SPACE.s36,
    height: SPACE.s36,
    backgroundColor: PRIMARY,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  adminInfo: {
    flex: 1,
    minWidth: 0,
  },
  adminName: {
    fontSize: TYPE_SCALE.xl,
    fontWeight: FONT_WEIGHT.black,
    color: PRIMARY,
  },
  adminRole: {
    fontSize: TYPE_SCALE.xs,
    fontWeight: FONT_WEIGHT.black,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.neutralBgSoft,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.s16,
    gap: SPACE.xs,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.xl,
    borderRadius: RADIUS.xl,
  },
  avatarRing: {
    width: SPACE.s40,
    height: SPACE.s40,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  settingsInfo: {
    flex: 1,
    minWidth: 0,
  },
  settingsNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
  },
  settingsName: {
    fontSize: TYPE_SCALE.xl,
    fontWeight: FONT_WEIGHT.black,
    color: PRIMARY,
    flex: 1,
  },
  settingsSubtitle: {
    fontSize: TYPE_SCALE.sm,
    fontWeight: FONT_WEIGHT.black,
    color: THEME_COLORS.neutralTextMuted,
    textTransform: 'uppercase',
    letterSpacing: LETTER_SPACING.normal,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.xl,
    borderRadius: RADIUS.xl,
  },
  signOutText: {
    fontSize: TYPE_SCALE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color: THEME_COLORS.errorStrong,
  },
  authBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.xl,
    paddingHorizontal: SPACE.xl,
    paddingVertical: SPACE.xl,
    borderRadius: RADIUS.xl,
  },
  authBtnText: {
    fontSize: TYPE_SCALE.xl,
    fontWeight: FONT_WEIGHT.bold,
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: THEME_COLORS.blackOverlay50,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACE.s24,
  },
  dialog: {
    backgroundColor: THEME_COLORS.white,
    borderRadius: RADIUS.pill,
    padding: SPACE.s24,
    width: '100%',
    gap: SPACE.xl,
  },
  dialogTitle: { fontSize: TYPE_SCALE.title, fontWeight: FONT_WEIGHT.bold, color: PRIMARY },
  dialogSub: { fontSize: TYPE_SCALE.lg, color: THEME_COLORS.outline },
  dialogInput: {
    borderWidth: 1,
    borderColor: THEME_COLORS.neutralBorderSoft,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.xxl,
    paddingVertical: TYPE_SCALE.md,
    fontSize: TYPE_SCALE.xl,
    color: THEME_COLORS.onSurface,
  },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACE.lg, marginTop: SPACE.xs },
  dialogCancel: { paddingHorizontal: SPACE.s16, paddingVertical: SPACE.lg },
  dialogCancelText: { fontSize: TYPE_SCALE.xl, color: THEME_COLORS.outline, fontWeight: FONT_WEIGHT.semibold },
  dialogConfirm: {
    backgroundColor: PRIMARY,
    paddingHorizontal: SPACE.s20,
    paddingVertical: SPACE.lg,
    borderRadius: RADIUS.lg,
  },
  dialogConfirmText: { fontSize: TYPE_SCALE.xl, color: THEME_COLORS.white, fontWeight: FONT_WEIGHT.bold },
});
