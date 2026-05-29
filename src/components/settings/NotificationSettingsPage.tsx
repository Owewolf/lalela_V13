import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState } from 'react';
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
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { CommunityNotificationOverride, NotificationPreferences } from '../../types';
import { THEME_COLORS } from '../../theme/colors';
import EmergencyResponderCard from '../shared/EmergencyResponderCard';

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
  const { currentCommunity, updateNotificationPreferences } = useCommunity();
  const { userProfile, refreshProfile } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences>(defaultPreferences);
  const [saving, setSaving] = useState(false);

  const selectedCommunityId = currentCommunity?.id ?? '';
  const selectedCommunityName = currentCommunity?.name ?? 'selected community';
  const canConfigure = Boolean(selectedCommunityId);

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

  const getEffectiveValue = (key: NotifTypeKey): boolean => {
    if (!selectedCommunityId) return prefs[key] as boolean;
    const selectedOverride = prefs.communityOverrides?.[selectedCommunityId] ?? {};
    return (selectedOverride[key] ?? prefs[key]) as boolean;
  };

  const updateSelectedCommunity = (changes: Partial<Record<NotifTypeKey, boolean>>) => {
    if (!selectedCommunityId) return;

    const currentOverride: CommunityNotificationOverride = prefs.communityOverrides?.[selectedCommunityId] ?? {};
    const mergedOverride: CommunityNotificationOverride = {
      ...currentOverride,
      ...changes,
    };

    const cleanedOverride: CommunityNotificationOverride = {};
    NOTIFICATION_TYPES.forEach(({ key }) => {
      const value = mergedOverride[key];
      if (typeof value === 'boolean' && value !== prefs[key]) {
        cleanedOverride[key] = value;
      }
    });

    const updatedOverrides = { ...(prefs.communityOverrides ?? {}) };
    if (Object.keys(cleanedOverride).length === 0) {
      delete updatedOverrides[selectedCommunityId];
    } else {
      updatedOverrides[selectedCommunityId] = cleanedOverride;
    }

    save({ ...prefs, communityOverrides: updatedOverrides });
  };

  const toggleType = (key: NotifTypeKey) => {
    updateSelectedCommunity({ [key]: !getEffectiveValue(key) });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME_COLORS.neutralBg }}>
      <ScrollView contentContainerStyle={{ padding: SPACE.s20, paddingBottom: SPACE.s48, gap: SPACE.s20 }} showsVerticalScrollIndicator={false}>
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
            <Text style={{ fontSize: TYPE_SCALE.lg, color: THEME_COLORS.neutralTextSoft }}>{selectedCommunityName}</Text>
          </View>
          {saving && (
            <ActivityIndicator size="small" color={THEME_COLORS.primary} />
          )}
        </View>

        <EmergencyResponderCard />

        <View style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.card, padding: SPACE.s20, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft, gap: SPACE.s16, opacity: canConfigure ? 1 : 0.55 }}>
          <View>
            <Text style={{ fontSize: TYPE_SCALE.h1, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>Notification Types</Text>
            <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSoft, marginTop: SPACE.xs }}>
              Fine-tune notification types for {selectedCommunityName}.
            </Text>
          </View>
          {NOTIFICATION_TYPES.map((item) => {
            const { Icon } = item;
            const enabled = getEffectiveValue(item.key);
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
                  onValueChange={() => toggleType(item.key)}
                  trackColor={{ false: THEME_COLORS.neutralBorderMuted, true: THEME_COLORS.primary }}
                  thumbColor={THEME_COLORS.white}
                  disabled={!canConfigure}
                />
              </View>
            );
          })}
          {!canConfigure && (
            <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.warningStrong }}>
              Select a community in Settings to configure community-specific notifications.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default NotificationSettingsPage;
