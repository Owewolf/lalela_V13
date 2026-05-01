import { SafeAreaView } from "react-native-safe-area-context";
import React, { useState, useEffect, useRef } from 'react';
import { GooglePlacesAutocomplete, GooglePlacesAutocompleteRef } from 'react-native-google-places-autocomplete';
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
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { GOOGLE_PLACES_API_KEY } from '../../constants';

// ─── Types ────────────────────────────────────────────────────────────────────

type OnboardingStep = 'profile' | 'community';

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
  // Synthetic `user` for backward-compat with the rest of this component
  const user = userProfile ? { uid: userProfile.id, email: userProfile.email, displayName: userProfile.name, photoURL: userProfile.profile_image ?? null } : null;
  const router = useRouter();

  const [step, setStep] = useState<OnboardingStep>('profile');

  useEffect(() => {
    if (userProfile?.profile_completed) {
      setStep('community');
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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const isProfileValid = fullName.trim().length > 0 && locationName.trim().length > 0 && locationLat !== 0;

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

  const handleSubmit = async () => {
    if (!communityName.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
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

      const profileData: Record<string, any> = {
        name: resolvedName,
        first_name: resolvedFirstName,
        last_name: resolvedLastName,
        email: resolvedEmail,
        phone: resolvedPhone,
        mobile_number: resolvedPhone,
        address: locationName,
        profile_image: resolvedImage,
        profile_completed: true,
        community_created: true,
        // onboarding_completed is set to true only after all 5 guided admin setup steps
      };

      if (locationName && locationLat && locationLng) {
        profileData.defaultLocation = { name: locationName, latitude: locationLat, longitude: locationLng };
      }

      // Update profile via REST
      await updateUserProfile(profileData);

      // Create/find TRIAL community via REST
      const { data: community } = await api.post('/communities', {
        name: communityName.trim(),
      });

      if (community?.id) {
        await updateUserProfile({ last_community_id: community.id } as any);
      }

      await Promise.all([
        AsyncStorage.removeItem('pending_onboarding_name'),
        AsyncStorage.removeItem('pending_onboarding_email'),
        AsyncStorage.removeItem('pending_onboarding_phone'),
        AsyncStorage.removeItem('pending_onboarding_contact'),
        AsyncStorage.removeItem('pending_onboarding_mode'),
        AsyncStorage.removeItem('pending_onboarding_invite'),
      ]);

      // Navigation to /admin?guided=true is handled by AppGuard once
      // userProfile.profile_completed updates via onSnapshot — avoids race condition.
    } catch (err: any) {
      console.error('Onboarding Error:', err);
      setError(err?.response?.data?.message ?? err.message ?? 'An error occurred');
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

  const steps = userProfile?.profile_completed
    ? [{ key: 'community' as OnboardingStep, label: 'Create Community' }]
    : [
        { key: 'profile' as OnboardingStep, label: 'Your Profile' },
        { key: 'community' as OnboardingStep, label: 'Create Community' },
      ];
  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Header */}
          <View className="px-6 pt-6 pb-4 flex-row items-center justify-between border-b border-gray-100">
            <View className="flex-row items-center gap-2">
              <View className="w-9 h-9 bg-[#0d3d47] rounded-xl items-center justify-center">
                <Text className="text-white font-black text-base">L</Text>
              </View>
              <Text className="text-xl font-black text-[#0d3d47] tracking-tight">lalela</Text>
            </View>
            <Text className="text-xs font-black uppercase tracking-widest text-gray-400">New Community</Text>
          </View>

          {/* Step indicator */}
          <View className="flex-row items-center justify-center gap-2 px-6 py-5">
            {steps.map((s, i) => (
              <React.Fragment key={s.key}>
                <View className="items-center gap-1">
                  <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: step === s.key ? '#0d3d47' : currentStepIndex > i ? '#10b981' : '#f3f4f6' }}>
                    {currentStepIndex > i ? (
                      <CheckCircle2 size={16} color="white" />
                    ) : (
                      <Text className="text-xs font-bold" style={{ color: step === s.key ? 'white' : '#9ca3af' }}>{i + 1}</Text>
                    )}
                  </View>
                  <Text className="text-[9px] font-bold uppercase tracking-wider" style={{ color: step === s.key ? '#0d3d47' : '#9ca3af' }}>{s.label}</Text>
                </View>
                {i < steps.length - 1 && (
                  <View className="h-0.5 w-8 rounded-full mb-4" style={{ backgroundColor: currentStepIndex > i ? '#10b981' : '#f3f4f6' }} />
                )}
              </React.Fragment>
            ))}
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

                <TouchableOpacity onPress={() => { if (isProfileValid) { setError(null); setStep('community'); } }} disabled={!isProfileValid} className="py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg" style={{ backgroundColor: isProfileValid ? '#0d3d47' : '#d1d5db' }}>
                  <Text className="text-white font-bold text-base">Continue</Text>
                  <ArrowRight size={20} color="white" />
                </TouchableOpacity>
              </View>
            )}

            {/* ── STEP 2: COMMUNITY ── */}
            {step === 'community' && (
              <View className="gap-5">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 bg-orange-50 rounded-2xl items-center justify-center">
                    <Sparkles size={24} color="#f97316" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-black text-[#0d3d47]">Start Your Community</Text>
                    <Text className="text-xs text-gray-500 font-medium">Name your community to get started.</Text>
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
                  <TouchableOpacity onPress={() => { if (communityName.trim()) setShowConfirmation(true); }} disabled={isSubmitting || !communityName.trim()} className="flex-1 py-4 rounded-2xl flex-row items-center justify-center gap-2 shadow-lg" style={{ backgroundColor: '#0d3d47', opacity: (isSubmitting || !communityName.trim()) ? 0.5 : 1 }}>
                    {isSubmitting ? <ActivityIndicator color="white" size="small" /> : <><Text className="text-white font-bold text-base">Create & Launch</Text><ArrowRight size={20} color="white" /></>}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={showConfirmation}
        title="Confirm Community Launch"
        message={`Confirm you want to create and launch "${communityName.trim()}".`}
        confirmLabel="Yes, create community"
        onConfirm={handleSubmit}
        onCancel={() => setShowConfirmation(false)}
      />
    </SafeAreaView>
  );
};

export default OnboardingCreate;
