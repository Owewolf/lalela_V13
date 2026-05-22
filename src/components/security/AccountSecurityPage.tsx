import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState } from 'react';
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

const AccountSecurityPage: React.FC = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ edit?: string | string[]; tab?: string | string[] }>();
  const routeEdit = Array.isArray(params.edit) ? params.edit[0] : params.edit;
  const routeTab = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const initialProfileEdit = routeEdit === 'true';
  const validTabs: Tab[] = ['profile', 'businesses', 'security', 'sessions', 'licensing', 'activity', 'danger'];
  const [activeTab, setActiveTab] = useState<Tab>(
    validTabs.includes(routeTab as Tab) ? (routeTab as Tab) : 'profile'
  );
  const { communities, currentCommunity } = useCommunity();

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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 16,
        paddingBottom: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.06)',
        gap: 12,
      }}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace('/settings');
            }
          }}
          style={{ padding: 8, borderRadius: 12, backgroundColor: '#f5f5f5' }}
        >
          <ArrowLeft size={20} color="#1a1a1a" />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={22} color="#0d3d47" />
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#1a1a1a' }}>Account & Security</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)' }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row', alignItems: 'center' }}
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
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: isActive ? '#0d3d47' : '#f8fafc',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <IconComponent size={20} color={isActive ? '#fff' : '#64748b'} />
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
          contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
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
