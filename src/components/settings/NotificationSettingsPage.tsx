import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  Bell,
  ShieldAlert,
  Building2,
  MessageSquare,
  Tag,
  Megaphone,
  ChevronDown,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { NotificationPreferences, CommunityNotificationOverride } from '../../types';

const defaultPreferences: NotificationPreferences = {
  globalEnabled: true,
  generalNotices: true,
  listingUpdates: true,
  communityActivity: true,
  businessActivity: true,
  priorityCommunityIds: [],
  communityOverrides: {},
};

type NotifTypeKey = 'generalNotices' | 'listingUpdates' | 'communityActivity' | 'businessActivity';

const NOTIFICATION_TYPES: {
  key: NotifTypeKey;
  Icon: React.ElementType;
  label: string;
  description: string;
}[] = [
  { key: 'generalNotices', Icon: Megaphone, label: 'General Notices', description: 'Community announcements and general updates' },
  { key: 'listingUpdates', Icon: Tag, label: 'Listing Updates', description: 'New listings, price changes, and marketplace activity' },
  { key: 'communityActivity', Icon: MessageSquare, label: 'Community Activity', description: 'Posts, comments, and member activity' },
  { key: 'businessActivity', Icon: Building2, label: 'Business Activity', description: 'Business updates, promotions, and reviews' },
];

const NotificationSettingsPage: React.FC = () => {
  const router = useRouter();
  const { communities, updateNotificationPreferences } = useCommunity();
  const { userProfile } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPreferences);
  const [saving, setSaving] = useState(false);
  const [expandedCommunityId, setExpandedCommunityId] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.notificationPreferences) {
      setPrefs({ ...defaultPreferences, ...(userProfile.notificationPreferences as NotificationPreferences) });
    }
  }, [userProfile?.notificationPreferences]);

  const save = async (updated: NotificationPreferences) => {
    setPrefs(updated);
    setSaving(true);
    try {
      await updateNotificationPreferences(updated);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (key: keyof Omit<NotificationPreferences, 'priorityCommunityIds' | 'communityOverrides'>) => {
    save({ ...prefs, [key]: !prefs[key] });
  };

  const toggleCommunityType = (communityId: string, key: NotifTypeKey) => {
    const currentOverride: CommunityNotificationOverride = prefs.communityOverrides?.[communityId] ?? {};
    const currentValue = currentOverride[key] ?? prefs[key];
    const newOverride = { ...currentOverride, [key]: !currentValue };

    const matchesGlobal =
      (newOverride.generalNotices ?? prefs.generalNotices) === prefs.generalNotices &&
      (newOverride.listingUpdates ?? prefs.listingUpdates) === prefs.listingUpdates &&
      (newOverride.communityActivity ?? prefs.communityActivity) === prefs.communityActivity &&
      (newOverride.businessActivity ?? prefs.businessActivity) === prefs.businessActivity;

    const updatedOverrides = { ...(prefs.communityOverrides ?? {}) };
    if (matchesGlobal) {
      delete updatedOverrides[communityId];
    } else {
      updatedOverrides[communityId] = newOverride;
    }
    save({ ...prefs, communityOverrides: updatedOverrides });
  };

  const getCommunityStatus = (communityId: string): { label: string; color: string } => {
    const override = prefs.communityOverrides?.[communityId];
    if (!override) return { label: 'Follows global', color: '#9ca3af' };
    const types: NotifTypeKey[] = ['generalNotices', 'listingUpdates', 'communityActivity', 'businessActivity'];
    const onCount = types.filter((k) => override[k] ?? prefs[k]).length;
    if (onCount === 0) return { label: 'Muted', color: '#ef4444' };
    if (onCount === 4) return { label: 'All on', color: '#0d3d47' };
    return { label: `${onCount} of 4 on`, color: '#f59e0b' };
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 8, borderRadius: 12, backgroundColor: '#f5f5f5' }}
          >
            <ArrowLeft size={20} color="#1a1a1a" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: '#1a1a1a' }}>Notification Settings</Text>
            <Text style={{ fontSize: 13, color: '#888' }}>Manage how you receive notifications</Text>
          </View>
          {saving && (
            <ActivityIndicator size="small" color="#0d3d47" />
          )}
        </View>

        {/* Emergency Banner */}
        <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)', flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(239,68,68,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldAlert size={20} color="#ef4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#ef4444' }}>Emergency Notifications</Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 18 }}>
              Emergency notifications are always enabled and cannot be turned off. These include security alerts and critical community warnings.
            </Text>
          </View>
        </View>

        {/* Global toggle */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: prefs.globalEnabled ? 'rgba(22,163,74,0.1)' : 'rgba(107,114,128,0.1)', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} color={prefs.globalEnabled ? '#0d3d47' : '#9ca3af'} />
            </View>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#1a1a1a' }}>All Notifications</Text>
              <Text style={{ fontSize: 11, color: '#888' }}>
                {prefs.globalEnabled ? 'Notifications are enabled' : 'All non-emergency paused'}
              </Text>
            </View>
          </View>
          <Switch
            value={prefs.globalEnabled}
            onValueChange={() => toggle('globalEnabled')}
            trackColor={{ false: '#d1d5db', true: '#0d3d47' }}
            thumbColor="#ffffff"
          />
        </View>

        {/* Notification Types */}
        <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', gap: 16, opacity: prefs.globalEnabled ? 1 : 0.5 }}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a1a' }}>Notification Types</Text>
            <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Default settings applied to all communities unless overridden below</Text>
          </View>
          {NOTIFICATION_TYPES.map((item) => {
            const { Icon } = item;
            const enabled = prefs[item.key] as boolean;
            return (
              <View
                key={item.key}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 14,
                  borderRadius: 16,
                  borderWidth: 1,
                  backgroundColor: enabled ? 'rgba(22,163,74,0.05)' : '#f5f5f5',
                  borderColor: enabled ? 'rgba(22,163,74,0.2)' : 'rgba(0,0,0,0.06)',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: enabled ? 'rgba(22,163,74,0.1)' : 'rgba(107,114,128,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} color={enabled ? '#0d3d47' : '#9ca3af'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a1a' }}>{item.label}</Text>
                    <Text style={{ fontSize: 11, color: '#888' }} numberOfLines={1}>{item.description}</Text>
                  </View>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: '#d1d5db', true: '#0d3d47' }}
                  thumbColor="#ffffff"
                  disabled={!prefs.globalEnabled}
                />
              </View>
            );
          })}
        </View>

        {/* Community overrides */}
        {communities.length > 1 && (
          <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', gap: 14, opacity: prefs.globalEnabled ? 1 : 0.5 }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '700', color: '#1a1a1a' }}>Community Settings</Text>
              <Text style={{ fontSize: 12, color: '#888', marginTop: 4, lineHeight: 18 }}>
                Customise which notifications you receive per community.
              </Text>
            </View>
            <View style={{ gap: 8 }}>
              {communities.map((community) => {
                const isExpanded = expandedCommunityId === community.id;
                const { label: statusLabel, color: statusColor } = getCommunityStatus(community.id);
                const override = prefs.communityOverrides?.[community.id];

                return (
                  <View
                    key={community.id}
                    style={{
                      borderRadius: 16,
                      borderWidth: 1,
                      overflow: 'hidden',
                      borderColor: isExpanded ? 'rgba(22,163,74,0.2)' : 'rgba(0,0,0,0.06)',
                      backgroundColor: isExpanded ? 'rgba(22,163,74,0.05)' : '#f5f5f5',
                    }}
                  >
                    {/* Collapsed header */}
                    <TouchableOpacity
                      onPress={() => setExpandedCommunityId(isExpanded ? null : community.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}
                      disabled={!prefs.globalEnabled}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(37,99,235,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Bell size={16} color="#2563eb" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#1a1a1a' }} numberOfLines={1}>{community.name}</Text>
                        <Text style={{ fontSize: 11, fontWeight: '600', color: statusColor, marginTop: 2 }}>{statusLabel}</Text>
                      </View>
                      <View style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
                        <ChevronDown size={16} color="#9ca3af" />
                      </View>
                    </TouchableOpacity>

                    {/* Expanded per-type toggles */}
                    {isExpanded && (
                      <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 14, paddingVertical: 12, gap: 6 }}>
                        {!override && (
                          <Text style={{ fontSize: 11, color: '#888', fontStyle: 'italic', marginBottom: 6 }}>
                            Using global defaults — toggle any type below to customise this community.
                          </Text>
                        )}
                        {NOTIFICATION_TYPES.map((item) => {
                          const { Icon } = item;
                          const effectiveValue = override?.[item.key] ?? prefs[item.key] as boolean;
                          const isOverriding = override?.[item.key] !== undefined && override[item.key] !== prefs[item.key];
                          return (
                            <View
                              key={item.key}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                borderRadius: 12,
                                backgroundColor: effectiveValue ? 'rgba(22,163,74,0.05)' : '#fff',
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: effectiveValue ? 'rgba(22,163,74,0.1)' : 'rgba(107,114,128,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Icon size={16} color={effectiveValue ? '#0d3d47' : '#9ca3af'} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 13, fontWeight: '500', color: '#1a1a1a' }}>{item.label}</Text>
                                  {isOverriding && (
                                    <Text style={{ fontSize: 10, color: '#f59e0b' }}>Overriding global</Text>
                                  )}
                                </View>
                              </View>
                              <Switch
                                value={effectiveValue}
                                onValueChange={() => toggleCommunityType(community.id, item.key)}
                                trackColor={{ false: '#d1d5db', true: '#0d3d47' }}
                                thumbColor="#ffffff"
                              />
                            </View>
                          );
                        })}
                        {override && (
                          <TouchableOpacity
                            onPress={() => {
                              const updatedOverrides = { ...(prefs.communityOverrides ?? {}) };
                              delete updatedOverrides[community.id];
                              save({ ...prefs, communityOverrides: updatedOverrides });
                            }}
                            style={{ paddingVertical: 10, alignItems: 'center', marginTop: 4 }}
                          >
                            <Text style={{ fontSize: 12, color: '#888' }}>Reset to global defaults</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationSettingsPage;
