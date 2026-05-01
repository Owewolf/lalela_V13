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
import { User, CheckCircle2, Smartphone, Camera, Siren, ShieldCheck } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { useCommunity } from '../../context/CommunityContext';
import { LocationSettings } from './LocationSettings';

interface ProfileSectionProps {
  initialEdit?: boolean;
}

export const ProfileSection: React.FC<ProfileSectionProps> = ({ initialEdit = false }) => {
  const { userProfile, updateUserProfile } = useAuth();
  const { communities, toggleCommunityResponder } = useCommunity();
  const [isEditing, setIsEditing] = useState(initialEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showResponderSelector, setShowResponderSelector] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    name: userProfile?.name || '',
    phone: userProfile?.phone || '',
    address: userProfile?.address || userProfile?.defaultLocation?.name || '',
    profile_image: userProfile?.profile_image || '',
    defaultLocation: userProfile?.defaultLocation || { name: '', latitude: 0, longitude: 0 },
  });

  useEffect(() => {
    if (!isEditing && userProfile) {
      setFormData({
        name: userProfile.name || '',
        phone: userProfile.phone || '',
        address: userProfile.address || userProfile.defaultLocation?.name || '',
        profile_image: userProfile.profile_image || '',
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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      setIsUploading(true);
      try {
        // Store URI directly — upload logic can be added later
        setFormData((prev) => ({ ...prev, profile_image: uri }));
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
      phone: userProfile?.phone || '',
      address: userProfile?.address || userProfile?.defaultLocation?.name || '',
      profile_image: userProfile?.profile_image || '',
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
        profile_image: formData.profile_image,
        defaultLocation: formData.defaultLocation,
      });
      setIsEditing(false);
      setStatus({ type: 'success', message: 'Your profile has been updated.' });
      setTimeout(() => setStatus(null), 3000);
    } catch {
      setStatus({ type: 'error', message: 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  const avatarUri = formData.profile_image
    ? formData.profile_image
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
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-gray-500">{userProfile?.email}</Text>
            {userProfile?.email && (
              <View className="flex-row items-center gap-1 bg-surface-container-low px-2 py-0.5 rounded-full">
                <CheckCircle2 size={10} color="#10b981" />
                <Text className="text-[10px] font-bold text-primary uppercase">Verified</Text>
              </View>
            )}
          </View>
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
