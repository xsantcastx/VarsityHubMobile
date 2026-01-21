import Constants from 'expo-constants';
import { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';

type MapProvider = typeof PROVIDER_GOOGLE;

/**
 * Returns the appropriate map provider based on the build type.
 * For dev-client builds, always use Google Maps if API key is available.
 * For Expo Go, fall back to Apple Maps (PROVIDER_DEFAULT).
 */
export function getMapProvider(): MapProvider {
  // Check if we have a Google Maps API key configured
  const hasGoogleMapsKey = Constants.expoConfig?.ios?.config?.googleMapsApiKey || 
                          Constants.expoConfig?.android?.config?.googleMaps?.apiKey ||
                          process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  
  // For dev-client builds (appOwnership is null), use Google Maps if key is available
  // Otherwise fall back to default (Apple Maps on iOS, Google Maps on Android)
  if (!Constants.appOwnership && hasGoogleMapsKey) {
    return PROVIDER_GOOGLE;
  }
  
  // Fall back to default provider (Apple Maps on iOS, Google Maps on Android)
  return PROVIDER_DEFAULT;
}
