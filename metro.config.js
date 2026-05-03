const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true,
});

// Alias native-only modules to web stubs for the web bundler
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Fix: react-native-webrtc imports event-target-shim/index which is not listed
  // in the package's exports field (only "." is exposed). Map it to the actual file.
  if (moduleName === 'event-target-shim/index') {
    return {
      type: 'sourceFile',
      filePath: require('path').resolve(
        __dirname,
        'node_modules/react-native-webrtc/node_modules/event-target-shim/index.js'
      ),
    };
  }

  if (platform === 'web') {
    if (moduleName === 'react-native-maps') {
      return context.resolveRequest(context, '@teovilla/react-native-web-maps', platform);
    }
    if (moduleName === 'react-native-webrtc') {
      return {
        type: 'sourceFile',
        filePath: require('path').resolve(__dirname, 'src/mocks/react-native-webrtc.web.js'),
      };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
