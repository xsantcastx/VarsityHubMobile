const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync(env, argv);
  
  // Add alias for react-native-maps to use our shim on web
  config.resolve.alias = {
    ...config.resolve.alias,
    'react-native-maps': path.resolve(__dirname, 'shims/react-native-maps.js'),
  };
  
  return config;
};
