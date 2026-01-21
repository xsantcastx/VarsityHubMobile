module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'], // Includes react-refresh/plugin by default
    plugins: [
      ['module-resolver', {
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        alias: {
          // Place more specific aliases first to avoid '@' greedy matches
          '@/components': './components',
          '@/constants': './constants',
          '@/hooks': './hooks',
          '@/context': './context',
          '@/api': './api',
          '@/utils': './utils',
          '@/config': './config',
          '@/ui': './components/ui',
          // Shim problematic nested deps on Windows
          'is-arrayish': './shims/is-arrayish',
        }
      }],
      // Reanimated must be listed last (after react-refresh)
      'react-native-reanimated/plugin',
    ],
    // Ensure Fast Refresh is enabled in development
    env: {
      development: {
        plugins: [
          // react-refresh is included by babel-preset-expo automatically
        ],
      },
    },
  };
};
