const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add resolver alias for shims
config.resolver.alias = {
  ...config.resolver.alias,
  'is-arrayish': path.resolve(__dirname, 'shims/is-arrayish.js'),
};

// Ensure shims directory is included in the watch folders
config.watchFolders = [
  ...config.watchFolders,
  path.resolve(__dirname, 'shims'),
];

module.exports = config;