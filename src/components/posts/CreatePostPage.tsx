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

const UNIT_OPTIONS = [
  'items',
  'piece',
  'pair',
  'set',
  'dozen',
  'bunch',
  'kg',
  'g',
  'litre',
  'ml',
  'pack',
  'box',
];

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
  const [isOpenExchange, setIsOpenExchange] = useState(Boolean(postToEdit?.isOpenExchange));
  const [price, setPrice] = useState<string>(postToEdit?.price?.toString() || '');
  const [initialQuantity, setInitialQuantity] = useState<string>(String(Math.max(1, Number(postToEdit?.initialQuantity ?? 1))));
  const [quantityType, setQuantityType] = useState<string>(postToEdit?.quantityType || 'items');
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
  const [unitPickerVisible, setUnitPickerVisible] = useState(false);

  // ── Derived values ──────────────────────────────────────────────────────────
  // CAT is always active for every listing. Resolve the community's active
  // charity (CAT by default, featured charity during a CAT cycle) so we can
  // preview the contribution and public price; the server re-derives these
  // authoritatively on save.
  const availableCharities = charities.filter((c) => c.status !== 'Archived');
  const { active: activeCharity } = resolveActiveCharity(availableCharities, currentCommunity ?? null);

  const enabledListingCategories = useMemo(() => {
    const enabledIds = currentCommunity?.enabledCategories ?? BUSINESS_CATEGORIES.map((c) => c.id);
    return BUSINESS_CATEGORIES.filter((cat) => enabledIds.includes(cat.id)).map((cat) => cat.label);
  }, [currentCommunity?.enabledCategories]);

  const unitOptions = useMemo(() => {
    const normalized = (quantityType || '').trim().toLowerCase();
    if (!normalized) return UNIT_OPTIONS;
    return UNIT_OPTIONS.includes(normalized) ? UNIT_OPTIONS : [normalized, ...UNIT_OPTIONS];
  }, [quantityType]);

  useEffect(() => {
    if (category !== 'All' && !enabledListingCategories.includes(category)) {
      setCategory('All');
    }
  }, [enabledListingCategories]);

  const CAT_MIN_PERCENTAGE = 15;
  const charityPercentage = Math.max(activeCharity?.percentage || 0, CAT_MIN_PERCENTAGE);
  const numericPrice = parseFloat(price) || 0;
  const numericQuantity = Math.max(1, parseInt(initialQuantity || '1', 10) || 1);
  // Quantity becomes locked once the listing has any recorded sales.
  const isQuantityLocked = !!postToEdit && postType === 'listing' && Number(postToEdit.soldQuantity ?? 0) > 0;
  const handleQuantityInput = (rawValue: string) => {
    const digitsOnly = rawValue.replace(/\D/g, '');
    if (!digitsOnly) {
      setInitialQuantity('');
      return;
    }
    const nextQuantity = Math.max(1, parseInt(digitsOnly, 10) || 1);
    setInitialQuantity(String(nextQuantity));
  };
  const charityAmount = Math.round(((numericPrice * charityPercentage) / 100) * 100) / 100;
  const publicPrice = Math.round((numericPrice + charityAmount) * 100) / 100;
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
    if (postType === 'listing' && numericPrice <= 0) {
      Alert.alert(
        'Value required',
        isOpenExchange
          ? 'Exchange listings must keep a listed value above R0.00.'
          : 'Listings must include a value above R0.00.',
      );
      return;
    }

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
      // The server re-derives charityId / charityPercentage / charityAmount /
      // publicPrice from the active charity — we send the client-side preview
      // values for optimistic display only.
      charityId: postType === 'listing' ? activeCharity?.id : undefined,
      charityPercentage: postType === 'listing' ? charityPercentage : undefined,
      charityAmount: postType === 'listing' ? charityAmount : undefined,
      price: postType === 'listing' ? numericPrice : undefined,
      communityPrice: postType === 'listing' ? numericPrice : undefined,
      publicPrice: postType === 'listing' ? publicPrice : undefined,
      isOpenExchange: postType === 'listing' ? isOpenExchange : undefined,
      // In edit mode, only send initialQuantity when the user actually changed it.
      // Sending an unchanged value would trip the backend lock guard once sales exist.
      initialQuantity: postType === 'listing'
        ? (postToEdit
            ? (numericQuantity !== Math.max(1, Number(postToEdit.initialQuantity ?? 1)) ? numericQuantity : undefined)
            : numericQuantity)
        : undefined,
      quantityType: postType === 'listing' ? (quantityType || 'items').trim() : undefined,
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
  const canSubmit = isEmergency
    ? !!emergencyCategory
    : postType === 'listing'
    ? !!title && !!description && numericQuantity >= 1
    : !!title && !!description;

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
            {/* ── Type Banner (notice only) ──────────────────────────────── */}
            {postType === 'notice' && (
              <View
                className="p-5 rounded-3xl flex-row items-center gap-4 border"
                style={{
                  backgroundColor: urgency === 'emergency' ? THEME_COLORS.neutralBg : THEME_COLORS.successSurface,
                  borderColor: urgency === 'emergency' ? THEME_COLORS.neutralBorderStrong : THEME_COLORS.aliasHex_0d3d4740,
                }}
              >
                <View
                  className="w-14 h-14 rounded-2xl items-center justify-center"
                  style={{
                    backgroundColor: urgency === 'emergency' ? THEME_COLORS.neutralTextSubtle : THEME_COLORS.primary,
                  }}
                >
                  <Siren color="white" size={28} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center flex-wrap gap-2 mb-1">
                    <Text
                      className="font-bold text-xl"
                      style={{
                        color: urgency === 'emergency' ? THEME_COLORS.neutralTextDefault : THEME_COLORS.primary,
                      }}
                    >
                      {urgency === 'emergency' ? 'Emergency Notice' : 'Community Notice'}
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
                    {urgency === 'emergency' ? "Stay calm. Report what's happening." : 'Alert neighbors about local events'}
                  </Text>
                </View>
              </View>
            )}

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
                {/* Photo hero */}
                <View className="rounded-3xl p-5 border shadow-sm gap-3" style={CARD_SURFACE_STYLE}>
                  <TouchableOpacity
                    onPress={handlePickImage}
                    activeOpacity={0.8}
                    className="rounded-2xl overflow-hidden border-2 border-dashed items-center justify-center"
                    style={{ height: 210, backgroundColor: THEME_COLORS.neutralBg, borderColor: THEME_COLORS.neutralBorderSoft }}
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
                      <View className="items-center gap-2 px-4">
                        <Text className="text-3xl font-bold text-primary text-center">Tap to add photo</Text>
                        <Text className="text-base text-gray-500 text-center">(Max 1 photo, up to 10MB)</Text>
                        <View
                          className="w-12 h-12 rounded-full items-center justify-center"
                          style={{ backgroundColor: THEME_COLORS.white }}
                        >
                          <Camera color={THEME_COLORS.primary} size={24} />
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Title */}
                <View className="gap-1">
                  <Text className="text-sm font-semibold text-primary ml-1">Title</Text>
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="e.g. Handmade Pottery"
                    placeholderTextColor={THEME_COLORS.neutralTextSoft}
                    className="px-4 py-3 rounded-2xl text-gray-800 border"
                    style={CARD_SURFACE_STYLE}
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
                    className="px-4 py-3 rounded-2xl text-gray-800 border"
                    style={[CARD_SURFACE_STYLE, { minHeight: 110 }]}
                  />
                </View>

                {/* Item details row */}
                <View className="rounded-3xl p-5 border shadow-sm gap-4" style={CARD_SURFACE_STYLE}>
                  <Text className="text-2xl font-bold text-primary">Item Details</Text>
                  <View className="flex-row gap-3">
                    <View className="flex-1 gap-1">
                      <Text className="text-xs font-bold uppercase tracking-wide text-gray-600 ml-1">Quantity</Text>
                      <View
                        className="h-12 rounded-2xl border px-2 flex-row items-center gap-2"
                        style={{
                          backgroundColor: getCardSurfaceColor('default'),
                          borderColor: getCardBorderColor('default'),
                          opacity: isQuantityLocked ? 0.5 : 1,
                        }}
                      >
                        <TextInput
                          value={initialQuantity}
                          onChangeText={handleQuantityInput}
                          keyboardType="number-pad"
                          className="flex-1 text-center text-base font-bold text-gray-800"
                          maxLength={4}
                          selectionColor={THEME_COLORS.primary}
                          editable={!isQuantityLocked}
                        />
                        <TouchableOpacity
                          onPress={() => !isQuantityLocked && setInitialQuantity(String(numericQuantity + 1))}
                          className="h-9 min-w-10 px-2 rounded-xl items-center justify-center"
                          style={{ backgroundColor: isQuantityLocked ? THEME_COLORS.neutralBorderSoft : THEME_COLORS.primary }}
                          disabled={isQuantityLocked}
                        >
                          <Text className="text-xl font-bold text-white">+</Text>
                        </TouchableOpacity>
                      </View>
                      {isQuantityLocked ? (
                        <Text className="text-[10px] text-gray-400 ml-1 mt-0.5">
                          Locked after first sale
                        </Text>
                      ) : null}
                    </View>

                    <View className="flex-1 gap-1">
                      <Text className="text-xs font-bold uppercase tracking-wide text-gray-600 ml-1">Unit</Text>
                      <TouchableOpacity
                        onPress={() => setUnitPickerVisible(true)}
                        className="h-12 rounded-2xl border px-3 flex-row items-center justify-between"
                        style={{
                          backgroundColor: getCardSurfaceColor('default'),
                          borderColor: getCardBorderColor('default'),
                        }}
                        activeOpacity={0.8}
                      >
                        <Text className="text-base font-semibold text-gray-800" numberOfLines={1}>
                          {quantityType || 'items'}
                        </Text>
                        <Text className="text-xs text-gray-400">v</Text>
                      </TouchableOpacity>
                    </View>

                    <View className="flex-1 gap-1">
                      <Text className="text-xs font-bold uppercase tracking-wide text-gray-600 ml-1">Price Per Unit</Text>
                      <TextInput
                        value={price}
                        onChangeText={setPrice}
                        placeholder="0.00"
                        placeholderTextColor={THEME_COLORS.neutralTextSoft}
                        keyboardType="decimal-pad"
                        className="h-12 px-3 rounded-2xl text-gray-800 border"
                        style={{
                          backgroundColor: getCardSurfaceColor('default'),
                          borderColor: getCardBorderColor('default'),
                        }}
                      />
                    </View>
                  </View>

                  <View className="px-1 pt-1 gap-3">
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 pr-4">
                        <Text className="text-xl font-semibold text-gray-700">Exchange</Text>
                        <Text className="text-sm text-gray-500 mt-1 leading-5">
                          Allow members to offer trades, swaps, gifts, or other exchange arrangements while keeping the item's listed value.
                        </Text>
                      </View>
                    <TouchableOpacity
                      onPress={() => {
                        setIsOpenExchange((currentValue) => !currentValue);
                      }}
                      className="rounded-full"
                      style={{
                        width: 54,
                        height: 30,
                        backgroundColor: isOpenExchange ? THEME_COLORS.primary : THEME_COLORS.neutralBorderSoft,
                        justifyContent: 'center',
                        paddingHorizontal: SPACE.xxs,
                      }}
                      activeOpacity={0.8}
                    >
                      <View
                        className="w-6 h-6 bg-surface-container-low rounded-full shadow-sm"
                        style={{ alignSelf: isOpenExchange ? 'flex-end' : 'flex-start' }}
                      />
                    </TouchableOpacity>
                  </View>
                  </View>
                </View>

                {/* Community contribution + active charity */}
                <View className="rounded-3xl p-5 border shadow-sm gap-4" style={CARD_SURFACE_STYLE}>
                  <View className="flex-row items-start gap-3">
                    <Info color={THEME_COLORS.primary} size={20} />
                    <Text className="flex-1 text-xl text-gray-700 leading-7">
                      Every listing includes a small CAT contribution to support local charities.
                    </Text>
                  </View>
                  <View className="gap-1">
                    <Text className="text-sm font-semibold text-primary ml-1">Active Charity</Text>
                    <View
                      className="px-4 py-3 rounded-2xl border flex-row items-center justify-between"
                      style={{ backgroundColor: getCardSurfaceColor('default'), borderColor: getCardBorderColor('default') }}
                    >
                      <Text className="text-base font-bold text-gray-800 flex-1">{activeCharity?.name || 'CAT'}</Text>
                      <Text className="text-base font-bold text-primary">{charityPercentage}%</Text>
                    </View>
                    <Text className="text-xs text-gray-500 ml-1 mt-1">
                      Buyer public price: R {publicPrice.toFixed(2)} per {quantityType || 'items'}
                    </Text>
                  </View>
                </View>

                {/* Remaining fields */}
                <View className="rounded-3xl p-5 border shadow-sm gap-4" style={CARD_SURFACE_STYLE}>
                  <View className="gap-1">
                    <Text className="text-sm font-semibold text-primary ml-1">Category</Text>
                    <TouchableOpacity
                      onPress={() => setCategoryPickerVisible(true)}
                      className="px-4 py-3 rounded-2xl flex-row items-center justify-between border"
                      style={{ backgroundColor: getCardSurfaceColor('default'), borderColor: getCardBorderColor('default') }}
                      activeOpacity={0.8}
                    >
                      <Text className="text-gray-800 text-sm">{category}</Text>
                      <Text className="text-gray-400 text-xs">Tap to change</Text>
                    </TouchableOpacity>
                  </View>

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

        {/* Unit picker modal */}
        <Modal
          visible={unitPickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setUnitPickerVisible(false)}
        >
          <View className="flex-1 bg-black/50 justify-end">
            <View className="bg-surface-container-low rounded-t-3xl px-6 pt-6 pb-10" style={{ maxHeight: '70%' }}>
              <Text className="text-lg font-bold text-gray-800 mb-4 text-center">Choose Unit</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {unitOptions.map((unit) => (
                  <TouchableOpacity
                    key={unit}
                    onPress={() => {
                      setQuantityType(unit);
                      setUnitPickerVisible(false);
                    }}
                    className="py-3.5 border-b"
                    style={{ borderBottomColor: THEME_COLORS.neutralBorderSoft }}
                    activeOpacity={0.8}
                  >
                    <Text
                      className="text-base text-gray-800"
                      style={{ color: quantityType === unit ? THEME_COLORS.primary : THEME_COLORS.aliasHex_1f2937, fontWeight: quantityType === unit ? '700' : '400' }}
                    >
                      {unit}
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
