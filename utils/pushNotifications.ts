import { User } from '@/api/entities';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Lazy import to avoid crash when native module isn't available (e.g., Simulator)
let Notifications: typeof import('expo-notifications') | null = null;

const loadNotifications = async () => {
  if (Notifications) return Notifications;
  try {
    Notifications = await import('expo-notifications');
    return Notifications;
  } catch (err) {
    if (__DEV__) console.warn('[push] expo-notifications not available:', err);
    return null;
  }
};

let handlerConfigured = false;
let registrationPromise: Promise<string | null> | null = null;
let lastSyncedToken: string | null = null;

const configureNotificationHandlers = async () => {
  if (handlerConfigured) return;
  const notif = await loadNotifications();
  if (!notif) return;
  
  notif.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await notif.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: notif.AndroidImportance.DEFAULT,
    });
  }
  handlerConfigured = true;
};

const resolveProjectId = () => {
  const easProjectId =
    (Constants as any)?.expoConfig?.extra?.eas?.projectId ||
    (Constants as any)?.easConfig?.projectId ||
    (Constants as any)?.expoConfig?.extra?.projectId;
  return typeof easProjectId === 'string' && easProjectId.length ? easProjectId : null;
};

export async function registerForPushNotifications(existingToken?: string | null) {
  if (Platform.OS === 'web') return null;
  
  // Check if notifications module is available
  const notif = await loadNotifications();
  if (!notif) {
    if (__DEV__) console.log('[push] Notifications module not available (Simulator?)');
    return null;
  }
  
  // Skip push notifications in Expo Go (requires development build)
  if (!Constants.appOwnership || Constants.appOwnership === 'expo') {
    if (__DEV__) console.log('[push] Skipping registration in Expo Go');
    return null;
  }
  
  if (registrationPromise) return registrationPromise;

  registrationPromise = (async () => {
    try {
      await configureNotificationHandlers();

      const { status: existingStatus } = await notif.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const request = await notif.requestPermissionsAsync();
        finalStatus = request.status;
      }
      if (finalStatus !== 'granted') {
        if (__DEV__) console.warn('[push] Notification permission not granted');
        return null;
      }

      const projectId = resolveProjectId();
      const tokenResponse = await notif.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );
      const token = tokenResponse?.data || null;
      if (!token) return null;

      if (token === existingToken || token === lastSyncedToken) {
        lastSyncedToken = token;
        return token;
      }

      try {
        await User.updatePreferences({
          push_token: token,
          notifications_enabled: true,
        });
        lastSyncedToken = token;
      } catch (err) {
        if (__DEV__) console.error('[push] Failed to sync push token', err);
      }

      return token;
    } catch (err) {
      if (__DEV__) console.error('[push] Registration failed', err);
      throw err;
    } finally {
      registrationPromise = null;
    }
  })();

  return registrationPromise;
}
