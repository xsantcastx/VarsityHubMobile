import { Expo, type ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from './prisma.js';
import { debugLog } from './debugLog.js';
import { shouldClearPushTokenForExpoError } from './pushReceiptPolicy.js';
import { updateUserAndInvalidate } from './userCache.js';
import { captureException } from './sentry.js';

const expo = new Expo();

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<string[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferences: true,
      },
    });

    if (!user) {
      debugLog(`User ${userId} not found`);
      return [];
    }

    const prefs = user.preferences as any;
    if (prefs && prefs.notifications_enabled === false) {
      debugLog(`Notifications disabled for user ${userId}`);
      return [];
    }

    const pushToken = prefs?.push_token as string;

    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      debugLog(`Invalid or missing push token for user ${userId}`);
      return [];
    }

    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: data || {},
    };

    const chunks = expo.chunkPushNotifications([message]);
    const tickets: any[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        // Without Sentry capture, bulk delivery failures (Expo platform
        // outage, network blip, malformed payload) only land in console
        // output and never get triaged. The loop continues regardless so
        // a single bad chunk doesn't kill the whole batch — but the
        // failure now surfaces in the alerts pipeline.
        console.error('Error sending push notification chunk:', error);
        captureException(error instanceof Error ? error : new Error(String(error)), {
          context: 'push_notification_chunk_failed',
          provider: 'expo-push',
          job: 'send-push',
          userId,
          chunkSize: chunk.length,
        });
      }
    }

    debugLog(`Sent notification to user ${userId}: ${title}`);

    const errorTickets = tickets.filter(
      (t: any) => t?.status === 'error' && shouldClearPushTokenForExpoError(t?.details?.error)
    );
    if (errorTickets.length > 0) {
      try {
        const currentPrefs = (user.preferences as any) || {};
        if (currentPrefs.push_token === pushToken) {
          await updateUserAndInvalidate(prisma, {
            where: { id: userId },
            data: { preferences: { ...currentPrefs, push_token: null } },
          });
          const firstError = errorTickets[0]?.details?.error || 'unknown';
          debugLog(`Cleared stale push_token for user ${userId} (${firstError})`);
        }
      } catch (clearErr) {
        console.warn('[notifications] Failed to clear stale push_token:', clearErr);
      }
    }

    return tickets.filter((t: any) => t.status === 'ok' && t.id).map((t: any) => t.id);
  } catch (error) {
    console.error(`Failed to send notification to user ${userId}:`, error);
    return [];
  }
}
