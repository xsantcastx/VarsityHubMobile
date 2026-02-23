/**
 * Map provider utilities for react-native-maps
 * Used by EventMap and ReachMapPreview for Google/Apple Maps on native
 */

import { Platform } from 'react-native';

/**
 * Returns the map provider for MapView.
 * - Native: 'google' (uses Google Maps when API key is configured in app.json)
 * - Web: undefined (map is shimmed out)
 */
export function getMapProvider(): 'google' | undefined {
  if (Platform.OS === 'web') return undefined;
  return 'google';
}
