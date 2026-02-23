const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const path = require('path');

// Use Sentry Metro config for Debug IDs (required for source map symbolication)
const config = getSentryExpoConfig(__dirname);

// Fast Refresh - REAL-TIME UPDATES CONFIGURATION
config.transformer = {
  ...config.transformer,
  experimentalImportSupport: false, // REQUIRED for Fast Refresh
  inlineRequires: true,
  unstable_allowRequireContext: true,
  // Enable Fast Refresh explicitly
  enableBabelRCLookup: true,
  enableBabelRuntime: true,
};

// Ensure Fast Refresh is not disabled by resolver - merge properly
config.resolver = {
  ...config.resolver,
  sourceExts: [...(config.resolver.sourceExts || []), 'jsx', 'js', 'ts', 'tsx'],
  // Add resolver alias for shims
  alias: {
    ...config.resolver.alias,
    'is-arrayish': path.resolve(__dirname, 'shims/is-arrayish.js'),
    'react-native-maps': path.resolve(__dirname, 'shims/react-native-maps.js'),
  },
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

// Server configuration for localhost development with fast refresh
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return middleware;
  },
};

// Explicitly enable Fast Refresh (should be enabled by default, but ensure it)
config.transformer.unstable_allowRequireContext = true;

// Cache configuration for faster rebuilds
config.cacheStores = config.cacheStores || [];

module.exports = config;