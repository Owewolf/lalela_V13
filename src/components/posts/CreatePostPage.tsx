import { defaultMapViewProps } from "../../lib/mapViewProps";
import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useMemo, useEffect } from 'react';
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
  Info,
  MapPin,
  Send,
  Tag,
  Siren,
  ArrowLeft,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import MapView, { Marker, Circle } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { uploadImage } from '../../lib/uploadImage';
import { resolveCreatePostLocationDefaults } from '../../lib/postLocationDefaults';
import { BUSINESS_CATEGORIES } from '../../constants';
import CreateWarningNotice from './CreateWarningNotice';
import CreateInfoNotice from './CreateInfoNotice';
import CreateGeneralNotice from './CreateGeneralNotice';
import LocationPickerSection from '../shared/LocationPickerSection';
import type { CommunityNotice } from '../../types';
import { THEME_COLORS } from '../../theme/colors';
import { getCardBorderColor, getCardSurfaceColor } from '../../theme/cardStyles';
import { resolveActiveCharity } from '../../lib/activeCharity';

type PostType = 'listing' | 'notice';
type Urgency = 'emergency' | 'warning' | 'info' | 'general';
type EmergencyCategory = 'fire' | 'medical' | 'accident' | 'crime';

const EMERGENCY_CATEGORIES: {
  id: EmergencyCategory;
  emoji: string;
  label: string;
  title: string;
}[] = [
  { id: 'fire', emoji: '🔥', label: 'Fire', title: '🔥 Fire Emergency' },
  { id: 'medical', emoji: '🚑', label: 'Medical', title: '🚑 Medical Emergency' },
  { id: 'accident', emoji: '🚗', label: 'Accident', title: '🚗 Accident Report' },
  { id: 'crime', emoji: '🚨', label: 'Crime / Security', title: '🚨 Crime/Security Alert' },
];

const urgencyColors: Record<Urgency, { bg: string; text: string }> = {
  emergency: { bg: THEME_COLORS.errorStrong, text: THEME_COLORS.white },
  warning: { bg: THEME_COLORS.warning, text: THEME_COLORS.white },
  info: { bg: THEME_COLORS.brandBlueText, text: THEME_COLORS.white },
  general: { bg: THEME_COLORS.successStrongAlt, text: THEME_COLORS.white },
};
const SPACE = {
  xxs: 2,
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

const getCtaLabel = (postType: PostType, urgency: Urgency, isEditing: boolean): string => {
  if (isEditing) return 'Update Post';
  if (postType === 'listing') return 'Post Listing';
  switch (urgency) {
    case 'emergency': return 'Post Emergency';
    case 'warning': return 'Send Warning';
    case 'info': return 'Share Information';
    case 'general': return 'Publish Notice';
    default: return 'Save Notice';
  }
};

interface CreatePostPageProps {
  postToEdit?: CommunityNotice;
  initialType?: PostType;
  initialUrgency?: Urgency;
  onEmergencyPosted?: (post: any) => void;
}

const CreatePostPage: React.FC<CreatePostPageProps> = ({
  postToEdit,
  initialType,
  initialUrgency,
  onEmergencyPosted,
}) => {
  const router = useRouter();
  const { currentCommunity, charities, addPost, updatePost } = useCommunity();
  const { userProfile } = useAuth();

  const handleBack = () => {
    if (router.canGoBack()) router.back(); else router.replace('/posts');
  };

  const isReadOnly = userProfile?.licenseStatus === 'EXPIRED';

  // ── Form state ──────────────────────────────────────────────────────────────
  const [postType, setPostType] = useState<PostType>(
    postToEdit?.type || initialType || 'listing',
  );
  const [urgency, setUrgency] = useState<Urgency>(
    postToEdit?.urgencyLevel ||
      initialUrgency ||
      (postToEdit?.urgency === 'high'
        ? 'warning'
        : postToEdit?.urgency === 'normal'
        ? 'info'
        : postToEdit?.urgency === 'low'
        ? 'general'
        : undefined) ||
      'info',
  );
  const [isPublic, setIsPublic] = useState(postToEdit?.isPublic ?? false);
  const [isFree, setIsFree] = useState(postToEdit?.price === 0);
  const [price, setPrice] = useState<string>(postToEdit?.price?.toString() || '');
  const [selectedCharityId, setSelectedCharityId] = useState<string>(postToEdit?.charityId || '');
  const [customCharityPercentage, setCustomCharityPercentage] = useState<string>(
    postToEdit?.charityPercentage?.toString() || '',
  );
  const [title, setTitle] = useState(postToEdit?.title || '');
  const [description, setDescription] = useState(postToEdit?.description || '');
  const [category, setCategory] = useState(postToEdit?.category || 'All');
  const [locationName, setLocationName] = useState(postToEdit?.locationName || '');
  const [latitude, setLatitude] = useState<number | undefined>(postToEdit?.latitude);
  const [longitude, setLongitude] = useState<number | undefined>(postToEdit?.longitude);
  const [locationSource, setLocationSource] = useState<
    'profile_default' | 'user_selected' | 'current_location'
  >(postToEdit?.source || 'profile_default');
  const [postsImage, setPostsImage] = useState<string>(postToEdit?.postsImage || '');
  const [emergencyCategory, setEmergencyCategory] = useState<EmergencyCategory | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);

  // ── Derived values ──────────────────────────────────────────────────────────
  const availableCharities = charities.filter((c) => c.status !== 'Archived');
  const { active: featuredCharity, cat: catCharity, featured: configuredFeaturedCharity } =
    resolveActiveCharity(availableCharities, currentCommunity ?? null);
  const selectedCharity = featuredCharity ?? availableCharities.find((c) => c.id === selectedCharityId);

  useEffect(() => {
    if (featuredCharity && selectedCharityId !== featuredCharity.id) {
      setSelectedCharityId(featuredCharity.id);
      if (!customCharityPercentage || parseFloat(customCharityPercentage) < featuredCharity.percentage) {
        setCustomCharityPercentage(featuredCharity.percentage.toString());
      }
    }
    if (!featuredCharity && selectedCharityId) {
      setSelectedCharityId('');
    }
  }, [featuredCharity]);

  const enabledListingCategories = useMemo(() => {
    const enabledIds = currentCommunity?.enabledCategories ?? BUSINESS_CATEGORIES.map((c) => c.id);
    return BUSINESS_CATEGORIES.filter((cat) => enabledIds.includes(cat.id)).map((cat) => cat.label);
  }, [currentCommunity?.enabledCategories]);

  useEffect(() => {
    if (category !== 'All' && !enabledListingCategories.includes(category)) {
      setCategory('All');
    }
  }, [enabledListingCategories]);

  const basePercentage = isPublic ? Math.max(selectedCharity?.percentage || 0, 15) : 0;
  const parsedCustom = parseFloat(customCharityPercentage) || 0;
  const charityPercentage = Math.max(parsedCustom, basePercentage);
  const numericPrice = parseFloat(price) || 0;
  const charityAmount = (numericPrice * charityPercentage) / 100;
  const publicPrice = numericPrice + charityAmount;
  const locationDefaults = useMemo(
    () => resolveCreatePostLocationDefaults(currentCommunity, userProfile),
    [currentCommunity?.coverageArea, userProfile?.defaultLocation, userProfile?.locationSharing],
  );

  // ── Default location ────────────────────────────────────────────────────────
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

  // ── Image picker ────────────────────────────────────────────────────────────
  const handlePickImage = async () => {
    if (postsImage) {
      Alert.alert('One image only', 'Listings allow only one image.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Media library access is required.');
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

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handlePost = async () => {
    const isEmergency = postType === 'notice' && urgency === 'emergency';
    if (isEmergency && !emergencyCategory) return;
    if (!isEmergency && (!title || !description)) return;

    const urgencyMap: Record<Urgency, NonNullable<CommunityNotice['urgency']>> = {
      emergency: 'emergency',
      warning: 'high',
      info: 'normal',
      general: 'low',
    };

    const emergencyTitle = isEmergency && emergencyCategory
      ? EMERGENCY_CATEGORIES.find((c) => c.id === emergencyCategory)!.title
      : '';

    const postData: Omit<CommunityNotice, 'id' | 'timestamp'> = {
      type: postType,
      postSubtype: isEmergency ? 'emergency' : 'listing',
      title: isEmergency ? emergencyTitle : title,
      description: isEmergency ? (description || emergencyTitle) : description,
      category: postType === 'listing' ? category : 'Community',
      authorName:
        postToEdit?.authorName ||
        userProfile?.name ||
        'Community Member',
      authorId: postToEdit?.authorId || userProfile?.id,
      authorRole: postToEdit?.authorRole || currentCommunity?.userRole || 'Member',
      authorImage:
        postToEdit?.authorImage ||
        userProfile?.profileImage ||
        `https://picsum.photos/seed/${userProfile?.id}/200/200`,
      charityId: isPublic ? selectedCharityId : undefined,
      charityPercentage: isPublic ? charityPercentage : undefined,
      charityAmount: postType === 'listing' ? (isPublic ? charityAmount : 0) : undefined,
      isPublic,
      price: postType === 'listing' ? numericPrice : undefined,
      communityPrice: postType === 'listing' ? numericPrice : undefined,
      publicPrice:
        postType === 'listing'
          ? isPublic
            ? numericPrice + charityAmount
            : numericPrice
          : undefined,
      urgency: postType === 'notice' ? urgencyMap[urgency] : undefined,
      urgencyLevel: postType === 'notice' ? urgency : undefined,
      locationName,
      latitude,
      longitude,
      source: locationSource,
      postsImage: postsImage,
    };

    setIsSubmitting(true);
    try {
      if (postToEdit) {
        await updatePost({ ...postToEdit, ...postData });
        if (router.canGoBack()) router.back(); else router.replace('/posts');
      } else {
        const postId = await addPost(postData);
        if (!postId) {
          Alert.alert('Error', 'No active community selected. Open your community first, then post again.');
          return;
        }
        if (postId && postData.urgency === 'emergency') {
          onEmergencyPosted?.({ ...postData, id: postId, timestamp: new Date().toISOString() });
          router.push(`/emergency/${postId}`);
        } else {
          if (router.canGoBack()) router.back(); else router.replace('/posts');
        }
      }
    } catch (err: any) {
      const serverMessage =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message;
      Alert.alert('Error', serverMessage ? `Failed to post: ${serverMessage}` : 'Failed to post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ctaLabel = getCtaLabel(postType, urgency, !!postToEdit);
  const isEmergency = postType === 'notice' && urgency === 'emergency';
  const canSubmit = isEmergency ? !!emergencyCategory : !!title && !!description;

  const mapRegion = {
    latitude: latitude ?? locationDefaults.mapFallback.latitude,
    longitude: longitude ?? locationDefaults.mapFallback.longitude,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };
  const coverageRadius = currentCommunity?.coverageArea?.radius
    ? currentCommunity.coverageArea.radius * 1000
    : 5000;

  if (postType === 'notice') {
    if (urgency === 'warning') {
      return (
        <SafeAreaView className="flex-1 bg-surface-container-low">
          <CreateWarningNotice onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/posts'); }} postToEdit={postToEdit} />
        </SafeAreaView>
      );
    }
    if (urgency === 'info') {
      return (
        <SafeAreaView className="flex-1 bg-surface-container-low">
          <CreateInfoNotice onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/posts'); }} postToEdit={postToEdit} />
        </SafeAreaView>
      );
    }
    if (urgency === 'general') {
      return (
        <SafeAreaView className="flex-1 bg-surface-container-low">
          <CreateGeneralNotice onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/posts'); }} postToEdit={postToEdit} />
        </SafeAreaView>
      );
    }
  }

  if (isReadOnly) {
    return (
      <SafeAreaView className="flex-1 bg-surface-container-low items-center justify-center p-8">
        <View className="w-16 h-16 rounded-full bg-red-100 items-center justify-center mb-4">
          <Text className="text-3xl">🔒</Text>
        </View>
        <Text className="text-lg font-bold text-gray-800 mb-2 text-center">Read-Only Mode</Text>
        <Text className="text-sm text-gray-500 mb-6 text-center max-w-xs">
          Your trial has expired. Pay R149 once-off for lifetime membership to create posts.
        </Text>
        <TouchableOpacity
          onPress={handleBack}
          className="px-6 py-3 rounded-xl bg-primary"
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-surface-container-low">
      <View className="px-5 pt-3 pb-1">
        <TouchableOpacity
          onPress={handleBack}
          className="self-start flex-row items-center gap-2 rounded-full px-4 py-2"
          style={{ backgroundColor: THEME_COLORS.surface }}
          activeOpacity={0.8}
        >
          <ArrowLeft size={18} color={THEME_COLORS.primary} />
          <Text className="text-sm font-bold text-primary">Back</Text>
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: SPACE.s120 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-5 pt-5 gap-5">
            {/* ── Type Banner ─────────────────────────────────────────────── */}
            <View
              className="p-5 rounded-3xl flex-row items-center gap-4 border"
              style={{
                backgroundColor:
                  postType === 'listing'
                    ? THEME_COLORS.successSurface
                    : urgency === 'emergency'
                    ? THEME_COLORS.neutralBg
                    : THEME_COLORS.successSurface,
                borderColor:
                  postType === 'listing'
                    ? THEME_COLORS.aliasHex_0d3d4740
                    : urgency === 'emergency'
                    ? THEME_COLORS.neutralBorderStrong
                    : THEME_COLORS.aliasHex_0d3d4740,
              }}
            >
              <View
                className="w-14 h-14 rounded-2xl items-center justify-center"
                style={{
                  backgroundColor:
                    postType === 'listing'
                      ? THEME_COLORS.primary
                      : urgency === 'emergency'
                      ? THEME_COLORS.neutralTextSubtle
                      : THEME_COLORS.primary,
                }}
              >
                {postType === 'listing' ? (
                  <Tag color="white" size={28} />
                ) : (
                  <Siren color="white" size={28} />
                )}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center flex-wrap gap-2 mb-1">
                  <Text
                    className="font-bold text-xl"
                    style={{
                      color: urgency === 'emergency' ? THEME_COLORS.neutralTextDefault : THEME_COLORS.primary,
                    }}
                  >
                    {postType === 'listing'
                      ? 'Marketplace Listing'
                      : urgency === 'emergency'
                      ? 'Emergency Notice'
                      : 'Community Notice'}
                  </Text>
                  {currentCommunity?.name && (
                    <View className="px-2 py-0.5 rounded bg-surface">
                      <Text className="text-xs font-black text-primary">
                        {currentCommunity.name}
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-xs font-bold uppercase tracking-widest text-gray-400">
                  {postType === 'listing'
                    ? 'Share items with your community'
                    : urgency === 'emergency'
                    ? "Stay calm. Report what's happening."
                    : 'Alert neighbors about local events'}
                </Text>
              </View>
            </View>

            {/* ── Emergency Form ──────────────────────────────────────────── */}
            {postType === 'notice' && urgency === 'emergency' && (
              <View className="gap-5">
                {/* Map */}
                <View>
                  <View className="flex-row items-center justify-between px-1 mb-2">
                    <View className="flex-row items-center gap-2">
                      <MapPin size={16} color={THEME_COLORS.neutralTextSubtle} />
                      <Text className="text-sm font-semibold text-gray-600">Emergency Location</Text>
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
                  <View
                    className="w-full rounded-3xl overflow-hidden border-2 border-amber-300"
                    style={{ height: 220 }}
                  >
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
                            strokeColor={THEME_COLORS.warningStrong}
                            fillColor={THEME_COLORS.aliasHex_f59e0b10}
                            strokeWidth={1}
                          />
                        </>
                      )}
                    </MapView>

                    <View className="absolute top-3 left-3 right-3">
                      <View className="bg-surface-container-low/90 px-3 py-2 rounded-2xl border border-amber-200 flex-row items-center justify-between">
                        <Text className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                          {locationSource === 'profile_default'
                            ? 'Community Default'
                            : locationSource === 'current_location'
                            ? 'Your Location'
                            : 'Custom Location'}
                        </Text>
                        <Text className="text-xs text-gray-400">Tap to pin</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Emergency category selector */}
                <View>
                  <Text className="text-sm font-bold text-gray-600 ml-1 mb-3">What's happening?</Text>
                  <View className="flex-row flex-wrap justify-between gap-y-3">
                    {EMERGENCY_CATEGORIES.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setEmergencyCategory(cat.id)}
                        className="items-center justify-center rounded-3xl border-2 px-3 py-4"
                        style={{
                          width: '48%',
                          backgroundColor:
                            emergencyCategory === cat.id ? THEME_COLORS.infoSurfaceSoft : THEME_COLORS.white,
                          borderColor:
                            emergencyCategory === cat.id ? THEME_COLORS.infoBorderStrong : THEME_COLORS.neutralBorder,
                        }}
                        activeOpacity={0.8}
                      >
                        <Text className="text-[28px] mb-1">{cat.emoji}</Text>
                        <Text
                          className="text-base font-bold text-center"
                          style={{
                            color: emergencyCategory === cat.id ? THEME_COLORS.brandBlueText : THEME_COLORS.neutralTextDefault,
                          }}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Optional description */}
                <View>
                  <Text className="text-sm font-bold text-gray-600 ml-1 mb-2">
                    Additional Details{' '}
                    <Text className="font-normal text-gray-400">(optional)</Text>
                  </Text>
                  <TextInput
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Describe what's happening..."
                    placeholderTextColor={THEME_COLORS.neutralTextSoft}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    className="bg-surface-container-low border-2 border-slate-200 px-4 py-4 rounded-2xl text-slate-700"
                    style={{ minHeight: 80 }}
                  />
                </View>
              </View>
            )}

            {/* ── Listing Form ────────────────────────────────────────────── */}
            {postType === 'listing' && (
              <View className="gap-5">
                {/* Photo */}
                <View className="rounded-3xl p-5 border shadow-sm gap-3" style={CARD_SURFACE_STYLE}>
                  <Text className="font-bold text-primary text-base">Photos</Text>
                  <TouchableOpacity
                    onPress={handlePickImage}
                    activeOpacity={0.8}
                    className="rounded-2xl overflow-hidden border-2 border-dashed items-center justify-center"
                    style={{ height: 180, backgroundColor: THEME_COLORS.neutralBg, borderColor: THEME_COLORS.neutralBorderSoft }}
                  >
                    {postsImage ? (
                      <>
                        <Image
                          source={{ uri: postsImage }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                        <TouchableOpacity
                          onPress={() => setPostsImage('')}
                          className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5"
                        >
                          <X color="white" size={14} />
                        </TouchableOpacity>
                      </>
                    ) : isUploading ? (
                      <View className="items-center gap-2">
                        <ActivityIndicator color={THEME_COLORS.primary} size="large" />
                        <Text className="text-sm text-gray-400">Uploading...</Text>
                      </View>
                    ) : (
                      <View className="items-center gap-2">
                        <Camera color={THEME_COLORS.neutralTextSoft} size={36} />
                        <Text className="text-sm text-gray-400">Add Photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text className="text-xs text-gray-400 ml-1">Max 1 photo, up to 10MB.</Text>
                </View>

                {/* Details */}
                <View className="rounded-3xl p-5 border shadow-sm gap-5" style={CARD_SURFACE_STYLE}>
                  {/* Title */}
                  <View className="gap-1">
                    <Text className="text-sm font-semibold text-primary ml-1">Title</Text>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="e.g. Handmade Pottery"
                      placeholderTextColor={THEME_COLORS.neutralTextSoft}
                      className="px-4 py-3 rounded-t-xl text-gray-800"
                      style={INPUT_SURFACE_STYLE}
                    />
                  </View>

                  {/* Description */}
                  <View className="gap-1">
                    <Text className="text-sm font-semibold text-primary ml-1">Description</Text>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Tell the community about what you're listing..."
                      placeholderTextColor={THEME_COLORS.neutralTextSoft}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      className="px-4 py-3 rounded-t-xl text-gray-800"
                      style={[INPUT_SURFACE_STYLE, { minHeight: 100 }]}
                    />
                  </View>

                  {/* Price + Free toggle */}
                  <View className="gap-3">
                    <View className="gap-1">
                      <Text className="text-sm font-semibold text-primary ml-1">Price (R)</Text>
                      <TextInput
                        value={price}
                        onChangeText={setPrice}
                        placeholder="0.00"
                        placeholderTextColor={THEME_COLORS.neutralTextSoft}
                        keyboardType="decimal-pad"
                        editable={!isFree}
                        className="px-4 py-3 rounded-t-xl text-gray-800"
                        style={[INPUT_SURFACE_STYLE, isFree ? { opacity: 0.5 } : undefined]}
                      />
                    </View>
                    <View className="flex-row items-center justify-between px-2">
                      <Text className="text-sm text-gray-700">Free Item</Text>
                      <TouchableOpacity
                        onPress={() => {
                          setIsFree(!isFree);
                          if (!isFree) setPrice('0');
                        }}
                        className="rounded-full"
                        style={{
                          width: 48,
                          height: 24,
                          backgroundColor: isFree ? THEME_COLORS.primary : THEME_COLORS.neutralBorderSoft,
                          justifyContent: 'center',
                          paddingHorizontal: SPACE.xxs,
                        }}
                        activeOpacity={0.8}
                      >
                        <View
                          className="w-5 h-5 bg-surface-container-low rounded-full shadow-sm"
                          style={{
                            alignSelf: isFree ? 'flex-end' : 'flex-start',
                          }}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Visibility toggle */}
                  <View className="gap-1">
                    <Text className="text-sm font-semibold text-primary ml-1">Post Visibility</Text>
                    <View
                      className="flex-row p-1 rounded-full border"
                      style={CARD_SURFACE_STYLE}
                    >
                      <TouchableOpacity
                        onPress={() => setIsPublic(false)}
                        className="flex-1 py-2 rounded-full items-center"
                        style={{
                          backgroundColor: !isPublic ? THEME_COLORS.surface : 'transparent',
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: !isPublic ? THEME_COLORS.primary : THEME_COLORS.neutralTextSubtle }}
                        >
                          Local
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setIsPublic(true)}
                        className="flex-1 py-2 rounded-full items-center"
                        style={{
                          backgroundColor: isPublic ? THEME_COLORS.surface : 'transparent',
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: isPublic ? THEME_COLORS.primary : THEME_COLORS.neutralTextSubtle }}
                        >
                          Public
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text className="text-xs text-gray-400 ml-1 mt-1">
                      Local listings are only seen by community members.
                    </Text>
                  </View>

                  {/* CAT card when public */}
                  {isPublic && (
                    <View className="bg-surface-container-low border border-outline-variant rounded-3xl p-5 gap-4">
                      <View className="flex-row gap-3">
                        <Info color={THEME_COLORS.primary} size={18} />
                        <Text className="flex-1 text-xs text-gray-700 leading-5">
                          Public listings include a community contribution (CAT) added to your price.
                          The charity is locked to the active community cause.
                        </Text>
                      </View>

                      {selectedCharity ? (
                        <View className="gap-3">
                          <View className="gap-1">
                            <Text className="text-xs font-bold uppercase tracking-widest text-primary ml-1">
                              Active Charity
                            </Text>
                            <View className="bg-surface-container-low border-b-2 border-outline-variant px-4 py-3 rounded-t-xl flex-row items-center justify-between">
                              <Text className="font-semibold text-gray-800 flex-1">{selectedCharity.name}</Text>
                              <Text className="text-xs font-bold text-primary">
                                {basePercentage}% min
                              </Text>
                            </View>
                          </View>
                          <View className="gap-1">
                            <Text className="text-xs font-bold uppercase tracking-widest text-primary ml-1">
                              Contribution %
                            </Text>
                            <TextInput
                              value={customCharityPercentage}
                              onChangeText={setCustomCharityPercentage}
                              placeholder={basePercentage.toString()}
                              placeholderTextColor={THEME_COLORS.neutralTextSoft}
                              keyboardType="decimal-pad"
                              className="bg-surface-container-low border-b-2 border-outline-variant px-4 py-3 rounded-t-xl text-gray-800 text-sm"
                              onBlur={() => {
                                const val = parseFloat(customCharityPercentage) || 0;
                                if (val < basePercentage) {
                                  setCustomCharityPercentage(basePercentage.toString());
                                }
                              }}
                            />
                          </View>
                        </View>
                      ) : (
                        <View className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                          <Text className="text-xs text-amber-700 leading-5">
                            No active community charity has been set yet — the {basePercentage}% CAT margin still applies and represents the buyer’s potential resale earning.
                          </Text>
                        </View>
                      )}

                      {/* Price breakdown */}
                      <View className="bg-surface-container-low/60 rounded-2xl p-4 gap-2">
                        <View className="flex-row justify-between">
                          <Text className="text-xs font-bold text-gray-500">Charity</Text>
                          <Text className="text-xs text-gray-600 max-w-[60%]" numberOfLines={1}>
                            {selectedCharity?.name || 'None selected'}
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-xs font-bold text-gray-500">Local Amount</Text>
                          <Text className="text-xs text-gray-600">R {numericPrice.toFixed(2)}</Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text className="text-xs font-bold text-primary">
                            {selectedCharity ? `To Charity (${charityPercentage}%)` : `CAT Margin (${charityPercentage}%)`}
                          </Text>
                          <Text className="text-xs font-bold text-primary">
                            + R {charityAmount.toFixed(2)}
                          </Text>
                        </View>
                        <View className="h-px my-1" style={{ backgroundColor: THEME_COLORS.neutralBorderSoft }} />
                        <View className="flex-row justify-between">
                          <Text className="text-sm font-bold text-primary">Public Price</Text>
                          <Text className="text-sm font-bold text-primary">
                            R {publicPrice.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

                  {/* Category picker */}
                  <View className="gap-1">
                    <Text className="text-sm font-semibold text-primary ml-1">Category</Text>
                    <TouchableOpacity
                      onPress={() => setCategoryPickerVisible(true)}
                      className="px-4 py-3 rounded-t-xl flex-row items-center justify-between"
                      style={INPUT_SURFACE_STYLE}
                      activeOpacity={0.8}
                    >
                      <Text className="text-gray-800 text-sm">{category}</Text>
                      <Text className="text-gray-400 text-xs">Tap to change</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Location — shared picker (Address + Search + Coordinates + Refine With Pin) */}
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
                    hint="Search first, then tap or drag the pin to set the exact listing location."
                  />
                </View>

                {/* Guidelines */}
                <View className="bg-surface-container-low rounded-3xl p-5 flex-row items-start gap-4 border border-outline-variant">
                  <Info color={THEME_COLORS.primary} size={22} />
                  <View className="flex-1 gap-1">
                    <Text className="font-bold text-primary text-sm">Community Guidelines</Text>
                    <Text className="text-xs text-gray-500 leading-5">
                      By posting, you agree to our fair-trade policy. Keep our community safe, rooted,
                      and respectful. Listings stay active for 30 days.
                    </Text>
                  </View>
                </View>
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
            className="py-4 rounded-full items-center justify-center flex-row gap-2"
            style={{
              backgroundColor: canSubmit
                ? urgency === 'emergency'
                  ? THEME_COLORS.errorStrong
                  : postType === 'listing'
                  ? THEME_COLORS.primary
                  : urgencyColors[urgency].bg
                : THEME_COLORS.neutralBorderSoft,
              opacity: canSubmit ? 1 : 0.5,
            }}
            activeOpacity={0.85}
          >
            <Text
              className="font-bold text-lg"
              style={{ color: canSubmit ? THEME_COLORS.white : THEME_COLORS.neutralTextSoft }}
            >
              {ctaLabel}
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
              <Text className="text-lg font-bold text-gray-800 mb-2 text-center">{ctaLabel}</Text>
              <Text className="text-sm text-gray-500 text-center mb-6">
                {isEmergency && emergencyCategory
                  ? `Post "${EMERGENCY_CATEGORIES.find((c) => c.id === emergencyCategory)?.title}" to ${currentCommunity?.name || 'community'}?`
                  : `Post "${title}" to ${currentCommunity?.name || 'your community'}?`}
              </Text>
              <View className="gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setShowConfirmModal(false);
                    handlePost();
                  }}
                  disabled={isSubmitting}
                  className="py-4 rounded-full items-center"
                  style={{
                    backgroundColor:
                      urgency === 'emergency'
                        ? THEME_COLORS.errorStrong
                        : postType === 'listing'
                        ? THEME_COLORS.primary
                        : urgencyColors[urgency].bg,
                  }}
                  activeOpacity={0.85}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold text-base">{ctaLabel}</Text>
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

        {/* Category picker modal */}
        <Modal
          visible={categoryPickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setCategoryPickerVisible(false)}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-surface-container-low rounded-t-3xl px-6 pt-6 pb-10" style={{ maxHeight: '70%' }}>
              <Text className="text-lg font-bold text-gray-800 mb-4 text-center">Choose Category</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {['All', ...enabledListingCategories].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      setCategory(cat);
                      setCategoryPickerVisible(false);
                    }}
                    className="py-3.5 border-b"
                    style={{ borderBottomColor: THEME_COLORS.neutralBorderSoft }}
                    activeOpacity={0.8}
                  >
                    <Text
                      className="text-base text-gray-800"
                      style={{ color: category === cat ? THEME_COLORS.primary : THEME_COLORS.aliasHex_1f2937, fontWeight: category === cat ? '700' : '400' }}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default CreatePostPage;
