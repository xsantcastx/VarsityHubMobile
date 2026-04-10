module.exports = function (api) {
  api.cache(true);

  const isProduction = process.env.NODE_ENV === 'production';

  return {
    presets: ['babel-preset-expo'], // Includes react-refresh/plugin by default
    plugins: [
      [
        'module-resolver',
        {
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
          alias: {
            // Place more specific aliases first to avoid '@' greedy matches
            '@/components': './components',
            '@/constants': './src/constants',
            '@/hooks': './src/hooks',
            '@/context': './src/context',
            '@/api': './src/api',
            '@/utils': './src/utils',
            '@/config': './src/config',
            '@/features': './src/features',
            '@/services': './src/services',
            '@/theme': './src/theme',
            '@/types': './src/types',
            '@/ui': './components/ui',
            // Shim problematic nested deps on Windows
            'is-arrayish': './shims/is-arrayish',
          },
        },
      ],
      // Remove console.* calls in production builds
      ...(isProduction ? [['transform-remove-console', { exclude: ['error', 'warn'] }]] : []),
      // CRITICAL: Reanimated plugin MUST be last for Fast Refresh to work
      'react-native-reanimated/plugin',
    ],
  };
};
