import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect, useRef } from 'react';
import { GooglePlacesAutocomplete, GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Image,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Camera,
  MapPin,
  User as UserIcon,
  AlertCircle,
} from 'lucide-react-native';
import { uploadImage } from '../../lib/uploadImage';
import api from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useCommunity } from '../../context/CommunityContext';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { GOOGLE_PLACES_API_KEY, BUSINESS_CATEGORIES } from '../../constants';

// ─── Types ────────────────────────────────────────────────────────────────────

type OnboardingStep = 'profile' | 'name' | 'coverage' | 'categories' | 'businesses' | 'rules';

const COMMUNITY_STEPS: OnboardingStep[] = ['name', 'coverage', 'categories', 'businesses', 'rules'];
const STEP_LABELS: Record<OnboardingStep, string> = {
  profile: 'Your Profile',
  name: 'Community Name',
  coverage: 'Coverage Area',
  categories: 'Categories',
  businesses: 'Businesses',
  rules: 'Rules',
};

// ─── Confirm Modal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  visible, title, message, confirmLabel, cancelLabel = 'No, cancel', onConfirm, onCancel,
}) => (
  <Modal transparent visible={visible} animationType="fade" onRequestClose={() => {}}>
    <View className="flex-1 bg-black/50 items-center justify-center px-6">
      <View className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl">
        <Text className="text-xl font-black text-[#0d3d47] mb-2">{title}</Text>
        <Text className="text-sm text-gray-500 mb-6 leading-relaxed">{message}</Text>
        <View className="gap-3">
          <TouchableOpacity onPress={onConfirm} className="py-4 rounded-2xl items-center" style={{ backgroundColor: '#0d3d47' }}>
            <Text className="text-white font-bold">{confirmLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} className="py-4 rounded-2xl items-center bg-gray-100">
            <Text className="text-gray-600 font-medium">{cancelLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

// ─── Community Creator Onboarding ─────────────────────────────────────────────

const OnboardingCreate: React.FC = () => {
  const { userProfile, loading, updateUserProfile } = useAuth();
  const { refreshCommunities } = useCommunity();
  // Synthetic `user` for backward-compat with the rest of this component
  const user = userProfile ? { uid: userProfile.id, email: userProfile.email, displayName: userProfile.name, photoURL: userProfile.profile_image ?? null } : null;
  const router = useRouter();

  const [step, setStep] = useState<OnboardingStep>('profile');

  // On mount only: if the user already has profile_completed (e.g. re-entering onboarding),
  // skip straight to the community name step.
  // A ref prevents this from re-firing when profile_completed is set inside handleSubmit.
  const movedPastProfile = useRef(false);
  useEffect(() => {
    if (userProfile?.profile_completed && !movedPastProfile.current) {
      movedPastProfile.current = true;
      setStep('name');
    }
  }, [userProfile?.profile_completed]);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [locationLat, setLocationLat] = useState(0);
  const [locationLng, setLocationLng] = useState(0);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const placesRef = useRef<GooglePlacesAutocompleteRef | null>(null);

  // Community fields
  const [communityName, setCommunityName] = useState('');

  // Step 2 — Coverage
  const [coverageName, setCoverageName] = useState('');
  const [coverageLat, setCoverageLat] = useState(0);
  const [coverageLng, setCoverageLng] = useState(0);
  const [coverageRadius, setCoverageRadius] = useState(5);
  const [mapDragging, setMapDragging] = useState(false);
  const coveragePlacesRef = useRef<GooglePlacesAutocompleteRef | null>(null);

  // Step 3 — Categories (all enabled by default)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    BUSINESS_CATEGORIES.map((c) => c.id),
  );

  // Step 4 — Businesses (optional)
  const [pendingBusinesses, setPendingBusinesses] = useState<{ name: string; category: string }[]>([]);
  const [newBizName, setNewBizName] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredBusinesses, setDiscoveredBusinesses] = useState<Array<{
    name: string; address: string; category: string;
    latitude: number; longitude: number;
    rating?: number | null; phone?: string | null; website?: string | null;
  }>>([]);
  const [selectedDiscovered, setSelectedDiscovered] = useState<Set<number>>(new Set());
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  // Step 5 — Rules
  const [maxPostsPerDay, setMaxPostsPerDay] = useState('3');
  const [maxListingsPerWeek, setMaxListingsPerWeek] = useState('5');
  const [requireVerification, setRequireVerification] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [trialBlocked, setTrialBlocked] = useState(false);

  // True when the user already has a completed profile (coming from inside the app)
  const isExistingUser = userProfile?.profile_completed === true;

  const isProfileValid = fullName.trim().length > 0 && locationName.trim().length > 0 && locationLat !== 0;

  const handleDiscover = async () => {
    const categoryTypes = selectedCategories.flatMap(id =>
      BUSINESS_CATEGORIES.find(c => c.id === id)?.types ?? []
    );
    setIsDiscovering(true);
    setDiscoverError(null);
    try {
      const { data } = await api.post('/places-search', {
        categoryTypes,
        lat: coverageLat,
        lng: coverageLng,
        radius: coverageRadius,
      });
      setDiscoveredBusinesses(data as any[]);
      // pre-select all results
      setSelectedDiscovered(new Set((data as any[]).map((_: any, i: number) => i)));
    } catch (err: any) {
      setDiscoverError(err?.response?.data?.error || err?.message || 'Discovery failed. Check server connection.');
    } finally {
      setIsDiscovering(false);
    }
  };

  const handleAddDiscovered = () => {
    const toAdd = discoveredBusinesses
      .filter((_, i) => selectedDiscovered.has(i))
      .map(b => ({ name: b.name, category: b.category }));
    setPendingBusinesses(prev => {
      const existing = new Set(prev.map(p => p.name.toLowerCase()));
      return [...prev, ...toAdd.filter(b => !existing.has(b.name.toLowerCase()))];
    });
    setDiscoveredBusinesses([]);
    setSelectedDiscovered(new Set());
  };

  // Load persisted data
  useEffect(() => {
    const load = async () => {
      const [pendingName, pendingEmail, pendingPhone, pendingContact] = await Promise.all([
        AsyncStorage.getItem('pending_onboarding_name'),
        AsyncStorage.getItem('pending_onboarding_email'),
        AsyncStorage.getItem('pending_onboarding_phone'),
        AsyncStorage.getItem('pending_onboarding_contact'),
      ]);
      if (pendingName) {
        setFullName(pendingName);
        setCommunityName(`${pendingName}'s Community`);
      }
      if (pendingEmail) setEmail(pendingEmail);
      if (pendingPhone) setPhone(pendingPhone);
      if (!pendingEmail && !pendingPhone && pendingContact) {
        if (pendingContact.includes('@')) setEmail(pendingContact);
        else setPhone(pendingContact);
      }
    };
    load();
  }, []);

  // Pre-fill from auth / existing profile
  useEffect(() => {
    if (userProfile) {
      if (!fullName) {
        const n = `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || userProfile.name || '';
        if (n) { setFullName(n); setCommunityName(`${n}'s Community`); }
      }
      if (!email && userProfile.email) setEmail(userProfile.email);
      if (!phone && (userProfile.mobile_number || userProfile.phone))
        setPhone(userProfile.mobile_number || userProfile.phone || '');
      if (!profileImage && userProfile.profile_image) setProfileImage(userProfile.profile_image);
      if (!locationName && userProfile.address) setLocationName(userProfile.address);
      if (locationLat === 0 && userProfile.defaultLocation?.latitude) setLocationLat(userProfile.defaultLocation.latitude);
      if (locationLng === 0 && userProfile.defaultLocation?.longitude) setLocationLng(userProfile.defaultLocation.longitude);
    } else if (user) {
      if (!fullName && user.displayName) { setFullName(user.displayName); setCommunityName(`${user.displayName}'s Community`); }
      if (!email && user.email) setEmail(user.email);
      if (!profileImage && user.photoURL) setProfileImage(user.photoURL);
    }
  }, [user, userProfile]);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant photo library access to upload a profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (!result.canceled && result.assets.length > 0) {
        setIsUploading(true);
        try {
          const url = await uploadImage(result.assets[0].uri, 'profiles', userProfile?.id ?? 'anon');
          setProfileImage(url);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Upload failed');
        } finally {
          setIsUploading(false);
        }
      }
    } catch {
      setError('Failed to open image picker.');
    }
  };

  const handleGetCurrentLocation = async () => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('Location Services Off', 'Please go to Settings → Location and enable Location Services, then try again.');
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant location permission for this app in Settings, then try again.');
        return;
      }
      setIsFetchingLocation(true);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      setLocationLat(latitude);
      setLocationLng(longitude);
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (place) {
        const parts = [place.streetNumber, place.street, place.district || place.subregion, place.city, place.region, place.country].filter(Boolean);
        const addr = parts.join(', ');
        setLocationName(addr);
        placesRef.current?.setAddressText(addr);
      } else {
        const coords = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        setLocationName(coords);
        placesRef.current?.setAddressText(coords);
      }
    } catch {
      setError('Failed to get current location. Please type your address manually.');
    } finally {
      setIsFetchingLocation(false);
    }
  };

  // Called from the final "Create & Launch" button after all 5 steps.
  const handleSubmit = async () => {
    if (!communityName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      // Validate location BEFORE any API call so we never orphan a community.
      if (!isExistingUser) {
        if (!locationLat || !locationLng || !locationName.trim()) {
          setError('Please set your location in the profile step before creating a community.');
          setStep('profile');
          setIsSubmitting(false);
          setShowConfirmation(false);
          return;
        }
      }

      // 1. Create community — or recover the existing trial on a retry after partial failure.
      let communityId: string | undefined;
      try {
        const { data: community } = await api.post('/communities', {
          name: communityName.trim(),
          coverage_lat: coverageLat || undefined,
          coverage_lng: coverageLng || undefined,
          coverage_radius: coverageRadius,
          coverage_location: coverageName || undefined,
          enabled_categories: selectedCategories,
        });
        communityId = community?.id;
      } catch (err: any) {
        if (err?.response?.data?.error === 'TRIAL_EXISTS') {
          if (isExistingUser) {
            // Fully-onboarded user trying to create a second community → block.
            setTrialBlocked(true);
            return;
          }
          // New user whose community was created on a previous attempt but whose
          // profile update failed (partial failure recovery). Use the existing community.
          communityId = err.response.data.community_id;
        } else {
          throw err;
        }
      }

      // 2. Save profile + completion flags.
      movedPastProfile.current = true;
      if (isExistingUser) {
        await updateUserProfile({
          community_created: true,
          last_community_id: communityId,
        } as any);
      } else {
        const resolvedName = fullName || userProfile?.name || 'Anonymous';
        const parts = resolvedName.trim().split(/\s+/).filter(Boolean);
        const resolvedFirstName = parts[0] || resolvedName;
        const resolvedLastName = parts.length > 1 ? parts.slice(1).join(' ') : '';
        const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const typedEmail = (email || '').trim().toLowerCase();
        const authEmail = (userProfile?.email || '').trim().toLowerCase();
        const resolvedEmail = emailPattern.test(typedEmail) ? typedEmail : emailPattern.test(authEmail) ? authEmail : '';
        const resolvedPhone = (phone || '').trim();
        const resolvedImage = profileImage || userProfile?.profile_image || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(resolvedName)}`;
        await updateUserProfile({
          name: resolvedName,
          first_name: resolvedFirstName,
          last_name: resolvedLastName,
          email: resolvedEmail,
          phone: resolvedPhone,
          mobile_number: resolvedPhone,
          address: locationName,
          profile_image: resolvedImage,
          defaultLocation: { name: locationName, latitude: locationLat, longitude: locationLng },
          profile_completed: true,
          community_created: true,
          onboarding_completed: true,
          last_community_id: communityId,
        } as any);
      }

      // 3. Refresh so currentCommunity resolves with correct name + userRole:'Admin'.
      await refreshCommunities();

      await Promise.all([
        AsyncStorage.removeItem('pending_onboarding_name'),
        AsyncStorage.removeItem('pending_onboarding_email'),
        AsyncStorage.removeItem('pending_onboarding_phone'),
        AsyncStorage.removeItem('pending_onboarding_contact'),
        AsyncStorage.removeItem('pending_onboarding_mode'),
        AsyncStorage.removeItem('pending_onboarding_invite'),
      ]);

      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('Onboarding Error:', err);
      setError(err?.response?.data?.error ?? err?.response?.data?.message ?? err.message ?? 'An error occurred');
    } finally {
      setIsSubmitting(false);
      setShowConfirmation(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#0d3d47" />
      </SafeAreaView>
    );
  }

  // Trial already exists — show a blocking gate instead of the wizard.
  if (trialBlocked) {
    return (
      <SafeAreaView className="flex-1 bg-[#fff8f0] items-center justify-center px-8">
        <View className="w-16 h-16 rounded-3xl bg-orange-100 items-center justify-center mb-6">
          <AlertCircle size={32} color="#f97316" />
        </View>
        <Text className="text-2xl font-black text-[#0d3d47] text-center mb-3">Trial Community Active</Text>
        <Text className="text-sm text-gray-500 text-center leading-relaxed mb-8">
          You already have an active 30-day trial community. Each account is limited to one trial.{'\n\n'}
          Upgrade your licence to create additional communities, or manage your existing community from the dashboard.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          className="w-full py-4 rounded-2xl items-center mb-3"
          style={{ backgroundColor: '#0d3d47' }}
        >
          <Text className="text-white font-bold text-base">Go to My Community</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/pricing' as any)}
          className="w-full py-4 rounded-2xl items-center bg-orange-50 border border-orange-100"
        >
          <Text className="text-[#f97316] font-bold text-base">View Licence Options</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const inCommunityPhase = COMMUNITY_STEPS.includes(step);
  const communitySubStep = inCommunityPhase ? COMMUNITY_STEPS.indexOf(step) + 1 : 0;
  // Outer progress bar — 2 phases: Profile | Community
  const steps = userProfile?.profile_completed
    ? [{ key: 'name' as OnboardingStep, label: 'Create Community' }]
    : [
        { key: 'profile' as OnboardingStep, label: 'Your Profile' },
        { key: 'name' as OnboardingStep, label: 'Create Community' },
      ];
  const currentStepIndex = step === 'profile' ? 0 : 1;

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEnabled={!mapDragging}>

          {/* Header */}
          <View className="px-6 pt-6 pb-4 flex-row items-center justify-between border-b border-gray-100">
            <View className="flex-row items-center gap-2">
              <View className="w-9 h-9 bg-[#0d3d47] rounded-xl items-center justify-center overflow-hidden">
                <Image source={require('../../../assets/icon.png')} style={{ width: 36, height: 36 }} resizeMode="cover" />
              </View>
              <Text className="text-xl font-black text-[#0d3d47] tracking-tight">lalela</Text>
            </View>
            <Text className="text-xs font-black uppercase tracking-widest text-gray-400">New Community</Text>
          </View>

          {/* Step indicator */}
          <View className="flex-row items-center justify-center gap-2 px-6 py-5">
            {/* Profile phase */}
            {!userProfile?.profile_completed && (
              <React.Fragment>
                <View className="items-center gap-1">
                  <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: step === 'profile' ? '#0d3d47' : '#10b981' }}>
                    {step !== 'profile' ? <CheckCircle2 size={16} color="white" /> : <Text className="text-xs font-bold text-white">1</Text>}
                  </View>
                  <Text className="text-[9px] font-bold uppercase tracking-wider" style={{ color: step === 'profile' ? '#0d3d47' : '#9ca3af' }}>Your Profile</Text>
                </View>
                <View className="h-0.5 w-8 rounded-full mb-4" style={{ backgroundColor: step !== 'profile' ? '#10b981' : '#f3f4f6' }} />
              </React.Fragment>
            )}
            {/* Community phase */}
            <View className="items-center gap-1">
              <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: inCommunityPhase ? '#0d3d47' : '#f3f4f6' }}>
                <Text className="text-xs font-bold" style={{ color: inCommunityPhase ? 'white' : '#9ca3af' }}>
                  {inCommunityPhase ? communitySubStep : '2'}
                </Text>
              </View>
              <Text className="text-[9px] font-bold uppercase tracking-wider" style={{ color: inCommunityPhase ? '#0d3d47' : '#9ca3af' }}>
                {inCommunityPhase ? STEP_LABELS[step] : 'Create Community'}
              </Text>
            </View>
            {inCommunityPhase && (
              <View className="flex-row items-center gap-1 mb-4">
                {COMMUNITY_STEPS.map((s) => (
                  <View key={s} className="w-2 h-2 rounded-full" style={{ backgroundColor: COMMUNITY_STEPS.indexOf(step) >= COMMUNITY_STEPS.indexOf(s) ? '#0d3d47' : '#e5e7eb' }} />
                ))}
              </View>
            )}
          </View>

          <View className="px-6">
            {/* ── STEP 1: PROFILE ── */}
            {step === 'profile' && (
              <View className="gap-5">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 bg-orange-50 rounded-2xl items-center justify-center">
                    <UserIcon size={24} color="#f97316" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-black text-[#0d3d47]">Your Profile</Text>
                    <Text className="text-xs text-gray-500 font-medium">Set your name and location to continue</Text>
                  </View>
                </View>

                {/* Profile Image */}
                <View className="items-center gap-2">
                  <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
                    <View className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-2 border-gray-200 items-center justify-center">
                      {profileImage ? (
                        <Image source={{ uri: profileImage }} className="w-full h-full" resizeMode="cover" />
                      ) : (
                        <UserIcon size={36} color="#d1d5db" />
                      )}
                      {isUploading && (
                        <View className="absolute inset-0 bg-black/40 items-center justify-center">
                          <ActivityIndicator color="white" />
                        </View>
                      )}
                    </View>
                    <View className="absolute bottom-0 right-0 w-7 h-7 bg-[#0d3d47] rounded-full items-center justify-center border-2 border-white">
                      <Camera size={12} color="white" />
                    </View>
                  </TouchableOpacity>
                  <Text className="text-[10px] text-gray-400 font-medium">Tap to add photo</Text>
                </View>

                {/* Full Name */}
                <View className="gap-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Full Name <Text className="text-red-500">*</Text></Text>
                  <TextInput value={fullName} onChangeText={(t) => { setFullName(t); if (!communityName || communityName.endsWith("'s Community")) setCommunityName(t ? `${t}'s Community` : ''); }} placeholder="Your full name" className="w-full px-5 py-4 bg-gray-100 rounded-2xl font-bold text-[#0d3d47]" placeholderTextColor="#9ca3af" />
                </View>

                {/* Email */}
                <View className="gap-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Email</Text>
                  <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" className="w-full px-5 py-4 bg-gray-100 rounded-2xl font-bold text-[#0d3d47]" placeholderTextColor="#9ca3af" />
                </View>

                {/* Phone */}
                <View className="gap-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Phone</Text>
                  <TextInput value={phone} onChangeText={setPhone} placeholder="+27..." keyboardType="phone-pad" className="w-full px-5 py-4 bg-gray-100 rounded-2xl font-bold text-[#0d3d47]" placeholderTextColor="#9ca3af" />
                </View>

                {/* Location */}
                <View className="gap-1" style={{ zIndex: 10, elevation: 10 }}>
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Location <Text className="text-red-500">*</Text></Text>
                  <View style={{ zIndex: 10, elevation: 10, position: 'relative' }}>
                    <GooglePlacesAutocomplete
                      placeholder="e.g. 123 Main St, Cape Town"
                      fetchDetails
                      // @ts-ignore
                      scrollEnabled={false}
                      onPress={(data, details) => {
                        setLocationName(data.description);
                        if (details?.geometry?.location) { setLocationLat(details.geometry.location.lat); setLocationLng(details.geometry.location.lng); }
                      }}
                      query={{ key: GOOGLE_PLACES_API_KEY, language: 'en' }}
                      ref={placesRef as any}
                      textInputProps={{
                        placeholderTextColor: '#9ca3af',
                        onBlur: () => {
                          const currentText = placesRef.current?.getAddressText() || '';
                          if (currentText !== locationName) {
                            setLocationName(currentText);
                            setLocationLat(0);
                            setLocationLng(0);
                          }
                        }
                      }}
                      styles={{
                        container: { flex: 0 },
                        textInput: { backgroundColor: '#f3f4f6', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontWeight: 'bold', color: '#0d3d47', height: 52, margin: 0 },
                        listView: { position: 'absolute', top: 56, left: 0, right: 0, zIndex: 9999, elevation: 9999, backgroundColor: '#fff', borderRadius: 12, marginTop: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
                        row: { paddingVertical: 12, paddingHorizontal: 16, zIndex: 9999 },
                        description: { fontSize: 13, color: '#374151' }
                      }}
                      enablePoweredByContainer={false}
                      keyboardShouldPersistTaps="handled"
                      listUnderlayColor="transparent"
                    />
                  </View>
                  <TouchableOpacity onPress={handleGetCurrentLocation} disabled={isFetchingLocation} className="flex-row items-center gap-2 py-3 px-4 bg-surface-container-low border border-outline-variant rounded-2xl mt-1">
                    {isFetchingLocation ? <ActivityIndicator size="small" color="#0d3d47" /> : <MapPin size={16} color="#0d3d47" />}
                    <Text className="text-xs font-bold text-[#0d3d47]">{isFetchingLocation ? 'Getting location...' : 'Use current location'}</Text>
                  </TouchableOpacity>
                  {locationName && locationLat !== 0 ? (
                    <View className="flex-row items-center gap-1 mt-1 ml-1"><CheckCircle2 size={12} color="#10b981" /><Text className="text-[10px] text-emerald-600 font-medium">Location set</Text></View>
                  ) : locationName ? (
                    <View className="flex-row items-center gap-1 mt-1 ml-1"><AlertCircle size={12} color="#f59e0b" /><Text className="text-[10px] text-amber-600 font-medium">Tap "Use current location" to confirm coordinates, or type your full address</Text></View>
                  ) : (
                    <View className="flex-row items-center gap-1 mt-1 ml-1"><AlertCircle size={12} color="#f59e0b" /><Text className="text-[10px] text-amber-600 font-medium">Set your location to continue</Text></View>
                  )}
                </View>

                {error && <View className="bg-red-50 border border-red-100 rounded-2xl p-4"><Text className="text-xs text-red-600 font-medium">{error}</Text></View>}

                <TouchableOpacity
                  onPress={() => {
                    if (isProfileValid) {
                      setError(null);
                      // Pre-fill coverage from profile location if not set yet
                      if (!coverageLat && locationLat) {
                        setCoverageLat(locationLat);
                        setCoverageLng(locationLng);
                        setCoverageName(locationName);
                      }
                      setStep('name');
                    }
                  }}
                  disabled={!isProfileValid}
                  className="py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg"
                  style={{ backgroundColor: isProfileValid ? '#0d3d47' : '#d1d5db' }}
                >
                  <Text className="text-white font-bold text-base">Continue</Text>
                  <ArrowRight size={20} color="white" />
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 2: NAME ── */}
            {step === 'name' && (
              <View className="gap-5">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 bg-orange-50 rounded-2xl items-center justify-center">
                    <Sparkles size={24} color="#f97316" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-black text-[#0d3d47]">Start Your Community</Text>
                    <Text className="text-xs text-gray-500 font-medium">Step 1 of 5 — Name your community.</Text>
                  </View>
                </View>

                {/* Profile preview */}
                <View className="flex-row items-center gap-3 p-4 bg-gray-50 rounded-2xl">
                  <View className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 items-center justify-center">
                    {profileImage ? <Image source={{ uri: profileImage }} className="w-full h-full" resizeMode="cover" /> : <UserIcon size={20} color="#9ca3af" />}
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-bold text-[#0d3d47]" numberOfLines={1}>{fullName}</Text>
                    <View className="flex-row items-center gap-1">
                      <MapPin size={10} color="#9ca3af" />
                      <Text className="text-[10px] text-gray-400" numberOfLines={1}>{locationName}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setStep('profile')}>
                    <Text className="text-[10px] font-bold text-[#0d3d47]">Edit</Text>
                  </TouchableOpacity>
                </View>

                {/* Community Name */}
                <View className="gap-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Community Name <Text className="text-red-500">*</Text></Text>
                  <TextInput value={communityName} onChangeText={setCommunityName} placeholder="e.g. Parkwood Heights" className="w-full px-5 py-4 bg-gray-100 rounded-2xl font-bold text-[#0d3d47]" placeholderTextColor="#9ca3af" />
                </View>

                {/* Trial banner */}
                <View className="bg-emerald-50 border border-emerald-100 p-5 rounded-2xl flex-row items-start gap-3">
                  <View className="w-10 h-10 rounded-xl bg-emerald-500 items-center justify-center">
                    <CheckCircle2 size={22} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-emerald-800">30-Day Trial Activated</Text>
                    <Text className="text-[11px] text-emerald-700 leading-relaxed mt-1">Full access to all features. Invite up to 100 members and set up your local market.</Text>
                  </View>
                </View>

                {error && <View className="bg-red-50 border border-red-100 rounded-2xl p-4"><Text className="text-xs text-red-600 font-medium">{error}</Text></View>}

                <View className="flex-row gap-3">
                  {!userProfile?.profile_completed && (
                    <TouchableOpacity onPress={() => { setStep('profile'); setError(null); }} className="py-4 px-5 bg-gray-100 rounded-2xl items-center justify-center">
                      <ArrowLeft size={20} color="#374151" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => {
                      if (communityName.trim()) {
                        setError(null);
                        // Pre-fill coverage from profile location if not set yet
                        if (!coverageLat && locationLat) {
                          setCoverageLat(locationLat);
                          setCoverageLng(locationLng);
                          setCoverageName(locationName);
                        }
                        setStep('coverage');
                      }
                    }}
                    disabled={!communityName.trim()}
                    className="flex-1 py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg"
                    style={{ backgroundColor: '#0d3d47', opacity: !communityName.trim() ? 0.5 : 1 }}
                  >
                    <Text className="text-white font-bold text-base">Next</Text>
                    <ArrowRight size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── STEP 3: COVERAGE ── */}
            {step === 'coverage' && (
              <View className="gap-5">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center">
                    <MapPin size={24} color="#3b82f6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-black text-[#0d3d47]">Coverage Area</Text>
                    <Text className="text-xs text-gray-500 font-medium">Step 2 of 5 — Where does your community operate?</Text>
                  </View>
                </View>

                <View className="gap-1" style={{ zIndex: 10, elevation: 10 }}>
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Area or Address</Text>
                  <View style={{ zIndex: 10, elevation: 10 }}>
                    <GooglePlacesAutocomplete
                      placeholder="e.g. Parkwood, Cape Town"
                      fetchDetails
                      // @ts-ignore
                      scrollEnabled={false}
                      onPress={(data, details) => {
                        setCoverageName(data.description);
                        if (details?.geometry?.location) {
                          setCoverageLat(details.geometry.location.lat);
                          setCoverageLng(details.geometry.location.lng);
                        }
                      }}
                      query={{ key: GOOGLE_PLACES_API_KEY, language: 'en' }}
                      ref={coveragePlacesRef as any}
                      textInputProps={{ placeholderTextColor: '#9ca3af' }}
                      styles={{
                        container: { flex: 0 },
                        textInput: { backgroundColor: '#f3f4f6', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, fontWeight: 'bold', color: '#0d3d47', height: 52, margin: 0 },
                        listView: { position: 'absolute', top: 56, left: 0, right: 0, zIndex: 9999, elevation: 9999, backgroundColor: '#fff', borderRadius: 12, marginTop: 4, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8 },
                        row: { paddingVertical: 12, paddingHorizontal: 16 },
                        description: { fontSize: 13, color: '#374151' },
                      }}
                      enablePoweredByContainer={false}
                      keyboardShouldPersistTaps="handled"
                      listUnderlayColor="transparent"
                    />
                  </View>
                  {coverageName ? (
                    <View className="flex-row items-center gap-1 mt-1 ml-1"><CheckCircle2 size={12} color="#10b981" /><Text className="text-[10px] text-emerald-600 font-medium">Location set: {coverageName}</Text></View>
                  ) : null}
                </View>

                {/* Draggable map — visible once a location is chosen */}
                {coverageLat !== 0 && coverageLng !== 0 && (
                  <View className="gap-2">
                    <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Fine-tune Position</Text>
                    <Text className="text-[10px] text-gray-400 ml-1">Tap anywhere on the map to move the pin, or drag it to fine-tune.</Text>
                    <View style={{ height: 240, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
                      <MapView
                        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
                        style={{ flex: 1 }}
                        region={{
                          latitude: coverageLat,
                          longitude: coverageLng,
                          latitudeDelta: Math.max(0.02, (coverageRadius / 111) * 2.5),
                          longitudeDelta: Math.max(0.02, (coverageRadius / 111) * 2.5),
                        }}
                        scrollEnabled={true}
                        zoomEnabled={true}
                        rotateEnabled={false}
                        pitchEnabled={false}
                        moveOnMarkerPress={false}
                        onPress={(e) => {
                          setCoverageLat(e.nativeEvent.coordinate.latitude);
                          setCoverageLng(e.nativeEvent.coordinate.longitude);
                        }}
                      >
                        <Circle
                          center={{ latitude: coverageLat, longitude: coverageLng }}
                          radius={coverageRadius * 1000}
                          strokeColor="#0d3d47"
                          strokeWidth={2}
                          fillColor="rgba(13,61,71,0.08)"
                        />
                        <Marker
                          coordinate={{ latitude: coverageLat, longitude: coverageLng }}
                          draggable
                          onDragStart={() => setMapDragging(true)}
                          onDragEnd={(e) => {
                            setMapDragging(false);
                            setCoverageLat(e.nativeEvent.coordinate.latitude);
                            setCoverageLng(e.nativeEvent.coordinate.longitude);
                          }}
                          pinColor="#0d3d47"
                        />
                      </MapView>
                    </View>
                  </View>
                )}

                {/* Radius */}
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400">Coverage Radius</Text>
                    <View className="px-3 py-1 rounded-full" style={{ backgroundColor: '#0d3d47' }}>
                      <Text className="text-white text-xs font-black">{coverageRadius} km</Text>
                    </View>
                  </View>
                  <Slider
                    style={{ width: '100%', height: 40 }}
                    minimumValue={1}
                    maximumValue={200}
                    step={1}
                    value={coverageRadius}
                    onValueChange={(val) => setCoverageRadius(Math.round(val))}
                    minimumTrackTintColor="#0d3d47"
                    maximumTrackTintColor="#e5e7eb"
                    thumbTintColor="#0d3d47"
                  />
                  <View className="flex-row justify-between -mt-1">
                    <Text className="text-[9px] text-gray-400 font-medium">1 km</Text>
                    <Text className="text-[9px] text-gray-400 font-medium">200 km</Text>
                  </View>
                </View>

                {error && <View className="bg-red-50 border border-red-100 rounded-2xl p-4"><Text className="text-xs text-red-600 font-medium">{error}</Text></View>}

                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => { setStep('name'); setError(null); }} className="py-4 px-5 bg-gray-100 rounded-2xl items-center justify-center">
                    <ArrowLeft size={20} color="#374151" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setError(null); setStep('categories'); }} className="flex-1 py-4 rounded-2xl flex-row items-center justify-center gap-2" style={{ backgroundColor: '#0d3d47' }}>
                    <Text className="text-white font-bold text-base">Next</Text>
                    <ArrowRight size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── STEP 4: CATEGORIES ── */}
            {step === 'categories' && (
              <View className="gap-6">
                {/* Progress bar */}
                <View className="gap-2">
                  <View className="flex-row gap-1.5">
                    {COMMUNITY_STEPS.map((s, i) => {
                      const stepIndex = COMMUNITY_STEPS.indexOf('categories');
                      const done = i <= stepIndex;
                      return (
                        <View
                          key={s}
                          className="flex-1 h-1 rounded-full"
                          style={{ backgroundColor: done ? '#fc7127' : '#e5e7eb' }}
                        />
                      );
                    })}
                  </View>
                  <Text className="text-[10px] text-gray-400 font-medium">Step 3 of 5</Text>
                </View>

                {/* Header */}
                <View className="gap-2">
                  <Text className="text-2xl font-black text-[#0d3d47]">What's in your neighbourhood?</Text>
                  <Text className="text-sm text-gray-500 leading-relaxed">
                    Pick the types of businesses your community members can discover and list in the marketplace. Tap a category to toggle it.
                  </Text>
                </View>

                {/* Counter + reset */}
                <View className="flex-row items-center justify-between px-1">
                  <View className="flex-row items-center gap-2">
                    <View className="px-3 py-1 rounded-full" style={{ backgroundColor: '#0d3d47' }}>
                      <Text className="text-white text-xs font-black">
                        {selectedCategories.length} of {BUSINESS_CATEGORIES.length} selected
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() =>
                      selectedCategories.length === BUSINESS_CATEGORIES.length
                        ? setSelectedCategories([])
                        : setSelectedCategories(BUSINESS_CATEGORIES.map(c => c.id))
                    }
                    className="py-1 px-3"
                  >
                    <Text className="text-xs font-bold" style={{ color: '#fc7127' }}>
                      {selectedCategories.length === BUSINESS_CATEGORIES.length ? 'Deselect all' : 'Select all'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 3-column grid — Next button slots into the last empty cell */}
                <View className="flex-row flex-wrap gap-2">
                  {BUSINESS_CATEGORIES.map(cat => {
                    const enabled = selectedCategories.includes(cat.id);
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setSelectedCategories(prev =>
                          enabled ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                        )}
                        style={{
                          width: '31%',
                          backgroundColor: enabled ? '#fff8f0' : '#f8fafc',
                          borderWidth: 2,
                          borderColor: enabled ? '#fc7127' : '#e5e7eb',
                          borderRadius: 16,
                          paddingVertical: 14,
                          paddingHorizontal: 8,
                          alignItems: 'center',
                          gap: 6,
                          position: 'relative',
                        }}
                      >
                        {/* Selected badge */}
                        {enabled && (
                          <View
                            style={{
                              position: 'absolute',
                              top: 8,
                              right: 8,
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              backgroundColor: '#fc7127',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <CheckCircle2 size={11} color="#fff" />
                          </View>
                        )}
                        <Text style={{ fontSize: 26 }}>{cat.icon}</Text>
                        <Text
                          className="text-[10px] font-bold text-center"
                          style={{ color: enabled ? '#0d3d47' : '#9ca3af' }}
                          numberOfLines={2}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {/* Next button — fills the empty 3rd slot in the last row */}
                  <TouchableOpacity
                    onPress={() => { setError(null); setStep('businesses'); }}
                    style={{
                      width: '31%',
                      backgroundColor: '#0d3d47',
                      borderWidth: 2,
                      borderColor: '#0d3d47',
                      borderRadius: 16,
                      paddingVertical: 14,
                      paddingHorizontal: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    <ArrowRight size={22} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>Next</Text>
                  </TouchableOpacity>
                </View>

                {/* Back + reassurance */}
                <View className="flex-row items-center justify-between px-1">
                  <TouchableOpacity
                    onPress={() => { setStep('coverage'); setError(null); }}
                    className="flex-row items-center gap-1 py-1"
                  >
                    <ArrowLeft size={13} color="#9ca3af" />
                    <Text className="text-[11px] text-gray-400 font-medium">Back</Text>
                  </TouchableOpacity>
                  <Text className="text-[10px] text-gray-400">Update anytime in Settings.</Text>
                </View>
              </View>
            )}

            {/* ── STEP 5: BUSINESSES ── */}
            {step === 'businesses' && (
              <View className="gap-5">
                {/* Header */}
                <View className="gap-1">
                  <Text className="text-2xl font-black text-[#0d3d47]">Discover Local Businesses</Text>
                  <Text className="text-sm text-gray-500 leading-relaxed">
                    We'll search Google Maps for businesses near{coverageName ? ` ${coverageName}` : ' your coverage area'} using the categories you selected.
                  </Text>
                </View>

                {/* Auto-discover button */}
                {discoveredBusinesses.length === 0 && (
                  <TouchableOpacity
                    onPress={handleDiscover}
                    disabled={isDiscovering || coverageLat === 0}
                    className="py-4 rounded-2xl flex-row items-center justify-center gap-2"
                    style={{ backgroundColor: coverageLat === 0 ? '#e5e7eb' : '#fc7127', opacity: isDiscovering ? 0.7 : 1 }}
                  >
                    {isDiscovering
                      ? <><ActivityIndicator color="#fff" size="small" /><Text className="text-white font-bold text-sm">Searching Google Maps…</Text></>
                      : <><Text style={{ fontSize: 18 }}>🔍</Text><Text className="text-white font-bold text-sm">Search businesses near me</Text></>}
                  </TouchableOpacity>
                )}

                {coverageLat === 0 && (
                  <Text className="text-[11px] text-amber-600 text-center">Set your coverage area in Step 2 to enable discovery.</Text>
                )}

                {discoverError && (
                  <View className="bg-red-50 border border-red-100 rounded-2xl p-3">
                    <Text className="text-xs text-red-600">{discoverError}</Text>
                  </View>
                )}

                {/* Discovered results */}
                {discoveredBusinesses.length > 0 && (
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-black text-[#0d3d47] uppercase tracking-widest">
                        {discoveredBusinesses.length} businesses found
                      </Text>
                      <TouchableOpacity onPress={() => {
                        if (selectedDiscovered.size === discoveredBusinesses.length) {
                          setSelectedDiscovered(new Set());
                        } else {
                          setSelectedDiscovered(new Set(discoveredBusinesses.map((_, i) => i)));
                        }
                      }}>
                        <Text className="text-[11px] font-bold" style={{ color: '#fc7127' }}>
                          {selectedDiscovered.size === discoveredBusinesses.length ? 'Deselect all' : 'Select all'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View className="gap-2">
                      {discoveredBusinesses.map((biz, i) => {
                        const selected = selectedDiscovered.has(i);
                        return (
                          <TouchableOpacity
                            key={i}
                            onPress={() => setSelectedDiscovered(prev => {
                              const next = new Set(prev);
                              next.has(i) ? next.delete(i) : next.add(i);
                              return next;
                            })}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 12,
                              padding: 12,
                              borderRadius: 16,
                              borderWidth: 2,
                              backgroundColor: selected ? '#fff8f0' : '#f8fafc',
                              borderColor: selected ? '#fc7127' : '#e5e7eb',
                            }}
                          >
                            <View
                              style={{
                                width: 22, height: 22, borderRadius: 11,
                                backgroundColor: selected ? '#fc7127' : '#e5e7eb',
                                alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              {selected && <CheckCircle2 size={13} color="#fff" />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text className="text-sm font-bold text-[#0d3d47]" numberOfLines={1}>{biz.name}</Text>
                              <Text className="text-[10px] text-gray-400" numberOfLines={1}>{biz.address}</Text>
                            </View>
                            {biz.rating != null && (
                              <Text className="text-[11px] font-bold text-amber-500">★ {biz.rating}</Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        onPress={() => { setDiscoveredBusinesses([]); setSelectedDiscovered(new Set()); }}
                        className="py-3 px-4 rounded-2xl bg-gray-100 items-center justify-center"
                      >
                        <Text className="text-gray-500 text-xs font-bold">Clear</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleAddDiscovered}
                        disabled={selectedDiscovered.size === 0}
                        className="flex-1 py-3 rounded-2xl items-center justify-center"
                        style={{ backgroundColor: selectedDiscovered.size > 0 ? '#0d3d47' : '#e5e7eb' }}
                      >
                        <Text style={{ color: selectedDiscovered.size > 0 ? '#fff' : '#9ca3af', fontWeight: 'bold', fontSize: 13 }}>
                          Add {selectedDiscovered.size} business{selectedDiscovered.size !== 1 ? 'es' : ''}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Pending list */}
                {pendingBusinesses.length > 0 && (
                  <View className="gap-2">
                    <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Added</Text>
                    {pendingBusinesses.map((biz, i) => (
                      <View key={i} className="flex-row items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <Text className="flex-1 text-sm font-bold text-[#0d3d47]">{biz.name}</Text>
                        <Text className="text-[10px] text-gray-400">{BUSINESS_CATEGORIES.find(c => c.id === biz.category)?.label ?? biz.category}</Text>
                        <TouchableOpacity onPress={() => setPendingBusinesses(prev => prev.filter((_, idx) => idx !== i))}>
                          <Text className="text-red-400 font-bold text-xs">✕</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                )}

                {/* Manual entry */}
                <View className="gap-2">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Add manually</Text>
                  <View className="flex-row gap-2">
                    <TextInput
                      value={newBizName}
                      onChangeText={setNewBizName}
                      placeholder="Business name (e.g. Cape Coffee)"
                      className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl font-bold text-[#0d3d47] text-sm"
                      placeholderTextColor="#9ca3af"
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (newBizName.trim()) {
                          setPendingBusinesses(prev => [...prev, { name: newBizName.trim(), category: 'services' }]);
                          setNewBizName('');
                        }
                      }}
                      disabled={!newBizName.trim()}
                      className="px-4 py-3 rounded-2xl items-center justify-center"
                      style={{ backgroundColor: newBizName.trim() ? '#0d3d47' : '#e5e7eb' }}
                    >
                      <Text style={{ color: newBizName.trim() ? '#fff' : '#9ca3af', fontWeight: 'bold', fontSize: 13 }}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => { setStep('categories'); setError(null); }} className="py-4 px-5 bg-gray-100 rounded-2xl items-center justify-center">
                    <ArrowLeft size={20} color="#374151" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setError(null); setStep('rules'); }} className="flex-1 py-4 rounded-2xl flex-row items-center justify-center gap-2" style={{ backgroundColor: '#0d3d47' }}>
                    <Text className="text-white font-bold text-base">{pendingBusinesses.length > 0 ? `Next (${pendingBusinesses.length} added)` : 'Skip'}</Text>
                    <ArrowRight size={20} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── STEP 6: RULES ── */}
            {step === 'rules' && (
              <View className="gap-5">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 bg-red-50 rounded-2xl items-center justify-center">
                    <Text style={{ fontSize: 22 }}>📋</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-black text-[#0d3d47]">Community Rules</Text>
                    <Text className="text-xs text-gray-500 font-medium">Step 5 of 5 — Set posting limits and access controls.</Text>
                  </View>
                </View>

                <View className="gap-4 p-4 bg-gray-50 rounded-2xl">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400">POSTING LIMITS</Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-[#0d3d47]">Max posts per user / day</Text>
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity onPress={() => setMaxPostsPerDay(v => String(Math.max(1, Number(v) - 1)))} className="w-8 h-8 rounded-lg bg-gray-200 items-center justify-center"><Text className="font-bold text-[#0d3d47]">−</Text></TouchableOpacity>
                      <Text className="text-base font-black text-[#0d3d47] w-6 text-center">{maxPostsPerDay}</Text>
                      <TouchableOpacity onPress={() => setMaxPostsPerDay(v => String(Math.min(20, Number(v) + 1)))} className="w-8 h-8 rounded-lg bg-gray-200 items-center justify-center"><Text className="font-bold text-[#0d3d47]">+</Text></TouchableOpacity>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-[#0d3d47]">Max listings per week</Text>
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity onPress={() => setMaxListingsPerWeek(v => String(Math.max(1, Number(v) - 1)))} className="w-8 h-8 rounded-lg bg-gray-200 items-center justify-center"><Text className="font-bold text-[#0d3d47]">−</Text></TouchableOpacity>
                      <Text className="text-base font-black text-[#0d3d47] w-6 text-center">{maxListingsPerWeek}</Text>
                      <TouchableOpacity onPress={() => setMaxListingsPerWeek(v => String(Math.min(20, Number(v) + 1)))} className="w-8 h-8 rounded-lg bg-gray-200 items-center justify-center"><Text className="font-bold text-[#0d3d47]">+</Text></TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View className="gap-3 p-4 bg-gray-50 rounded-2xl">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400">ACCESS CONTROL</Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-[#0d3d47] flex-1 pr-4">Require business verification</Text>
                    <TouchableOpacity
                      onPress={() => setRequireVerification(v => !v)}
                      className="w-12 h-7 rounded-full items-center justify-center"
                      style={{ backgroundColor: requireVerification ? '#0d3d47' : '#e5e7eb' }}
                    >
                      <View className="w-5 h-5 rounded-full bg-white" style={{ alignSelf: requireVerification ? 'flex-end' : 'flex-start', margin: 3 }} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Summary of all steps */}
                <View className="bg-[#f0fdf4] border border-emerald-100 rounded-2xl p-4 gap-2">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Ready to Launch</Text>
                  <Text className="text-xs text-gray-600">📍 <Text className="font-bold">{communityName}</Text></Text>
                  {coverageName ? <Text className="text-xs text-gray-600">🗺️ {coverageName} · {coverageRadius}km radius</Text> : null}
                  <Text className="text-xs text-gray-600">🏷️ {selectedCategories.length} of {BUSINESS_CATEGORIES.length} categories enabled</Text>
                  {pendingBusinesses.length > 0 ? <Text className="text-xs text-gray-600">🏪 {pendingBusinesses.length} business{pendingBusinesses.length > 1 ? 'es' : ''} added</Text> : null}
                </View>

                {error && <View className="bg-red-50 border border-red-100 rounded-2xl p-4"><Text className="text-xs text-red-600 font-medium">{error}</Text></View>}

                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => { setStep('businesses'); setError(null); }} className="py-4 px-5 bg-gray-100 rounded-2xl items-center justify-center">
                    <ArrowLeft size={20} color="#374151" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowConfirmation(true)}
                    disabled={isSubmitting}
                    className="flex-1 py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg"
                    style={{ backgroundColor: '#0d3d47', opacity: isSubmitting ? 0.6 : 1 }}
                  >
                    {isSubmitting
                      ? <ActivityIndicator color="white" size="small" />
                      : <><Text className="text-white font-bold text-base">Create & Launch</Text><ArrowRight size={20} color="white" /></>}
                  </TouchableOpacity>
                </View>
                <Text className="text-[10px] text-gray-400 text-center leading-relaxed">
                  By creating a community you agree to our{' '}
                  <Text className="text-[#0d3d47]">Terms & Conditions</Text>.
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={showConfirmation}
        title="Create & Launch Community"
        message={`Ready to launch "${communityName.trim()}"? You'll be assigned as Admin and can manage everything from the dashboard.`}
        confirmLabel="Yes, create community"
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirmation(false)}
      />
    </SafeAreaView>
  );
};

export default OnboardingCreate;
