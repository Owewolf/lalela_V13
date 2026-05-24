import React, { useEffect, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import MapView, { MapPressEvent, Marker, Region } from 'react-native-maps';
import { MapPin } from 'lucide-react-native';
import { defaultMapViewProps } from '../../lib/mapViewProps';
import { GOOGLE_PLACES_API_KEY } from '../../constants';

export type LocationSource = 'places' | 'current_location' | 'map' | 'manual';

export interface LocationValue {
  address: string;
  latitude?: number;
  longitude?: number;
}

interface LocationPickerSectionProps {
  value: LocationValue;
  onChange: (next: LocationValue, source: LocationSource) => void;
  hint?: string;
  showSearch?: boolean;
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

const reverseGeocodeName = async (lat: number, lng: number): Promise<string> => {
  try {
    const geo = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    const place = geo[0];
    if (place) {
      const parts = [place.name, place.street, place.subregion, place.city, place.region].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
    }
  } catch {
    // Geocoding unavailable — fall back to coordinates
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

const LocationPickerSection: React.FC<LocationPickerSectionProps> = ({
  value,
  onChange,
  hint = 'Search first, then tap or drag the pin to set the exact location.',
  showSearch = true,
}) => {
  const [latText, setLatText] = useState(
    value.latitude !== undefined && Number.isFinite(value.latitude) ? String(value.latitude) : ''
  );
  const [lngText, setLngText] = useState(
    value.longitude !== undefined && Number.isFinite(value.longitude) ? String(value.longitude) : ''
  );

  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: value.latitude && Number.isFinite(value.latitude) ? value.latitude : -33.9249,
    longitude: value.longitude && Number.isFinite(value.longitude) ? value.longitude : 18.4241,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  // Keep local text + map region in sync with value changes from parent
  useEffect(() => {
    const nextLat = value.latitude !== undefined && Number.isFinite(value.latitude) ? String(value.latitude) : '';
    const nextLng = value.longitude !== undefined && Number.isFinite(value.longitude) ? String(value.longitude) : '';
    setLatText(nextLat);
    setLngText(nextLng);
    if (
      value.latitude !== undefined && Number.isFinite(value.latitude) &&
      value.longitude !== undefined && Number.isFinite(value.longitude)
    ) {
      setMapRegion((prev) => ({ ...prev, latitude: value.latitude!, longitude: value.longitude! }));
    }
  }, [value.latitude, value.longitude]);

  const applyLocation = async (lat: number, lng: number, source: LocationSource, preferredName?: string) => {
    const resolvedName = preferredName || (await reverseGeocodeName(lat, lng));
    setMapRegion((prev) => ({ ...prev, latitude: lat, longitude: lng }));
    onChange({ address: resolvedName, latitude: lat, longitude: lng }, source);
  };

  const handleUseCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required.');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({});
      await applyLocation(loc.coords.latitude, loc.coords.longitude, 'current_location');
    } catch {
      Alert.alert('Location error', 'Could not get your current location.');
    }
  };

  const handleLatitudeChange = (text: string) => {
    setLatText(text);
    const parsed = Number(text);
    const parsedLng = Number(lngText);
    if (Number.isFinite(parsed) && Number.isFinite(parsedLng)) {
      setMapRegion((prev) => ({ ...prev, latitude: parsed, longitude: parsedLng }));
      onChange({ address: value.address, latitude: parsed, longitude: parsedLng }, 'manual');
    }
  };

  const handleLongitudeChange = (text: string) => {
    setLngText(text);
    const parsed = Number(text);
    const parsedLat = Number(latText);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsed)) {
      setMapRegion((prev) => ({ ...prev, latitude: parsedLat, longitude: parsed }));
      onChange({ address: value.address, latitude: parsedLat, longitude: parsed }, 'manual');
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
    void applyLocation(lat, lng, 'map');
  };

  const hasValidCoords =
    value.latitude !== undefined && Number.isFinite(value.latitude) && value.latitude !== 0 &&
    value.longitude !== undefined && Number.isFinite(value.longitude) && value.longitude !== 0;

  return (
    <View style={{ gap: 16 }}>
      <View>
        <Text style={labelStyle}>Address</Text>
        <TextInput
          value={value.address}
          onChangeText={(text) => onChange({ ...value, address: text }, 'manual')}
          placeholder="Street address or area name"
          placeholderTextColor="#9ca3af"
          style={inputStyle}
        />
      </View>

      {showSearch && (
        <View style={{ gap: 10, zIndex: 9999, elevation: 999 }}>
          <Text style={labelStyle}>Search Address</Text>
          <GooglePlacesAutocomplete
            placeholder="Search with Google"
            fetchDetails
            // @ts-ignore - older typings
            scrollEnabled={false}
            onPress={(data, details) => {
              const lat = details?.geometry?.location?.lat;
              const lng = details?.geometry?.location?.lng;
              if (typeof lat !== 'number' || typeof lng !== 'number') return;
              void applyLocation(lat, lng, 'places', data.description);
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
      )}

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={labelStyle}>Location Coordinates</Text>
          <TouchableOpacity
            onPress={handleUseCurrentLocation}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <MapPin size={14} color="#0d3d47" />
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0d3d47' }}>Use current location</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TextInput
            value={latText}
            onChangeText={handleLatitudeChange}
            keyboardType="numeric"
            placeholder="Latitude"
            placeholderTextColor="#9ca3af"
            style={[inputStyle, { flex: 1 }]}
          />
          <TextInput
            value={lngText}
            onChangeText={handleLongitudeChange}
            keyboardType="numeric"
            placeholder="Longitude"
            placeholderTextColor="#9ca3af"
            style={[inputStyle, { flex: 1 }]}
          />
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={labelStyle}>Refine With Pin</Text>
        <View style={{ height: 240, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)' }}>
          <MapView
            {...defaultMapViewProps}
            style={{ flex: 1 }}
            region={mapRegion}
            onPress={handleMapPress}
          >
            {hasValidCoords && (
              <Marker
                coordinate={{ latitude: value.latitude!, longitude: value.longitude! }}
                draggable
                onDragEnd={(event) => {
                  const { latitude: lat, longitude: lng } = event.nativeEvent.coordinate;
                  void applyLocation(lat, lng, 'map');
                }}
              />
            )}
          </MapView>
        </View>
        <Text style={{ fontSize: 11, color: '#6b7280' }}>{hint}</Text>
      </View>
    </View>
  );
};

export default LocationPickerSection;
