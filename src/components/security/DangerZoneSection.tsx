import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { ShieldAlert, Trash2, LogOut } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { THEME_COLORS } from '../../theme/colors';

const TYPE_SCALE = {
  xs: 10,
  sm: 12,
  md: 13,
  lg: 18,
  h1: 20,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;

const SPACE = {
  xxs: 4,
  xs: 8,
  sm: 10,
  md: 12,
  lg: 14,
  xl: 20,
  xxl: 24,
  s28: 28,
  s40: 40,
  s56: 56,
  s360: 360,
};

const RADIUS = {
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 28,
  round: 20,
};
const LINE_HEIGHT = {
  compact: 16,
  body: 20,
};

export const DangerZoneSection: React.FC = () => {
  const { signOut, deleteAccount } = useAuth();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await deleteAccount();
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError('Please sign out and sign back in to delete your account for security reasons.');
      } else {
        setError('Failed to delete account. Please try again later.');
      }
      setIsDeleting(false);
    }
  };

  return (
    <View style={{ backgroundColor: THEME_COLORS.alias_rgba_239_68_68_0_05, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: THEME_COLORS.errorTintSoft, padding: SPACE.xxl, gap: SPACE.xl }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.md }}>
        <View style={{ width: SPACE.s40, height: SPACE.s40, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.errorTintSoft, alignItems: 'center', justifyContent: 'center' }}>
          <ShieldAlert size={22} color={THEME_COLORS.errorStrong} />
        </View>
        <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.errorStrong }}>Account Management</Text>
      </View>

      {error && (
        <View style={{ padding: SPACE.lg, backgroundColor: THEME_COLORS.errorTintSoft, borderRadius: RADIUS.lg }}>
          <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.errorStrong, textAlign: 'center' }}>{error}</Text>
        </View>
      )}

      <View style={{ gap: SPACE.lg }}>
        {/* Logout Card */}
        <View style={{ backgroundColor: THEME_COLORS.surfaceContainerLow, borderRadius: RADIUS.xl, padding: SPACE.xl, gap: SPACE.lg, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft }}>
          <View style={{ gap: SPACE.xxs }}>
            <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>Logout Account</Text>
            <Text style={{ fontSize: TYPE_SCALE.xs, color: THEME_COLORS.neutralTextSoft, lineHeight: LINE_HEIGHT.compact }}>
              Safely sign out of your account on this device. You can log back in anytime.
            </Text>
          </View>
          <TouchableOpacity
            onPress={signOut}
            style={{
              paddingVertical: SPACE.lg, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.alias_rgba_22_163_74_0_06,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs,
            }}
          >
            <LogOut size={16} color={THEME_COLORS.primary} />
            <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary }}>Logout Account</Text>
          </TouchableOpacity>
        </View>

        {/* Delete Card */}
        <View style={{ backgroundColor: THEME_COLORS.errorStrong, borderRadius: RADIUS.xl, padding: SPACE.xl, gap: SPACE.lg }}>
          <View style={{ gap: SPACE.xxs }}>
            <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.white }}>Delete Account</Text>
            <Text style={{ fontSize: TYPE_SCALE.xs, color: THEME_COLORS.whiteOverlay70, lineHeight: LINE_HEIGHT.compact }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowConfirmDelete(true)}
            style={{
              paddingVertical: SPACE.lg, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.surfaceContainerLowOverlay20,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs,
            }}
          >
            <Trash2 size={16} color={THEME_COLORS.white} />
            <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.white }}>Delete Permanently</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Confirm Delete Modal */}
      <Modal
        visible={showConfirmDelete}
        transparent
        animationType="fade"
        onRequestClose={() => { if (!isDeleting) setShowConfirmDelete(false); }}
      >
        <View style={{
          flex: 1,
          backgroundColor: THEME_COLORS.blackOverlay60,
          alignItems: 'center',
          justifyContent: 'center',
          padding: SPACE.xxl,
        }}>
          <View style={{
            backgroundColor: THEME_COLORS.surfaceContainerLow,
            borderRadius: RADIUS.xxl,
            padding: SPACE.s28,
            width: '100%',
            maxWidth: SPACE.s360,
            gap: SPACE.xl,
          }}>
            <View style={{ alignItems: 'center', gap: SPACE.sm }}>
              <View style={{ width: SPACE.s56, height: SPACE.s56, borderRadius: RADIUS.xxl, backgroundColor: THEME_COLORS.errorTintSoft, alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={26} color={THEME_COLORS.errorStrong} />
              </View>
              <Text style={{ fontSize: TYPE_SCALE.h1, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface, textAlign: 'center' }}>
                Are you absolutely sure?
              </Text>
              <Text style={{ fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextSubtle, textAlign: 'center', lineHeight: LINE_HEIGHT.body }}>
                This will permanently remove your account and all associated data. You will not be able to use this email to create a new account.
              </Text>
            </View>

            {error && (
              <View style={{ padding: SPACE.md, backgroundColor: THEME_COLORS.errorTintSoft, borderRadius: RADIUS.md }}>
                <Text style={{ fontSize: TYPE_SCALE.sm, color: THEME_COLORS.errorStrong, fontWeight: FONT_WEIGHT.bold, textAlign: 'center' }}>{error}</Text>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: SPACE.md }}>
              <TouchableOpacity
                onPress={() => { if (!isDeleting) { setShowConfirmDelete(false); setError(null); } }}
                style={{ flex: 1, paddingVertical: SPACE.lg, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.surfaceContainerLow, alignItems: 'center' }}
              >
                <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.neutralTextSubtle }}>Keep My Account</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDelete}
                disabled={isDeleting}
                style={{ flex: 1, paddingVertical: SPACE.lg, borderRadius: RADIUS.lg, backgroundColor: THEME_COLORS.errorStrong, alignItems: 'center', opacity: isDeleting ? 0.6 : 1 }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={THEME_COLORS.white} />
                ) : (
                  <Text style={{ fontSize: TYPE_SCALE.md, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.white }}>Delete Everything</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};
