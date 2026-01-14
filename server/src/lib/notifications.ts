
/**
 * @deprecated Use email.ts instead - this file is maintained for backward compatibility with push notifications
 * All email functionality has been consolidated into server/src/lib/email.ts
 *
 * Re-export email functions for backward compatibility
 */
export {
    initEmailService as initNotifications, sendBillingNoticeEmail, sendContentModerationEmail, sendOrganizationApprovalEmail,
    sendOrganizationDenialEmail, sendOrganizationInviteEmail, sendVerificationEmail
} from './email.js';

/**
 * Push Notification System
 *
 * Notification triggers:
 * 1. New direct message
 * 2. Someone interacts with user's post (like, comment, share)
 * 3. Someone follows the user
 * 4. 12 hours before RSVP'd game
 * 5. 1 hour before RSVP'd game
 *
 * Enhanced with:
 * - Delivery tracking via Expo receipts
 * - Token invalidation on DeviceNotRegistered
 * - Detailed logging for debugging
 */

import * as Sentry from '@sentry/node';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { prisma } from './prisma.js';
import { debugLog } from './debugLog.js';
import {
  buildNewMessageNotificationPayload,
  buildPostInteractionNotificationPayload,
} from './notificationHelpers.js';

const expo = new Expo();

// Track pending tickets for receipt verification
interface PendingTicket {
  userId: string;
  ticketId: string;
  sentAt: Date;
  type: string;
}

const pendingTickets: Map<string, PendingTicket> = new Map();

// Notification stats for monitoring
let stats = {
  sent: 0,
  failed: 0,
  delivered: 0,
  invalidTokens: 0,
  lastReset: new Date(),
};

/**
 * Get current notification stats
 */
export function getNotificationStats() {
  return { ...stats, pendingReceipts: pendingTickets.size };
}

/**
 * Reset notification stats (called periodically)
 */
export function resetNotificationStats() {
  stats = {
    sent: 0,
    failed: 0,
    delivered: 0,
    invalidTokens: 0,
    lastReset: new Date(),
  };
}

/**
 * Send a push notification to a user with enhanced tracking
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<{ success: boolean; ticketId?: string; error?: string }> {
  try {
    // Get user's push token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        preferences: true,
      },
    });

    if (!user) {
      console.log(`[Notifications] User ${userId} not found`);
      return { success: false, error: 'User not found' };
    }

    // Check if notifications are enabled
    const prefs = user.preferences as any;
    if (prefs && prefs.notifications_enabled === false) {
      console.log(`[Notifications] Disabled for user ${userId}`);
      return { success: false, error: 'Notifications disabled' };
    }

    // Get push token from preferences
    const pushToken = prefs?.push_token as string;

    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      console.log(`[Notifications] Invalid or missing push token for user ${userId}`);
      return { success: false, error: 'Invalid push token' };
    }

    // Create message with enhanced data
    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: {
        ...data,
        sentAt: new Date().toISOString(),
        notificationId: `${userId}-${Date.now()}`,
      },
      priority: 'high',
      channelId: 'default',
    };

    // Send notification
    const chunks = expo.chunkPushNotifications([message]);

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

        for (const ticket of ticketChunk) {
          if (ticket.status === 'ok' && ticket.id) {
            // Track for receipt verification
            pendingTickets.set(ticket.id, {
              userId,
              ticketId: ticket.id,
              sentAt: new Date(),
              type: data?.type || 'unknown',
            });

            stats.sent++;
            console.log(`[Notifications] ✓ Sent to ${userId}: ${title} (ticket: ${ticket.id})`);
            return { success: true, ticketId: ticket.id };
          } else if (ticket.status === 'error') {
            stats.failed++;
            const error = ticket.message || 'Unknown error';

            // Handle token issues
            if (ticket.details?.error === 'DeviceNotRegistered') {
              await invalidatePushToken(userId, prefs);
              stats.invalidTokens++;
            }

            console.error(`[Notifications] ✗ Failed for ${userId}: ${error}`);
            Sentry.captureMessage(`Push notification failed: ${error}`, {
              level: 'warning',
              tags: { userId, notificationType: data?.type },
            });

            return { success: false, error };
          }
        }
      } catch (error) {
        stats.failed++;
        console.error('[Notifications] Error sending chunk:', error);
        Sentry.captureException(error);
        return { success: false, error: (error as Error).message };
      }
    }

    return { success: false, error: 'No tickets returned' };
  } catch (error) {
    stats.failed++;
    console.error(`[Notifications] Failed for ${userId}:`, error);
    Sentry.captureException(error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Check delivery receipts for pending notifications
 * Should be called periodically (e.g., every 15 minutes)
 */
export async function checkDeliveryReceipts(): Promise<{
  checked: number;
  delivered: number;
  failed: number;
  invalidated: number;
}> {
  const ticketIds = Array.from(pendingTickets.keys());

  if (ticketIds.length === 0) {
    return { checked: 0, delivered: 0, failed: 0, invalidated: 0 };
  }

  console.log(`[Notifications] Checking ${ticketIds.length} delivery receipts...`);

  let delivered = 0;
  let failed = 0;
  let invalidated = 0;

  try {
    const receiptChunks = expo.chunkPushNotificationReceiptIds(ticketIds);

    for (const chunk of receiptChunks) {
      try {
        const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

        for (const [ticketId, receipt] of Object.entries(receipts)) {
          const pending = pendingTickets.get(ticketId);
          if (!pending) continue;

          if (receipt.status === 'ok') {
            delivered++;
            stats.delivered++;
            console.log(`[Notifications] ✓ Delivered: ${ticketId} to ${pending.userId}`);
          } else if (receipt.status === 'error') {
            failed++;
            console.error(`[Notifications] ✗ Delivery failed: ${ticketId} - ${receipt.message}`);

            // Handle DeviceNotRegistered
            if (receipt.details?.error === 'DeviceNotRegistered') {
              const user = await prisma.user.findUnique({
                where: { id: pending.userId },
                select: { preferences: true },
              });

              if (user) {
                await invalidatePushToken(pending.userId, user.preferences);
                invalidated++;
              }
            }

            Sentry.captureMessage(`Push delivery failed: ${receipt.message}`, {
              level: 'warning',
              tags: { ticketId, userId: pending.userId },
            });
          }

          pendingTickets.delete(ticketId);
        }
      } catch (error) {
        console.error('[Notifications] Receipt check chunk failed:', error);
      }
    }
  } catch (error) {
    console.error('[Notifications] Receipt check failed:', error);
    Sentry.captureException(error);
  }

  // Clean up old tickets (> 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  for (const [ticketId, pending] of pendingTickets.entries()) {
    if (pending.sentAt < oneDayAgo) {
      pendingTickets.delete(ticketId);
    }
  }

  return { checked: ticketIds.length, delivered, failed, invalidated };
}

/**
 * Invalidate a user's push token when it's no longer valid
 */
async function invalidatePushToken(userId: string, currentPrefs: any): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        preferences: {
          ...(currentPrefs || {}),
          push_token: null,
          push_token_invalidated_at: new Date().toISOString(),
        },
      },
    });
    console.log(`[Notifications] Invalidated push token for user ${userId}`);
  } catch (error) {
    console.error(`[Notifications] Failed to invalidate token for ${userId}:`, error);
  }
}

/**
 * Notify when user receives a new direct message
 */
export async function notifyNewMessage(
  recipientId: string,
  senderId: string,
  senderName: string,
  messagePreview: string
): Promise<void> {
  const payload = buildNewMessageNotificationPayload(senderId, senderName, messagePreview);
  await sendPushNotification(recipientId, payload.title, payload.body, payload.data);
}

/**
 * Notify when someone interacts with user's post
 */
export async function notifyPostInteraction(
  postAuthorId: string,
  interactionType: 'like' | 'comment' | 'share',
  actorId: string,
  actorName: string,
  postId: string
): Promise<void> {
  // Don't notify if user interacted with their own post
  if (postAuthorId === actorId) {
    return;
  }

  const payload = buildPostInteractionNotificationPayload(interactionType, actorId, actorName, postId);
  await sendPushNotification(postAuthorId, payload.title, payload.body, payload.data);
}

/**
 * Notify when someone follows the user
 */
export async function notifyNewFollower(
  userId: string,
  followerId: string,
  followerName: string
): Promise<void> {
  await sendPushNotification(
    userId,
    `${followerName} started following you`,
    `Tap to view their profile`,
    {
      type: 'new_follower',
      follower_id: followerId,
      screen: 'profile',
      user_id_param: followerId,
    }
  );
}

/**
 * Notify users about upcoming RSVPd games
 * Should be called by a cron job or scheduled task
 */
export async function notifyUpcomingGames(hoursBeforeGame: number): Promise<void> {
  const now = new Date();
  const targetTime = new Date(now.getTime() + hoursBeforeGame * 60 * 60 * 1000);

  // Find all events happening at the target time (with 5 minute window)
  const windowStart = new Date(targetTime.getTime() - 5 * 60 * 1000);
  const windowEnd = new Date(targetTime.getTime() + 5 * 60 * 1000);

  const upcomingEvents = await prisma.event.findMany({
    where: {
      date: {
        gte: windowStart,
        lte: windowEnd,
      },
      OR: [
        { status: { in: ['active', 'approved'] } },
        { approval_status: 'approved' },
      ],
    },
    include: {
      rsvps: {
        include: {
          user: {
            select: {
              id: true,
              display_name: true,
              preferences: true,
            },
          },
        },
      },
    },
  });

  debugLog(`Found ${upcomingEvents.length} events happening in ${hoursBeforeGame} hours`);

  // Send notifications to all RSVPd users
  for (const event of upcomingEvents) {
    for (const rsvp of event.rsvps) {
      const user = rsvp.user;
      const title = hoursBeforeGame === 12
        ? `Game reminder: ${event.title}`
        : `Game starting soon: ${event.title}`;

      const body = hoursBeforeGame === 12
        ? `Your game starts in 12 hours at ${event.location || 'the venue'}`
        : `Your game starts in 1 hour! Get ready!`;

      await sendPushNotification(
        user.id,
        title,
        body,
        {
          type: 'game_reminder',
          hours_before: hoursBeforeGame,
          event_id: event.id,
          screen: 'event-detail',
          event_id_param: event.id,
        }
      );
    }
  }
}

/**
 * Schedule notifications for a newly created RSVP
 * This sets up both 12-hour and 1-hour reminders
 */
export async function scheduleGameReminders(eventId: string, userId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { date: true, title: true },
  });

  if (!event) {
    console.error(`Event ${eventId} not found for scheduling reminders`);
    return;
  }

  // In a real implementation, you would use a job queue (Bull, Agenda, etc.)
  // For now, we log that reminders should be scheduled
  debugLog(`📅 Scheduled game reminders for user ${userId} for event ${eventId} (${event.title})`);
  debugLog(`  - 12-hour reminder: ${new Date(new Date(event.date).getTime() - 12 * 60 * 60 * 1000).toISOString()}`);
  debugLog(`  - 1-hour reminder: ${new Date(new Date(event.date).getTime() - 1 * 60 * 60 * 1000).toISOString()}`);
}

/**
 * Cancel scheduled game reminders when RSVP is removed
 */
export async function cancelGameReminders(eventId: string, userId: string): Promise<void> {
  // In a real implementation, you would cancel the scheduled jobs
  debugLog(`❌ Cancelled game reminders for user ${userId} for event ${eventId}`);
}
