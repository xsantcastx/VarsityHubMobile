import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

const unsupported = () => {
  throw new Error('expo-notifications is unavailable on this platform.');
};

let Notifications: NotificationsModule | null = null;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
  } catch (error) {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[notifications] expo-notifications unavailable:', (error as Error)?.message);
    }
  }
}

const NotificationsProxy: NotificationsModule = (Notifications ??
  new Proxy(
    {},
    {
      get: () => unsupported,
    }
  )) as NotificationsModule;

export default NotificationsProxy;
