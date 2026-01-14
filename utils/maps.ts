import Constants from 'expo-constants';
import { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

type MapProvider = typeof PROVIDER_GOOGLE;

/**
 * Ensures Expo Go/dev builds fall back to Apple Maps while
 * standalone/dev-client builds continue to use Google Maps.
 */
export function getMapProvider(): MapProvider {
  // SDK 54: appOwnership is 'expo' | null (no more 'standalone')
  return !Constants.appOwnership
    ? PROVIDER_GOOGLE
    : PROVIDER_DEFAULT;
}
