import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '../../constants';
import MapView, { Marker, MapPressEvent, Region } from 'react-native-maps';
import { useAuth } from '../../context/AuthContext';
import { useCommunity } from '../../context/CommunityContext';

interface LocationSettingsProps {
  isEditing?: boolean;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  onLocationChange?: (location: { name: string; latitude: number; longitude: number }) => void;
}

export const LocationSettings: React.FC<LocationSettingsProps> = ({
  isEditing = false,
  locationName,
  latitude,
  longitude,
  onLocationChange,
}) => {
  const { userProfile, updateUserProfile } = useAuth();
  const { currentCommunity } = useCommunity();

  const [localLocationName, setLocalLocationName] = useState(
    locationName || userProfile?.defaultLocation?.name || ''
  );
  const [localLatitude, setLocalLatitude] = useState(
    latitude ?? userProfile?.defaultLocation?.latitude ?? 0
  );
  const [localLongitude, setLocalLongitude] = useState(
    longitude ?? userProfile?.defaultLocation?.longitude ?? 0
  );
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: latitude ?? userProfile?.defaultLocation?.latitude ?? -33.9249,
    longitude: longitude ?? userProfile?.defaultLocation?.longitude ?? 18.4241,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    if (!isEditing && userProfile?.defaultLocation) {
      setLocalLocationName(userProfile.defaultLocation.name);
      setLocalLatitude(userProfile.defaultLocation.latitude);
      setLocalLongitude(userProfile.defaultLocation.longitude);
    }
  }, [userProfile?.defaultLocation, isEditing]);

  useEffect(() => {
    if (isEditing) {
      if (locationName !== undefined) setLocalLocationName(locationName);
      if (latitude !== undefined) setLocalLatitude(latitude);
      if (longitude !== undefined) setLocalLongitude(longitude);
      if (latitude !== undefined && longitude !== undefined) {
        setMapRegion((prev) => ({
          ...prev,
          latitude,
          longitude,
        }));
      }
    }
  }, [locationName, latitude, longitude, isEditing]);

  const reverseGeocodeName = async (lat: number, lng: number) => {
    try {
      const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      const place = geo[0];
      return place
        ? [place.name, place.street, place.subregion, place.city, place.region]
            .filter(Boolean)
            .join(', ')
        : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  };

  const applyLocationSelection = async (lat: number, lng: number, preferredName?: string) => {
    const name = preferredName || (await reverseGeocodeName(lat, lng));
    setLocalLatitude(lat);
    setLocalLongitude(lng);
    setLocalLocationName(name);
    setMapRegion((prev) => ({ ...prev, latitude: lat, longitude: lng }));

    const update = { name, latitude: lat, longitude: lng };
    onLocationChange?.(update);
    if (!isEditing) {
      updateUserProfile({ address: name, defaultLocation: update });
    }
  };

  const handleGetCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to use this feature.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      await applyLocationSelection(lat, lng);
    } catch (err) {
      Alert.alert('Error', 'Failed to get current location.');
    } finally {
      setIsGettingLocation(false);
    }
  };

  const handleLatChange = (val: string) => {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      setLocalLatitude(parsed);
      setMapRegion((prev) => ({ ...prev, latitude: parsed }));
      onLocationChange?.({ name: localLocationName, latitude: parsed, longitude: localLongitude });
    }
  };

  const handleLngChange = (val: string) => {
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      setLocalLongitude(parsed);
      setMapRegion((prev) => ({ ...prev, longitude: parsed }));
      onLocationChange?.({ name: localLocationName, latitude: localLatitude, longitude: parsed });
    }
  };

  const handleMapSelect = async (lat: number, lng: number) => {
    await applyLocationSelection(lat, lng);
  };

  return (
    <View className="pt-4 border-t border-gray-100 gap-y-4">
      {/* Header with sharing toggle */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-surface-container-low items-center justify-center">
            <MapPin size={18} color="#0d3d47" />
          </View>
          <View>
            <Text className="text-sm font-bold text-gray-900">Default Location</Text>
            <Text className="text-[10px] text-gray-500">Auto-attach to new posts and businesses</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <Text className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            {userProfile?.locationSharingEnabled ? 'On' : 'Off'}
          </Text>
          <Switch
            value={!!userProfile?.locationSharingEnabled}
            onValueChange={(val) => updateUserProfile({ locationSharingEnabled: val })}
            trackColor={{ false: '#d1d5db', true: '#0d3d47' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* Current location display */}
      <View className="bg-gray-50 rounded-xl p-3 flex-row items-center gap-2">
        <MapPin size={14} color="#6b7280" />
        <Text className="text-sm text-gray-700 flex-1" numberOfLines={2}>
          {localLocationName || 'No location set'}
        </Text>
      </View>

      {/* Coordinates */}
      {localLatitude !== 0 && localLongitude !== 0 && (
        <View className="flex-row gap-3">
          <View className="flex-1 gap-y-1">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Latitude</Text>
            <TextInput
              value={String(localLatitude)}
              onChangeText={handleLatChange}
              keyboardType="numeric"
              className="bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-800"
            />
          </View>
          <View className="flex-1 gap-y-1">
            <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Longitude</Text>
            <TextInput
              value={String(localLongitude)}
              onChangeText={handleLngChange}
              keyboardType="numeric"
              className="bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-800"
            />
          </View>
        </View>
      )}

      {/* Search by address */}
      <View className="gap-y-2 z-50" style={{ position: 'relative', zIndex: 9999, elevation: 999 }}>
        <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Search Address</Text>
        <View className="flex-row gap-2 relative z-50" style={{ zIndex: 9999, elevation: 999 }}>
          <GooglePlacesAutocomplete
            placeholder="123 Community St, Suburb"
            fetchDetails
            // @ts-ignore
            scrollEnabled={false}
            onPress={(data, details) => {
              const name = data.description;
              const lat = details?.geometry?.location?.lat ?? localLatitude;
              const lng = details?.geometry?.location?.lng ?? localLongitude;
              applyLocationSelection(lat, lng, name);
            }}
            query={{ key: GOOGLE_PLACES_API_KEY, language: 'en' }}
            textInputProps={{
              placeholderTextColor: '#9ca3af',
              returnKeyType: 'search',
            }}
            styles={{
              container: { flex: 1 },
              textInput: {
                backgroundColor: '#f3f4f6',
                borderRadius: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                fontSize: 14,
                color: '#1f2937',
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
      </View>

      {isEditing && (
        <View className="gap-y-2">
          <Text className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            Refine With Pin
          </Text>
          <View style={{ borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
            <MapView
              style={{ width: '100%', height: 220 }}
              initialRegion={mapRegion}
              region={mapRegion}
              onPress={(event: MapPressEvent) => {
                const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
                handleMapSelect(lat, lng);
              }}
            >
              <Marker
                coordinate={{ latitude: localLatitude || mapRegion.latitude, longitude: localLongitude || mapRegion.longitude }}
                draggable
                onDragEnd={(event) => {
                  const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
                  handleMapSelect(lat, lng);
                }}
              />
            </MapView>
          </View>
          <Text className="text-[10px] text-gray-500 italic px-1">
            Search first, then tap or drag the pin to fine-tune your exact address.
          </Text>
        </View>
      )}

      {/* Use current location button */}
      <TouchableOpacity
        onPress={handleGetCurrentLocation}
        disabled={isGettingLocation}
        className="flex-row items-center justify-center gap-2 py-3 bg-surface-container-low rounded-xl border border-outline-variant"
      >
        {isGettingLocation ? (
          <ActivityIndicator size="small" color="#0d3d47" />
        ) : (
          <MapPin size={16} color="#0d3d47" />
        )}
        <Text className="text-sm font-bold text-primary">
          {isGettingLocation ? 'Getting Location...' : 'Use Current Location'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};
