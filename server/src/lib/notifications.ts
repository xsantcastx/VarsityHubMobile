
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
 */

import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { EventApprovalStatus, EventStatus, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { debugLog } from './debugLog.js';

const expo = new Expo();
let pushTicketTableReadyCache: boolean | null = null;
let pushTicketTableReadyCheckedAt = 0;

export async function isPushTicketStorageReady(): Promise<boolean> {
  const now = Date.now();
  if (pushTicketTableReadyCache !== null && now - pushTicketTableReadyCheckedAt < 60_000) {
    return pushTicketTableReadyCache;
  }

  try {
    await prisma.pushTicket.count({ where: { id: '__probe__' } });
    pushTicketTableReadyCache = true;
  } catch {
    pushTicketTableReadyCache = false;
  }

  pushTicketTableReadyCheckedAt = now;
  return pushTicketTableReadyCache;
}

/**
 * Remove a user's push_token from their preferences. Called when Expo reports
 * DeviceNotRegistered (the token is permanently invalid) so we stop pushing
 * to a dead device and future queries skip it.
 */
async function clearPushTokenForUser(userId: string, expectedToken?: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });
    if (!user) return;
    const prefs = (user.preferences && typeof user.preferences === 'object')
      ? { ...(user.preferences as Record<string, any>) }
      : {};
    if (expectedToken && prefs.push_token && prefs.push_token !== expectedToken) return;
    if (!prefs.push_token) return;
    delete prefs.push_token;
    await prisma.user.update({ where: { id: userId }, data: { preferences: prefs as any } });
    debugLog(`[push] Cleared dead push token for user ${userId}`);
  } catch (err) {
    console.error('[push] Failed to clear push token:', err);
  }
}

/**
 * Fetch receipts for every pending ticket, mark the row resolved, and clear
 * push tokens that Expo reports as invalid. Called by the scheduler.
 *
 * Expo reference: https://docs.expo.dev/push-notifications/sending-notifications/#check-push-receipts-for-errors
 */
export async function verifyPushReceipts(): Promise<{ checked: number; cleared: number }> {
  if (!(await isPushTicketStorageReady())) {
    return { checked: 0, cleared: 0 };
  }

  const pending = await prisma.pushTicket.findMany({
    where: { status: 'pending' },
    take: 500,
    orderBy: { created_at: 'asc' },
  });
  if (pending.length === 0) return { checked: 0, cleared: 0 };

  const ticketIds = pending.map((t) => t.ticket_id);
  const chunks = expo.chunkPushNotificationReceiptIds(ticketIds);
  let checked = 0;
  let cleared = 0;

  for (const chunk of chunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);
      for (const [ticketId, receipt] of Object.entries(receipts)) {
        checked += 1;
        const row = pending.find((p) => p.ticket_id === ticketId);
        if (!row) continue;

        if (receipt.status === 'ok') {
          await prisma.pushTicket.update({
            where: { ticket_id: ticketId },
            data: { status: 'ok', resolved_at: new Date() },
          });
        } else {
          const errorCode = (receipt as any).details?.error ?? null;
          await prisma.pushTicket.update({
            where: { ticket_id: ticketId },
            data: {
              status: 'error',
              error_code: errorCode,
              error_message: receipt.message ?? null,
              resolved_at: new Date(),
            },
          });
          if (errorCode === 'DeviceNotRegistered') {
            await clearPushTokenForUser(row.user_id, row.push_token);
            cleared += 1;
          }
        }
      }
    } catch (err) {
      console.error('[push] Failed to fetch receipts for chunk:', err);
    }
  }

  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await prisma.pushTicket.deleteMany({
    where: { status: { in: ['ok', 'error'] }, resolved_at: { lt: cutoff } },
  });

  return { checked, cleared };
}

type InAppNotificationInput = {
  userId: string;
  actorId: string;
  type: string;
  postId?: string | null;
  commentId?: string | null;
  messageId?: string | null;
  meta?: Record<string, unknown> | null;
};

export async function createInAppNotification(input: InAppNotificationInput): Promise<void> {
  await prisma.notification.create({
    data: {
      user_id: input.userId,
      actor_id: input.actorId,
      type: input.type as any,
      post_id: input.postId ?? undefined,
      comment_id: input.commentId ?? undefined,
      message_id: input.messageId ?? undefined,
      meta: (input.meta ?? undefined) as any,
    },
  });
}

/**
 * Send a push notification to a user
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    // Get user's push token
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        preferences: true,
      },
    });

    if (!user) {
      debugLog(`User ${userId} not found`);
      return;
    }

    // Check if notifications are enabled
    const prefs = user.preferences as any;
    if (prefs && prefs.notifications_enabled === false) {
      debugLog(`Notifications disabled for user ${userId}`);
      return;
    }

    // Get push token from preferences
    const pushToken = prefs?.push_token as string;
    
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      debugLog(`Invalid or missing push token for user ${userId}`);
      return;
    }

    // Create message
    const message: ExpoPushMessage = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data: data || {},
    };

    // Send notification
    const chunks = expo.chunkPushNotifications([message]);

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        // Persist 'ok' tickets so the scheduler can look up receipts and reap
        // invalid tokens (DeviceNotRegistered, MessageRateExceeded, etc.).
        // Tickets with status 'error' failed at send time — clear the token now
        // if the error indicates it's invalid.
        for (const ticket of ticketChunk) {
          if (ticket.status === 'ok' && ticket.id) {
            if (await isPushTicketStorageReady()) {
              await prisma.pushTicket
                .create({
                  data: {
                    ticket_id: ticket.id,
                    user_id: userId,
                    push_token: pushToken,
                    status: 'pending',
                  },
                })
                .catch((err) => {
                  console.error('[push] Failed to persist push ticket:', err);
                });
            }
          } else if (ticket.status === 'error') {
            const details = (ticket as any).details;
            if (details?.error === 'DeviceNotRegistered') {
              await clearPushTokenForUser(userId, pushToken);
            }
            console.warn('[push] Send-time error ticket:', ticket.message, details);
          }
        }
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    debugLog(`Sent notification to user ${userId}: ${title}`);
  } catch (error) {
    console.error(`Failed to send notification to user ${userId}:`, error);
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
  const user = await prisma.user.findUnique({
    where: { id: recipientId },
    select: { preferences: true },
  });
  const prefs = user?.preferences as any;
  if (prefs?.notifications?.messages_notifications === false) {
    debugLog(`Messages notifications disabled for user ${recipientId}`);
    return;
  }
  await sendPushNotification(
    recipientId,
    `New message from ${senderName}`,
    messagePreview.substring(0, 100),
    {
      type: 'new_message',
      sender_id: senderId,
      screen: 'messages',
    }
  );
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

  // Check if user has disabled comments & upvotes notifications
  if (interactionType === 'like' || interactionType === 'comment') {
    const user = await prisma.user.findUnique({
      where: { id: postAuthorId },
      select: { preferences: true },
    });
    const prefs = user?.preferences as any;
    if (prefs?.notifications?.comments_upvotes === false) {
      debugLog(`Comments & upvotes notifications disabled for user ${postAuthorId}`);
      return;
    }
  }

  const titles = {
    like: `${actorName} liked your post`,
    comment: `${actorName} commented on your post`,
    share: `${actorName} shared your post`,
  };

  await sendPushNotification(
    postAuthorId,
    titles[interactionType],
    `Tap to view`,
    {
      type: 'post_interaction',
      interaction_type: interactionType,
      actor_id: actorId,
      post_id: postId,
      screen: 'post-detail',
      post_id_param: postId,
    }
  );
}

/**
 * Notify when someone replies to a user's comment
 */
export async function notifyCommentReply(
  parentCommentAuthorId: string,
  replierId: string,
  replierName: string,
  postId: string,
  commentId: string
): Promise<void> {
  if (parentCommentAuthorId === replierId) return;

  const user = await prisma.user.findUnique({
    where: { id: parentCommentAuthorId },
    select: { preferences: true },
  });
  const prefs = user?.preferences as any;
  if (prefs?.notifications?.comments_upvotes === false) {
    debugLog(`Comments & upvotes notifications disabled for user ${parentCommentAuthorId}`);
    return;
  }

  await sendPushNotification(
    parentCommentAuthorId,
    `${replierName} replied to your comment`,
    'Tap to view',
    {
      type: 'comment_reply',
      actor_id: replierId,
      post_id: postId,
      comment_id: commentId,
      screen: 'post-detail',
      post_id_param: postId,
      comment_id_param: commentId,
    }
  );
}

/**
 * Notify when someone follows the user
 */
export async function notifyNewFollower(
  userId: string,
  followerId: string,
  followerName: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  const prefs = user?.preferences as any;
  if (prefs?.notifications?.follows_notifications === false) {
    debugLog(`Follows notifications disabled for user ${userId}`);
    return;
  }
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
        { status: EventStatus.approved },
        { approval_status: EventApprovalStatus.approved },
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
  const eventsWithRsvps = upcomingEvents as Prisma.EventGetPayload<{
    include: {
      rsvps: {
        include: {
          user: {
            select: {
              id: true;
              display_name: true;
              preferences: true;
            };
          };
        };
      };
    };
  }>[];

  debugLog(`Found ${eventsWithRsvps.length} events happening in ${hoursBeforeGame} hours`);

  // Send notifications to all RSVPd users
  for (const event of eventsWithRsvps) {
    for (const rsvp of event.rsvps) {
      const user = rsvp.user;
      
      // Check if user has disabled game/event reminders
      const prefs = user.preferences as any;
      if (prefs?.notifications?.game_event_reminders === false) {
        debugLog(`Game reminders disabled for user ${user.id}, skipping notification`);
        continue;
      }
      
      const title = hoursBeforeGame === 12 
        ? `Game reminder: ${event.title}` 
        : `Game starting soon: ${event.title}`;
      
      const body = hoursBeforeGame === 12
        ? `Your game starts in 12 hours at ${event.location || 'the venue'}`
        : `Your game starts in 1 hour! Get ready!`;

      // Create in-app notification record so it appears in notification history
      const actorId = (event as any).creator_id ?? user.id;
      try {
        await createInAppNotification({
          userId: user.id,
          actorId,
          type: 'GAME_REMINDER',
          meta: {
            event_id: event.id,
            event_title: event.title,
            hours_before: hoursBeforeGame,
            location: event.location,
          },
        });
      } catch (e) {
        console.error('[notifications] Failed to create game reminder in-app notification:', e);
      }

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
