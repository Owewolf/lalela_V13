import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { CreditCard, ShieldAlert, Star, Calendar, CheckCircle2 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useCommunity } from '../../context/CommunityContext';
import { useRouter } from 'expo-router';

const PRIMARY = '#0d3d47';

export const LicensingSection: React.FC = () => {
  const { userProfile } = useAuth();
  const { communities, setCurrentCommunity } = useCommunity();
  const router = useRouter();

  const now = new Date();
  const licenseStatus = userProfile?.licenseStatus ?? 'TRIAL';
  const trialExpiresAt = userProfile?.trialExpiresAt ? new Date(userProfile.trialExpiresAt) : null;
  const renewalDate = userProfile?.subscriptionRenewalDate ? new Date(userProfile.subscriptionRenewalDate) : null;

  const isActive = licenseStatus === 'ACTIVE' && userProfile?.subscriptionActive && renewalDate && renewalDate > now;
  const isTrial = licenseStatus === 'TRIAL' && trialExpiresAt && trialExpiresAt > now;
  const isExpired = licenseStatus === 'EXPIRED' || (!isActive && !isTrial);

  const daysLeft = trialExpiresAt && isTrial
    ? Math.max(0, Math.ceil((trialExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null;

  const overallStatus = isActive ? 'Active Subscription' : isTrial ? 'Free Trial' : 'Expired';
  const statusColor = isActive ? '#059669' : isTrial ? '#d97706' : '#dc2626';
  const statusBg = isActive ? 'rgba(16,185,129,0.1)' : isTrial ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
  const statusBorder = isActive ? 'rgba(16,185,129,0.2)' : isTrial ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)';

  const handleCheckout = (type: 'membership' | 'community', targetId?: string) => {
    let path = `/checkout?type=${type}`;
    if (targetId) path += `&targetId=${targetId}`;
    router.push(path as any);
  };

  const getCommunityStatus = (community: any) => {
    if (community.type === 'ACTIVE' || community.isPaid) {
      return { label: 'Active', color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
    }
    const trialEnd = community.trialExpiresAt ? new Date(community.trialExpiresAt) : null;
    if (!trialEnd || trialEnd < now) {
      return { label: 'Expired', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
    }
    const days = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return { label: `Trial (${days}d left)`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString();
  };

  return (
    <View style={{ backgroundColor: '#fff', borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)', padding: 24, gap: 20 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 40, height: 40, borderRadius: 16, backgroundColor: 'rgba(37,99,235,0.1)', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={22} color="#2563eb" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: PRIMARY }}>Licensing & Access</Text>
        </View>
        <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, backgroundColor: statusBg, borderColor: statusBorder }}>
          <Text style={{ fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, color: statusColor }}>
            {overallStatus}
          </Text>
        </View>
      </View>

      {/* Membership status card */}
      <View style={{ backgroundColor: '#f8fafc', borderRadius: 20, padding: 16, gap: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>Platform Membership</Text>
        {isActive && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={16} color="#10b981" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
              Active — renews {formatDate(renewalDate)} (R99/year)
            </Text>
          </View>
        )}
        {isTrial && (
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Calendar size={14} color="#d97706" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                Free trial — {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: '#6b7280', lineHeight: 16 }}>
              Trial ends {formatDate(trialExpiresAt)}. After that, subscribe for R99/year to keep access.
            </Text>
          </View>
        )}
        {isExpired && (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldAlert size={16} color="#ef4444" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#b91c1c' }}>Access expired</Text>
            </View>
            <Text style={{ fontSize: 11, color: '#dc2626', lineHeight: 16 }}>
              Your trial or subscription has ended. Subscribe for R99/year to restore access.
            </Text>
            <TouchableOpacity
              onPress={() => handleCheckout('membership')}
              style={{ alignSelf: 'flex-start', backgroundColor: '#dc2626', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
            >
              <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
                Subscribe — R99/year
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {isTrial && !isActive && (
          <TouchableOpacity
            onPress={() => handleCheckout('membership')}
            style={{ alignSelf: 'flex-start', backgroundColor: PRIMARY, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 }}
          >
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
              Subscribe Early — R99/year
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Community list */}
      {communities.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 10, fontWeight: '800', color: '#888', textTransform: 'uppercase', letterSpacing: 1 }}>
            Community Status
          </Text>
          {communities.map((community) => {
            const statusInfo = getCommunityStatus(community);
            const isOwner = community.ownerId === userProfile?.id;
            return (
              <View key={community.id} style={{ backgroundColor: '#f5f5f5', borderRadius: 20, padding: 16, gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(22,163,74,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: PRIMARY }}>{community.name.charAt(0)}</Text>
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
                        {community.userRole || 'Member'}
                      </Text>
                    </View>
                  </View>
                </View>
                {/* Activate CTA for TRIAL community owners */}
                {isOwner && community.type === 'TRIAL' && (
                  <TouchableOpacity
                    onPress={() => handleCheckout('community', community.id)}
                    style={{ alignSelf: 'flex-start', backgroundColor: PRIMARY, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12 }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#fff', textTransform: 'uppercase', letterSpacing: 1 }}>
                      Activate Community — R999
                    </Text>
                  </TouchableOpacity>
                )}
                {community.type === 'ACTIVE' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={14} color="#10b981" />
                    <Text style={{ fontSize: 11, fontWeight: '600', color: '#059669' }}>
                      Permanently active {community.activatedAt ? `since ${formatDate(new Date(community.activatedAt))}` : ''}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

