import { PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import { Platform } from 'react-native';

/**
 * Returns the appropriate map provider for the current platform.
 * - Android: Google Maps (required; API key injected via Expo config env)
 * - iOS: Apple Maps (PROVIDER_DEFAULT = null) — avoids requiring the
 *   Google Maps iOS SDK in development / Expo Go builds where it is
 *   not bundled. Switch back to PROVIDER_GOOGLE for production iOS
 *   builds once the Google Maps iOS SDK pod is confirmed installed.
 */
export function getMapProvider() {
  return Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;
}
