const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Enable Fast Refresh (should be enabled by default in Expo)
config.transformer = {
  ...config.transformer,
  // Fast Refresh is enabled by default, but we ensure it's not disabled
  minifierConfig: {
    ...config.transformer.minifierConfig,
  },
};

// Add resolver alias for shims
config.resolver.alias = {
  ...config.resolver.alias,
  'is-arrayish': path.resolve(__dirname, 'shims/is-arrayish.js'),
  'react-native-maps': path.resolve(__dirname, 'shims/react-native-maps.js'),
};

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