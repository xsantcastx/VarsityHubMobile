module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        alias: {
          // Place more specific aliases first to avoid '@' greedy matches
          '@/components': './components',
          '@/constants': './constants',
          '@/hooks': './hooks',
          '@': './src',
          // Shim problematic nested deps on Windows
          'is-arrayish': './shims/is-arrayish',
        }
      }],
      // Reanimated must be listed last
      'react-native-reanimated/plugin',
    ],
  };
};
