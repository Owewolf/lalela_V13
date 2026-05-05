import { Platform } from 'react-native';

const webGoogleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_WEB_API_KEY ?? '';

export const defaultMapViewProps = {
  provider: (Platform.OS === 'ios' ? undefined : 'google') as any,
  mapToolbarEnabled: true, // Enables the directions/maps toolbar when tapping markers
  ...(Platform.OS === 'web' && webGoogleMapsApiKey
    ? {
        googleMapsApiKey: webGoogleMapsApiKey,
        options: {
          mapId: 'DEMO_MAP_ID',
          disableDefaultUI: true,
          zoomControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          rotateControl: false,
        },
      }
    : {}),
};