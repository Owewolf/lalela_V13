import 'dotenv/config';

export default ({ config }) => {
  return {
    ...config,
    plugins: [
      ...(config.plugins ?? []),
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
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: process.env.IOS_GOOGLE_MAPS_API_KEY,
      },
    },
  };
};
