import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { User, CheckCircle2, Camera } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import EmergencyResponderCard from '../shared/EmergencyResponderCard';
import { LocationSettings } from './LocationSettings';
import { THEME_COLORS } from '../../theme/colors';

interface ProfileSectionProps {
  initialEdit?: boolean;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({ initialEdit = true }) => {
  const { userProfile, updateUserProfile, linkEmail, resendVerification } = useAuth();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(initialEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    name: userProfile?.name || '',
    email: userProfile?.email || '',
    phone: userProfile?.phone || '',
    address: userProfile?.address || userProfile?.defaultLocation?.name || '',
    profileImage: userProfile?.profileImage || '',
    defaultLocation: userProfile?.defaultLocation || { name: '', latitude: 0, longitude: 0 },
  });

  useEffect(() => {
    if (!isEditing && userProfile) {
      setFormData({
        name: userProfile.name || '',
        email: userProfile.email || '',
        phone: userProfile.phone || '',
        address: userProfile.address || userProfile.defaultLocation?.name || '',
        profileImage: userProfile.profileImage || '',
        defaultLocation: userProfile.defaultLocation || { name: '', latitude: 0, longitude: 0 },
      });
    }
  }, [userProfile, isEditing]);

  const normalizeText = (value?: string | null) => (value || '').trim();
  const baselineLocation = userProfile?.defaultLocation || { name: '', latitude: 0, longitude: 0 };
  const isLocationDirty =
    normalizeText(formData.defaultLocation.name) !== normalizeText(baselineLocation.name) ||
    Math.abs((formData.defaultLocation.latitude || 0) - (baselineLocation.latitude || 0)) > 0.000001 ||
    Math.abs((formData.defaultLocation.longitude || 0) - (baselineLocation.longitude || 0)) > 0.000001;

  const hasUnsavedChanges =
    normalizeText(formData.name) !== normalizeText(userProfile?.name) ||
    normalizeText(formData.email).toLowerCase() !== normalizeText(userProfile?.email).toLowerCase() ||
    normalizeText(formData.phone) !== normalizeText(userProfile?.phone) ||
    normalizeText(formData.address) !== normalizeText(userProfile?.address || userProfile?.defaultLocation?.name) ||
    normalizeText(formData.profileImage) !== normalizeText(userProfile?.profileImage) ||
    isLocationDirty;

  const handleImagePick = async () => {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') {
      Alert.alert('Permission required', 'Please allow photo access to upload a profile image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setIsUploading(true);
      try {
        setFormData((prev) => ({ ...prev, profileImage: uri }));
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleCancelEdit = () => {
    setStatus(null);
    setFormData({
      name: userProfile?.name || '',
      email: userProfile?.email || '',
      phone: userProfile?.phone || '',
      address: userProfile?.address || userProfile?.defaultLocation?.name || '',
      profileImage: userProfile?.profileImage || '',
      defaultLocation: userProfile?.defaultLocation || { name: '', latitude: 0, longitude: 0 },
    });
  };

  const handleUpdateProfile = async () => {
    try {
      setIsSaving(true);
      await updateUserProfile({
        name: formData.name,
        phone: formData.phone,
        address: formData.address,
        profileImage: formData.profileImage,
        defaultLocation: formData.defaultLocation,
      });
      const trimmedEmail = formData.email.trim().toLowerCase();
      const currentEmail = (userProfile?.email || '').trim().toLowerCase();
      let emailLinked = false;
      if (trimmedEmail && trimmedEmail !== currentEmail) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          setStatus({ type: 'error', message: 'Please enter a valid email address.' });
          setIsSaving(false);
          return;
        }
        if (userProfile?.hasPassword === false) {
          setStatus({
            type: 'error',
            message: 'Set a password first under Login & Authentication so you can sign in with this email.',
          });
          setIsSaving(false);
          return;
        }
        await linkEmail(trimmedEmail);
        emailLinked = true;
      }
      setStatus({
        type: 'success',
        message: emailLinked
          ? 'Profile updated. Check your inbox to verify your new email.'
          : 'Your profile has been updated.',
      });
      setTimeout(() => setStatus(null), 4000);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.response?.data?.message ?? 'Failed to update profile';
      setStatus({ type: 'error', message: msg });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendVerification = async () => {
    if (!userProfile?.email) return;
    try {
      await resendVerification(userProfile.email);
      setStatus({ type: 'success', message: 'Verification email sent.' });
      setTimeout(() => setStatus(null), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? err?.response?.data?.message ?? 'Failed to send verification email';
      setStatus({ type: 'error', message: msg });
    }
  };

  const avatarUri = formData.profileImage
    ? formData.profileImage
    : `https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile?.id}`;

  // ── Shared style tokens ────────────────────────────────────────────────────
  const card: import('react-native').ViewStyle = {
    backgroundColor: THEME_COLORS.surfaceContainer,
    borderRadius: 24,
    padding: 20,
  };

  const rowLabel: import('react-native').TextStyle = {
    fontSize: 14,
    fontWeight: '600',
    color: THEME_COLORS.neutralTextSubtle,
    width: 100,
  };

  const rowValue: import('react-native').TextStyle = {
    fontSize: 14,
    fontWeight: '700',
    color: THEME_COLORS.onSurface,
    flex: 1,
  };

  const inlineInput: import('react-native').TextStyle = {
    fontSize: 14,
    fontWeight: '700',
    color: THEME_COLORS.onSurface,
    flex: 1,
    padding: 0,
  };

  const divider: import('react-native').ViewStyle = {
    height: 1,
    backgroundColor: THEME_COLORS.neutralBorderSoft,
    marginVertical: 12,
  };

  return (
    <View style={{ gap: 12 }}>
      {/* Unsaved changes banner */}
      {isEditing && hasUnsavedChanges && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderRadius: 16,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: 1,
            backgroundColor: THEME_COLORS.warningTintSoft,
            borderColor: THEME_COLORS.warningStrong,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, color: THEME_COLORS.warningStrong }}>
            Reminder
          </Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: THEME_COLORS.warningStrong, flex: 1 }}>
            You have unsaved changes. Tap Save Changes.
          </Text>
        </View>
      )}

      {/* ── Avatar ───────────────────────────────────────────────────────── */}
      <View style={{ alignItems: 'center', paddingVertical: 8 }}>
        <View>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              overflow: 'hidden',
              borderWidth: 3,
              borderColor: THEME_COLORS.outlineVariant,
            }}
          >
            {isUploading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: THEME_COLORS.surfaceContainer }}>
                <ActivityIndicator color={THEME_COLORS.primary} />
              </View>
            ) : (
              <Image source={{ uri: avatarUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
            )}
          </View>
          <TouchableOpacity
            onPress={handleImagePick}
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: THEME_COLORS.primary,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: THEME_COLORS.surface,
            }}
          >
            <Camera size={14} color={THEME_COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Card B: Account Information ──────────────────────────────────── */}
      <View style={card}>
        {/* Section header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 14,
              backgroundColor: THEME_COLORS.primaryTintSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={22} color={THEME_COLORS.primary} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: THEME_COLORS.primary }}>Account Information</Text>
        </View>

        {/* Full Name */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={rowLabel}>Full Name</Text>
          {isEditing ? (
            <TextInput
              value={formData.name}
              onChangeText={(v) => setFormData({ ...formData, name: v })}
              style={inlineInput}
              placeholder="Enter your name"
              placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
            />
          ) : (
            <Text style={rowValue}>{userProfile?.name || 'Not set'}</Text>
          )}
        </View>

        <View style={divider} />

        {/* Phone */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={rowLabel}>Phone</Text>
          {isEditing ? (
            <TextInput
              value={formData.phone}
              onChangeText={(v) => setFormData({ ...formData, phone: v })}
              keyboardType="phone-pad"
              style={inlineInput}
              placeholder="+27 82 123 4567"
              placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
            />
          ) : (
            <Text style={rowValue}>{userProfile?.phone || 'Not set'}</Text>
          )}
        </View>

        <View style={divider} />

        {/* Email */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <Text style={[rowLabel, { paddingTop: 2 }]}>Email</Text>
          <View style={{ flex: 1 }}>
            {isEditing ? (
              <>
                <TextInput
                  value={formData.email}
                  onChangeText={(v) => setFormData({ ...formData, email: v })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={userProfile?.hasPassword !== false}
                  style={[inlineInput, { flex: undefined, opacity: userProfile?.hasPassword === false ? 0.5 : 1 }]}
                  placeholder="you@example.com"
                  placeholderTextColor={THEME_COLORS.neutralTextPlaceholder}
                />
                {userProfile?.hasPassword === false ? (
                  <View style={{ gap: 4, marginTop: 4 }}>
                    <Text style={{ fontSize: 10, color: THEME_COLORS.warningText, fontStyle: 'italic' }}>
                      Set a password first so you can sign in with email.
                    </Text>
                    <TouchableOpacity
                      onPress={() => router.push('/security?tab=security' as any)}
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: THEME_COLORS.surfaceContainer,
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: THEME_COLORS.brandBlue }}>
                        Go to Login & Authentication
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : userProfile?.email && formData.email.trim().toLowerCase() !== userProfile.email.toLowerCase() ? (
                  <Text style={{ fontSize: 10, color: THEME_COLORS.warningText, fontStyle: 'italic', marginTop: 4 }}>
                    Changing your email will require re-verification.
                  </Text>
                ) : !userProfile?.email ? (
                  <Text style={{ fontSize: 10, color: THEME_COLORS.neutralTextSoft, fontStyle: 'italic', marginTop: 4 }}>
                    Add an email so you can sign in with email + password.
                  </Text>
                ) : null}
              </>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={[rowValue, { flex: 1 }]} numberOfLines={1}>
                  {userProfile?.email || 'Not set'}
                </Text>
                {userProfile?.email && userProfile?.emailVerified && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: THEME_COLORS.surfaceContainerLow, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <CheckCircle2 size={10} color={THEME_COLORS.success} />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: THEME_COLORS.primary, textTransform: 'uppercase' }}>Verified</Text>
                  </View>
                )}
                {userProfile?.email && !userProfile?.emailVerified && (
                  <TouchableOpacity
                    onPress={handleResendVerification}
                    style={{ backgroundColor: THEME_COLORS.warningSurface, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}
                  >
                    <Text style={{ fontSize: 10, fontWeight: '700', color: THEME_COLORS.warningText, textTransform: 'uppercase' }}>Resend</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>
      </View>

      {/* ── Card C: Emergency Responder ──────────────────────────────────── */}
      <EmergencyResponderCard />

      {/* ── Card D: Default Location ─────────────────────────────────────── */}
      <View style={card}>
        <LocationSettings
          isEditing={isEditing}
          locationName={formData.defaultLocation.name}
          latitude={formData.defaultLocation.latitude}
          longitude={formData.defaultLocation.longitude}
          onLocationChange={(loc) =>
            setFormData((prev) => ({
              ...prev,
              address: loc.name,
              defaultLocation: loc,
            }))
          }
        />
      </View>

      {/* ── Save / Cancel bar ────────────────────────────────────────────── */}
      {isEditing && (
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={handleCancelEdit}
            disabled={isSaving}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 12,
              backgroundColor: THEME_COLORS.surfaceContainer,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: THEME_COLORS.neutralTextSubtle }}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleUpdateProfile}
            disabled={isSaving || isUploading || !hasUnsavedChanges}
            style={{
              flex: 1,
              paddingVertical: 14,
              borderRadius: 12,
              backgroundColor: THEME_COLORS.primary,
              alignItems: 'center',
              opacity: isSaving || isUploading || !hasUnsavedChanges ? 0.6 : 1,
            }}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={THEME_COLORS.white} />
            ) : (
              <Text style={{ fontSize: 14, fontWeight: '700', color: THEME_COLORS.white }}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Status message ───────────────────────────────────────────────── */}
      {status && (
        <View
          style={{
            padding: 16,
            borderRadius: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: status.type === 'success' ? THEME_COLORS.surfaceContainerLow : THEME_COLORS.errorSurface,
          }}
        >
          {status.type === 'success' && <CheckCircle2 size={16} color={THEME_COLORS.success} />}
          <Text style={{ fontSize: 14, fontWeight: '700', color: status.type === 'success' ? THEME_COLORS.primary : THEME_COLORS.errorText }}>
            {status.message}
          </Text>
        </View>
      )}
    </View>
  );
};
