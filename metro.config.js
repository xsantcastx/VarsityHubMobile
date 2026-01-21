const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable Fast Refresh explicitly for SDK 54
config.transformer = {
  ...config.transformer,
  // Fast Refresh is enabled by default, but we ensure it's explicitly enabled
  unstable_allowRequireContext: true,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false, // Disable to avoid Fast Refresh issues in SDK 54
      inlineRequires: true,
    },
  }),
};

// Add resolver alias for shims (web only - don't shim on native)
if (process.env.EXPO_PLATFORM === 'web') {
  config.resolver.alias = {
    ...config.resolver.alias,
    'is-arrayish': path.resolve(__dirname, 'shims/is-arrayish.js'),
    'react-native-maps': path.resolve(__dirname, 'shims/react-native-maps.js'),
  };
} else {
  // Native platforms - only shim is-arrayish, not react-native-maps
  config.resolver.alias = {
    ...config.resolver.alias,
    'is-arrayish': path.resolve(__dirname, 'shims/is-arrayish.js'),
  };
}

// Shim deprecated React Native modules to prevent errors
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  '@react-native-community/push-notification-ios': path.resolve(__dirname, 'shims/PushNotificationIOS.js'),
};

// Ensure shims directory is included in the watch folders
config.watchFolders = [
  ...config.watchFolders,
  path.resolve(__dirname, 'shims'),
];

// Ensure Fast Refresh watch options are optimal
config.watchFolders = [...new Set(config.watchFolders)]; // Remove duplicates

module.exports = config;