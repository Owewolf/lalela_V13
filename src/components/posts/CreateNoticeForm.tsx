import { defaultMapViewProps } from "../../lib/mapViewProps";
import React, { useState, useEffect, useMemo } from 'react';
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
import { resolveCreatePostLocationDefaults } from '../../lib/postLocationDefaults';
import LocationPickerSection from '../shared/LocationPickerSection';
import type { CommunityNotice } from '../../types';
import { THEME_COLORS } from '../../theme/colors';
import { getCardBorderColor, getCardSurfaceColor } from '../../theme/cardStyles';

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
  if (!postToEdit?.expiresAt) return getDefaultExpiryDate();
  const expiryDate = new Date(postToEdit.expiresAt);
  return Number.isNaN(expiryDate.getTime()) ? getDefaultExpiryDate() : formatDateInput(expiryDate);
};

const NOTICE_CTA: Record<NoticeSubtype, { ctaLabel: string; buttonBg: string }> = {
  warning: { ctaLabel: 'Send Warning', buttonBg: 'bg-amber-600' },
  normal: { ctaLabel: 'Publish Notice', buttonBg: 'bg-emerald-600' },
  information: { ctaLabel: 'Share Information', buttonBg: 'bg-blue-600' },
};
const SPACE = {
  s120: 120,
};

const CARD_SURFACE_STYLE = {
  backgroundColor: getCardSurfaceColor('subtle'),
  borderColor: getCardBorderColor('default'),
};

const INPUT_SURFACE_STYLE = {
  backgroundColor: getCardSurfaceColor('default'),
  borderBottomColor: getCardBorderColor('default'),
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
    iconColor: THEME_COLORS.white,
    iconBgColor: THEME_COLORS.warning,
    accentColor: THEME_COLORS.warning,
    bannerBgColor: THEME_COLORS.warningSurface,
    badgeBgColor: THEME_COLORS.warningSurfaceAlt,
    badgeTextColor: THEME_COLORS.aliasHex_92400e,
    circleStrokeColor: THEME_COLORS.warningStrong,
  },
  normal: {
    label: 'General Notice',
    subtitle: 'General community information',
    iconColor: THEME_COLORS.white,
    iconBgColor: THEME_COLORS.successStrongAlt,
    accentColor: THEME_COLORS.successStrongAlt,
    bannerBgColor: THEME_COLORS.successSurfaceSoft,
    badgeBgColor: THEME_COLORS.aliasHex_d1fae5,
    badgeTextColor: THEME_COLORS.aliasHex_065f46,
    circleStrokeColor: THEME_COLORS.success,
  },
  information: {
    label: 'Info Notice',
    subtitle: 'Standard community notice',
    iconColor: THEME_COLORS.white,
    iconBgColor: THEME_COLORS.brandBlueText,
    accentColor: THEME_COLORS.brandBlueText,
    bannerBgColor: THEME_COLORS.infoSurfaceSoft,
    badgeBgColor: THEME_COLORS.aliasHex_dbeafe,
    badgeTextColor: THEME_COLORS.aliasHex_1e40af,
    circleStrokeColor: THEME_COLORS.brandBlue,
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

  const isReadOnly = userProfile?.licenseStatus === 'EXPIRED';

  const [title, setTitle] = useState(postToEdit?.title || '');
  const [description, setDescription] = useState(postToEdit?.description || '');
  const [locationName, setLocationName] = useState(postToEdit?.locationName || '');
  const [latitude, setLatitude] = useState<number | undefined>(postToEdit?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(postToEdit?.longitude);
  const [locationSource, setLocationSource] = useState<'profile_default' | 'user_selected' | 'current_location'>(postToEdit?.source || 'profile_default');
  const [postsImage, setPostsImage] = useState<string>(postToEdit?.postsImage || '');
  const [expiresAt, setExpiresAt] = useState(() => getInitialExpiryDate(postSubtype, postToEdit));
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const theme = SUBTYPE_THEME[postSubtype];
  const config = POST_SUBTYPE_CONFIG[postSubtype];
  const locationDefaults = useMemo(
    () => resolveCreatePostLocationDefaults(currentCommunity, userProfile),
    [currentCommunity?.coverageArea, userProfile?.defaultLocation, userProfile?.locationSharing],
  );

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      if (router.canGoBack()) if (router.canGoBack()) router.back(); else router.replace('/posts'); else router.replace('/posts');
    }
  };

  useEffect(() => {
    if (postToEdit) return;

    setLatitude(locationDefaults.initialState.latitude);
    setLongitude(locationDefaults.initialState.longitude);
    setLocationName(locationDefaults.initialState.locationName);
    setLocationSource(locationDefaults.initialState.source);

    if (locationDefaults.shouldUseCurrentLocation) {
      handleUseCurrentLocation();
    }
  }, [locationDefaults, postToEdit]);

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
      mediaTypes: ['images'],
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
        authorId: postToEdit?.authorId || userProfile?.id,
        authorRole: postToEdit?.authorRole || (currentCommunity?.userRole || 'MEMBER'),
        authorImage: postToEdit?.authorImage || userProfile?.profileImage || `https://picsum.photos/seed/${userProfile?.id}/200/200`,
        urgency: config.urgency,
        urgencyLevel: config.urgencyLevel,
        locationName,
        latitude,
        longitude,
        source: locationSource,
        postsImage: postSubtype !== 'warning' ? postsImage : undefined,
        expiresAt: postSubtype === 'warning' ? undefined : expiresAt,
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
    latitude: latitude || locationDefaults.mapFallback.latitude,
    longitude: longitude || locationDefaults.mapFallback.longitude,
    latitudeDelta: 0.06,
    longitudeDelta: 0.06,
  };
  const coverageRadius = currentCommunity?.coverageArea?.radius ? currentCommunity.coverageArea.radius * 1000 : 5000;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-surface-container-low"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: SPACE.s120 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-5 pt-6 space-y-6">
          <TouchableOpacity
            onPress={handleBack}
            className="self-start flex-row items-center gap-2 rounded-full px-4 py-2"
            style={{ backgroundColor: THEME_COLORS.surface }}
            activeOpacity={0.8}
          >
            <ArrowLeft size={18} color={THEME_COLORS.primary} />
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
                  <MapPin size={16} color={THEME_COLORS.neutralTextSubtle} />
                  <Text className="text-sm font-semibold text-gray-600">Warning Location</Text>
                </View>
                <View className="flex-row gap-2">
                  {locationSource !== 'profile_default' && locationDefaults.resetTarget && (
                    <TouchableOpacity
                      onPress={() => {
                        setLatitude(locationDefaults.resetTarget!.latitude);
                        setLongitude(locationDefaults.resetTarget!.longitude);
                        setLocationName(locationDefaults.resetTarget!.locationName);
                        setLocationSource(locationDefaults.resetTarget!.source);
                      }}
                    >
                      <Text className="text-xs font-bold text-primary">
                        {locationDefaults.resetTarget.kind === 'community_default' ? 'Reset' : 'Reset to Profile'}
                      </Text>
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
                <MapView {...defaultMapViewProps}
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
                  <View className="bg-surface-container-low/90 px-3 py-2 rounded-2xl border border-amber-200 flex-row items-center justify-between">
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
                className="w-full rounded-3xl overflow-hidden border-2 border-dashed items-center justify-center"
                style={{ height: 180, backgroundColor: THEME_COLORS.neutralBg, borderColor: THEME_COLORS.neutralBorderSoft }}
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
                    <ActivityIndicator color={THEME_COLORS.primary} size="large" />
                    <Text className="text-sm text-gray-400">Uploading...</Text>
                  </View>
                ) : (
                  <View className="items-center gap-2">
                    <Camera color={THEME_COLORS.neutralTextSoft} size={40} />
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
              placeholderTextColor={THEME_COLORS.neutralTextSoft}
              className="px-4 py-4 rounded-t-2xl text-lg text-gray-800"
              style={INPUT_SURFACE_STYLE}
            />
          </View>

          {/* Body */}
          <View className="space-y-2">
            <Text className="text-sm font-semibold ml-1 text-gray-500">Message Body</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Provide details for your community..."
              placeholderTextColor={THEME_COLORS.neutralTextSoft}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              className="px-4 py-4 rounded-t-2xl text-gray-800"
              style={[INPUT_SURFACE_STYLE, { minHeight: 100 }]}
            />
          </View>

          {/* Location */}
          {postSubtype === 'warning' ? (
            <View className="space-y-2">
              <Text className="text-sm font-semibold ml-1 text-gray-500">Location</Text>
              <View className="relative">
                <View className="flex-row items-center rounded-t-2xl px-4" style={INPUT_SURFACE_STYLE}>
                  <MapPin size={16} color={THEME_COLORS.neutralTextSubtle} />
                  <TextInput
                    value={locationName}
                    onChangeText={setLocationName}
                    placeholder="Location set via map above"
                    placeholderTextColor={THEME_COLORS.neutralTextSoft}
                    className="flex-1 py-4 px-2 text-sm text-gray-800"
                  />
                </View>
              </View>
            </View>
          ) : (
            <LocationPickerSection
              value={{ address: locationName, latitude, longitude }}
              onChange={(next, source) => {
                setLocationName(next.address);
                setLatitude(next.latitude);
                setLongitude(next.longitude);
                if (source === 'current_location') {
                  setLocationSource('current_location');
                } else if (source === 'places' || source === 'map' || source === 'manual') {
                  setLocationSource('user_selected');
                }
              }}
              hint="Search first, then tap or drag the pin to set the exact notice location."
            />
          )}

          {/* Expiry Date — not for warning */}
          {postSubtype !== 'warning' && (
            <View className="space-y-2">
              <Text className="text-sm font-semibold ml-1 text-gray-500">Expiration Date</Text>
              <View className="flex-row items-center rounded-t-2xl px-4" style={INPUT_SURFACE_STYLE}>
                <Calendar size={16} color={THEME_COLORS.neutralTextSubtle} />
                <TextInput
                  value={expiresAt}
                  onChangeText={setExpiresAt}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={THEME_COLORS.neutralTextSoft}
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
      <View
        className="absolute bottom-0 left-0 right-0 bg-surface-container-low/90 px-5 pb-8 pt-4 border-t"
        style={{ borderTopColor: THEME_COLORS.neutralBorderSoft }}
      >
        <TouchableOpacity
          onPress={() => setShowConfirmModal(true)}
          disabled={!canSubmit}
          className={`py-4 rounded-full items-center justify-center flex-row gap-2 ${
            canSubmit ? '' : 'opacity-40'
          }`}
          style={{ backgroundColor: canSubmit ? theme.iconBgColor : THEME_COLORS.neutralBorderSoft }}
          activeOpacity={0.8}
        >
          <Text className={`font-bold text-lg ${canSubmit ? 'text-white' : 'text-gray-400'}`}>
            {postToEdit ? 'Update Notice' : NOTICE_CTA[postSubtype].ctaLabel}
          </Text>
          <Send color={canSubmit ? 'white' : THEME_COLORS.neutralTextSoft} size={20} />
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
          <View className="bg-surface-container-low rounded-t-3xl px-6 pt-6 pb-10">
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
                className="py-4 rounded-full items-center"
                style={{ backgroundColor: THEME_COLORS.surface }}
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
