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
import { Camera, ImagePlus, Mail, Phone, X } from 'lucide-react-native';
import { BUSINESS_CATEGORIES } from '../../constants';
import { useCommunity } from '../../context/CommunityContext';
import { useAuth } from '../../context/AuthContext';
import { uploadImage } from '../../lib/uploadImage';
import LocationPickerSection from '../shared/LocationPickerSection';
import { Community, UserBusiness } from '../../types';
import { THEME_COLORS } from '../../theme/colors';

const TYPE_SCALE = {
  base: 11,
  body: 12,
  lg: 13,
  xl: 14,
  xxl: 16,
  title: 18,
};

const FONT_WEIGHT = {
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
} as const;
const SPACE = {
  xs: 4,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  s15: 15,
  s16: 16,
  s18: 18,
  s20: 20,
  s36: 36,
  s72: 72,
};
const RADIUS = {
  lg: 14,
  xl: 16,
  xxl: 18,
  pill: 20,
};
const LETTER_SPACING = {
  normal: 1,
};

interface CreateBusinessFormProps {
  visible: boolean;
  business?: UserBusiness | null;
  communities: Community[];
  currentCommunity?: Community | null;
  onClose: () => void;
}

const inputStyle = {
  borderWidth: 1,
  borderColor: THEME_COLORS.overlayBorder,
  borderRadius: RADIUS.lg,
  paddingHorizontal: SPACE.xl,
  paddingVertical: SPACE.lg,
  backgroundColor: THEME_COLORS.white,
  fontSize: TYPE_SCALE.xl,
  color: THEME_COLORS.onSurface,
} as const;

const labelStyle = {
  fontSize: TYPE_SCALE.base,
  fontWeight: FONT_WEIGHT.bold,
  color: THEME_COLORS.neutralTextDefault,
  textTransform: 'uppercase' as const,
  letterSpacing: LETTER_SPACING.normal,
  marginBottom: SPACE.sm,
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

  const defaultLocation = useMemo(() => {
    if (business) {
      return {
        address: business.address,
        latitude: String(business.latitude),
        longitude: String(business.longitude),
      };
    }

    if (userProfile?.locationSharing && userProfile?.defaultLocation) {
      return {
        address: userProfile.defaultLocation.name,
        latitude: String(userProfile.defaultLocation.latitude),
        longitude: String(userProfile.defaultLocation.longitude),
      };
    }

    if (currentCommunity?.coverageArea) {
      return {
        address: currentCommunity.coverageArea.locationName,
        latitude: String(currentCommunity.coverageArea.latitude),
        longitude: String(currentCommunity.coverageArea.longitude),
      };
    }

    return {
      address: '',
      latitude: '',
      longitude: '',
    };
  }, [business, currentCommunity?.coverageArea, userProfile?.defaultLocation, userProfile?.locationSharing]);

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
  }, [business, communities, currentCommunity?.id, defaultLocation, visible]);

  const toggleCommunity = (communityId: string) => {
    setCommunityIds((currentIds) =>
      currentIds.includes(communityId)
        ? currentIds.filter((id) => id !== communityId)
        : [...currentIds, communityId]
    );
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
      mediaTypes: ['images'],
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
      ownerId: business?.ownerId ?? userProfile.id,
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
      <View style={{ flex: 1, backgroundColor: THEME_COLORS.alias_rgba_15_23_42_0_38, justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={{ maxHeight: '92%', backgroundColor: THEME_COLORS.neutralBg, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: 'hidden' }}>
            <View style={{ paddingHorizontal: SPACE.s20, paddingTop: SPACE.s16, paddingBottom: SPACE.lg, borderBottomWidth: 1, borderBottomColor: THEME_COLORS.overlayBorderSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ fontSize: TYPE_SCALE.title, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.primary }}>
                  {business ? 'Edit Business' : 'Create Business'}
                </Text>
                <Text style={{ fontSize: TYPE_SCALE.body, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xs }}>
                  Add a business profile to your communities.
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={{ width: SPACE.s36, height: SPACE.s36, borderRadius: RADIUS.xxl, backgroundColor: THEME_COLORS.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft }}>
                <X size={18} color={THEME_COLORS.neutralTextSubtle} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: SPACE.s20, gap: SPACE.s18, paddingBottom: SPACE.s36 }} keyboardShouldPersistTaps="handled">
              <View style={{ gap: SPACE.lg }}>
                <Text style={labelStyle}>Business Image</Text>
                <TouchableOpacity onPress={handlePickImage} activeOpacity={0.8} style={{ borderRadius: RADIUS.pill, borderWidth: 1, borderColor: THEME_COLORS.overlayBorder, backgroundColor: THEME_COLORS.white, padding: SPACE.xl, flexDirection: 'row', alignItems: 'center', gap: SPACE.xl }}>
                  <View style={{ width: SPACE.s72, height: SPACE.s72, borderRadius: RADIUS.xxl, backgroundColor: THEME_COLORS.infoSurfaceAlt, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                    {image ? (
                      <Image source={{ uri: image }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                    ) : (
                      <ImagePlus size={24} color={THEME_COLORS.primary} />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>
                      {image ? 'Replace image' : 'Upload business image'}
                    </Text>
                    <Text style={{ fontSize: TYPE_SCALE.body, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xs }}>
                      Photos help neighbors recognize your business faster.
                    </Text>
                  </View>
                  {isUploadingImage ? <ActivityIndicator color={THEME_COLORS.primary} /> : <Camera size={18} color={THEME_COLORS.primary} />}
                </TouchableOpacity>
              </View>

              <View>
                <Text style={labelStyle}>Business Name</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Example: Sipho's Bakery" placeholderTextColor={THEME_COLORS.neutralTextSoft} style={inputStyle} />
              </View>

              <View style={{ gap: SPACE.lg }}>
                <Text style={labelStyle}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.lg }}>
                  {BUSINESS_CATEGORIES.map((item) => {
                    const selected = item.label === category;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        onPress={() => setCategory(item.label)}
                        style={{
                          paddingHorizontal: SPACE.xl,
                          paddingVertical: SPACE.lg,
                          borderRadius: RADIUS.lg,
                          borderWidth: 1,
                          borderColor: selected ? THEME_COLORS.primary : THEME_COLORS.overlayBorder,
                          backgroundColor: selected ? THEME_COLORS.primaryTintSoft : THEME_COLORS.white,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: SPACE.sm,
                        }}
                      >
                        <Text style={{ fontSize: TYPE_SCALE.xxl }}>{item.icon}</Text>
                        <Text style={{ fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.bold, color: selected ? THEME_COLORS.primary : THEME_COLORS.neutralTextEmphasis }}>
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
                  placeholderTextColor={THEME_COLORS.neutralTextSoft}
                  style={[inputStyle, { minHeight: 112, textAlignVertical: 'top' }]}
                  multiline
                />
              </View>

              <LocationPickerSection
                value={{
                  address,
                  latitude: latitude && Number.isFinite(Number(latitude)) && Number(latitude) !== 0 ? Number(latitude) : undefined,
                  longitude: longitude && Number.isFinite(Number(longitude)) && Number(longitude) !== 0 ? Number(longitude) : undefined,
                }}
                onChange={(next) => {
                  setAddress(next.address);
                  setLatitude(next.latitude !== undefined ? String(next.latitude) : '');
                  setLongitude(next.longitude !== undefined ? String(next.longitude) : '');
                }}
                hint="Search first, then tap or drag the pin to set the exact business location."
              />

              <View style={{ gap: SPACE.lg }}>
                <Text style={labelStyle}>Contact Details</Text>
                <View style={{ gap: SPACE.lg }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: THEME_COLORS.overlayBorder, backgroundColor: THEME_COLORS.white, paddingHorizontal: SPACE.xl }}>
                    <Phone size={16} color={THEME_COLORS.neutralTextSubtle} />
                    <TextInput value={contactPhone} onChangeText={setContactPhone} placeholder="Phone number" placeholderTextColor={THEME_COLORS.neutralTextSoft} style={{ flex: 1, paddingVertical: SPACE.lg, fontSize: TYPE_SCALE.xl, color: THEME_COLORS.onSurface }} keyboardType="phone-pad" />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: THEME_COLORS.overlayBorder, backgroundColor: THEME_COLORS.white, paddingHorizontal: SPACE.xl }}>
                    <Mail size={16} color={THEME_COLORS.neutralTextSubtle} />
                    <TextInput value={contactEmail} onChangeText={setContactEmail} placeholder="Email address" placeholderTextColor={THEME_COLORS.neutralTextSoft} style={{ flex: 1, paddingVertical: SPACE.lg, fontSize: TYPE_SCALE.xl, color: THEME_COLORS.onSurface }} keyboardType="email-address" autoCapitalize="none" />
                  </View>
                </View>
              </View>

              <View style={{ gap: SPACE.lg }}>
                <Text style={labelStyle}>Visible In Communities</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: SPACE.lg }}>
                  {communities.map((community) => {
                    const selected = communityIds.includes(community.id);
                    return (
                      <TouchableOpacity
                        key={community.id}
                        onPress={() => toggleCommunity(community.id)}
                        style={{
                          paddingHorizontal: SPACE.xl,
                          paddingVertical: SPACE.lg,
                          borderRadius: RADIUS.lg,
                          borderWidth: 1,
                          borderColor: selected ? THEME_COLORS.success : THEME_COLORS.overlayBorder,
                          backgroundColor: selected ? THEME_COLORS.alias_rgba_16_185_129_0_08 : THEME_COLORS.white,
                        }}
                      >
                        <Text style={{ fontSize: TYPE_SCALE.body, fontWeight: FONT_WEIGHT.bold, color: selected ? THEME_COLORS.aliasHex_047857 : THEME_COLORS.neutralTextEmphasis }}>
                          {community.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: SPACE.s16, borderRadius: RADIUS.xl, backgroundColor: THEME_COLORS.white, borderWidth: 1, borderColor: THEME_COLORS.overlayBorderSoft }}>
                <View>
                  <Text style={{ fontSize: TYPE_SCALE.xl, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.onSurface }}>Business is active</Text>
                  <Text style={{ fontSize: TYPE_SCALE.body, color: THEME_COLORS.neutralTextSubtle, marginTop: SPACE.xs }}>
                    Inactive businesses stay saved but won’t appear publicly.
                  </Text>
                </View>
                <Switch value={isActive} onValueChange={setIsActive} trackColor={{ false: THEME_COLORS.neutralBorderMuted, true: THEME_COLORS.primary }} thumbColor={THEME_COLORS.white} />
              </View>

              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isSubmitting || isUploadingImage}
                style={{
                  backgroundColor: isSubmitting || isUploadingImage ? THEME_COLORS.neutralTextSoft : THEME_COLORS.primary,
                  paddingVertical: SPACE.s15,
                  borderRadius: RADIUS.xl,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: SPACE.lg,
                }}
              >
                {isSubmitting ? <ActivityIndicator color={THEME_COLORS.white} /> : null}
                <Text style={{ fontSize: TYPE_SCALE.lg, fontWeight: FONT_WEIGHT.extrabold, color: THEME_COLORS.white, textTransform: 'uppercase', letterSpacing: LETTER_SPACING.normal }}>
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