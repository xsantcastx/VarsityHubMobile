module.exports = function (api) {
  api.cache(true);
  
  return {
    presets: [
      ['babel-preset-expo', {
        // Explicitly enable Fast Refresh
        jsxRuntime: 'automatic',
      }],
    ],
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
      // NOTE: react-native-reanimated/plugin is automatically included by babel-preset-expo in SDK 54
      // Explicitly listing it causes conflicts that break Fast Refresh
      // If you need to customize it, configure it via babel-preset-expo options
    ].filter(Boolean), // Remove false/undefined plugins
  };
};
