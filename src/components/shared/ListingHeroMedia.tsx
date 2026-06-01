import React from 'react';
import { View, Text, Image } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { defaultMapViewProps } from '../../lib/mapViewProps';
import { resolveMediaUrl } from '../../lib/config';
import { THEME_COLORS } from '../../theme/colors';

interface ListingHeroMediaProps {
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  imageAspectClassName?: string;
  imageHeight?: number;
  showLocationBadge?: boolean;
  soldStateLabel?: string | null;
}

export function ListingHeroMedia({
  imageUrl,
  latitude,
  longitude,
  imageAspectClassName = 'aspect-[4/3]',
  imageHeight,
  showLocationBadge = false,
  soldStateLabel,
}: ListingHeroMediaProps) {
  const hasImage = typeof imageUrl === 'string' && imageUrl.trim().length > 0;
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  if (hasImage) {
    return (
      <View
        className={`w-full ${imageHeight ? '' : imageAspectClassName} overflow-hidden`}
        style={imageHeight ? { height: imageHeight } : undefined}
      >
        <Image source={{ uri: resolveMediaUrl(imageUrl) }} className="w-full h-full" resizeMode="cover" />
        <View
          className="absolute inset-0"
          style={{ backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_15 }}
          pointerEvents="none"
        />
        {soldStateLabel ? (
          <View
            className="absolute top-4 right-4 px-4 py-1.5 rounded-full"
            style={{ backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_75 }}
          >
            <Text
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: THEME_COLORS.white }}
            >
              {soldStateLabel}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (hasCoordinates) {
    return (
      <View
        className={`w-full ${imageHeight ? '' : imageAspectClassName} overflow-hidden`}
        style={imageHeight ? { height: imageHeight } : undefined}
      >
        <MapView
          {...defaultMapViewProps}
          style={{ flex: 1 }}
          initialRegion={{
            latitude: Number(latitude),
            longitude: Number(longitude),
            latitudeDelta: 0.08,
            longitudeDelta: 0.08,
          }}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
          pointerEvents="none"
        >
          <Marker
            coordinate={{ latitude: Number(latitude), longitude: Number(longitude) }}
            pinColor={THEME_COLORS.secondaryContainer}
          />
        </MapView>

        {showLocationBadge ? (
          <View
            className="absolute top-4 left-4 px-3 py-1 rounded-full flex-row items-center gap-1"
            style={{ backgroundColor: THEME_COLORS.primary }}
          >
            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: THEME_COLORS.surfaceContainerLow }} />
            <Text
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: THEME_COLORS.white }}
            >
              Location Preview
            </Text>
          </View>
        ) : null}

        {soldStateLabel ? (
          <View
            className="absolute top-4 right-4 px-4 py-1.5 rounded-full"
            style={{ backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_75 }}
          >
            <Text
              className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: THEME_COLORS.white }}
            >
              {soldStateLabel}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View className={`w-full ${imageHeight ? '' : imageAspectClassName} overflow-hidden`} style={imageHeight ? { height: imageHeight } : undefined}>
      <MapView
        {...defaultMapViewProps}
        style={{ flex: 1 }}
        initialRegion={{
          latitude: 0,
          longitude: 0,
          latitudeDelta: 0.3,
          longitudeDelta: 0.3,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        pointerEvents="none"
      >
        <Marker
          coordinate={{ latitude: 0, longitude: 0 }}
          pinColor={THEME_COLORS.secondaryContainer}
        />
      </MapView>

      <View
        className="absolute inset-0 items-center justify-center"
        style={{ backgroundColor: THEME_COLORS.alias_rgba_0_0_0_0_15 }}
        pointerEvents="none"
      >
        <Text className="text-[10px] font-bold uppercase tracking-widest" style={{ color: THEME_COLORS.white }}>
          Location Pending
        </Text>
      </View>
    </View>
  );
}
