/**
 * Expo Config Plugin - Google Maps API Key Injection
 * 
 * Ensures Google Maps API key is properly injected into iOS Info.plist
 * for react-native-maps to work correctly.
 * 
 * Note: react-native-maps handles Google Maps SDK initialization automatically
 * when GMSApiKey is present in Info.plist, so we don't need to modify AppDelegate.
 */

const { withInfoPlist } = require('expo/config-plugins');

function withGoogleMaps(config) {
  return withInfoPlist(config, (config) => {
    // Prefer env-driven key and fall back to app config if present.
    const apiKey =
      process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      config.ios?.config?.googleMapsApiKey;
    
    if (apiKey) {
      // Add GMSApiKey to Info.plist for react-native-maps
      // This is required for Google Maps SDK to initialize
      // react-native-maps will automatically use this key
      config.modResults.GMSApiKey = apiKey;
      console.log('[withGoogleMaps] ✅ Injected Google Maps API key into Info.plist');
    } else {
      console.warn('[withGoogleMaps] ⚠️  Google Maps API key not found in config');
    }
    
    return config;
  });
}

module.exports = withGoogleMaps;
