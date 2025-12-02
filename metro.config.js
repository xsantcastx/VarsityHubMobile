const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add resolver alias for shims
config.resolver.alias = {
  ...config.resolver.alias,
  'is-arrayish': path.resolve(__dirname, 'shims/is-arrayish.js'),
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

module.exports = config;