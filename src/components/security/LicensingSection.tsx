import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { CreditCard, ShieldAlert, Calendar, CheckCircle2, LogOut, Trash2 } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useCommunity } from '../../context/CommunityContext';
import { useRouter } from 'expo-router';
import { THEME_COLORS } from '../../theme/colors';
import api from '../../lib/api';

const PRIMARY = THEME_COLORS.primary;
const TYPE_SCALE = {
  xs: 9,
  sm: 10,
  md: 11,
  lg: 13,
  xl: 18,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  xxs: 2,
  xs: 4,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  xxl: 16,
  s20: 20,
  s24: 24,
  s40: 40,
  s44: 44,
};
const RADIUS = {
  chip: 6,
  md: 12,
  lg: 14,
  xl: 16,
  panel: 20,
  card: 24,
};
const LETTER_SPACING = {
  normal: 1,
};
const LINE_HEIGHT = {
  compact: 16,
};

export const LicensingSection: React.FC = () => {
  const { userProfile, signOut, deleteAccount } = useAuth();
  const { communities, currentCommunity, setCurrentCommunity, refreshCommunities } = useCommunity();
  const router = useRouter();
  const [busyCommunityId, setBusyCommunityId] = useState<string | null>(null);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  const ownedActiveCommunities = (communities || []).filter(
    (community) => community.ownerId === userProfile?.id && community.status === 'ACTIVE'
  );
  const canDeleteAccount = ownedActiveCommunities.length === 0;

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

  const overallStatus = isActive ? 'Active' : isTrial ? 'Trial' : 'Expired';
  const statusColor = isActive ? THEME_COLORS.successStrongAlt : isTrial ? THEME_COLORS.warning : THEME_COLORS.errorStrong;
  const statusBg = isActive ? THEME_COLORS.successTintSoftAlt : isTrial ? THEME_COLORS.warningTintSoft : THEME_COLORS.errorTintSoft;
  const statusBorder = isActive ? THEME_COLORS.successTintStrongAlt : isTrial ? THEME_COLORS.alias_rgba_245_158_11_0_2 : THEME_COLORS.alias_rgba_239_68_68_0_2;

  const handleCheckout = (type: 'membership' | 'community', targetId?: string) => {
    let path = `/checkout?type=${type}`;
    if (targetId) path += `&targetId=${targetId}`;
    router.push(path as any);
  };

  const getCommunityStatus = (community: any) => {
    if (community.type === 'ACTIVE' || community.isPaid) {
      return { label: 'Active', color: THEME_COLORS.success, bg: THEME_COLORS.successTintSoftAlt };
    }
    const trialEnd = community.trialExpiresAt ? new Date(community.trialExpiresAt) : null;
    if (!trialEnd || trialEnd < now) {
      return { label: 'Expired', color: THEME_COLORS.errorStrong, bg: THEME_COLORS.errorTintSoft };
    }
    const days = Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    return { label: `Trial (${days}d left)`, color: THEME_COLORS.warningStrong, bg: THEME_COLORS.warningTintSoft };
  };

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return date.toLocaleDateString();
  };

  const performCommunityRemoval = async (community: any, isOwner: boolean) => {
    try {
      setBusyCommunityId(community.id);
      if (isOwner) {
        await api.delete(`/communities/${community.id}`);
      } else {
        await api.post(`/communities/${community.id}/leave`);
      }

      const fallbackId = communities.find((c) => c.id !== community.id)?.id;
      await refreshCommunities();
      if (currentCommunity?.id === community.id && fallbackId) {
        await setCurrentCommunity(fallbackId);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Unable to remove community. Please try again.';
      Alert.alert('Action failed', msg);
    } finally {
      setBusyCommunityId(null);
    }
  };

  const handleRemoveCommunity = (community: any) => {
    const isOwner = community.ownerId === userProfile?.id;
    if (!isOwner) {
      Alert.alert(
        'Leave community?',
        `You are about to leave ${community.name}. You will lose access to this community until an admin adds you again.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Leave Community',
            style: 'destructive',
            onPress: () => {
              performCommunityRemoval(community, false);
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      'Delete community permanently?',
      `Deleting ${community.name} will remove all members, posts, chats, and community-linked records. This cannot be undone.\n\nLicensing impact:\n- The community license tied to this community ends on deletion.\n- Your personal platform membership (R99/year) remains on your account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final confirmation',
              `This is permanent. Delete ${community.name} now?`,
              [
                { text: 'Keep Community', style: 'cancel' },
                {
                  text: 'Delete Permanently',
                  style: 'destructive',
                  onPress: () => {
                    performCommunityRemoval(community, true);
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account permanently?',
      'This permanently removes your account and associated data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingAccount(true);
              await deleteAccount();
            } catch (err: any) {
              const serverCode = err?.response?.data?.code;
              const msg = serverCode === 'OWNED_COMMUNITIES_EXIST'
                ? 'Delete your owned active communities first before deleting your account.'
                : 'Failed to delete account. Please try again.';
              Alert.alert('Delete failed', msg);
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ gap: SPACE.s20 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xl }}>
          <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.xl, backgroundColor: THEME_COLORS.infoTintSoft, alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={22} color={THEME_COLORS.brandBlueText} />
          </View>
          <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold, color: PRIMARY }}>Licensing & Access</Text>
        </View>
        <View style={{ paddingHorizontal: SPACE.md, paddingVertical: SPACE.xs, borderRadius: RADIUS.lg, borderWidth: 1, backgroundColor: statusBg, borderColor: statusBorder }}>
          <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal, color: statusColor }}>
            {overallStatus}
          </Text>
        </View>
      </View>

      {/* Membership status card */}
      <View style={{ backgroundColor: THEME_COLORS.surface, borderRadius: RADIUS.panel, padding: SPACE.xxl, gap: SPACE.lg, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft }}>
        <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>Platform Membership</Text>
        {isActive && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
            <CheckCircle2 size={16} color={THEME_COLORS.success} />
            <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong }}>
              Active — renews {formatDate(renewalDate)} (R99/year)
            </Text>
          </View>
        )}
        {isTrial && (
          <View style={{ gap: SPACE.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
              <Calendar size={14} color={THEME_COLORS.warning} />
              <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextStrong }}>
                Free trial — {daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining
              </Text>
            </View>
            <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, lineHeight: LINE_HEIGHT.compact }}>
              Trial ends {formatDate(trialExpiresAt)}. After that, subscribe for R99/year to keep access.
            </Text>
          </View>
        )}
        {isExpired && (
          <View style={{ gap: SPACE.lg }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
              <ShieldAlert size={16} color={THEME_COLORS.errorStrong} />
              <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.aliasHex_b91c1c }}>Access expired</Text>
            </View>
            <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.errorStrong, lineHeight: LINE_HEIGHT.compact }}>
              Your trial or subscription has ended. Subscribe for R99/year to restore access.
            </Text>
            <TouchableOpacity
              onPress={() => handleCheckout('membership')}
              style={{ alignSelf: 'flex-start', backgroundColor: THEME_COLORS.errorStrong, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.lg, borderRadius: RADIUS.md }}
            >
              <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                Subscribe — R99/year
              </Text>
            </TouchableOpacity>
          </View>
        )}
        {isTrial && !isActive && (
          <TouchableOpacity
            onPress={() => handleCheckout('membership')}
            style={{ alignSelf: 'flex-start', backgroundColor: PRIMARY, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.lg, borderRadius: RADIUS.md }}
          >
            <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
              Subscribe Early — R99/year
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Community list */}
      {communities.length > 0 && (
        <View style={{ gap: SPACE.lg }}>
          <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
            Community Status
          </Text>
          {communities.map((community) => {
            const statusInfo = getCommunityStatus(community);
            const isOwner = community.ownerId === userProfile?.id;
            return (
              <View key={community.id} style={{ backgroundColor: THEME_COLORS.surface, borderRadius: RADIUS.panel, padding: SPACE.xxl, gap: SPACE.xl, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACE.xl }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xl, flex: 1 }}>
                    <View style={{ width: SPACE.s44, height: SPACE.s44, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.successTintSoft, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.extrabold, color: PRIMARY }}>{community.name.charAt(0)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>{community.name}</Text>
                      <View style={{ marginTop: SPACE.xs }}>
                        <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSoft }}>
                          {community.userRole || 'Member'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: SPACE.md }}>
                    <View style={{ paddingHorizontal: SPACE.md, paddingVertical: SPACE.xxs, borderRadius: RADIUS.chip, backgroundColor: statusInfo.bg }}>
                      <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold, color: statusInfo.color, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                        {statusInfo.label}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleRemoveCommunity(community)}
                      disabled={busyCommunityId === community.id}
                      style={{
                        backgroundColor: THEME_COLORS.surface,
                        borderWidth: 1,
                        borderColor: THEME_COLORS.alias_rgba_239_68_68_0_2,
                        paddingHorizontal: SPACE.lg,
                        paddingVertical: SPACE.sm,
                        borderRadius: RADIUS.chip,
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: SPACE.xs,
                        opacity: busyCommunityId === community.id ? 0.7 : 1,
                      }}
                    >
                      {busyCommunityId === community.id ? (
                        <ActivityIndicator size="small" color={THEME_COLORS.errorStrong} />
                      ) : (
                        <Trash2 size={12} color={THEME_COLORS.errorStrong} />
                      )}
                      <Text style={{ fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.errorStrong, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                        {community.ownerId === userProfile?.id ? 'Delete' : 'Leave'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Activate CTA for TRIAL community owners */}
                {isOwner && community.type === 'TRIAL' && (
                  <TouchableOpacity
                    onPress={() => handleCheckout('community', community.id)}
                    style={{ alignSelf: 'flex-start', backgroundColor: PRIMARY, paddingHorizontal: SPACE.xxl, paddingVertical: SPACE.md, borderRadius: RADIUS.md }}
                  >
                    <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
                      Activate Community — R999
                    </Text>
                  </TouchableOpacity>
                )}
                {community.type === 'ACTIVE' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.sm }}>
                    <CheckCircle2 size={14} color={THEME_COLORS.success} />
                    <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.semibold, color: THEME_COLORS.successStrongAlt }}>
                      Permanently active {community.activatedAt ? `since ${formatDate(new Date(community.activatedAt))}` : ''}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      <View style={{ gap: SPACE.md, marginTop: SPACE.sm }}>
        <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.neutralTextSoft, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
          Account Management
        </Text>

        <View style={{ backgroundColor: THEME_COLORS.surface, borderRadius: RADIUS.panel, padding: SPACE.xxl, gap: SPACE.lg, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft }}>
          <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>Logout Account</Text>
          <TouchableOpacity
            onPress={signOut}
            style={{
              paddingVertical: SPACE.lg,
              borderRadius: RADIUS.lg,
              backgroundColor: THEME_COLORS.alias_rgba_22_163_74_0_06,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: SPACE.sm,
            }}
          >
            <LogOut size={16} color={THEME_COLORS.primary} />
            <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary }}>Logout Account</Text>
          </TouchableOpacity>
        </View>

        {canDeleteAccount && (
          <View style={{ backgroundColor: THEME_COLORS.errorStrong, borderRadius: RADIUS.panel, padding: SPACE.xxl, gap: SPACE.lg }}>
            <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.white }}>Delete Account Permanently</Text>
            <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.whiteOverlay70, lineHeight: LINE_HEIGHT.compact }}>
              Permanently delete your account and associated data. This action cannot be undone.
            </Text>
            <TouchableOpacity
              onPress={handleDeleteAccount}
              disabled={isDeletingAccount}
              style={{
                paddingVertical: SPACE.lg,
                borderRadius: RADIUS.lg,
                backgroundColor: THEME_COLORS.surfaceContainerLow,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: SPACE.sm,
                opacity: isDeletingAccount ? 0.7 : 1,
              }}
            >
              {isDeletingAccount ? (
                <ActivityIndicator size="small" color={THEME_COLORS.white} />
              ) : (
                <Trash2 size={16} color={THEME_COLORS.white} />
              )}
              <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.white }}>
                {isDeletingAccount ? 'Deleting…' : 'Delete Permanently'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

