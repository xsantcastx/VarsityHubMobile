import Constants from 'expo-constants';
import { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

type MapProvider = typeof PROVIDER_GOOGLE;

/**
 * Returns Google Maps provider for all builds.
 * Google Maps API key is configured in app.json for iOS and Android.
 */
export function getMapProvider(): MapProvider {
  // Always use Google Maps - API key is configured in app.json
  return PROVIDER_GOOGLE;
}
