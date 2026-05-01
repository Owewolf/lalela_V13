import React from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { CreditCard, ShieldAlert, Star, Calendar } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useCommunity } from '../../context/CommunityContext';
import { accountService } from '../../services/accountService';

export const LicensingSection: React.FC = () => {
  const { userProfile } = useAuth();
  const { communities, setCurrentCommunity } = useCommunity();

  const isOverallLicensed = communities.some((c) => c.type === 'LICENSED');
  const isExpiredInvitedMember =
    userProfile?.license_type === 'COMMUNITY_GRANTED' &&
    userProfile?.license_status === 'UNLICENSED' &&
    userProfile?.member_expiry_date &&
    new Date(userProfile.member_expiry_date) < new Date();

  const overallStatus = isExpiredInvitedMember
    ? 'Expired Member'
    : isOverallLicensed
    ? 'Licensed Platform Member'
    : 'Trial Platform User';

  const handleCheckout = async (type: 'membership' | 'community', targetId?: string) => {
    try {
      const { url } = await accountService.createCheckoutSession(type, targetId);
      const fullUrl = url.startsWith('http') ? url : `https://lalela.app${url}`;
      Linking.openURL(fullUrl).catch(() =>
        Alert.alert('Error', 'Could not open payment page. Please try again.')
      );
    } catch {
      Alert.alert('Error', 'Failed to initialize checkout. Please try again.');
    }
  };

  const getCommunityStatus = (community: any) => {
    const now = new Date();
    const trialEndDate = community.trial_end_date instanceof Date
      ? community.trial_end_date
      : new Date(community.trial_end_date);

    if (community.type === 'LICENSED') return { label: 'Licensed', color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
    if (trialEndDate < now) return { label: 'Expired', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
    return { label: 'Trial', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  };

  const formatTrialDate = (date: any) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 24, gap: 20 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(37,99,235,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={22} color="#2563eb" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#0d3d47' }}>Licensing & Access</Text>
        </View>
        <View style={{
          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1,
          backgroundColor: isOverallLicensed ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
          borderColor: isOverallLicensed ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)',
        }}>
          <Text style={{
            fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1,
            color: isOverallLicensed ? '#059669' : '#d97706',
          }}>
            {overallStatus}
          </Text>
        </View>
      </View>

      {/* Expired member banner */}
      {isExpiredInvitedMember && (
        <View style={{ backgroundColor: '#fef2f2', borderRadius: 24, padding: 18, gap: 12, borderWidth: 1, borderColor: '#fecaca', flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ShieldAlert size={20} color="#ef4444" />
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#b91c1c' }}>Membership Expired</Text>
              <Text style={{ fontSize: 11, color: '#dc2626', marginTop: 4, lineHeight: 17 }}>
                Your community-granted membership trial has expired. Pay R149 once-off for lifetime membership.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleCheckout('membership')}
              style={{ alignSelf: 'flex-start', backgroundColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
                Upgrade Membership (R149)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Upgrade banner for trial users */}
      {!isOverallLicensed && !isExpiredInvitedMember && (
        <View style={{ backgroundColor: 'rgba(22,163,74,0.05)', borderRadius: 24, padding: 18, gap: 12, borderWidth: 1, borderColor: 'rgba(22,163,74,0.2)', flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(22,163,74,0.1)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Star size={20} color="#0d3d47" />
          </View>
          <View style={{ flex: 1, gap: 10 }}>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0d3d47' }}>Upgrade to Lifetime Membership</Text>
              <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 4, lineHeight: 17 }}>
                Secure your access across the platform without worrying about community trial limits.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => handleCheckout('membership')}
              style={{ alignSelf: 'flex-start', backgroundColor: '#0d3d47', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
                Upgrade Membership (R149)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Community list */}
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 10, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
          Community Status & Roles
        </Text>
        {communities.map((community) => {
          const statusInfo = getCommunityStatus(community);
          return (
            <View
              key={community.id}
              style={{ backgroundColor: '#f5f5f5', borderRadius: 20, padding: 16, gap: 12 }}
            >
              {/* Top row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(22,163,74,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 20, fontWeight: '800', color: '#0d3d47' }}>{community.name.charAt(0)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1a1a1a' }}>{community.name}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: statusInfo.bg }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: statusInfo.color, textTransform: 'uppercase', letterSpacing: 1 }}>
                        {statusInfo.label}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#888' }}>
                      Role: {community.userRole || 'Member'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Actions row */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {community.type === 'TRIAL' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
                    <Calendar size={12} color="#6b7280" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#6b7280' }}>
                      Ends: {formatTrialDate(community.trial_end_date)}
                    </Text>
                  </View>
                )}
                {community.type === 'TRIAL' && statusInfo.label !== 'Expired' && (
                  <TouchableOpacity
                    onPress={() => setCurrentCommunity(community.id)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(22,163,74,0.1)' }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#0d3d47', textTransform: 'uppercase', letterSpacing: 1 }}>Manage</Text>
                  </TouchableOpacity>
                )}
                {community.type === 'TRIAL' ? (
                  <TouchableOpacity
                    onPress={() => handleCheckout('community', community.id)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#0d3d47' }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
                      License (R999)
                    </Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => setCurrentCommunity(community.id)}
                    style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: '#10b981' }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>Manage</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};
