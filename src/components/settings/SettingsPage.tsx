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
  Lock,
  BellRing,
  ChevronRight,
  ShieldCheck,
  MapPin,
  AlertCircle,
  Shield,
  Sparkles,
  ChevronDown,
  CheckCircle2,
  Plus,
} from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { isCommunityActive, isCommunityTrial, isUserLicensed } from '../../lib/licensing';
import { NotificationPreferences } from '../../types';


const APP_LOGO = require('../../../assets/lalela_logo.png');
const APP_LOGO_SELECTED = require('../../../assets/lalela_logo_transparent.png');
import ManageCommunityCharity from './ManageCommunityCharity';

const SettingsPage: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ charityMode?: string | string[] }>();
  const { userProfile, updateUserProfile } = useAuth();
  const { currentCommunity, communities, setCurrentCommunity } = useCommunity();

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
    if (val) {
      router.push('/notifications-settings');
    } else {
      // Just disable — keep other prefs intact
      // This mirrors the web behaviour
    }
  };

  const avatarUri = userProfile?.profileImage
    ? userProfile.profileImage
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.id}`;

  const roleColor = () => {
    switch (currentCommunity?.userRole) {
      case 'ADMIN': return { bg: 'rgba(239,68,68,0.1)', text: '#ef4444', dot: '#ef4444' };
      case 'MODERATOR': return { bg: 'rgba(37,99,235,0.1)', text: '#2563eb', dot: '#2563eb' };
      default: return { bg: 'rgba(22,163,74,0.1)', text: '#0d3d47', dot: '#0d3d47' };
    }
  };

  // Per pricing model: only a pending TRIAL community blocks creating another.
  // Aligned with the sidebar gate so both surfaces stay consistent.
  const hasTrialCommunity = (communities || []).some(
    (c: any) => c.ownerId === userProfile?.id && isCommunityTrial(c)
  );
  const canCreateNewCommunity = !hasTrialCommunity;

  const rc = roleColor();

  const isLicensed = isUserLicensed(userProfile, currentCommunity);
  const ringColor = isLicensed ? '#10b981' : '#dc2626';

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 48, gap: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profile Identity Card ── */}
        <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 20, gap: 16 }}>
          {/* Avatar + Name row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ position: 'relative' }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, overflow: 'hidden', borderWidth: 3, borderColor: ringColor }}>
                <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#1a1a1a', flex: 1 }} numberOfLines={1}>
                  {userProfile?.name}
                </Text>
              </View>

              {/* Community + license badge */}
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <MapPin size={14} color="#0d3d47" />
                  <Text style={{ fontSize: 13, color: '#4b5563' }}>{currentCommunity?.name}</Text>
                </View>
                {(() => {
                  const active = isCommunityActive(currentCommunity);
                  const trial = isCommunityTrial(currentCommunity);
                  const label = active ? 'Active' : trial ? 'Trial' : 'Expired';
                  const palette = active
                    ? { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)', fg: '#059669' }
                    : trial
                      ? { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', fg: '#d97706' }
                      : { bg: 'rgba(220,38,38,0.1)', border: 'rgba(220,38,38,0.2)', fg: '#dc2626' };
                  const Icon = active ? ShieldCheck : AlertCircle;
                  return (
                    <View style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
                      backgroundColor: palette.bg,
                      borderColor: palette.border,
                    }}>
                      <Icon size={11} color={palette.fg} />
                      <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: palette.fg }}>
                        {label}
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {/* Role badges */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: rc.bg }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: rc.dot }} />
                  <Text style={{ fontSize: 10, fontWeight: '800', color: rc.text, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {currentCommunity?.userRole || 'MEMBER'}
                  </Text>
                </View>
                {currentCommunity?.isSecurityMember && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, backgroundColor: 'rgba(37,99,235,0.1)', borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)' }}>
                    <Shield size={11} color="#2563eb" />
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#2563eb', textTransform: 'uppercase', letterSpacing: 1 }}>Security Responder</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Community Switcher */}
          <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 16, gap: 10 }}>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#0d3d47', textTransform: 'uppercase', letterSpacing: 2 }}>
              Community Switcher
            </Text>

            <TouchableOpacity
              onPress={() => setShowCommunitySwitcher(!showCommunitySwitcher)}
              style={{
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                padding: 14, backgroundColor: '#f5f5f5', borderRadius: 16, borderWidth: 1,
                borderColor: showCommunitySwitcher ? 'rgba(22,163,74,0.3)' : 'rgba(0,0,0,0.06)',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Image source={APP_LOGO_SELECTED} style={{ width: 40, height: 40, borderRadius: 12 }} resizeMode="cover" />
                <View>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Active Community</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a', marginTop: 2 }}>
                    {currentCommunity?.name || 'Select Community'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {currentCommunity && (
                  <TouchableOpacity
                    onPress={() => router.push('/admin')}
                    style={{ paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#0d3d47', borderRadius: 8 }}
                  >
                    <Text style={{ fontSize: 9, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
                      Dashboard
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={{ transform: [{ rotate: showCommunitySwitcher ? '180deg' : '0deg' }] }}>
                  <ChevronDown size={20} color="#6b7280" />
                </View>
              </View>
            </TouchableOpacity>

            {showCommunitySwitcher && (
              <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                {(communities || []).map((c, idx) => {
                  const isActive = c.id === currentCommunity?.id;
                  const isAdminOrMod = c.ownerId === userProfile?.id || c.userRole === 'ADMIN' || c.userRole === 'MODERATOR';
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => { setCurrentCommunity(c.id); setShowCommunitySwitcher(false); }}
                      style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        padding: 14, borderBottomWidth: idx < (communities?.length || 1) - 1 ? 1 : 0, borderBottomColor: 'rgba(0,0,0,0.05)',
                        backgroundColor: isActive ? 'rgba(22,163,74,0.05)' : '#fff',
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                        <Image source={isActive ? APP_LOGO_SELECTED : APP_LOGO} style={{ width: 32, height: 32, borderRadius: 10 }} resizeMode="cover" />
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#0d3d47' : '#1a1a1a' }}>{c.name}</Text>
                          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                            <Text style={{ fontSize: 9, fontWeight: '800', color: isAdminOrMod ? '#2563eb' : '#0d3d47', textTransform: 'uppercase', letterSpacing: 1 }}>
                              {c.userRole || 'MEMBER'}
                            </Text>
                            {(() => {
                              const active = isCommunityActive(c);
                              const trial = isCommunityTrial(c);
                              const label = active ? 'Active' : trial ? 'Trial' : 'Expired';
                              const color = active ? '#059669' : trial ? '#d97706' : '#dc2626';
                              return (
                                <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color }}>
                                  {label}
                                </Text>
                              );
                            })()}
                          </View>
                        </View>
                      </View>
                      {isActive && <CheckCircle2 size={18} color="#10b981" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        </View>

        {/* ── General Settings ── */}
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 2, paddingHorizontal: 4, paddingBottom: 6 }}>
            General Settings
          </Text>

          {/* Account & Security */}
          <TouchableOpacity
            onPress={() => router.push('/security')}
            style={{
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              padding: 16, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={20} color="#0d3d47" />
              </View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a' }}>My Profile & Account</Text>
            </View>
            <ChevronRight size={20} color="#9ca3af" />
          </TouchableOpacity>

          {/* Notifications */}
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            padding: 16, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
          }}>
            <TouchableOpacity
              onPress={() => globalNotificationsEnabled && router.push('/notifications-settings')}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 }}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' }}>
                <BellRing size={20} color={globalNotificationsEnabled ? '#0d3d47' : '#9ca3af'} />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a' }}>Notifications</Text>
                <Text style={{ fontSize: 11, color: '#888' }}>
                  {globalNotificationsEnabled ? 'Tap to manage' : 'All non-emergency paused'}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Switch
                value={globalNotificationsEnabled}
                onValueChange={handleNotificationToggle}
                trackColor={{ false: '#d1d5db', true: '#0d3d47' }}
                thumbColor="#ffffff"
              />
              {globalNotificationsEnabled && (
                <TouchableOpacity onPress={() => router.push('/notifications-settings')}>
                  <ChevronRight size={20} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
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
          <View style={{ backgroundColor: '#1e5667', borderRadius: 24, padding: 20, gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#fff', flex: 1 }} numberOfLines={1}>
                {currentCommunity?.name || 'Community'}
              </Text>
              <View style={{
                flexDirection: 'row', alignItems: 'center', gap: 6,
                paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
                backgroundColor: 'rgba(245,158,11,0.25)',
                marginLeft: 12,
              }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fcd34d' }} />
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Trial Mode
                </Text>
              </View>
            </View>

            <View style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Sparkles size={18} color="#fcd34d" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Unlock Full Potential</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 4, lineHeight: 17 }}>
                    License your community to remove member limits, enable advanced moderation tools, and unlock all features.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/checkout', params: { type: 'community', targetId: currentCommunity.id } })}
                style={{ backgroundColor: '#fff', paddingVertical: 12, borderRadius: 14, alignItems: 'center' }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#1e5667', textTransform: 'uppercase', letterSpacing: 1 }}>
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
              padding: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#10b981',
              borderStyle: 'dashed',
              backgroundColor: 'rgba(16,185,129,0.05)',
              gap: 8,
            }}
            onPress={() => router.push('/onboarding-create')}
            activeOpacity={0.7}
          >
            <Plus size={20} color="#10b981" />
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#10b981' }}>Create New Community</Text>
          </TouchableOpacity>
        )}

      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default SettingsPage;
