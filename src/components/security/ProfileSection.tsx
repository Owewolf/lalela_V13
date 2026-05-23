import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { User, CheckCircle2, Smartphone, Camera, Siren, ShieldCheck, Mail } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useCommunity } from '../../context/CommunityContext';
import { LocationSettings } from './LocationSettings';

interface ProfileSectionProps {
  initialEdit?: boolean;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({ initialEdit = false }) => {
  const { userProfile, updateUserProfile, linkEmail, resendVerification } = useAuth();
  const router = useRouter();
  const { communities, toggleCommunityResponder } = useCommunity();
  const [isEditing, setIsEditing] = useState(initialEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showResponderSelector, setShowResponderSelector] = useState(false);
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
        // Store URI directly — upload logic can be added later
        setFormData((prev) => ({ ...prev, profileImage: uri }));
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
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
      // If the email was changed (or added), link it and trigger verification.
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
        // Block email add/change when the account has no password yet —
        // otherwise the user would never be able to log in with the email.
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
      setIsEditing(false);
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

  return (
    <View className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 gap-y-5">
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-2xl bg-blue-50 items-center justify-center">
            <User size={22} color="#2563eb" />
          </View>
          <Text className="text-lg font-bold text-primary">Account Information</Text>
        </View>
        {!isEditing ? (
          <TouchableOpacity
            onPress={() => { setStatus(null); setIsEditing(true); }}
            className="px-4 py-2 bg-blue-50 rounded-lg"
          >
            <Text className="text-xs font-bold text-blue-600">Edit Profile</Text>
          </TouchableOpacity>
        ) : (
          <View className="px-3 py-1.5 rounded-full bg-blue-100">
            <Text className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Editing</Text>
          </View>
        )}
      </View>

      {/* Avatar + Name */}
      <View className="flex-row items-center gap-5">
        <View className="relative">
          <View className="w-24 h-24 rounded-full overflow-hidden border-4 border-outline-variant">
            {isUploading ? (
              <View className="w-full h-full bg-gray-200 items-center justify-center">
                <ActivityIndicator color="#0d3d47" />
              </View>
            ) : (
              <Image source={{ uri: avatarUri }} className="w-full h-full" resizeMode="cover" />
            )}
          </View>
          {isEditing && (
            <TouchableOpacity
              onPress={handleImagePick}
              className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full items-center justify-center border-2 border-white"
            >
              <Camera size={14} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-1 gap-y-2">
          {isEditing ? (
            <View className="gap-y-2">
              <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Name</Text>
              <TextInput
                value={formData.name}
                onChangeText={(v) => setFormData({ ...formData, name: v })}
                className="bg-gray-100 rounded-xl px-4 py-2 text-sm font-bold text-gray-900"
                placeholder="Enter your name"
              />
            </View>
          ) : (
            <Text className="text-xl font-bold text-gray-900">{userProfile?.name}</Text>
          )}
        </View>
      </View>

      {/* Phone + Address */}
      <View className="gap-y-4">
        <View className="gap-y-1">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Phone Number</Text>
          {isEditing ? (
            <TextInput
              value={formData.phone}
              onChangeText={(v) => setFormData({ ...formData, phone: v })}
              keyboardType="phone-pad"
              className="bg-gray-100 rounded-xl px-4 py-2 text-sm text-gray-900"
              placeholder="+27 82 123 4567"
            />
          ) : (
            <View className="flex-row items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <Smartphone size={16} color="#6b7280" />
              <Text className="text-sm font-bold text-gray-900">{userProfile?.phone || 'Not set'}</Text>
            </View>
          )}
        </View>

        <View className="gap-y-1">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email Address</Text>
          {isEditing ? (
            <View className="gap-y-1">
              <TextInput
                value={formData.email}
                onChangeText={(v) => setFormData({ ...formData, email: v })}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={userProfile?.hasPassword !== false}
                className={`rounded-xl px-4 py-2 text-sm ${userProfile?.hasPassword === false ? 'bg-gray-100 text-gray-400' : 'bg-gray-100 text-gray-900'}`}
                placeholder="you@example.com"
              />
              {userProfile?.hasPassword === false ? (
                <View className="gap-y-1">
                  <Text className="text-[10px] text-yellow-700 italic px-1">
                    Set a password first so you can sign in with email.
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push('/security?tab=security' as any)}
                    className="self-start bg-blue-50 px-3 py-1.5 rounded-lg"
                  >
                    <Text className="text-[11px] font-bold text-blue-600">Go to Login & Authentication</Text>
                  </TouchableOpacity>
                </View>
              ) : userProfile?.email && formData.email.trim().toLowerCase() !== userProfile.email.toLowerCase() ? (
                <Text className="text-[10px] text-yellow-700 italic px-1">
                  Changing your email will require re-verification.
                </Text>
              ) : !userProfile?.email ? (
                <Text className="text-[10px] text-gray-400 italic px-1">
                  Add an email so you can sign in with email + password.
                </Text>
              ) : null}
            </View>
          ) : (
            <View className="flex-row items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <Mail size={16} color="#6b7280" />
              <Text className="text-sm font-bold text-gray-900 flex-1" numberOfLines={1}>
                {userProfile?.email || 'Not set'}
              </Text>
              {userProfile?.email && userProfile?.emailVerified && (
                <View className="flex-row items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded-full">
                  <CheckCircle2 size={10} color="#10b981" />
                  <Text className="text-[10px] font-bold text-primary uppercase">Verified</Text>
                </View>
              )}
              {userProfile?.email && !userProfile?.emailVerified && (
                <TouchableOpacity onPress={handleResendVerification} className="bg-yellow-50 px-2 py-0.5 rounded-full">
                  <Text className="text-[10px] font-bold text-yellow-700 uppercase">Resend</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        <View className="gap-y-1">
          <Text className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Physical Address</Text>
          {isEditing ? (
            <View className="gap-y-1">
              <TextInput
                value={formData.address}
                editable={false}
                className="bg-gray-100 rounded-xl px-4 py-2 text-sm text-gray-400"
                placeholder="Use the location picker below"
              />
              <Text className="text-[10px] text-gray-400 italic px-1">
                Use the location picker below to update your address.
              </Text>
            </View>
          ) : (
            <View className="p-3 bg-gray-50 rounded-xl">
              <Text className="text-sm font-bold text-gray-900">{userProfile?.address || 'Not set'}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Emergency Responder */}
      <View className="pt-4 border-t border-gray-100 gap-y-3">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <View className={`w-10 h-10 rounded-full items-center justify-center ${userProfile?.isSecurityMember ? 'bg-red-600' : 'bg-red-50'}`}>
              <Siren size={18} color={userProfile?.isSecurityMember ? '#fff' : '#ef4444'} />
            </View>
            <View>
              <Text className="text-sm font-bold text-gray-900">Emergency Responder</Text>
              <Text className="text-[10px] text-gray-500">Receive and respond to community alerts</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              onPress={() => setShowResponderSelector(!showResponderSelector)}
              className={`px-3 py-1.5 rounded-xl ${showResponderSelector ? 'bg-primary' : 'bg-gray-100'}`}
            >
              <Text className={`text-[10px] font-black uppercase tracking-widest ${showResponderSelector ? 'text-white' : 'text-gray-500'}`}>
                Manage
              </Text>
            </TouchableOpacity>
            <Switch
              value={!!userProfile?.isSecurityMember}
              onValueChange={(val) => updateUserProfile({ isSecurityMember: val })}
              trackColor={{ false: '#d1d5db', true: '#2563eb' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {userProfile?.isSecurityMember && (
          <View className="gap-y-2">
            <View className="bg-gray-50 rounded-xl p-4 flex-row items-center justify-between border border-red-100">
              <View className="flex-row items-center gap-3">
                <ShieldCheck size={16} color="#2563eb" />
                <Text className="text-[10px] font-bold text-gray-500">
                  Status: {communities.some((c) => c.isEmergencyMode) ? 'ACTIVE RESPONSE' : 'On-Call'}
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <View className={`w-2 h-2 rounded-full ${communities.some((c) => c.isEmergencyMode) ? 'bg-red-500' : 'bg-blue-500'}`} />
                <Text className="text-[10px] font-black uppercase tracking-widest text-gray-800">
                  {communities.some((c) => c.isEmergencyMode) ? 'Emergency Active' : 'Ready'}
                </Text>
              </View>
            </View>

            <View className="bg-gray-50 rounded-2xl p-4 flex-row items-center justify-between border border-gray-200">
              <View>
                <Text className="text-xs font-bold text-primary">Emergency Location Visibility</Text>
                <Text className="text-[10px] text-gray-500">Show my live location on emergency maps</Text>
              </View>
              <Switch
                value={!!userProfile?.emergencyLocationOptIn}
                onValueChange={(val) => updateUserProfile({ emergencyLocationOptIn: val })}
                trackColor={{ false: '#d1d5db', true: '#ef4444' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>
        )}

        {showResponderSelector && (
          <View className="bg-gray-50 rounded-2xl p-4 gap-y-2">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Select Communities</Text>
            {communities.map((community) => (
              <View
                key={community.id}
                className="flex-row items-center justify-between p-3 bg-white rounded-xl border border-gray-100"
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-8 h-8 rounded-lg bg-surface-container-low items-center justify-center">
                    <ShieldCheck size={16} color="#0d3d47" />
                  </View>
                  <Text className="text-sm font-bold text-gray-900">{community.name}</Text>
                </View>
                <Switch
                  value={!!community.isSecurityMember}
                  onValueChange={(val) => toggleCommunityResponder(community.id, val)}
                  trackColor={{ false: '#d1d5db', true: '#0d3d47' }}
                  thumbColor="#ffffff"
                />
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Location Settings */}
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

      {/* Save / Cancel bar */}
      {isEditing && (
        <View className="pt-4 border-t border-gray-100 flex-row gap-3">
          <TouchableOpacity
            onPress={handleCancelEdit}
            disabled={isSaving}
            className="flex-1 py-3 rounded-xl bg-gray-100 items-center"
          >
            <Text className="text-sm font-bold text-gray-700">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleUpdateProfile}
            disabled={isSaving || isUploading}
            className="flex-1 py-3 rounded-xl bg-blue-600 items-center"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="text-sm font-bold text-white">Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Status message */}
      {status && (
        <View className={`p-4 rounded-2xl flex-row items-center justify-center gap-2 ${status.type === 'success' ? 'bg-surface-container-low' : 'bg-red-50'}`}>
          {status.type === 'success' && <CheckCircle2 size={16} color="#10b981" />}
          <Text className={`text-sm font-bold ${status.type === 'success' ? 'text-primary' : 'text-red-600'}`}>
            {status.message}
          </Text>
        </View>
      )}
    </View>
  );
};
