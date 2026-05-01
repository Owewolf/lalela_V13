import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import {
  Camera,
  X,
  MapPin,
  Send,
  Calendar,
  AlertTriangle,
  Info,
  Tag,
  ArrowLeft,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { cn } from '../../lib/utils';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { POST_SUBTYPE_CONFIG } from '../../constants';
import { uploadImage } from '../../lib/uploadImage';
import type { CommunityNotice } from '../../types';

type NoticeSubtype = 'warning' | 'normal' | 'information';

const NOTICE_DEFAULT_EXPIRY_DAYS = 30;

const formatDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDefaultExpiryDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + NOTICE_DEFAULT_EXPIRY_DAYS);
  return formatDateInput(date);
};

const getInitialExpiryDate = (postSubtype: NoticeSubtype, postToEdit?: CommunityNotice) => {
  if (postSubtype === 'warning') return '';
  if (!postToEdit?.expires_at) return getDefaultExpiryDate();
  const expiryDate = new Date(postToEdit.expires_at);
  return Number.isNaN(expiryDate.getTime()) ? getDefaultExpiryDate() : formatDateInput(expiryDate);
};

const NOTICE_CTA: Record<NoticeSubtype, { ctaLabel: string; buttonBg: string }> = {
  warning: { ctaLabel: 'Send Warning', buttonBg: 'bg-amber-600' },
  normal: { ctaLabel: 'Publish Notice', buttonBg: 'bg-emerald-600' },
  information: { ctaLabel: 'Share Information', buttonBg: 'bg-blue-600' },
};

const SUBTYPE_THEME: Record<NoticeSubtype, {
  label: string;
  subtitle: string;
  iconColor: string;
  iconBgColor: string;
  accentColor: string;
  bannerBgColor: string;
  badgeBgColor: string;
  badgeTextColor: string;
  circleStrokeColor: string;
}> = {
  warning: {
    label: 'Warning Notice',
    subtitle: 'Immediate attention needed',
    iconColor: '#FFFFFF',
    iconBgColor: '#D97706',
    accentColor: '#D97706',
    bannerBgColor: '#FFFBEB',
    badgeBgColor: '#FEF3C7',
    badgeTextColor: '#92400E',
    circleStrokeColor: '#F59E0B',
  },
  normal: {
    label: 'General Notice',
    subtitle: 'General community information',
    iconColor: '#FFFFFF',
    iconBgColor: '#059669',
    accentColor: '#059669',
    bannerBgColor: '#ECFDF5',
    badgeBgColor: '#D1FAE5',
    badgeTextColor: '#065F46',
    circleStrokeColor: '#10B981',
  },
  information: {
    label: 'Info Notice',
    subtitle: 'Standard community notice',
    iconColor: '#FFFFFF',
    iconBgColor: '#2563EB',
    accentColor: '#2563EB',
    bannerBgColor: '#EFF6FF',
    badgeBgColor: '#DBEAFE',
    badgeTextColor: '#1E40AF',
    circleStrokeColor: '#3B82F6',
  },
};

interface CreateNoticeFormProps {
  postSubtype: NoticeSubtype;
  onBack?: () => void;
  postToEdit?: CommunityNotice;
}

export const CreateNoticeForm: React.FC<CreateNoticeFormProps> = ({ postSubtype, onBack, postToEdit }) => {
  const router = useRouter();
  const { currentCommunity, addPost, updatePost } = useCommunity();
  const { userProfile } = useAuth();

  const isReadOnly = userProfile?.status === 'READ-ONLY' || (
    userProfile?.license_type === 'COMMUNITY_GRANTED' &&
    userProfile?.license_status === 'UNLICENSED' &&
    userProfile?.member_expiry_date &&
    (userProfile.member_expiry_date.toDate ? userProfile.member_expiry_date.toDate() : new Date(userProfile.member_expiry_date)) < new Date()
  );

  const [title, setTitle] = useState(postToEdit?.title || '');
  const [description, setDescription] = useState(postToEdit?.description || '');
  const [locationName, setLocationName] = useState(postToEdit?.locationName || '');
  const [latitude, setLatitude] = useState<number | undefined>(postToEdit?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(postToEdit?.longitude);
  const [locationSource, setLocationSource] = useState<'profile_default' | 'user_selected' | 'current_location'>(postToEdit?.source || 'profile_default');
  const [postsImage, setPostsImage] = useState<string>(postToEdit?.posts_image || '');
  const [expiresAt, setExpiresAt] = useState(() => getInitialExpiryDate(postSubtype, postToEdit));
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const theme = SUBTYPE_THEME[postSubtype];
  const config = POST_SUBTYPE_CONFIG[postSubtype];

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  useEffect(() => {
    if (!postToEdit) {
      if (currentCommunity?.coverageArea) {
        setLatitude(currentCommunity.coverageArea.latitude);
        setLongitude(currentCommunity.coverageArea.longitude);
        setLocationName(currentCommunity.coverageArea.location_name || 'Community Area');
        setLocationSource('profile_default');
      } else if (userProfile?.defaultLocation) {
        setLatitude(userProfile.defaultLocation.latitude);
        setLongitude(userProfile.defaultLocation.longitude);
        setLocationName(userProfile.defaultLocation.name);
      } else if (userProfile?.locationSharingEnabled) {
        handleUseCurrentLocation();
      }
    }
  }, [currentCommunity?.coverageArea, userProfile?.defaultLocation, userProfile?.locationSharingEnabled, postToEdit]);

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      setLocationName('Current Location');
      setLocationSource('current_location');
    } catch {
      Alert.alert('Error', 'Could not get current location.');
    }
  };

  const handlePickImage = async () => {
    if (postSubtype === 'warning') return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Media library access is required to upload images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setIsUploading(true);
    try {
      const url = await uploadImage(asset.uri, 'posts', userProfile?.id ?? 'anon', postsImage);
      setPostsImage(url);
    } catch {
      Alert.alert('Upload failed', 'Image upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handlePost = async () => {
    if (!title) return;
    setIsSubmitting(true);
    try {
      const postData = {
        type: 'notice' as const,
        postSubtype,
        title,
        description,
        category: 'Community',
        authorName: postToEdit?.authorName || userProfile?.name || 'Community Member',
        author_id: postToEdit?.author_id || userProfile?.id,
        authorRole: postToEdit?.authorRole || (currentCommunity?.userRole || 'Member'),
        authorImage: postToEdit?.authorImage || userProfile?.profile_image || `https://picsum.photos/seed/${userProfile?.id}/200/200`,
        urgency: config.urgency,
        urgency_level: config.urgency_level,
        locationName,
        latitude,
        longitude,
        source: locationSource,
        posts_image: postSubtype !== 'warning' ? postsImage : undefined,
        expires_at: postSubtype === 'warning' ? undefined : expiresAt,
      };

      if (postToEdit) {
        await updatePost({ ...postToEdit, ...postData });
      } else {
        await addPost(postData);
      }
      handleBack();
    } catch {
      Alert.alert('Error', 'Failed to post notice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isReadOnly) {
    return (
      <View className="flex-1 items-center justify-center p-8">
        <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
          <Text className="text-3xl">🔒</Text>
        </View>
        <Text className="text-lg font-bold text-gray-800 mb-2 text-center">Read-Only Mode</Text>
        <Text className="text-sm text-gray-500 mb-6 text-center max-w-xs">
          Your trial has expired. Pay R149 once-off for lifetime membership to create notices.
        </Text>
        <TouchableOpacity onPress={handleBack} className="px-6 py-3 rounded-xl bg-primary">
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const canSubmit = !!title && (postSubtype === 'warning' || !!expiresAt);
  const mapRegion = {
    latitude: latitude || currentCommunity?.coverageArea?.latitude || -26.2041,
    longitude: longitude || currentCommunity?.coverageArea?.longitude || 28.0473,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };
  const coverageRadius = currentCommunity?.coverageArea?.radius ? currentCommunity.coverageArea.radius * 1000 : 5000;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-white"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-5 pt-6 space-y-6">
          <TouchableOpacity
            onPress={handleBack}
            className="self-start flex-row items-center gap-2 rounded-full bg-slate-100 px-4 py-2"
            activeOpacity={0.8}
          >
            <ArrowLeft size={18} color="#0d3d47" />
            <Text className="text-sm font-bold text-primary">Back</Text>
          </TouchableOpacity>

          {/* Type Banner */}
          <View
            className="p-5 rounded-3xl flex-row items-center gap-4 border"
            style={{ backgroundColor: theme.bannerBgColor, borderColor: theme.accentColor + '40' }}
          >
            <View
              className="w-14 h-14 rounded-2xl items-center justify-center"
              style={{ backgroundColor: theme.iconBgColor }}
            >
              {postSubtype === 'warning' && <AlertTriangle color={theme.iconColor} size={28} />}
              {postSubtype === 'normal' && <Tag color={theme.iconColor} size={28} />}
              {postSubtype === 'information' && <Info color={theme.iconColor} size={28} />}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1 flex-wrap">
                <Text className="font-bold text-xl" style={{ color: theme.accentColor }}>
                  {theme.label}
                </Text>
                {currentCommunity?.name && (
                  <View
                    className="px-2 py-0.5 rounded"
                    style={{ backgroundColor: theme.badgeBgColor }}
                  >
                    <Text className="text-xs font-bold" style={{ color: theme.badgeTextColor }}>
                      {currentCommunity.name}
                    </Text>
                  </View>
                )}
              </View>
              <Text className="text-xs font-bold uppercase tracking-widest text-gray-500">
                {theme.subtitle}
              </Text>
            </View>
          </View>

          {/* Warning Map */}
          {postSubtype === 'warning' && (
            <View className="space-y-3">
              <View className="flex-row items-center justify-between px-1 mb-2">
                <View className="flex-row items-center gap-2">
                  <MapPin size={16} color="#6B7280" />
                  <Text className="text-sm font-semibold text-gray-600">Warning Location</Text>
                </View>
                <View className="flex-row gap-2">
                  {locationSource !== 'profile_default' && currentCommunity?.coverageArea && (
                    <TouchableOpacity
                      onPress={() => {
                        setLatitude(currentCommunity.coverageArea!.latitude);
                        setLongitude(currentCommunity.coverageArea!.longitude);
                        setLocationName(currentCommunity.coverageArea!.location_name || 'Community Area');
                        setLocationSource('profile_default');
                      }}
                    >
                      <Text className="text-xs font-bold text-primary">Reset</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={handleUseCurrentLocation}>
                    <Text className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
                      My Location
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View className="w-full rounded-3xl overflow-hidden border-2 border-amber-300" style={{ height: 220 }}>
                <MapView
                  style={{ flex: 1 }}
                  region={mapRegion}
                  showsUserLocation={false}
                  onPress={(e) => {
                    const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
                    setLatitude(lat);
                    setLongitude(lng);
                    setLocationSource('user_selected');
                    setLocationName('Selected Location');
                  }}
                >
                  {latitude && longitude && (
                    <>
                      <Marker
                        coordinate={{ latitude, longitude }}
                        draggable
                        onDragEnd={(e) => {
                          const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
                          setLatitude(lat);
                          setLongitude(lng);
                          setLocationSource('user_selected');
                          setLocationName('Selected Location');
                        }}
                      />
                      <Circle
                        center={{ latitude, longitude }}
                        radius={coverageRadius}
                        strokeColor={theme.circleStrokeColor}
                        fillColor={theme.circleStrokeColor + '10'}
                        strokeWidth={1}
                      />
                    </>
                  )}
                </MapView>

                <View className="absolute top-3 left-3 right-3">
                  <View className="bg-white/90 px-3 py-2 rounded-2xl border border-amber-200 flex-row items-center justify-between">
                    <Text className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                      {locationSource === 'profile_default' ? 'Community Default' :
                       locationSource === 'current_location' ? 'Your Location' : 'Custom Location'}
                    </Text>
                    <Text className="text-xs text-gray-400">Tap to pin</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Image Upload — not shown for warning */}
          {postSubtype !== 'warning' && (
            <View>
              <Text className="text-sm font-semibold mb-3 ml-1 text-gray-500">Add Photo (up to 10MB)</Text>
              <TouchableOpacity
                onPress={handlePickImage}
                className="w-full rounded-3xl overflow-hidden border-2 border-dashed border-gray-300 items-center justify-center"
                style={{ height: 180, backgroundColor: '#F9FAFB' }}
                activeOpacity={0.8}
              >
                {postsImage ? (
                  <>
                    <Image source={{ uri: postsImage }} className="w-full h-full" resizeMode="cover" />
                    <TouchableOpacity
                      onPress={() => setPostsImage('')}
                      className="absolute top-3 right-3 bg-black/50 rounded-full p-1.5"
                    >
                      <X color="white" size={16} />
                    </TouchableOpacity>
                  </>
                ) : isUploading ? (
                  <View className="items-center gap-2">
                    <ActivityIndicator color="#0d3d47" size="large" />
                    <Text className="text-sm text-gray-400">Uploading...</Text>
                  </View>
                ) : (
                  <View className="items-center gap-2">
                    <Camera color="#9CA3AF" size={40} />
                    <Text className="text-sm text-gray-500">Upload image or take photo</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Title */}
          <View className="space-y-2">
            <Text className="text-sm font-semibold ml-1 text-gray-500">Post Title</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What is this notice about?"
              placeholderTextColor="#9CA3AF"
              className="bg-gray-50 border-b-2 border-gray-200 px-4 py-4 rounded-t-2xl text-lg text-gray-800"
            />
          </View>

          {/* Body */}
          <View className="space-y-2">
            <Text className="text-sm font-semibold ml-1 text-gray-500">Message Body</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Provide details for your community..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="bg-gray-50 border-b-2 border-gray-200 px-4 py-4 rounded-t-2xl text-gray-800"
              style={{ minHeight: 100 }}
            />
          </View>

          {/* Location */}
          <View className="space-y-2">
            <Text className="text-sm font-semibold ml-1 text-gray-500">Location</Text>
            <View className="relative">
              <View className="flex-row items-center bg-gray-50 border-b-2 border-gray-200 rounded-t-2xl px-4">
                <MapPin size={16} color="#6B7280" />
                <TextInput
                  value={locationName}
                  onChangeText={setLocationName}
                  placeholder={postSubtype === 'warning' ? 'Location set via map above' : 'Set location (optional)'}
                  placeholderTextColor="#9CA3AF"
                  className="flex-1 py-4 px-2 text-sm text-gray-800"
                />
                {postSubtype !== 'warning' && (
                  <TouchableOpacity onPress={handleUseCurrentLocation}>
                    <Text className="text-xs font-bold text-primary bg-surface-container-low px-2 py-1 rounded-lg">
                      Use Current
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Expiry Date — not for warning */}
          {postSubtype !== 'warning' && (
            <View className="space-y-2">
              <Text className="text-sm font-semibold ml-1 text-gray-500">Expiration Date</Text>
              <View className="flex-row items-center bg-gray-50 border-b-2 border-gray-200 rounded-t-2xl px-4">
                <Calendar size={16} color="#6B7280" />
                <TextInput
                  value={expiresAt}
                  onChangeText={setExpiresAt}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#9CA3AF"
                  className="flex-1 py-4 px-2 text-sm text-gray-800"
                  keyboardType="numbers-and-punctuation"
                />
              </View>
              <Text className="text-xs text-gray-400 ml-1">Format: YYYY-MM-DD (e.g. {getDefaultExpiryDate()})</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View className="absolute bottom-0 left-0 right-0 bg-white/90 px-5 pb-8 pt-4 border-t border-gray-100">
        <TouchableOpacity
          onPress={() => setShowConfirmModal(true)}
          disabled={!canSubmit}
          className={`py-4 rounded-full items-center justify-center flex-row gap-2 ${
            canSubmit ? '' : 'opacity-40'
          }`}
          style={{ backgroundColor: canSubmit ? theme.iconBgColor : '#E5E7EB' }}
          activeOpacity={0.8}
        >
          <Text className={`font-bold text-lg ${canSubmit ? 'text-white' : 'text-gray-400'}`}>
            {postToEdit ? 'Update Notice' : NOTICE_CTA[postSubtype].ctaLabel}
          </Text>
          <Send color={canSubmit ? 'white' : '#9CA3AF'} size={20} />
        </TouchableOpacity>
      </View>

      {/* Confirm Modal */}
      <Modal
        visible={showConfirmModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10">
            <Text className="text-lg font-bold text-gray-800 mb-2 text-center">
              {postToEdit ? 'Update Notice' : NOTICE_CTA[postSubtype].ctaLabel}
            </Text>
            <Text className="text-sm text-gray-500 text-center mb-6">
              Post "{title}" to {currentCommunity?.name || 'your community'}?
            </Text>
            <View className="gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowConfirmModal(false);
                  handlePost();
                }}
                disabled={isSubmitting}
                className="py-4 rounded-full items-center"
                style={{ backgroundColor: theme.iconBgColor }}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-bold text-base">
                    {postToEdit ? 'Update Notice' : NOTICE_CTA[postSubtype].ctaLabel}
                  </Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowConfirmModal(false)}
                className="py-4 rounded-full items-center bg-gray-100"
                activeOpacity={0.8}
              >
                <Text className="text-gray-600 font-semibold">Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};
