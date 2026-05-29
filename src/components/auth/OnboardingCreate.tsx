import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect, useRef } from 'react';
import { GooglePlacesAutocomplete, GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
import MapView, { Marker, Circle } from 'react-native-maps';
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
import { defaultMapViewProps } from '../../lib/mapViewProps';
import { APP_SHELL_COLORS, THEME_COLORS } from '../../theme/colors';
import { getCardBorderColor, getCardSurfaceColor } from '../../theme/cardStyles';
import { LAYER_ELEVATION, LAYER_Z_INDEX } from '../../theme/layers';
import { createShadow } from '../../theme/shadows';

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

const TYPE_SCALE = {
  xs: 10,
  sm: 13,
  md: 14,
  lg: 18,
  xl: 22,
  icon: 26,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  zero: 0,
  xxxs: 3,
  xxs: 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  xxl: 18,
  s22: 22,
  s36: 36,
  s40: 40,
  s48: 48,
  s52: 52,
  s56: 56,
  mapHeight: 240,
};
const RADIUS = {
  md: 9,
  lg: 11,
  xl: 12,
  xxl: 16,
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
    <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_05 }}>
      <View className="rounded-3xl p-8 w-full max-w-sm shadow-2xl" style={{ backgroundColor: THEME_COLORS.surface }}>
        <Text className="text-xl font-black text-primary mb-2">{title}</Text>
        <Text className="text-sm text-gray-500 mb-6 leading-relaxed">{message}</Text>
        <View className="gap-3">
          <TouchableOpacity onPress={onConfirm} className="py-4 rounded-2xl items-center" style={{ backgroundColor: THEME_COLORS.primary }}>
            <Text className="text-white font-bold">{confirmLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} className="py-4 rounded-2xl items-center" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}>
            <Text className="text-gray-600 font-medium">{cancelLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const OnboardingCreate: React.FC = () => {
  const { userProfile, loading, updateUserProfile } = useAuth();
  const { refreshCommunities } = useCommunity();
  // Synthetic `user` for backward-compat with the rest of this component
  const user = userProfile ? { uid: userProfile.id, email: userProfile.email, displayName: userProfile.name, photoURL: userProfile.profileImage ?? null } : null;
  const router = useRouter();

  const [step, setStep] = useState<OnboardingStep>(
    // If profile is already completed, jump straight to community creation steps.
    // This avoids a flash of the profile step for existing users.
    userProfile?.profileCompleted ? 'name' : 'profile'
  );

  // Keep step in sync if userProfile loads asynchronously after initial render.
  const movedPastProfile = useRef(userProfile?.profileCompleted === true);
  useEffect(() => {
    if (userProfile?.profileCompleted && !movedPastProfile.current) {
      movedPastProfile.current = true;
      setStep('name');
    }
  }, [userProfile?.profileCompleted]);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Community fields
  const [communityName, setCommunityName] = useState('');
  const [draftCommunityId, setDraftCommunityId] = useState<string | null>(null);
  const [isSavingCommunity, setIsSavingCommunity] = useState(false);

  // Step 2 — Coverage
  const [coverageName, setCoverageName] = useState('');
  const [coverageLat, setCoverageLat] = useState(0);
  const [coverageLng, setCoverageLng] = useState(0);
  const [coverageRadius, setCoverageRadius] = useState(5);
  const [mapDragging, setMapDragging] = useState(false);
  const [isFetchingCoverageLocation, setIsFetchingCoverageLocation] = useState(false);
  const coveragePlacesRef = useRef<GooglePlacesAutocompleteRef | null>(null);

  // Step 3 — Categories (all enabled by default)
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    BUSINESS_CATEGORIES.map((c) => c.id),
  );

  // Step 4 — Businesses (optional)
  type PendingBusiness = {
    name: string;
    category: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    phone?: string | null;
    website?: string | null;
    rating?: number | null;
    imageUrl?: string;
  };
  const [pendingBusinesses, setPendingBusinesses] = useState<PendingBusiness[]>([]);
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
  const isExistingUser = userProfile?.profileCompleted === true;

  const isProfileValid = fullName.trim().length > 0;

  const handleCoverageCurrentLocation = async () => {
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('Location Services Off', 'Please enable location services and try again.');
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant location permission to set your coverage area from the device location.');
        return;
      }

      setIsFetchingCoverageLocation(true);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      setCoverageLat(latitude);
      setCoverageLng(longitude);

      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const parts = place
        ? [place.streetNumber, place.street, place.district || place.subregion, place.city, place.region, place.country].filter(Boolean)
        : [];
      const resolvedName = parts.length > 0 ? parts.join(', ') : `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      setCoverageName(resolvedName);
      coveragePlacesRef.current?.setAddressText(resolvedName);
    } catch {
      setError('Failed to get your current location for coverage.');
    } finally {
      setIsFetchingCoverageLocation(false);
    }
  };

  const saveCommunityDraft = async () => {
    if (!communityName.trim()) return null;

    setIsSavingCommunity(true);
    setError(null);

    try {
      if (draftCommunityId) {
        await api.put(`/communities/${draftCommunityId}`, {
          name: communityName.trim(),
        });
        return draftCommunityId;
      }

      const { data } = await api.post('/communities', {
        name: communityName.trim(),
        enabledCategories: selectedCategories,
      });

      const nextCommunityId = data?.id ?? data?.community_id ?? null;
      if (nextCommunityId) {
        setDraftCommunityId(nextCommunityId);
      }
      return nextCommunityId;
    } catch (err: any) {
      if (err?.response?.data?.error === 'TRIAL_EXISTS') {
        const existingCommunityId = err.response.data.communityId ?? err.response.data.community_id ?? null;
        if (isExistingUser) {
          setTrialBlocked(true);
          return null;
        }
        if (existingCommunityId) {
          setDraftCommunityId(existingCommunityId);
          await api.put(`/communities/${existingCommunityId}`, {
            name: communityName.trim(),
          });
          return existingCommunityId;
        }
      }

      throw err;
    } finally {
      setIsSavingCommunity(false);
    }
  };

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
    const toAdd: PendingBusiness[] = discoveredBusinesses
      .filter((_, i) => selectedDiscovered.has(i))
      .map(b => ({
        name: b.name,
        category: b.category,
        address: b.address,
        latitude: b.latitude,
        longitude: b.longitude,
        phone: b.phone ?? null,
        website: b.website ?? null,
        rating: b.rating ?? null,
      }));
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
        const n = `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || userProfile.name || '';
        if (n) { setFullName(n); setCommunityName(`${n}'s Community`); }
      }
      if (!email && userProfile.email) setEmail(userProfile.email);
      if (!phone && (userProfile.mobileNumber || userProfile.phone))
        setPhone(userProfile.mobileNumber || userProfile.phone || '');
      if (!profileImage && userProfile.profileImage) setProfileImage(userProfile.profileImage);
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
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
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

  // Called from the final "Create & Launch" button after all 5 steps.
  const handleSubmit = async () => {
    if (!communityName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      // Validate coverage BEFORE any API call so we never orphan a profile or community.
      if (!isExistingUser) {
        if (!coverageLat || !coverageLng || !coverageName.trim()) {
          setError('Please set your community coverage area before creating a community.');
          setStep('coverage');
          setIsSubmitting(false);
          setShowConfirmation(false);
          return;
        }
      }

      // 1. Ensure the draft community exists, then update it with the collected onboarding data.
      let communityId = draftCommunityId;
      if (!communityId) {
        communityId = await saveCommunityDraft();
      }
      if (!communityId) {
        setIsSubmitting(false);
        setShowConfirmation(false);
        return;
      }

      await api.put(`/communities/${communityId}`, {
        name: communityName.trim(),
        coverageLat,
        coverageLng,
        coverageRadius,
        coverageLocation: coverageName,
        enabledCategories: selectedCategories,
        onboardingStepsCompleted: COMMUNITY_STEPS,
      });

      // 1b. Persist any businesses the user added during onboarding so they
      //     show up in the Marketplace and the admin Business Management view.
      if (pendingBusinesses.length > 0) {
        try {
          await api.post('/businesses/import', {
            communityId,
            businesses: pendingBusinesses.map((b) => ({
              name: b.name,
              category: b.category,
              address: b.address,
              latitude: b.latitude,
              longitude: b.longitude,
              phone: b.phone ?? undefined,
              website: b.website ?? undefined,
              imageUrl: b.imageUrl,
            })),
          });
        } catch (importErr) {
          // Don't fail the entire onboarding if business import has an issue,
          // but surface it so the user knows to retry from the admin dashboard.
          console.error('Onboarding business import failed:', importErr);
        }
      }

      // 2. Save profile + completion flags.
      movedPastProfile.current = true;
      if (isExistingUser) {
        await updateUserProfile({
          communityCreated: true,
          lastCommunityId: communityId,
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
        const resolvedImage = profileImage || userProfile?.profileImage || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(resolvedName)}`;
        await updateUserProfile({
          name: resolvedName,
          firstName: resolvedFirstName,
          lastName: resolvedLastName,
          email: resolvedEmail,
          phone: resolvedPhone,
          mobileNumber: resolvedPhone,
          address: coverageName,
          profileImage: resolvedImage,
          defaultLocation: { name: coverageName, latitude: coverageLat, longitude: coverageLng },
          profileCompleted: true,
          communityCreated: true,
          onboardingCompleted: true,
          lastCommunityId: communityId,
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
      <SafeAreaView className="flex-1 items-center justify-center" style={{ backgroundColor: APP_SHELL_COLORS.body }}>
        <ActivityIndicator size="large" color={THEME_COLORS.primary} />
      </SafeAreaView>
    );
  }

  // Trial already exists — show a blocking gate instead of the wizard.
  if (trialBlocked) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-8">
        <View className="w-16 h-16 rounded-3xl bg-orange-100 items-center justify-center mb-6">
          <AlertCircle size={32} color={THEME_COLORS.secondaryContainer} />
        </View>
        <Text className="text-2xl font-black text-primary text-center mb-3">Trial Community Active</Text>
        <Text className="text-sm text-gray-500 text-center leading-relaxed mb-8">
          You already have an active 30-day trial community. Each account is limited to one trial.{'\n\n'}
          Upgrade your licence to create additional communities, or manage your existing community from the dashboard.
        </Text>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          className="w-full py-4 rounded-2xl items-center mb-3"
          style={{ backgroundColor: THEME_COLORS.primary }}
        >
          <Text className="text-white font-bold text-base">Go to My Community</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/pricing' as any)}
          className="w-full py-4 rounded-2xl items-center border border-orange-100"
          style={{ backgroundColor: THEME_COLORS.warningSurface }}
        >
          <Text className="text-secondary-container font-bold text-base">View Licence Options</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const inCommunityPhase = COMMUNITY_STEPS.includes(step);
  const communitySubStep = inCommunityPhase ? COMMUNITY_STEPS.indexOf(step) + 1 : 0;
  // Outer progress bar — 2 phases: Profile | Community
  const steps = userProfile?.profileCompleted
    ? [{ key: 'name' as OnboardingStep, label: 'Create Community' }]
    : [
        { key: 'profile' as OnboardingStep, label: 'Your Profile' },
        { key: 'name' as OnboardingStep, label: 'Create Community' },
      ];
  const currentStepIndex = step === 'profile' ? 0 : 1;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: APP_SHELL_COLORS.body }}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: SPACE.s48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} scrollEnabled={!mapDragging}>

          {/* Header */}
          <View
            className="px-6 pt-6 pb-4 flex-row items-center justify-between border-b"
            style={{ borderBottomColor: THEME_COLORS.neutralBorderSoft }}
          >
            <View className="flex-row items-center gap-2">
              <View className="w-9 h-9 bg-primary rounded-xl items-center justify-center overflow-hidden">
                <Image source={require('../../../assets/lalela_logo.png')} style={{ width: SPACE.s36, height: SPACE.s36 }} resizeMode="cover" />
              </View>
              <Text className="text-xl font-black text-primary tracking-tight">lalela</Text>
            </View>
            <Text className="text-xs font-black uppercase tracking-widest text-gray-400">New Community</Text>
          </View>

          {/* Step indicator */}
          <View className="flex-row items-center justify-center gap-2 px-6 py-5">
            {/* Profile phase */}
            {!userProfile?.profileCompleted && (
              <React.Fragment>
                <View className="items-center gap-1">
                  <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: step === 'profile' ? THEME_COLORS.primary : THEME_COLORS.success }}>
                    {step !== 'profile' ? <CheckCircle2 size={16} color="white" /> : <Text className="text-xs font-bold text-white">1</Text>}
                  </View>
                  <Text className="text-[9px] font-bold uppercase tracking-wider" style={{ color: step === 'profile' ? THEME_COLORS.primary : THEME_COLORS.neutralTextSoft }}>Your Profile</Text>
                </View>
                <View className="h-0.5 w-8 rounded-full mb-4" style={{ backgroundColor: step !== 'profile' ? THEME_COLORS.success : THEME_COLORS.neutralBgSofter }} />
              </React.Fragment>
            )}
            {/* Community phase */}
            <View className="items-center gap-1">
              <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: inCommunityPhase ? THEME_COLORS.primary : THEME_COLORS.neutralBgSofter }}>
                <Text className="text-xs font-bold" style={{ color: inCommunityPhase ? 'white' : THEME_COLORS.neutralTextSoft }}>
                  {inCommunityPhase ? communitySubStep : '2'}
                </Text>
              </View>
              <Text className="text-[9px] font-bold uppercase tracking-wider" style={{ color: inCommunityPhase ? THEME_COLORS.primary : THEME_COLORS.neutralTextSoft }}>
                {inCommunityPhase ? STEP_LABELS[step] : 'Create Community'}
              </Text>
            </View>
            {inCommunityPhase && (
              <View className="flex-row items-center gap-1 mb-4">
                {COMMUNITY_STEPS.map((s) => (
                  <View key={s} className="w-2 h-2 rounded-full" style={{ backgroundColor: COMMUNITY_STEPS.indexOf(step) >= COMMUNITY_STEPS.indexOf(s) ? THEME_COLORS.primary : THEME_COLORS.neutralBorderSoft }} />
                ))}
              </View>
            )}
          </View>

          <View className="px-6">
            {/* ── STEP 1: PROFILE ── */}
            {step === 'profile' && (
              <View className="gap-5">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: THEME_COLORS.warningSurface }}>
                    <UserIcon size={24} color={THEME_COLORS.secondaryContainer} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-black text-primary">Your Profile</Text>
                    <Text className="text-xs text-gray-500 font-medium">Set your account details first. Coverage comes in the next step.</Text>
                  </View>
                </View>

                {/* Profile Image */}
                <View className="items-center gap-2">
                  <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8}>
                    <View
                      className="w-24 h-24 rounded-full overflow-hidden border-2 items-center justify-center"
                      style={{ backgroundColor: getCardSurfaceColor('subtle'), borderColor: getCardBorderColor('default') }}
                    >
                      {profileImage ? (
                        <Image source={{ uri: profileImage }} className="w-full h-full" resizeMode="cover" />
                      ) : (
                        <UserIcon size={36} color={THEME_COLORS.neutralBorderMuted} />
                      )}
                      {isUploading && (
                        <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_4 }}>
                          <ActivityIndicator color="white" />
                        </View>
                      )}
                    </View>
                    <View
                      className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full items-center justify-center border-2"
                      style={{ borderColor: THEME_COLORS.surface }}
                    >
                      <Camera size={12} color="white" />
                    </View>
                  </TouchableOpacity>
                  <Text className="text-[10px] text-gray-400 font-medium">Tap to add photo</Text>
                </View>

                {/* Full Name */}
                <View className="gap-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Full Name <Text className="text-red-500">*</Text></Text>
                  <TextInput value={fullName} onChangeText={(t) => { setFullName(t); if (!communityName || communityName.endsWith("'s Community")) setCommunityName(t ? `${t}'s Community` : ''); }} placeholder="Your full name" className="w-full px-5 py-4 rounded-2xl font-bold text-primary" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }} placeholderTextColor={THEME_COLORS.neutralTextSoft} />
                </View>

                {/* Email */}
                <View className="gap-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Email</Text>
                  <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" className="w-full px-5 py-4 rounded-2xl font-bold text-primary" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }} placeholderTextColor={THEME_COLORS.neutralTextSoft} />
                </View>

                {/* Phone */}
                <View className="gap-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Phone</Text>
                  <TextInput value={phone} onChangeText={setPhone} placeholder="+27..." keyboardType="phone-pad" className="w-full px-5 py-4 rounded-2xl font-bold text-primary" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }} placeholderTextColor={THEME_COLORS.neutralTextSoft} />
                </View>

                <View className="border border-blue-100 rounded-2xl px-4 py-4 flex-row items-start gap-3" style={{ backgroundColor: THEME_COLORS.infoSurfaceSoft }}>
                  <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: THEME_COLORS.surface }}>
                    <MapPin size={18} color={THEME_COLORS.brandBlue} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-blue-900">Coverage sets your default location</Text>
                    <Text className="text-[11px] text-blue-800 leading-relaxed mt-1">
                      You will choose the community coverage area in the next step. That location becomes your default profile location when onboarding finishes.
                    </Text>
                  </View>
                </View>

                {error && <View className="border border-red-100 rounded-2xl p-4" style={{ backgroundColor: THEME_COLORS.errorSurface }}><Text className="text-xs text-red-600 font-medium">{error}</Text></View>}

                <TouchableOpacity
                  onPress={() => {
                    if (isProfileValid) {
                      setError(null);
                      setStep('name');
                    }
                  }}
                  disabled={!isProfileValid}
                  className="py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg"
                  style={{ backgroundColor: isProfileValid ? THEME_COLORS.primary : THEME_COLORS.neutralBorderMuted }}
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
                  <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: THEME_COLORS.warningSurface }}>
                    <Sparkles size={24} color={THEME_COLORS.secondaryContainer} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-black text-primary">Start Your Community</Text>
                    <Text className="text-xs text-gray-500 font-medium">Step 1 of 5 — Name your community.</Text>
                  </View>
                </View>

                {/* Profile preview */}
                <View className="flex-row items-center gap-3 p-4 rounded-2xl" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}>
                  <View className="w-10 h-10 rounded-full overflow-hidden items-center justify-center" style={{ backgroundColor: THEME_COLORS.surfaceContainer }}>
                    {profileImage ? <Image source={{ uri: profileImage }} className="w-full h-full" resizeMode="cover" /> : <UserIcon size={20} color={THEME_COLORS.neutralTextSoft} />}
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-sm font-bold text-primary" numberOfLines={1}>{fullName}</Text>
                    <View className="flex-row items-center gap-1">
                      <MapPin size={10} color={THEME_COLORS.neutralTextSoft} />
                      <Text className="text-[10px] text-gray-400" numberOfLines={1}>{coverageName || 'Coverage area set in next step'}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setStep('profile')}>
                    <Text className="text-[10px] font-bold text-primary">Edit</Text>
                  </TouchableOpacity>
                </View>

                {/* Community Name */}
                <View className="gap-1">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Community Name <Text className="text-red-500">*</Text></Text>
                  <TextInput value={communityName} onChangeText={setCommunityName} placeholder="e.g. Parkwood Heights" className="w-full px-5 py-4 rounded-2xl font-bold text-primary" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }} placeholderTextColor={THEME_COLORS.neutralTextSoft} />
                </View>

                {draftCommunityId ? (
                  <View className="border border-emerald-100 p-4 rounded-2xl flex-row items-center gap-3" style={{ backgroundColor: THEME_COLORS.successSurfaceSoft }}>
                    <CheckCircle2 size={18} color={THEME_COLORS.success} />
                    <View className="flex-1">
                      <Text className="text-sm font-bold text-emerald-800">Community name saved</Text>
                      <Text className="text-[11px] text-emerald-700 mt-1">Your community draft is created. Continue to add coverage, categories, and businesses.</Text>
                    </View>
                  </View>
                ) : null}

                {/* Trial banner */}
                <View className="border border-emerald-100 p-5 rounded-2xl flex-row items-start gap-3" style={{ backgroundColor: THEME_COLORS.successSurfaceSoft }}>
                  <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: THEME_COLORS.successStrong }}>
                    <CheckCircle2 size={22} color="white" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-emerald-800">30-Day Trial Activated</Text>
                    <Text className="text-[11px] text-emerald-700 leading-relaxed mt-1">Full access to all features. Invite up to 100 members and set up your local market.</Text>
                  </View>
                </View>

                {error && <View className="border border-red-100 rounded-2xl p-4" style={{ backgroundColor: THEME_COLORS.errorSurface }}><Text className="text-xs text-red-600 font-medium">{error}</Text></View>}

                <View className="flex-row gap-3">
                  {!userProfile?.profileCompleted && (
                    <TouchableOpacity onPress={() => { setStep('profile'); setError(null); }} className="py-4 px-5 rounded-2xl items-center justify-center" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}>
                      <ArrowLeft size={20} color={THEME_COLORS.neutralTextEmphasis} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={async () => {
                      if (communityName.trim()) {
                        try {
                          const communityId = await saveCommunityDraft();
                          if (communityId) {
                            setStep('coverage');
                          }
                        } catch (err: any) {
                          setError(err?.response?.data?.error ?? err?.response?.data?.message ?? err.message ?? 'Failed to save community name.');
                        }
                      }
                    }}
                    disabled={!communityName.trim() || isSavingCommunity}
                    className="flex-1 py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg"
                    style={{ backgroundColor: THEME_COLORS.primary, opacity: !communityName.trim() || isSavingCommunity ? 0.5 : 1 }}
                  >
                    {isSavingCommunity ? <ActivityIndicator color="white" size="small" /> : <Text className="text-white font-bold text-base">Save & Continue</Text>}
                    {!isSavingCommunity ? <ArrowRight size={20} color="white" /> : null}
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ── STEP 3: COVERAGE ── */}
            {step === 'coverage' && (
              <View className="gap-5">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: THEME_COLORS.infoSurfaceSoft }}>
                    <MapPin size={24} color={THEME_COLORS.brandBlue} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-black text-primary">Coverage Area</Text>
                    <Text className="text-xs text-gray-500 font-medium">Step 2 of 5 — Where does your community operate?</Text>
                  </View>
                </View>

                <View
                  className="gap-1"
                  style={{ zIndex: LAYER_Z_INDEX.dropdown, elevation: LAYER_ELEVATION.dropdown }}
                >
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Area or Address</Text>
                  <View style={{ zIndex: LAYER_Z_INDEX.dropdown, elevation: LAYER_ELEVATION.dropdown }}>
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
                      textInputProps={{ placeholderTextColor: THEME_COLORS.neutralTextSoft }}
                      styles={{
                        container: { flex: 0 },
                        textInput: { backgroundColor: THEME_COLORS.neutralBgSofter, borderRadius: RADIUS.xxl, paddingHorizontal: SPACE.xl, paddingVertical: SPACE.lg, fontSize: TYPE_SCALE.md, fontWeight: 'bold', color: THEME_COLORS.primary, height: SPACE.s52, margin: SPACE.zero },
                        listView: { position: 'absolute', top: SPACE.s56, left: SPACE.zero, right: SPACE.zero, zIndex: 9999, ...createShadow(THEME_COLORS.black, 0, 0, 0.1, SPACE.sm, 9999), backgroundColor: THEME_COLORS.surface, borderRadius: RADIUS.xl, marginTop: SPACE.xxs },
                        row: { paddingVertical: SPACE.md, paddingHorizontal: SPACE.xl },
                        description: { fontSize: TYPE_SCALE.sm, color: THEME_COLORS.neutralTextEmphasis },
                      }}
                      enablePoweredByContainer={false}
                      keyboardShouldPersistTaps="handled"
                      listUnderlayColor="transparent"
                    />
                  </View>
                  <TouchableOpacity onPress={handleCoverageCurrentLocation} disabled={isFetchingCoverageLocation} className="flex-row items-center gap-2 py-3 px-4 bg-surface-container-low border border-outline-variant rounded-2xl mt-1">
                    {isFetchingCoverageLocation ? <ActivityIndicator size="small" color={THEME_COLORS.primary} /> : <MapPin size={16} color={THEME_COLORS.primary} />}
                    <Text className="text-xs font-bold text-primary">{isFetchingCoverageLocation ? 'Getting location...' : 'Use current location'}</Text>
                  </TouchableOpacity>
                  {coverageName ? (
                    <View className="flex-row items-center gap-1 mt-1 ml-1"><CheckCircle2 size={12} color={THEME_COLORS.success} /><Text className="text-[10px] text-emerald-600 font-medium">Location set: {coverageName}</Text></View>
                  ) : (
                    <View className="flex-row items-center gap-1 mt-1 ml-1"><AlertCircle size={12} color={THEME_COLORS.warningStrong} /><Text className="text-[10px] text-amber-600 font-medium">Search, use current location, or tap the map to drop a pin.</Text></View>
                  )}
                </View>

                {/* Draggable map */}
                <View className="gap-2">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Fine-tune Position</Text>
                  <Text className="text-[10px] text-gray-400 ml-1">Tap anywhere on the map to set coverage, or drag the pin to fine-tune.</Text>
                  <View style={{ height: SPACE.mapHeight, borderRadius: RADIUS.xxl, overflow: 'hidden', borderWidth: 1, borderColor: THEME_COLORS.neutralBorderSoft }}>
                    <MapView
                      {...defaultMapViewProps}
                      provider={Platform.OS === 'ios' ? undefined : 'google'}
                      style={{ flex: 1 }}
                      region={{
                        latitude: coverageLat || userProfile?.defaultLocation?.latitude || -26.2041,
                        longitude: coverageLng || userProfile?.defaultLocation?.longitude || 28.0473,
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
                        if (!coverageName) {
                          setCoverageName(`${e.nativeEvent.coordinate.latitude.toFixed(4)}, ${e.nativeEvent.coordinate.longitude.toFixed(4)}`);
                        }
                      }}
                    >
                      {coverageLat !== 0 && coverageLng !== 0 ? (
                        <>
                        <Circle
                          center={{ latitude: coverageLat, longitude: coverageLng }}
                          radius={coverageRadius * 1000}
                          strokeColor={THEME_COLORS.primary}
                          strokeWidth={2}
                          fillColor={THEME_COLORS.primaryTintSoft}
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
                          pinColor={THEME_COLORS.primary}
                        />
                        </>
                      ) : null}
                    </MapView>
                  </View>
                </View>

                {/* Radius */}
                <View className="gap-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400">Coverage Radius</Text>
                    <View className="px-3 py-1 rounded-full" style={{ backgroundColor: THEME_COLORS.primary }}>
                      <Text className="text-white text-xs font-black">{coverageRadius} km</Text>
                    </View>
                  </View>
                  <Slider
                    style={{ width: '100%', height: SPACE.s40 }}
                    minimumValue={1}
                    maximumValue={200}
                    step={1}
                    value={coverageRadius}
                    onValueChange={(val) => setCoverageRadius(Math.round(val))}
                    minimumTrackTintColor={THEME_COLORS.primary}
                    maximumTrackTintColor={THEME_COLORS.neutralBorderSoft}
                    thumbTintColor={THEME_COLORS.primary}
                  />
                  <View className="flex-row justify-between -mt-1">
                    <Text className="text-[9px] text-gray-400 font-medium">1 km</Text>
                    <Text className="text-[9px] text-gray-400 font-medium">200 km</Text>
                  </View>
                </View>

                {error && <View className="border border-red-100 rounded-2xl p-4" style={{ backgroundColor: THEME_COLORS.errorSurface }}><Text className="text-xs text-red-600 font-medium">{error}</Text></View>}

                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => { setStep('name'); setError(null); }} className="py-4 px-5 rounded-2xl items-center justify-center" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}>
                    <ArrowLeft size={20} color={THEME_COLORS.neutralTextEmphasis} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setError(null); setStep('categories'); }} className="flex-1 py-4 rounded-2xl flex-row items-center justify-center gap-2" style={{ backgroundColor: THEME_COLORS.primary }}>
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
                          style={{ backgroundColor: done ? THEME_COLORS.secondaryContainer : THEME_COLORS.neutralBorderSoft }}
                        />
                      );
                    })}
                  </View>
                  <Text className="text-[10px] text-gray-400 font-medium">Step 3 of 5</Text>
                </View>

                {/* Header */}
                <View className="gap-2">
                  <Text className="text-2xl font-black text-primary">What's in your neighbourhood?</Text>
                  <Text className="text-sm text-gray-500 leading-relaxed">
                    Pick the types of businesses your community members can discover and list in the marketplace. Tap a category to toggle it.
                  </Text>
                </View>

                {/* Counter + reset */}
                <View className="flex-row items-center justify-between px-1">
                  <View className="flex-row items-center gap-2">
                    <View className="px-3 py-1 rounded-full" style={{ backgroundColor: THEME_COLORS.primary }}>
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
                    <Text className="text-xs font-bold" style={{ color: THEME_COLORS.secondaryContainer }}>
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
                          backgroundColor: enabled ? THEME_COLORS.surface : THEME_COLORS.neutralBg,
                          borderWidth: 2,
                          borderColor: enabled ? THEME_COLORS.secondaryContainer : THEME_COLORS.neutralBorderSoft,
                          borderRadius: RADIUS.xxl,
                          paddingVertical: SPACE.lg,
                          paddingHorizontal: SPACE.sm,
                          alignItems: 'center',
                          gap: SPACE.xs,
                          position: 'relative',
                        }}
                      >
                        {/* Selected badge */}
                        {enabled && (
                          <View
                            style={{
                              position: 'absolute',
                              top: SPACE.sm,
                              right: SPACE.sm,
                              width: SPACE.xxl,
                              height: SPACE.xxl,
                              borderRadius: RADIUS.md,
                              backgroundColor: THEME_COLORS.secondaryContainer,
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <CheckCircle2 size={11} color={THEME_COLORS.white} />
                          </View>
                        )}
                        <Text style={{ fontSize: TYPE_SCALE.icon }}>{cat.icon}</Text>
                        <Text
                          className="text-[10px] font-bold text-center"
                          style={{ color: enabled ? THEME_COLORS.primary : THEME_COLORS.neutralTextSoft }}
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
                      backgroundColor: THEME_COLORS.primary,
                      borderWidth: 2,
                      borderColor: THEME_COLORS.primary,
                      borderRadius: RADIUS.xxl,
                      paddingVertical: SPACE.lg,
                      paddingHorizontal: SPACE.sm,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: SPACE.xs,
                    }}
                  >
                    <ArrowRight size={22} color={THEME_COLORS.white} />
                    <Text style={{ color: THEME_COLORS.white, fontSize: TYPE_SCALE.xs, fontWeight: FONT_WEIGHT.extrabold }}>Next</Text>
                  </TouchableOpacity>
                </View>

                {/* Back + reassurance */}
                <View className="flex-row items-center justify-between px-1">
                  <TouchableOpacity
                    onPress={() => { setStep('coverage'); setError(null); }}
                    className="flex-row items-center gap-1 py-1"
                  >
                    <ArrowLeft size={13} color={THEME_COLORS.neutralTextSoft} />
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
                  <Text className="text-2xl font-black text-primary">Discover Local Businesses</Text>
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
                    style={{ backgroundColor: coverageLat === 0 ? THEME_COLORS.neutralBorderSoft : THEME_COLORS.secondaryContainer, opacity: isDiscovering ? 0.7 : 1 }}
                  >
                    {isDiscovering
                      ? <><ActivityIndicator color={THEME_COLORS.white} size="small" /><Text className="text-white font-bold text-sm">Searching Google Maps…</Text></>
                      : <><Text style={{ fontSize: TYPE_SCALE.lg }}>🔍</Text><Text className="text-white font-bold text-sm">Search businesses near me</Text></>}
                  </TouchableOpacity>
                )}

                {coverageLat === 0 && (
                  <Text className="text-[11px] text-amber-600 text-center">Set your coverage area in Step 2 to enable discovery.</Text>
                )}

                {discoverError && (
                  <View className="border border-red-100 rounded-2xl p-3" style={{ backgroundColor: THEME_COLORS.errorSurface }}>
                    <Text className="text-xs text-red-600">{discoverError}</Text>
                  </View>
                )}

                {/* Discovered results */}
                {discoveredBusinesses.length > 0 && (
                  <View className="gap-3">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-xs font-black text-primary uppercase tracking-widest">
                        {discoveredBusinesses.length} businesses found
                      </Text>
                      <TouchableOpacity onPress={() => {
                        if (selectedDiscovered.size === discoveredBusinesses.length) {
                          setSelectedDiscovered(new Set());
                        } else {
                          setSelectedDiscovered(new Set(discoveredBusinesses.map((_, i) => i)));
                        }
                      }}>
                        <Text className="text-[11px] font-bold" style={{ color: THEME_COLORS.secondaryContainer }}>
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
                              gap: SPACE.md,
                              padding: SPACE.md,
                              borderRadius: RADIUS.xxl,
                              borderWidth: 2,
                              backgroundColor: selected ? THEME_COLORS.surface : THEME_COLORS.neutralBg,
                              borderColor: selected ? THEME_COLORS.secondaryContainer : THEME_COLORS.neutralBorderSoft,
                            }}
                          >
                            <View
                              style={{
                                width: SPACE.s22, height: SPACE.s22, borderRadius: RADIUS.lg,
                                backgroundColor: selected ? THEME_COLORS.secondaryContainer : THEME_COLORS.neutralBorderSoft,
                                alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              {selected && <CheckCircle2 size={13} color={THEME_COLORS.white} />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text className="text-sm font-bold text-primary" numberOfLines={1}>{biz.name}</Text>
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
                        className="py-3 px-4 rounded-2xl items-center justify-center"
                        style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}
                      >
                        <Text className="text-gray-500 text-xs font-bold">Clear</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleAddDiscovered}
                        disabled={selectedDiscovered.size === 0}
                        className="flex-1 py-3 rounded-2xl items-center justify-center"
                        style={{ backgroundColor: selectedDiscovered.size > 0 ? THEME_COLORS.primary : THEME_COLORS.neutralBorderSoft }}
                      >
                        <Text style={{ color: selectedDiscovered.size > 0 ? THEME_COLORS.white : THEME_COLORS.neutralTextSoft, fontWeight: 'bold', fontSize: TYPE_SCALE.sm }}>
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
                      <View key={i} className="flex-row items-center gap-3 p-3 rounded-xl border" style={{ backgroundColor: getCardSurfaceColor('subtle'), borderColor: getCardBorderColor('default') }}>
                        <Text className="flex-1 text-sm font-bold text-primary">{biz.name}</Text>
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
                      className="flex-1 px-4 py-3 rounded-2xl font-bold text-primary text-sm"
                      style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}
                      placeholderTextColor={THEME_COLORS.neutralTextSoft}
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
                      style={{ backgroundColor: newBizName.trim() ? THEME_COLORS.primary : THEME_COLORS.neutralBorderSoft }}
                    >
                      <Text style={{ color: newBizName.trim() ? THEME_COLORS.white : THEME_COLORS.neutralTextSoft, fontWeight: 'bold', fontSize: TYPE_SCALE.sm }}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => { setStep('categories'); setError(null); }} className="py-4 px-5 rounded-2xl items-center justify-center" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}>
                    <ArrowLeft size={20} color={THEME_COLORS.neutralTextEmphasis} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setError(null); setStep('rules'); }} className="flex-1 py-4 rounded-2xl flex-row items-center justify-center gap-2" style={{ backgroundColor: THEME_COLORS.primary }}>
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
                  <View className="w-12 h-12 rounded-2xl items-center justify-center" style={{ backgroundColor: THEME_COLORS.errorSurface }}>
                    <Text style={{ fontSize: TYPE_SCALE.xl }}>📋</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-black text-primary">Community Rules</Text>
                    <Text className="text-xs text-gray-500 font-medium">Step 5 of 5 — Set posting limits and access controls.</Text>
                  </View>
                </View>

                <View className="gap-4 p-4 rounded-2xl" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}>
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400">POSTING LIMITS</Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-primary">Max posts per user / day</Text>
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity onPress={() => setMaxPostsPerDay(v => String(Math.max(1, Number(v) - 1)))} className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: THEME_COLORS.neutralBgSofter }}><Text className="font-bold text-primary">−</Text></TouchableOpacity>
                      <Text className="text-base font-black text-primary w-6 text-center">{maxPostsPerDay}</Text>
                      <TouchableOpacity onPress={() => setMaxPostsPerDay(v => String(Math.min(20, Number(v) + 1)))} className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: THEME_COLORS.neutralBgSofter }}><Text className="font-bold text-primary">+</Text></TouchableOpacity>
                    </View>
                  </View>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-primary">Max listings per week</Text>
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity onPress={() => setMaxListingsPerWeek(v => String(Math.max(1, Number(v) - 1)))} className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: THEME_COLORS.neutralBgSofter }}><Text className="font-bold text-primary">−</Text></TouchableOpacity>
                      <Text className="text-base font-black text-primary w-6 text-center">{maxListingsPerWeek}</Text>
                      <TouchableOpacity onPress={() => setMaxListingsPerWeek(v => String(Math.min(20, Number(v) + 1)))} className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: THEME_COLORS.neutralBgSofter }}><Text className="font-bold text-primary">+</Text></TouchableOpacity>
                    </View>
                  </View>
                </View>

                <View className="gap-3 p-4 rounded-2xl" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}>
                  <Text className="text-[10px] font-black uppercase tracking-widest text-gray-400">ACCESS CONTROL</Text>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-medium text-primary flex-1 pr-4">Require business verification</Text>
                    <TouchableOpacity
                      onPress={() => setRequireVerification(v => !v)}
                      className="w-12 h-7 rounded-full items-center justify-center"
                      style={{ backgroundColor: requireVerification ? THEME_COLORS.primary : THEME_COLORS.neutralBorderSoft }}
                    >
                      <View className="w-5 h-5 rounded-full" style={{ alignSelf: requireVerification ? 'flex-end' : 'flex-start', margin: SPACE.xxxs, backgroundColor: THEME_COLORS.surface }} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Summary of all steps */}
                <View className="bg-successSurface border border-emerald-100 rounded-2xl p-4 gap-2">
                  <Text className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Ready to Launch</Text>
                  <Text className="text-xs text-gray-600">📍 <Text className="font-bold">{communityName}</Text></Text>
                  {coverageName ? <Text className="text-xs text-gray-600">🗺️ {coverageName} · {coverageRadius}km radius</Text> : null}
                  <Text className="text-xs text-gray-600">🏷️ {selectedCategories.length} of {BUSINESS_CATEGORIES.length} categories enabled</Text>
                  {pendingBusinesses.length > 0 ? <Text className="text-xs text-gray-600">🏪 {pendingBusinesses.length} business{pendingBusinesses.length > 1 ? 'es' : ''} added</Text> : null}
                </View>

                {error && <View className="border border-red-100 rounded-2xl p-4" style={{ backgroundColor: THEME_COLORS.errorSurface }}><Text className="text-xs text-red-600 font-medium">{error}</Text></View>}

                <View className="flex-row gap-3">
                  <TouchableOpacity onPress={() => { setStep('businesses'); setError(null); }} className="py-4 px-5 rounded-2xl items-center justify-center" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }}>
                    <ArrowLeft size={20} color={THEME_COLORS.neutralTextEmphasis} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setShowConfirmation(true)}
                    disabled={isSubmitting}
                    className="flex-1 py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg"
                    style={{ backgroundColor: THEME_COLORS.primary, opacity: isSubmitting ? 0.6 : 1 }}
                  >
                    {isSubmitting
                      ? <ActivityIndicator color="white" size="small" />
                      : <><Text className="text-white font-bold text-base">Create & Launch</Text><ArrowRight size={20} color="white" /></>}
                  </TouchableOpacity>
                </View>
                <Text className="text-[10px] text-gray-400 text-center leading-relaxed">
                  By creating a community you agree to our{' '}
                  <Text className="text-primary">Terms & Conditions</Text>.
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
