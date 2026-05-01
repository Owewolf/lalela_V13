import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import MapView, { MapPressEvent, Marker, Region } from 'react-native-maps';
import { Camera, ImagePlus, Mail, MapPin, Phone, X } from 'lucide-react-native';
import { BUSINESS_CATEGORIES, GOOGLE_PLACES_API_KEY } from '../../constants';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { uploadImage } from '../../lib/uploadImage';
import { Community, UserBusiness } from '../../types';

interface CreateBusinessFormProps {
  visible: boolean;
  business?: UserBusiness | null;
  communities: Community[];
  currentCommunity?: Community | null;
  onClose: () => void;
}

const inputStyle = {
  borderWidth: 1,
  borderColor: 'rgba(0,0,0,0.08)',
  borderRadius: 14,
  paddingHorizontal: 14,
  paddingVertical: 12,
  backgroundColor: '#ffffff',
  fontSize: 14,
  color: '#1a1a1a',
} as const;

const labelStyle = {
  fontSize: 11,
  fontWeight: '700' as const,
  color: '#4b5563',
  textTransform: 'uppercase' as const,
  letterSpacing: 1,
  marginBottom: 8,
} as const;

const CreateBusinessForm: React.FC<CreateBusinessFormProps> = ({
  visible,
  business,
  communities,
  currentCommunity,
  onClose,
}) => {
  const { userProfile } = useAuth();
  const { addUserBusiness, updateUserBusiness } = useCommunity();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [image, setImage] = useState<string | undefined>(undefined);
  const [communityIds, setCommunityIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: -33.9249,
    longitude: 18.4241,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const defaultLocation = useMemo(() => {
    if (business) {
      return {
        address: business.address,
        latitude: String(business.latitude),
        longitude: String(business.longitude),
      };
    }

    if (userProfile?.defaultLocation) {
      return {
        address: userProfile.defaultLocation.name,
        latitude: String(userProfile.defaultLocation.latitude),
        longitude: String(userProfile.defaultLocation.longitude),
      };
    }

    if (currentCommunity?.coverageArea) {
      return {
        address: currentCommunity.coverageArea.location_name,
        latitude: String(currentCommunity.coverageArea.latitude),
        longitude: String(currentCommunity.coverageArea.longitude),
      };
    }

    return {
      address: '',
      latitude: '',
      longitude: '',
    };
  }, [business, currentCommunity?.coverageArea, userProfile?.defaultLocation]);

  useEffect(() => {
    if (!visible) return;

    setName(business?.name ?? '');
    setCategory(business?.category ?? '');
    setDescription(business?.description ?? '');
    setAddress(defaultLocation.address);
    setLatitude(defaultLocation.latitude);
    setLongitude(defaultLocation.longitude);
    setContactPhone(business?.contactPhone ?? '');
    setContactEmail(business?.contactEmail ?? '');
    setImage(business?.image);
    setCommunityIds(
      business?.communityIds?.length
        ? business.communityIds
        : currentCommunity?.id
          ? [currentCommunity.id]
          : communities[0]?.id
            ? [communities[0].id]
            : []
    );
    setIsActive((business?.status ?? 'ACTIVE') === 'ACTIVE');

    const parsedLat = Number(defaultLocation.latitude);
    const parsedLng = Number(defaultLocation.longitude);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      setMapRegion((prev) => ({
        ...prev,
        latitude: parsedLat,
        longitude: parsedLng,
      }));
    }
  }, [business, communities, currentCommunity?.id, defaultLocation, visible]);

  const reverseGeocodeName = async (lat: number, lng: number) => {
    const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const place = geo[0];
    return place
      ? [place.name, place.street, place.subregion, place.city, place.region]
          .filter(Boolean)
          .join(', ')
      : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  };

  const applyBusinessLocation = async (lat: number, lng: number, preferredName?: string) => {
    const resolvedName = preferredName || (await reverseGeocodeName(lat, lng));
    setAddress(resolvedName);
    setLatitude(String(lat));
    setLongitude(String(lng));
    setMapRegion((prev) => ({ ...prev, latitude: lat, longitude: lng }));
  };

  const toggleCommunity = (communityId: string) => {
    setCommunityIds((currentIds) =>
      currentIds.includes(communityId)
        ? currentIds.filter((id) => id !== communityId)
        : [...currentIds, communityId]
    );
  };

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      await applyBusinessLocation(loc.coords.latitude, loc.coords.longitude);
    } catch {
      Alert.alert('Location error', 'Could not get your current location.');
    }
  };

  const handleLatitudeChange = (value: string) => {
    setLatitude(value);
    const parsed = Number(value);
    const parsedLng = Number(longitude);
    if (Number.isFinite(parsed) && Number.isFinite(parsedLng)) {
      setMapRegion((prev) => ({ ...prev, latitude: parsed, longitude: parsedLng }));
    }
  };

  const handleLongitudeChange = (value: string) => {
    setLongitude(value);
    const parsed = Number(value);
    const parsedLat = Number(latitude);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsed)) {
      setMapRegion((prev) => ({ ...prev, latitude: parsedLat, longitude: parsed }));
    }
  };

  const handleMapSelection = async (lat: number, lng: number) => {
    try {
      await applyBusinessLocation(lat, lng);
    } catch {
      Alert.alert('Location error', 'Could not resolve the selected map location.');
    }
  };

  const handlePickImage = async () => {
    if (!userProfile) {
      Alert.alert('Sign in required', 'You need to be signed in to upload an image.');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Media library access is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setIsUploadingImage(true);
    try {
      const uploadedUrl = await uploadImage(result.assets[0].uri, 'businesses', userProfile!.id, image);
      setImage(uploadedUrl);
    } catch {
      Alert.alert('Upload failed', 'Image upload failed. Please try again.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!userProfile) {
      Alert.alert('Sign in required', 'You need to be signed in to manage businesses.');
      return;
    }

    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (!name.trim() || !category || !description.trim() || !address.trim()) {
      Alert.alert('Missing details', 'Please complete the business name, category, description, and address.');
      return;
    }

    if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude)) {
      Alert.alert('Invalid location', 'Please provide valid latitude and longitude values.');
      return;
    }

    if (communityIds.length === 0) {
      Alert.alert('Select a community', 'Choose at least one community where this business should appear.');
      return;
    }

    const payload = {
      name: name.trim(),
      category,
      description: description.trim(),
      address: address.trim(),
      latitude: parsedLatitude,
      longitude: parsedLongitude,
      contactPhone: contactPhone.trim() || undefined,
      contactEmail: contactEmail.trim() || undefined,
      image,
      owner_id: business?.owner_id ?? userProfile.id,
      communityIds,
      status: isActive ? 'ACTIVE' as const : 'INACTIVE' as const,
      subcategory: business?.subcategory,
      charityId: business?.charityId,
      charityPercentage: business?.charityPercentage,
    };

    setIsSubmitting(true);
    try {
      if (business) {
        await updateUserBusiness({ ...business, ...payload });
      } else {
        await addUserBusiness(payload);
      }
      onClose();
    } catch {
      Alert.alert('Save failed', 'We could not save this business. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.38)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ maxHeight: '92%', backgroundColor: '#f9fafb', borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#0d3d47' }}>
                  {business ? 'Edit Business' : 'Create Business'}
                </Text>
                <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                  Add a business profile to your communities.
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#ffffff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
                <X size={18} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 18, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
              <View style={{ gap: 10 }}>
                <Text style={labelStyle}>Business Image</Text>
                <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8} style={{ borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: '#ffffff', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ width: 72, height: 72, borderRadius: 18, backgroundColor: '#ecfeff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {image ? (
                      <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <ImagePlus size={24} color="#0d3d47" />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>
                      {image ? 'Replace image' : 'Upload business image'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                      Photos help neighbors recognize your business faster.
                    </Text>
                  </View>
                  {isUploadingImage ? <ActivityIndicator color="#0d3d47" /> : <Camera size={18} color="#0d3d47" />}
                </TouchableOpacity>
              </View>

              <View>
                <Text style={labelStyle}>Business Name</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Example: Sipho's Bakery" placeholderTextColor="#9ca3af" style={inputStyle} />
              </View>

              <View style={{ gap: 10 }}>
                <Text style={labelStyle}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {BUSINESS_CATEGORIES.map((item) => {
                    const selected = item.label === category;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setCategory(item.label)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: selected ? '#0d3d47' : 'rgba(0,0,0,0.08)',
                          backgroundColor: selected ? 'rgba(13,61,71,0.08)' : '#ffffff',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <Text style={{ fontSize: 16 }}>{item.icon}</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? '#0d3d47' : '#374151' }}>
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text style={labelStyle}>Description</Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Tell neighbors what you offer."
                  placeholderTextColor="#9ca3af"
                  style={[inputStyle, { minHeight: 112, textAlignVertical: 'top' }]}
                  multiline
                />
              </View>

              <View>
                <Text style={labelStyle}>Address</Text>
                <TextInput value={address} onChangeText={setAddress} placeholder="Street address or area name" placeholderTextColor="#9ca3af" style={inputStyle} />
              </View>

              <View style={{ gap: 10, zIndex: 9999, elevation: 999 }}>
                <Text style={labelStyle}>Search Address</Text>
                <GooglePlacesAutocomplete
                  placeholder="Search with Google"
                  fetchDetails
                  // @ts-ignore
                  scrollEnabled={false}
                  onPress={(data, details) => {
                    const lat = details?.geometry?.location?.lat;
                    const lng = details?.geometry?.location?.lng;
                    if (typeof lat !== 'number' || typeof lng !== 'number') return;
                    applyBusinessLocation(lat, lng, data.description);
                  }}
                  query={{ key: GOOGLE_PLACES_API_KEY, language: 'en' }}
                  textInputProps={{
                    placeholderTextColor: '#9ca3af',
                    returnKeyType: 'search',
                  }}
                  styles={{
                    container: { flex: 1 },
                    textInput: {
                      backgroundColor: '#ffffff',
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: 'rgba(0,0,0,0.08)',
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      fontSize: 14,
                      color: '#1a1a1a',
                      marginBottom: 0,
                    },
                    listView: {
                      position: 'absolute',
                      top: 50,
                      width: '100%',
                      backgroundColor: '#fff',
                      borderRadius: 12,
                      elevation: 5,
                      shadowColor: '#000',
                      shadowOpacity: 0.1,
                      shadowRadius: 5,
                      zIndex: 9999,
                    },
                    row: { paddingVertical: 12, paddingHorizontal: 16 },
                    description: { fontSize: 14, color: '#374151' },
                  }}
                  enablePoweredByContainer={false}
                  keyboardShouldPersistTaps="handled"
                />
              </View>

              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={labelStyle}>Location Coordinates</Text>
                  <TouchableOpacity onPress={handleUseCurrentLocation} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MapPin size={14} color="#0d3d47" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0d3d47' }}>Use current location</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput value={latitude} onChangeText={handleLatitudeChange} keyboardType="numeric" placeholder="Latitude" placeholderTextColor="#9ca3af" style={[inputStyle, { flex: 1 }]} />
                  <TextInput value={longitude} onChangeText={handleLongitudeChange} keyboardType="numeric" placeholder="Longitude" placeholderTextColor="#9ca3af" style={[inputStyle, { flex: 1 }]} />
                </View>
              </View>

              <View style={{ gap: 8 }}>
                <Text style={labelStyle}>Refine With Pin</Text>
                <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
                  <MapView
                    style={{ width: '100%', height: 220 }}
                    region={mapRegion}
                    onPress={(event: MapPressEvent) => {
                      const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
                      handleMapSelection(lat, lng);
                    }}
                  >
                    <Marker
                      coordinate={{ latitude: Number(latitude) || mapRegion.latitude, longitude: Number(longitude) || mapRegion.longitude }}
                      draggable
                      onDragEnd={(event) => {
                        const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
                        handleMapSelection(lat, lng);
                      }}
                    />
                  </MapView>
                </View>
                <Text style={{ fontSize: 11, color: '#6b7280' }}>
                  Search first, then tap or drag the pin to set the exact business location.
                </Text>
              </View>

              <View style={{ gap: 10 }}>
                <Text style={labelStyle}>Contact Details</Text>
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: '#ffffff', paddingHorizontal: 14 }}>
                    <Phone size={16} color="#6b7280" />
                    <TextInput value={contactPhone} onChangeText={setContactPhone} placeholder="Phone number" placeholderTextColor="#9ca3af" style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: '#1a1a1a' }} keyboardType="phone-pad" />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)', backgroundColor: '#ffffff', paddingHorizontal: 14 }}>
                    <Mail size={16} color="#6b7280" />
                    <TextInput value={contactEmail} onChangeText={setContactEmail} placeholder="Email address" placeholderTextColor="#9ca3af" style={{ flex: 1, paddingVertical: 12, fontSize: 14, color: '#1a1a1a' }} keyboardType="email-address" autoCapitalize="none" />
                  </View>
                </View>
              </View>

              <View style={{ gap: 10 }}>
                <Text style={labelStyle}>Visible In Communities</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {communities.map((community) => {
                    const selected = communityIds.includes(community.id);
                    return (
                      <TouchableOpacity
                        key={community.id}
                        onPress={() => toggleCommunity(community.id)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: selected ? '#10b981' : 'rgba(0,0,0,0.08)',
                          backgroundColor: selected ? 'rgba(16,185,129,0.08)' : '#ffffff',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? '#047857' : '#374151' }}>
                          {community.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#1a1a1a' }}>Business is active</Text>
                  <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    Inactive businesses stay saved but won’t appear publicly.
                  </Text>
                </View>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: '#d1d5db', true: '#0d3d47' }} thumbColor="#ffffff" />
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting || isUploadingImage}
                style={{
                  backgroundColor: isSubmitting || isUploadingImage ? '#9ca3af' : '#0d3d47',
                  paddingVertical: 15,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 10,
                }}
              >
                {isSubmitting ? <ActivityIndicator color="#ffffff" /> : null}
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>
                  {business ? 'Save Changes' : 'Create Business'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default CreateBusinessForm;