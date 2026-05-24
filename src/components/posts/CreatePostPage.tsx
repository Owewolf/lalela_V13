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
import { BUSINESS_CATEGORIES } from '../../constants';
import CreateWarningNotice from './CreateWarningNotice';
import CreateInfoNotice from './CreateInfoNotice';
import CreateGeneralNotice from './CreateGeneralNotice';
import LocationPickerSection from '../shared/LocationPickerSection';
import type { CommunityNotice } from '../../types';

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
  emergency: { bg: '#DC2626', text: '#FFFFFF' },
  warning: { bg: '#D97706', text: '#FFFFFF' },
  info: { bg: '#2563EB', text: '#FFFFFF' },
  general: { bg: '#059669', text: '#FFFFFF' },
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
  const { currentCommunity, charities, addPost, updatePost, securityResponders } = useCommunity();
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
  const featuredCharity =
    availableCharities.find((c) => c.isFeatured) ??
    (availableCharities.length === 1 ? availableCharities[0] : undefined);
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

  const basePercentage = selectedCharity?.percentage || 0;
  const parsedCustom = parseFloat(customCharityPercentage) || 0;
  const charityPercentage = Math.max(parsedCustom, basePercentage);
  const numericPrice = parseFloat(price) || 0;
  const charityAmount = (numericPrice * charityPercentage) / 100;
  const publicPrice = numericPrice + charityAmount;

  // ── Default location ────────────────────────────────────────────────────────
  useEffect(() => {
    if (postToEdit) return;
    if (userProfile?.defaultLocation) {
      setLatitude(userProfile.defaultLocation.latitude);
      setLongitude(userProfile.defaultLocation.longitude);
      setLocationName(userProfile.defaultLocation.name);
    } else if (userProfile?.locationSharingEnabled) {
      handleUseCurrentLocation();
    }
  }, [userProfile?.defaultLocation, userProfile?.locationSharingEnabled, postToEdit]);

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
    if (postType === 'listing' && isPublic && !featuredCharity) return;

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
        if (postId && postData.urgency === 'emergency') {
          onEmergencyPosted?.({ ...postData, id: postId, timestamp: new Date().toISOString() });
          router.push(`/emergency/${postId}`);
        } else {
          if (router.canGoBack()) router.back(); else router.replace('/posts');
        }
      }
    } catch {
      Alert.alert('Error', 'Failed to post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const ctaLabel = getCtaLabel(postType, urgency, !!postToEdit);
  const isEmergency = postType === 'notice' && urgency === 'emergency';
  const canSubmit = isEmergency ? !!emergencyCategory : !!title && !!description;

  const mapRegion = {
    latitude: latitude ?? -26.2041,
    longitude: longitude ?? 28.0473,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  if (postType === 'notice') {
    if (urgency === 'warning') {
      return (
        <SafeAreaView className="flex-1 bg-white">
          <CreateWarningNotice onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/posts'); }} postToEdit={postToEdit} />
        </SafeAreaView>
      );
    }
    if (urgency === 'info') {
      return (
        <SafeAreaView className="flex-1 bg-white">
          <CreateInfoNotice onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/posts'); }} postToEdit={postToEdit} />
        </SafeAreaView>
      );
    }
    if (urgency === 'general') {
      return (
        <SafeAreaView className="flex-1 bg-white">
          <CreateGeneralNotice onBack={() => { if (router.canGoBack()) router.back(); else router.replace('/posts'); }} postToEdit={postToEdit} />
        </SafeAreaView>
      );
    }
  }

  if (isReadOnly) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center p-8">
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
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-5 pt-3 pb-1">
        <TouchableOpacity
          onPress={handleBack}
          className="self-start flex-row items-center gap-2 rounded-full bg-slate-100 px-4 py-2"
          activeOpacity={0.8}
        >
          <ArrowLeft size={18} color="#0d3d47" />
          <Text className="text-sm font-bold text-primary">Back</Text>
        </TouchableOpacity>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="px-5 pt-5 gap-5">
            {/* ── Type Banner ─────────────────────────────────────────────── */}
            <View
              className="p-5 rounded-3xl flex-row items-center gap-4 border"
              style={{
                backgroundColor:
                  postType === 'listing'
                    ? '#F0FDF4'
                    : urgency === 'emergency'
                    ? '#F8FAFC'
                    : '#F0FDF4',
                borderColor:
                  postType === 'listing'
                    ? '#0d3d4740'
                    : urgency === 'emergency'
                    ? '#CBD5E1'
                    : '#0d3d4740',
              }}
            >
              <View
                className="w-14 h-14 rounded-2xl items-center justify-center"
                style={{
                  backgroundColor:
                    postType === 'listing'
                      ? '#0d3d47'
                      : urgency === 'emergency'
                      ? '#64748B'
                      : '#0d3d47',
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
                      color: urgency === 'emergency' ? '#475569' : '#0d3d47',
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
                      <MapPin size={16} color="#6B7280" />
                      <Text className="text-sm font-bold text-gray-600">Your Location</Text>
                    </View>
                    {locationSource !== 'profile_default' && userProfile?.defaultLocation && (
                      <TouchableOpacity
                        onPress={() => {
                          if (userProfile.defaultLocation) {
                            setLatitude(userProfile.defaultLocation.latitude);
                            setLongitude(userProfile.defaultLocation.longitude);
                            setLocationName(userProfile.defaultLocation.name);
                            setLocationSource('profile_default');
                          }
                        }}
                      >
                        <Text className="text-xs font-bold text-blue-600">Reset to Profile</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <View
                    className="w-full rounded-3xl overflow-hidden border-2 border-slate-200"
                    style={{ height: 220 }}
                  >
                    <MapView {...defaultMapViewProps}
                      style={{ flex: 1 }}
                      region={mapRegion}
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
                            radius={10000}
                            strokeColor="#6B8DD640"
                            fillColor="#6B8DD610"
                            strokeWidth={1}
                          />
                          <Circle
                            center={{ latitude, longitude }}
                            radius={20000}
                            strokeColor="#6B8DD620"
                            fillColor="#6B8DD608"
                            strokeWidth={1}
                          />
                        </>
                      )}
                      {securityResponders.map((r) => (
                        <Marker
                          key={r.userId}
                          coordinate={{ latitude: r.latitude, longitude: r.longitude }}
                          pinColor="#0D9488"
                        />
                      ))}
                    </MapView>

                    <View className="absolute top-3 left-3 right-3">
                      <View className="bg-white/90 px-3 py-2 rounded-2xl flex-row items-center justify-between">
                        <View>
                          <Text className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                            {locationSource === 'profile_default'
                              ? 'Default Location'
                              : 'Custom Location Active'}
                          </Text>
                          <Text className="text-xs text-slate-400">Tap map to pin or drag marker</Text>
                        </View>
                        {locationSource === 'user_selected' && (
                          <View className="flex-row items-center gap-1">
                            <View className="w-2 h-2 rounded-full bg-blue-500" />
                            <Text className="text-xs font-bold text-blue-600 uppercase">Set</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View className="absolute bottom-3 left-3 right-3">
                      <View className="bg-white/90 px-3 py-2 rounded-2xl">
                        <Text className="text-xs font-bold text-slate-600 uppercase tracking-widest mb-0.5">
                          Situational View
                        </Text>
                        <Text className="text-xs text-slate-400">
                          Showing 10km &amp; 20km radii and active security personnel.
                        </Text>
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
                            emergencyCategory === cat.id ? '#EFF6FF' : '#FFFFFF',
                          borderColor:
                            emergencyCategory === cat.id ? '#93C5FD' : '#E2E8F0',
                        }}
                        activeOpacity={0.8}
                      >
                        <Text className="text-[28px] mb-1">{cat.emoji}</Text>
                        <Text
                          className="text-base font-bold text-center"
                          style={{
                            color: emergencyCategory === cat.id ? '#1D4ED8' : '#475569',
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
                    placeholderTextColor="#9CA3AF"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    className="bg-white border-2 border-slate-200 px-4 py-4 rounded-2xl text-slate-700"
                    style={{ minHeight: 80 }}
                  />
                </View>
              </View>
            )}

            {/* ── Listing Form ────────────────────────────────────────────── */}
            {postType === 'listing' && (
              <View className="gap-5">
                {/* Photo */}
                <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm gap-3">
                  <Text className="font-bold text-primary text-base">Photos</Text>
                  <TouchableOpacity
                    onPress={handlePickImage}
                    activeOpacity={0.8}
                    className="rounded-2xl overflow-hidden border-2 border-dashed border-gray-300 items-center justify-center"
                    style={{ height: 180, backgroundColor: '#F9FAFB' }}
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
                        <ActivityIndicator color="#0d3d47" size="large" />
                        <Text className="text-sm text-gray-400">Uploading...</Text>
                      </View>
                    ) : (
                      <View className="items-center gap-2">
                        <Camera color="#9CA3AF" size={36} />
                        <Text className="text-sm text-gray-400">Add Photo</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text className="text-xs text-gray-400 ml-1">Max 1 photo, up to 10MB.</Text>
                </View>

                {/* Details */}
                <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm gap-5">
                  {/* Title */}
                  <View className="gap-1">
                    <Text className="text-sm font-semibold text-primary ml-1">Title</Text>
                    <TextInput
                      value={title}
                      onChangeText={setTitle}
                      placeholder="e.g. Handmade Pottery"
                      placeholderTextColor="#9CA3AF"
                      className="bg-gray-50 border-b-2 border-gray-200 px-4 py-3 rounded-t-xl text-gray-800"
                    />
                  </View>

                  {/* Description */}
                  <View className="gap-1">
                    <Text className="text-sm font-semibold text-primary ml-1">Description</Text>
                    <TextInput
                      value={description}
                      onChangeText={setDescription}
                      placeholder="Tell the community about what you're listing..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      className="bg-gray-50 border-b-2 border-gray-200 px-4 py-3 rounded-t-xl text-gray-800"
                      style={{ minHeight: 100 }}
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
                        placeholderTextColor="#9CA3AF"
                        keyboardType="decimal-pad"
                        editable={!isFree}
                        className="bg-gray-50 border-b-2 border-gray-200 px-4 py-3 rounded-t-xl text-gray-800"
                        style={isFree ? { opacity: 0.5 } : undefined}
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
                          backgroundColor: isFree ? '#0d3d47' : '#E5E7EB',
                          justifyContent: 'center',
                          paddingHorizontal: 2,
                        }}
                        activeOpacity={0.8}
                      >
                        <View
                          className="w-5 h-5 bg-white rounded-full shadow-sm"
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
                      className="flex-row bg-gray-100 p-1 rounded-full border border-gray-200"
                    >
                      <TouchableOpacity
                        onPress={() => setIsPublic(false)}
                        className="flex-1 py-2 rounded-full items-center"
                        style={{
                          backgroundColor: !isPublic ? '#FFFFFF' : 'transparent',
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: !isPublic ? '#0d3d47' : '#6B7280' }}
                        >
                          Local
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setIsPublic(true)}
                        className="flex-1 py-2 rounded-full items-center"
                        style={{
                          backgroundColor: isPublic ? '#FFFFFF' : 'transparent',
                        }}
                        activeOpacity={0.8}
                      >
                        <Text
                          className="text-xs font-semibold"
                          style={{ color: isPublic ? '#0d3d47' : '#6B7280' }}
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
                        <Info color="#0d3d47" size={18} />
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
                            <View className="bg-white border-b-2 border-outline-variant px-4 py-3 rounded-t-xl flex-row items-center justify-between">
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
                              placeholderTextColor="#9CA3AF"
                              keyboardType="decimal-pad"
                              className="bg-white border-b-2 border-outline-variant px-4 py-3 rounded-t-xl text-gray-800 text-sm"
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
                            Public CAT pricing is unavailable until an admin selects the active charity.
                          </Text>
                        </View>
                      )}

                      {/* Price breakdown */}
                      <View className="bg-white/60 rounded-2xl p-4 gap-2">
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
                            To Charity{selectedCharity ? ` (${charityPercentage}%)` : ''}
                          </Text>
                          <Text className="text-xs font-bold text-primary">
                            + R {selectedCharity ? charityAmount.toFixed(2) : '0.00'}
                          </Text>
                        </View>
                        <View className="h-px bg-gray-200 my-1" />
                        <View className="flex-row justify-between">
                          <Text className="text-sm font-bold text-primary">Public Price</Text>
                          <Text className="text-sm font-bold text-primary">
                            R {(selectedCharity ? publicPrice : numericPrice).toFixed(2)}
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
                      className="bg-gray-50 border-b-2 border-gray-200 px-4 py-3 rounded-t-xl flex-row items-center justify-between"
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
                  <Info color="#0d3d47" size={22} />
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
        <View className="absolute bottom-0 left-0 right-0 bg-white/90 px-5 pb-8 pt-4 border-t border-gray-100">
          <TouchableOpacity
            onPress={() => setShowConfirmModal(true)}
            disabled={!canSubmit}
            className="py-4 rounded-full items-center justify-center flex-row gap-2"
            style={{
              backgroundColor: canSubmit
                ? urgency === 'emergency'
                  ? '#DC2626'
                  : postType === 'listing'
                  ? '#0d3d47'
                  : urgencyColors[urgency].bg
                : '#E5E7EB',
              opacity: canSubmit ? 1 : 0.5,
            }}
            activeOpacity={0.85}
          >
            <Text
              className="font-bold text-lg"
              style={{ color: canSubmit ? '#FFFFFF' : '#9CA3AF' }}
            >
              {ctaLabel}
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
                        ? '#DC2626'
                        : postType === 'listing'
                        ? '#0d3d47'
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
                  className="py-4 rounded-full items-center bg-gray-100"
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
            <View className="bg-white rounded-t-3xl px-6 pt-6 pb-10" style={{ maxHeight: '70%' }}>
              <Text className="text-lg font-bold text-gray-800 mb-4 text-center">Choose Category</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {['All', ...enabledListingCategories].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      setCategory(cat);
                      setCategoryPickerVisible(false);
                    }}
                    className="py-3.5 border-b border-gray-100"
                    activeOpacity={0.8}
                  >
                    <Text
                      className="text-base text-gray-800"
                      style={{ color: category === cat ? '#0d3d47' : '#1F2937', fontWeight: category === cat ? '700' : '400' }}
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
