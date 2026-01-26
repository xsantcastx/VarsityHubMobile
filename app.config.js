/**
 * Dynamic Expo Configuration
 *
 * This file wraps app.json and injects sensitive values from environment variables.
 * API keys should be set via:
 *   - Local: .env file (not committed)
 *   - EAS Build: EAS Secrets in dashboard
 */

const baseConfig = require('./app.json');

module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || '';

  return {
    ...config,
    ...baseConfig.expo,
    ios: {
      ...baseConfig.expo.ios,
      config: {
        ...baseConfig.expo.ios?.config,
        googleMapsApiKey,
      },
    },
    android: {
      ...baseConfig.expo.android,
      config: {
        ...baseConfig.expo.android?.config,
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },
    },
    extra: {
      ...baseConfig.expo.extra,
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: googleMapsApiKey,
    },
  };
};
