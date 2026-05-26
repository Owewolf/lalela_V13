import { SafeAreaView } from "react-native-safe-area-context";
import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, ShieldCheck, User, Lock, Clock, Key, Activity, AlertTriangle, Building2 } from 'lucide-react-native';
import { ProfileSection } from './ProfileSection';
import { SecuritySection } from './SecuritySection';
import { SessionsSection } from './SessionsSection';
import { LicensingSection } from './LicensingSection';
import { AuditLogsSection } from './AuditLogsSection';
import { DangerZoneSection } from './DangerZoneSection';
import ManageUserBusinesses from '../settings/ManageUserBusinesses';
import { useCommunity } from '../../context/CommunityContext';
import { THEME_COLORS } from '../../theme/colors';

type Tab = 'profile' | 'businesses' | 'security' | 'sessions' | 'licensing' | 'activity' | 'danger';

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: 'Profile' },
  { key: 'businesses', label: 'Businesses' },
  { key: 'security', label: 'Security' },
  { key: 'sessions', label: 'Sessions' },
  { key: 'licensing', label: 'Licensing' },
  { key: 'activity', label: 'Activity' },
  { key: 'danger', label: 'Account' },
];

const TYPE_SCALE = {
  title: 20,
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  s44: 44,
  s150: 150,
};
const RADIUS = {
  md: 12,
  full: 22,
};

const AccountSecurityPage: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{
    edit?: string | string[];
    tab?: string | string[];
    warningMode?: string | string[];
    securityHandoff?: string | string[];
    emergencyId?: string | string[];
  }>();
  const routeEdit = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const routeTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const routeWarningMode = Array.isArray(params.warningMode) ? params.warningMode[0] : params.warningMode;
  const routeSecurityHandoff = Array.isArray(params.securityHandoff) ? params.securityHandoff[0] : params.securityHandoff;
  const routeEmergencyId = Array.isArray(params.emergencyId) ? params.emergencyId[0] : params.emergencyId;
  const initialProfileEdit = routeEdit === 'true';
  const validTabs: Tab[] = ['profile', 'businesses', 'security', 'sessions', 'licensing', 'activity', 'danger'];
  const [activeTab, setActiveTab] = useState<Tab>(
    validTabs.includes(routeTab as Tab) ? (routeTab as Tab) : 'profile'
  );
  const { communities, currentCommunity, posts } = useCommunity();
  const hasProcessedHandoff = useRef(false);

  const fallbackActiveEmergencyId = useMemo(() => {
    const exact = currentCommunity?.activeEmergencyId;
    if (exact) return exact;

    const emergencyPost = posts.find(
      (p) => p.urgencyLevel === 'emergency' || p.urgency === 'emergency'
    );
    if (emergencyPost?.id) return emergencyPost.id;

    const warningPost = posts.find(
      (p) => p.urgencyLevel === 'warning' || p.urgency === 'high'
    );
    return warningPost?.id;
  }, [currentCommunity?.activeEmergencyId, posts]);

  useEffect(() => {
    const shouldHandoff = routeSecurityHandoff === '1' && routeWarningMode === '1';
    if (!shouldHandoff || hasProcessedHandoff.current) return;

    const targetEmergencyId = routeEmergencyId || fallbackActiveEmergencyId;
    if (!targetEmergencyId) return;

    hasProcessedHandoff.current = true;
    router.replace(`/emergency/${targetEmergencyId}?forceCenter=1` as any);
  }, [routeSecurityHandoff, routeWarningMode, routeEmergencyId, fallbackActiveEmergencyId, router]);

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileSection initialEdit={initialProfileEdit} />;
      case 'businesses':
        return (
          <ManageUserBusinesses
            communities={communities || []}
            currentCommunity={currentCommunity || null}
          />
        );
      case 'security':
        return <SecuritySection />;
      case 'sessions':
        return <SessionsSection />;
      case 'licensing':
        return <LicensingSection />;
      case 'activity':
        return <AuditLogsSection />;
      case 'danger':
        return <DangerZoneSection />;
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: THEME_COLORS.neutralBg }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACE.xl,
        paddingTop: SPACE.lg,
        paddingBottom: SPACE.md,
        backgroundColor: THEME_COLORS.white,
        borderBottomWidth: 1,
        borderBottomColor: THEME_COLORS.overlayBorderSoft,
        gap: SPACE.md,
      }}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/settings');
            }
          }}
          style={{ padding: SPACE.sm, borderRadius: RADIUS.md, backgroundColor: THEME_COLORS.surfaceContainerLow }}
        >
          <ArrowLeft size={20} color={THEME_COLORS.onSurface} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
          <ShieldCheck size={22} color={THEME_COLORS.primary} />
          <Text style={{ fontSize: TYPE_SCALE.title, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>Account & Security</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={{ backgroundColor: THEME_COLORS.white, borderBottomWidth: 1, borderBottomColor: THEME_COLORS.overlayBorderSoft }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: SPACE.md, paddingVertical: SPACE.sm, gap: SPACE.sm, flexDirection: 'row', alignItems: 'center' }}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            let IconComponent: any;
            switch (tab.key) {
              case 'profile': IconComponent = User; break;
              case 'businesses': IconComponent = Building2; break;
              case 'security': IconComponent = Lock; break;
              case 'sessions': IconComponent = Clock; break;
              case 'licensing': IconComponent = Key; break;
              case 'activity': IconComponent = Activity; break;
              case 'danger': IconComponent = AlertTriangle; break;
              default: IconComponent = User; break;
            }

            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
                style={{
                  width: SPACE.s44,
                  height: SPACE.s44,
                  borderRadius: RADIUS.full,
                  backgroundColor: isActive ? THEME_COLORS.primary : THEME_COLORS.neutralBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconComponent size={20} color={isActive ? THEME_COLORS.white : THEME_COLORS.neutralTextSubtle} />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          contentContainerStyle={{ padding: SPACE.lg, paddingBottom: SPACE.s150 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {renderContent()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default AccountSecurityPage;
