import { Alert, Linking } from 'react-native';

export type LocationDeniedContext =
  | 'stories'
  | 'posts'
  | 'map'
  | 'discovery'
  | 'onboarding'
  | 'general';

const MESSAGES: Record<LocationDeniedContext, { title: string; message: string }> = {
  stories: {
    title: 'Location Required',
    message:
      "Stories need your location to verify you're at the venue. Go to Settings > VarsityHub > Location and enable it.",
  },
  posts: {
    title: 'Location Access',
    message:
      'Location helps suggest nearby events when you post. Go to Settings > VarsityHub > Location to enable it.',
  },
  map: {
    title: 'Location for Map',
    message:
      'Your location shows you on the map and helps find nearby games. Enable it in Settings > VarsityHub > Location.',
  },
  discovery: {
    title: 'Location for Map View',
    message:
      'Enable location to see nearby events on the map. Go to Settings > VarsityHub > Location.',
  },
  onboarding: {
    title: 'Permission Denied',
    message:
      'Location helps find local games and events. Go to Settings > VarsityHub > Location to enable it.',
  },
  general: {
    title: 'Location Access',
    message:
      'Location is used for nearby events and maps. Enable it in Settings > VarsityHub > Location.',
  },
};

/**
 * Show a standardized alert when location permission is denied.
 * Explains why we need it and offers to open device Settings.
 */
export function showLocationDeniedAlert(context: LocationDeniedContext) {
  const { title, message } = MESSAGES[context];
  const openSettings = () => {
    if (typeof Linking.openSettings === 'function') {
      Linking.openSettings();
    }
  };
  Alert.alert(title, message, [
    { text: 'Not Now', style: 'cancel' },
    { text: 'Open Settings', onPress: openSettings },
  ]);
}
