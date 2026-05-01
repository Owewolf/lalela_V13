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

const PRIMARY = '#0d3d47';
const APP_LOGO = require('../../../assets/icon.png');
const SCREEN_WIDTH = Dimensions.get('window').width;
const PANEL_WIDTH = Math.min(320, SCREEN_WIDTH * 0.85);

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  onNavigate: (tab: string) => void;
  onOpenAdmin: (communityId: string, role: string) => void;
  onOpenSettings: () => void;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  onClose,
  activeTab,
  onNavigate,
  onOpenAdmin,
  onOpenSettings,
}) => {
  const router = useRouter();
  const { currentCommunity, communities, setCurrentCommunity, createCommunity } = useCommunity();
  const { userProfile, signOut } = useAuth();
  const [communitiesExpanded, setCommunitiesExpanded] = useState(false);

  // Animations
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;
  const chevronRotate = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  const isLicensed = userProfile?.licenseStatus === 'LICENSED' || currentCommunity?.type === 'LICENSED';
  const hasTrialCommunity = (communities || []).some(
    (c: any) => c.ownerId === userProfile?.id && c.type === 'TRIAL'
  );
  const canCreateNewCommunity = !hasTrialCommunity;

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
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
    onOpenAdmin(currentCommunity.id, currentCommunity.userRole ?? 'Member');
    onClose();
  };

  const handleOpenSettings = () => {
    onOpenSettings();
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
            <X size={20} color="#94a3b8" />
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
                  <item.icon size={20} color={isActive ? PRIMARY : '#334155'} />
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
                <Users size={20} color="#334155" />
                <Text style={styles.navLabel}>Communities</Text>
              </View>
              <Animated.View style={{ transform: [{ rotate: chevronAngle }] }}>
                <ChevronDown size={16} color="#94a3b8" />
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
                          { backgroundColor: isSelected ? PRIMARY : '#f1f5f9' },
                        ]}
                      >
                        <Image source={APP_LOGO} style={styles.communityLogoImg} resizeMode="contain" />
                      </View>
                      <View style={styles.communityInfo}>
                        <Text style={styles.communityName} numberOfLines={1}>
                          {c.name}
                        </Text>
                        <View style={styles.communityBadges}>
                          <View
                            style={[
                              styles.smallBadge,
                              {
                                backgroundColor:
                                  c.type === 'LICENSED' ? '#ecfdf5' : '#fffbeb',
                              },
                            ]}
                          >
                            {c.type === 'LICENSED' ? (
                              <ShieldCheck size={8} color="#1e5667" />
                            ) : (
                              <AlertCircle size={8} color="#b45309" />
                            )}
                            <Text
                              style={[
                                styles.smallBadgeText,
                                { color: c.type === 'LICENSED' ? '#1e5667' : '#b45309' },
                              ]}
                            >
                              {c.type === 'LICENSED' ? 'Licensed' : 'Trial'}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.smallBadge,
                              {
                                backgroundColor:
                                  c.userRole === 'Admin'
                                    ? '#fef2f2'
                                    : c.userRole === 'Moderator'
                                    ? '#f5f3ff'
                                    : '#f0fdf4',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.smallBadgeText,
                                {
                                  color:
                                    c.userRole === 'Admin'
                                      ? '#dc2626'
                                      : c.userRole === 'Moderator'
                                      ? '#6750a4'
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
                  <Plus size={16} color={canCreateNewCommunity ? PRIMARY : '#94a3b8'} />
                  <Text
                    style={[
                      styles.createCommunityText,
                      { color: canCreateNewCommunity ? PRIMARY : '#94a3b8' },
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
                            currentCommunity.userRole === 'Admin'
                              ? '#dc2626'
                              : currentCommunity.userRole === 'Moderator'
                              ? '#6750a4'
                              : '#94a3b8',
                        },
                      ]}
                    >
                      {(currentCommunity.userRole ?? 'Member').toUpperCase()} DASHBOARD
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#94a3b8" style={{ marginLeft: 'auto' }} />
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
                  { borderColor: isLicensed ? '#10b981' : '#e2e8f0' },
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
                  {isLicensed && <Check size={14} color="#10b981" />}
                </View>
                <Text style={styles.settingsSubtitle}>Account & Settings</Text>
              </View>
              <ChevronRight size={16} color="#94a3b8" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}

          {userProfile ? (
            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
              <LogOut size={20} color="#dc2626" />
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 100,
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_WIDTH,
    backgroundColor: '#fff',
    zIndex: 110,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
    flexDirection: 'column',
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 52,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBox: {
    width: 36,
    height: 36,
    backgroundColor: PRIMARY,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: 28,
    height: 28,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '900',
    color: PRIMARY,
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
  },
  body: {
    flex: 1,
    paddingVertical: 12,
  },
  section: {
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
  },
  navItemActive: {
    backgroundColor: '#f0fdf4',
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
  navLabelActive: {
    fontWeight: '900',
    color: PRIMARY,
  },
  separator: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 20,
    marginVertical: 8,
  },
  communitiesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
  },
  communitiesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  communitiesList: {
    paddingLeft: 12,
    paddingTop: 4,
    gap: 4,
  },
  communityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  communityItemActive: {
    backgroundColor: '#f0fdf4',
  },
  communityLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  communityLogoImg: {
    width: 20,
    height: 20,
  },
  communityInfo: {
    flex: 1,
    minWidth: 0,
  },
  communityName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  communityBadges: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  smallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 99,
  },
  smallBadgeText: {
    fontSize: 7,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PRIMARY,
    flexShrink: 0,
  },
  createCommunityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createCommunityBtnDisabled: {
    opacity: 0.5,
  },
  createCommunityText: {
    fontSize: 12,
    fontWeight: '900',
  },
  upgradeHint: {
    fontSize: 8,
    color: '#b45309',
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingBottom: 4,
    lineHeight: 13,
  },
  adminLogo: {
    width: 36,
    height: 36,
    backgroundColor: PRIMARY,
    borderRadius: 10,
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
    fontSize: 14,
    fontWeight: '900',
    color: PRIMARY,
  },
  adminRole: {
    fontSize: 8,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 4,
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
  },
  avatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
    gap: 6,
  },
  settingsName: {
    fontSize: 14,
    fontWeight: '900',
    color: PRIMARY,
    flex: 1,
  },
  settingsSubtitle: {
    fontSize: 9,
    fontWeight: '900',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#dc2626',
  },
  authBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
  },
  authBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    gap: 12,
  },
  dialogTitle: { fontSize: 18, fontWeight: '700', color: PRIMARY },
  dialogSub: { fontSize: 13, color: '#737971' },
  dialogInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#1a1c1a',
  },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  dialogCancel: { paddingHorizontal: 16, paddingVertical: 10 },
  dialogCancelText: { fontSize: 14, color: '#737971', fontWeight: '600' },
  dialogConfirm: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  dialogConfirmText: { fontSize: 14, color: '#fff', fontWeight: '700' },
});
