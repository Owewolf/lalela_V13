import React, { useEffect, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import MapView, { MapPressEvent, Marker, Region } from 'react-native-maps';
import { MapPin } from 'lucide-react-native';
import { defaultMapViewProps } from '../../lib/mapViewProps';
import { GOOGLE_PLACES_API_KEY } from '../../constants';
import { THEME_COLORS } from '../../theme/colors';
import { LAYER_ELEVATION, LAYER_Z_INDEX } from '../../theme/layers';
import { createShadow } from '../../theme/shadows';

const TYPE_SCALE = {
  xs: 11,
  sm: 12,
  md: 14,
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
  xs: 6,
  sm: 8,
  md: 10,
  lg: 12,
  xl: 14,
  xxl: 16,
  sectionGap: 16,
  mapHeight: 240,
  placesTop: 50,
};
const RADIUS = {
  md: 12,
  lg: 14,
};
const LETTER_SPACING = {
  wide: 1,
};

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
  borderColor: THEME_COLORS.overlayBorder,
  borderRadius: RADIUS.lg,
  paddingHorizontal: SPACE.xl,
  paddingVertical: SPACE.lg,
  backgroundColor: THEME_COLORS.surface,
  fontSize: TYPE_SCALE.md,
  color: THEME_COLORS.onSurface,
} as const;

const labelStyle = {
  fontSize: TYPE_SCALE.xs,
  fontWeight: FONT_WEIGHT.bold,
  color: THEME_COLORS.neutralTextDefault,
  textTransform: 'uppercase' as const,
  letterSpacing: LETTER_SPACING.wide,
  marginBottom: SPACE.sm,
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
    <View style={{ gap: SPACE.sectionGap }}>
      <View>
        <Text style={labelStyle}>Address</Text>
        <TextInput
          value={value.address}
          onChangeText={(text) => onChange({ ...value, address: text }, 'manual')}
          placeholder="Street address or area name"
          placeholderTextColor={THEME_COLORS.neutralTextSoft}
          style={inputStyle}
        />
      </View>

      {showSearch && (
        <View
          style={{
            gap: SPACE.md,
            zIndex: LAYER_Z_INDEX.placesOverlay,
            elevation: LAYER_ELEVATION.placesOverlay,
          }}
        >
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
              placeholderTextColor: THEME_COLORS.neutralTextSoft,
              returnKeyType: 'search',
            }}
            styles={{
              container: { flex: 1 },
              textInput: {
                backgroundColor: THEME_COLORS.surface,
                borderRadius: RADIUS.lg,
                borderWidth: 1,
                borderColor: THEME_COLORS.overlayBorder,
                paddingHorizontal: SPACE.xl,
                paddingVertical: SPACE.lg,
                fontSize: TYPE_SCALE.md,
                color: THEME_COLORS.onSurface,
                marginBottom: SPACE.zero,
              },
              listView: {
                position: 'absolute',
                top: SPACE.placesTop,
                width: '100%',
                backgroundColor: THEME_COLORS.surface,
                borderRadius: RADIUS.md,
                ...createShadow(THEME_COLORS.black, 0, 0, 0.1, 5, 5),
                zIndex: 9999,
              },
              row: { paddingVertical: SPACE.lg, paddingHorizontal: SPACE.xxl },
              description: { fontSize: TYPE_SCALE.md, color: THEME_COLORS.neutralTextEmphasis },
            }}
            enablePoweredByContainer={false}
            keyboardShouldPersistTaps="handled"
          />
        </View>
      )}

      <View style={{ gap: SPACE.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={labelStyle}>Location Coordinates</Text>
          <TouchableOpacity
            onPress={handleUseCurrentLocation}
            style={{ flexDirection: 'row', alignItems: 'center', gap: SPACE.xs }}
          >
            <MapPin size={14} color={THEME_COLORS.primary} />
            <Text style={{ fontSize: TYPE_SCALE.sm, fontWeight: FONT_WEIGHT.bold, color: THEME_COLORS.primary }}>Use current location</Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: SPACE.md }}>
          <TextInput
            value={latText}
            onChangeText={handleLatitudeChange}
            keyboardType="numeric"
            placeholder="Latitude"
            placeholderTextColor={THEME_COLORS.neutralTextSoft}
            style={[inputStyle, { flex: 1 }]}
          />
          <TextInput
            value={lngText}
            onChangeText={handleLongitudeChange}
            keyboardType="numeric"
            placeholder="Longitude"
            placeholderTextColor={THEME_COLORS.neutralTextSoft}
            style={[inputStyle, { flex: 1 }]}
          />
        </View>
      </View>

      <View style={{ gap: SPACE.sm }}>
        <Text style={labelStyle}>Refine With Pin</Text>
        <View style={{ height: SPACE.mapHeight, borderRadius: RADIUS.lg, overflow: 'hidden', borderWidth: 1, borderColor: THEME_COLORS.overlayBorder }}>
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
        <Text style={{ fontSize: TYPE_SCALE.xs, color: THEME_COLORS.neutralTextSubtle }}>{hint}</Text>
      </View>
    </View>
  );
};

export default LocationPickerSection;
