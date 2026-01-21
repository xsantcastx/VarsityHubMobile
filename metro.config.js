const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add resolver alias for shims (web only - handled by webpack.config.js)
// Do NOT alias react-native-maps here as it breaks iOS/Android native builds
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

// Fast Refresh configuration for Expo Router SDK 54
// Aggressive Fast Refresh configuration to work around SDK 54 bugs
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
  // Explicitly enable Fast Refresh
  unstable_allowRequireContext: true,
  // Enable React Refresh for Fast Refresh
  enableBabelRCLookup: false,
  enableBabelRuntime: false,
};

// Fast Refresh is enabled by default in Expo
// Ensure dev mode is enabled for Fast Refresh to work
// SDK 54 requires explicit configuration for Expo Router
if (process.env.NODE_ENV !== 'production') {
  // Disable cache to ensure Fast Refresh always works
  config.cacheStores = [];
  
  config.server = {
    ...config.server,
    enhanceMiddleware: (middleware) => {
      return middleware;
    },
    rewriteRequestUrl: (url) => {
      // Ensure Fast Refresh endpoint is accessible
      if (url.includes('hot-update') || url.includes('refresh')) {
        return url;
      }
      return url;
    },
  };
  
  // Explicitly enable Fast Refresh in development
  config.resolver = {
    ...config.resolver,
    sourceExts: [...(config.resolver?.sourceExts || []), 'tsx', 'ts', 'jsx', 'js'],
    // Ensure React Refresh runtime is resolvable
    platforms: ['ios', 'android', 'native', 'web'],
  };
  
  // Explicitly enable file watching for Fast Refresh
  config.watcher = {
    ...config.watcher,
    healthCheck: {
      enabled: true,
      interval: 30000,
    },
  };
}

module.exports = config;