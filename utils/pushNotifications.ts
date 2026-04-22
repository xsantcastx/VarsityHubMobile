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
      // iOS 14+: shouldShowAlert is deprecated. Use the granular pair so iOS
      // renders a standard transient banner instead of falling back to a legacy
      // presentation that can leave a persistent bell indicator on screen.
      shouldShowBanner: true,
      shouldShowList: true,
      shouldShowAlert: true,
      shouldPlaySound: true,
      // Let iOS auto-increment the app icon badge when a push arrives while
      // the app isn't in the foreground. Foreground sync goes through
      // syncNotificationBadge() below so the count stays aligned with the
      // server's /notifications/unread-count.
      shouldSetBadge: true,
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

/**
 * Sync the app icon badge with the server's unread notification count.
 *
 * Call on: app foreground, notifications-screen focus, after mark-read actions.
 * Best-effort and silent — failures don't propagate.
 *
 * - Web: no-op (setBadgeCountAsync is not supported in react-native-web).
 * - Android: setBadgeCountAsync exists but is a no-op unless the launcher
 *   advertises badge support. Safe to call regardless.
 * - iOS: updates the app icon badge directly.
 */
export async function syncNotificationBadge(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const notif = await loadNotifications();
    if (!notif?.setBadgeCountAsync) return;
    // Lazy import to avoid a circular dependency and to keep this helper
    // opt-in from the callsites that already know the API shape.
    const { httpGet } = await import('@/api/http');
    const res: any = await httpGet('/notifications/unread-count').catch(() => null);
    const raw = res?.count ?? res?.data?.count ?? 0;
    const count = Math.max(0, Number(raw) || 0);
    await notif.setBadgeCountAsync(count);
  } catch (err) {
    if (__DEV__) console.warn('[push] syncNotificationBadge failed:', err);
  }
}

/**
 * Clear the app icon badge unconditionally. Useful when the user taps into
 * the notifications tab — the server-side unread count may take a moment to
 * propagate after mark-read-all, so zero-on-open gives the right UX.
 */
export async function clearNotificationBadge(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const notif = await loadNotifications();
    if (!notif?.setBadgeCountAsync) return;
    await notif.setBadgeCountAsync(0);
  } catch {
    // best-effort
  }
}
