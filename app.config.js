import dotenv from 'dotenv';

dotenv.config({ path: '.env', override: false });

if (process.env.NODE_ENV === 'production') {
  dotenv.config({ path: '.env.production', override: true });
}

export default ({ config }) => {
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
      'expo-font',
      '@config-plugins/react-native-webrtc',
    ],
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          apiKey: process.env.ANDROID_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    // iOS intentionally uses Apple MapKit (react-native-maps default when provider is undefined).
    // No Google Maps iOS SDK key is needed.
  };
};
