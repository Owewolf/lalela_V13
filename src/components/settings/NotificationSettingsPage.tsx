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
import { THEME_COLORS } from '../../theme/colors';

const TYPE_SCALE = {
  xs: 10,
  sm: 11,
  md: 12,
  lg: 13,
  xl: 14,
  h2: 16,
  h1: 18,
  hero: 22,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

const LINE_HEIGHT = {
  body: 18,
} as const;

const SPACE = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 14,
  s16: 16,
  s18: 18,
  s20: 20,
  s48: 48,
};

const RADIUS = {
  md: 12,
  lg: 16,
  xl: 18,
  card: 20,
  panel: 36,
  round: 40,
};

const defaultPreferences: NotificationPreferences = {
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

type NotifTypeKey =
  | 'generalNotices'
  | 'listingUpdates'
  | 'communityActivity'
  | 'businessActivity'
  | 'charitySuggestions'
  | 'securityAlerts';

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
  { key: 'charitySuggestions', Icon: Bell, label: 'Charity Suggestions', description: 'Member charity suggestions and review activity' },
  { key: 'securityAlerts', Icon: ShieldAlert, label: 'Security Alerts', description: 'Security and high-priority system alerts' },
];

const NotificationSettingsPage: React.FC = () => {
  const router = useRouter();
  const { communities, updateNotificationPreferences } = useCommunity();
  const { userProfile, refreshProfile } = useAuth();
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
      await refreshProfile();
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
      (newOverride.businessActivity ?? prefs.businessActivity) === prefs.businessActivity &&
      (newOverride.charitySuggestions ?? prefs.charitySuggestions) === prefs.charitySuggestions &&
      (newOverride.securityAlerts ?? prefs.securityAlerts) === prefs.securityAlerts;

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
    if (!override) return { label: 'Follows global', color: THEME_COLORS.neutralTextSoft };
    const types: NotifTypeKey[] = ['generalNotices', 'listingUpdates', 'communityActivity', 'businessActivity', 'charitySuggestions', 'securityAlerts'];
    const onCount = types.filter((k) => override[k] ?? prefs[k]).length;
    if (onCount === 0) return { label: 'Muted', color: THEME_COLORS.errorStrong };
    if (onCount === types.length) return { label: 'All on', color: THEME_COLORS.primary };
    return { label: `${onCount} of ${types.length} on`, color: THEME_COLORS.warningStrong };
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME_COLORS.neutralBg }}>
      <ScrollView contentContainerStyle={{ padding: SPACE.s20, paddingBottom: SPACE.s48, gap: SPACE.s20 }} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xxl }}>
          <TouchableOpacity
            onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/settings');
            }
          }}
            style={{ padding: SPACE.md, borderRadius: RADIUS.md, backgroundColor: THEME_COLORS.surfaceContainerLow }}
          >
            <ArrowLeft size={20} color={THEME_COLORS.onSurface} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: TYPE_SCALE.hero, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>Notification Settings</Text>
            <Text style={{ fontSize: TYPE_SCALE.lg, color: THEME_COLORS.neutralTextSoft }}>Manage how you receive notifications</Text>
          </View>
          {saving && (
            <ActivityIndicator size="small" color={THEME_COLORS.primary} />
          )}
        </View>

        {/* Emergency Banner */}
        <View style={{ backgroundColor: THEME_COLORS.errorTintSoft, borderRadius: RADIUS.card, padding: SPACE.s18, borderWidth: 1, borderColor: THEME_COLORS.alias_rgba_239_68_68_0_2, flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.xl }}>
          <View style={{ width: 40, height: 40, borderRadius: RADIUS.round, backgroundColor: THEME_COLORS.alias_rgba_239_68_68_0_2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldAlert size={20} color={THEME_COLORS.errorStrong} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: TYPE_SCALE.h2, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.errorStrong }}>Emergency Notifications</Text>
            <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xs, lineHeight: LINE_HEIGHT.body }}>
              Emergency notifications are always enabled and cannot be turned off. These include security alerts and critical community warnings.
            </Text>
          </View>
        </View>

        {/* Global toggle */}
        <View style={{ backgroundColor: THEME_COLORS.white, borderRadius: RADIUS.card, padding: SPACE.s18, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xl }}>
            <View style={{ width: 40, height: 40, borderRadius: RADIUS.round, backgroundColor: prefs.globalEnabled ? THEME_COLORS.successTintSoft : THEME_COLORS.neutralTintSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} color={prefs.globalEnabled ? THEME_COLORS.primary : THEME_COLORS.neutralTextSoft} />
            </View>
            <View>
              <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.semibold, color: THEME_COLORS.onSurface }}>All Notifications</Text>
              <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSoft }}>
                {prefs.globalEnabled ? 'Notifications are enabled' : 'All non-emergency paused'}
              </Text>
            </View>
          </View>
          <Switch
            value={prefs.globalEnabled}
            onValueChange={() => toggle('globalEnabled')}
            trackColor={{ false: THEME_COLORS.neutralBorderMuted, true: THEME_COLORS.primary }}
            thumbColor={THEME_COLORS.white}
          />
        </View>

        {/* Notification Types */}
        <View style={{ backgroundColor: THEME_COLORS.white, borderRadius: RADIUS.card, padding: SPACE.s20, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft, gap: SPACE.s16, opacity: prefs.globalEnabled ? 1 : 0.5 }}>
          <View>
            <Text style={{ fontSize: TYPE_SCALE.h1, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>Notification Types</Text>
            <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSoft, marginTop: SPACE.xs }}>Default settings applied to all communities unless overridden below</Text>
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
                  padding: SPACE.xxl,
                  borderRadius: RADIUS.lg,
                  borderWidth: 1,
                  backgroundColor: enabled ? THEME_COLORS.successTintSofter : THEME_COLORS.surfaceContainerLow,
                  borderColor: enabled ? THEME_COLORS.successTintBorderAlt : THEME_COLORS.overlayBorderSoft,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xl, flex: 1 }}>
                  <View style={{ width: 40, height: 40, borderRadius: RADIUS.round, backgroundColor: enabled ? THEME_COLORS.successTintSoft : THEME_COLORS.neutralTintSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={20} color={enabled ? THEME_COLORS.primary : THEME_COLORS.neutralTextSoft} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.semibold, color: THEME_COLORS.onSurface }}>{item.label}</Text>
                    <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSoft }} numberOfLines={1}>{item.description}</Text>
                  </View>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: THEME_COLORS.neutralBorderMuted, true: THEME_COLORS.primary }}
                  thumbColor={THEME_COLORS.white}
                  disabled={!prefs.globalEnabled}
                />
              </View>
            );
          })}
        </View>

        {/* Community overrides */}
        {communities.length > 1 && (
          <View style={{ backgroundColor: THEME_COLORS.white, borderRadius: RADIUS.card, padding: SPACE.s20, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft, gap: SPACE.xxl, opacity: prefs.globalEnabled ? 1 : 0.5 }}>
            <View>
              <Text style={{ fontSize: TYPE_SCALE.h1, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>Community Settings</Text>
              <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSoft, marginTop: SPACE.xs, lineHeight: LINE_HEIGHT.body }}>
                Customise which notifications you receive per community.
              </Text>
            </View>
            <View style={{ gap: SPACE.md }}>
              {communities.map((community) => {
                const isExpanded = expandedCommunityId === community.id;
                const { label: statusLabel, color: statusColor } = getCommunityStatus(community.id);
                const override = prefs.communityOverrides?.[community.id];

                return (
                  <View
                    key={community.id}
                    style={{
                      borderRadius: RADIUS.lg,
                      borderWidth: 1,
                      overflow: 'hidden',
                      borderColor: isExpanded ? THEME_COLORS.successTintBorderAlt : THEME_COLORS.overlayBorderSoft,
                      backgroundColor: isExpanded ? THEME_COLORS.successTintSofter : THEME_COLORS.surfaceContainerLow,
                    }}
                  >
                    {/* Collapsed header */}
                    <TouchableOpacity
                      onPress={() => setExpandedCommunityId(isExpanded ? null : community.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xl, padding: SPACE.xxl }}
                      disabled={!prefs.globalEnabled}
                    >
                      <View style={{ width: 36, height: 36, borderRadius: RADIUS.xl, backgroundColor: THEME_COLORS.infoTintSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Bell size={16} color={THEME_COLORS.brandBlueText} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.semibold, color: THEME_COLORS.onSurface }} numberOfLines={1}>{community.name}</Text>
                        <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.semibold, color: statusColor, marginTop: SPACE.xxs }}>{statusLabel}</Text>
                      </View>
                      <View style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
                        <ChevronDown size={16} color={THEME_COLORS.neutralTextSoft} />
                      </View>
                    </TouchableOpacity>

                    {/* Expanded per-type toggles */}
                    {isExpanded && (
                      <View style={{ borderTopWidth: 1, borderTopColor: THEME_COLORS.overlayBorderSoft, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.xl, gap: SPACE.lg }}>
                        {!override && (
                          <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextSoft, fontStyle: 'italic', marginBottom: SPACE.lg }}>
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
                                paddingVertical: SPACE.lg,
                                paddingHorizontal: SPACE.xl,
                                borderRadius: RADIUS.md,
                                backgroundColor: effectiveValue ? THEME_COLORS.successTintSofter : THEME_COLORS.white,
                              }}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, flex: 1 }}>
                                <View style={{ width: 32, height: 32, borderRadius: RADIUS.lg, backgroundColor: effectiveValue ? THEME_COLORS.successTintSoft : THEME_COLORS.neutralTintSoft, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <Icon size={16} color={effectiveValue ? THEME_COLORS.primary : THEME_COLORS.neutralTextSoft} />
                                </View>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.medium, color: THEME_COLORS.onSurface }}>{item.label}</Text>
                                  {isOverriding && (
                                    <Text style={{ fontSize: TYPE_SCALE.xs, color: THEME_COLORS.warningStrong }}>Overriding global</Text>
                                  )}
                                </View>
                              </View>
                              <Switch
                                value={effectiveValue}
                                onValueChange={() => toggleCommunityType(community.id, item.key)}
                                trackColor={{ false: THEME_COLORS.neutralBorderMuted, true: THEME_COLORS.primary }}
                                thumbColor={THEME_COLORS.white}
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
                            style={{ paddingVertical: SPACE.lg, alignItems: 'center', marginTop: SPACE.xs }}
                          >
                            <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSoft }}>Reset to global defaults</Text>
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
