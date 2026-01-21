import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Type-safe map provider values
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = 'default';
export type MapProvider = typeof PROVIDER_GOOGLE | typeof PROVIDER_DEFAULT;

/**
 * Returns the appropriate map provider based on platform and build type.
 * - Web: Returns default (not used, but safe fallback)
 * - iOS/Android dev builds: Google Maps
 * - iOS/Android Expo Go: Default (Apple Maps on iOS, Google Maps on Android)
 * 
 * Note: On web, maps are handled via platform-specific components (.web.tsx)
 */
export function getMapProvider(): MapProvider {
  // Web platform - maps handled via .web.tsx components
  if (Platform.OS === 'web') {
    return PROVIDER_DEFAULT;
  }

  // Import react-native-maps only on native platforms
  try {
    // SDK 54: appOwnership is 'expo' | null (no more 'standalone')
    // Dev builds (appOwnership === null) use Google Maps
    // Expo Go (appOwnership === 'expo') uses default provider
    return !Constants.appOwnership
      ? PROVIDER_GOOGLE
      : PROVIDER_DEFAULT;
  } catch (error) {
    // Fallback if react-native-maps not available
    console.warn('react-native-maps not available, using default provider');
    return PROVIDER_DEFAULT;
  }
}
