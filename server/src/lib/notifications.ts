
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
import { prisma } from './prisma.js';
import { debugLog } from './debugLog.js';

const expo = new Expo();

/**
 * Send a push notification to a user
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<string[]> {
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
      return [];
    }

    // Check if notifications are enabled
    const prefs = user.preferences as any;
    if (prefs && prefs.notifications_enabled === false) {
      debugLog(`Notifications disabled for user ${userId}`);
      return [];
    }

    // Get push token from preferences
    const pushToken = prefs?.push_token as string;

    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      debugLog(`Invalid or missing push token for user ${userId}`);
      return [];
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
    const tickets: any[] = [];

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    debugLog(`Sent notification to user ${userId}: ${title}`);

    // Return successful ticket IDs for receipt tracking
    const successTicketIds = tickets
      .filter((t: any) => t.status === 'ok' && t.id)
      .map((t: any) => t.id);
    return successTicketIds;
  } catch (error) {
    console.error(`Failed to send notification to user ${userId}:`, error);
    return [];
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
      let notificationId: string | undefined;
      try {
        const notification = await prisma.notification.create({
          data: {
            user_id: user.id,
            actor_id: actorId,
            type: 'GAME_REMINDER',
            meta: {
              event_id: event.id,
              event_title: event.title,
              hours_before: hoursBeforeGame,
              location: event.location,
            },
          },
        });
        notificationId = notification.id;
      } catch (e) {
        console.error('[notifications] Failed to create game reminder in-app notification:', e);
      }

      const ticketIds = await sendPushNotification(
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

      // Store ticket ID in notification meta for receipt tracking
      if (notificationId && ticketIds.length > 0) {
        try {
          const existing = await prisma.notification.findUnique({
            where: { id: notificationId },
            select: { meta: true },
          });
          await prisma.notification.update({
            where: { id: notificationId },
            data: {
              meta: { ...(existing?.meta as any || {}), ticket_id: ticketIds[0] },
            },
          });
        } catch (e) {
          console.error('[notifications] Failed to store ticket_id in notification meta:', e);
        }
      }
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

  const { notificationQueue } = await import('../jobs/queues.js');
  if (!notificationQueue) {
    debugLog(`[scheduleGameReminders] No notification queue available, skipping for event ${eventId}`);
    return;
  }

  const now = Date.now();
  const gameTime = new Date(event.date).getTime();
  const twelveHBefore = gameTime - 12 * 60 * 60 * 1000;
  const oneHBefore = gameTime - 1 * 60 * 60 * 1000;

  if (twelveHBefore > now) {
    await notificationQueue.add(
      `game-reminder-${eventId}-${userId}-12h`,
      { userId, title: `Game reminder: ${event.title}`, body: `Your game starts in 12 hours!` },
      { delay: twelveHBefore - now, jobId: `game-reminder-${eventId}-${userId}-12h` }
    );
  }

  if (oneHBefore > now) {
    await notificationQueue.add(
      `game-reminder-${eventId}-${userId}-1h`,
      { userId, title: `Game starting soon: ${event.title}`, body: `Your game starts in 1 hour! Get ready!` },
      { delay: oneHBefore - now, jobId: `game-reminder-${eventId}-${userId}-1h` }
    );
  }

  debugLog(`Scheduled game reminders for user ${userId} for event ${eventId} (${event.title})`);
}

/**
 * Cancel scheduled game reminders when RSVP is removed
 */
export async function cancelGameReminders(eventId: string, userId: string): Promise<void> {
  const { notificationQueue } = await import('../jobs/queues.js');
  if (!notificationQueue) {
    debugLog(`[cancelGameReminders] No notification queue available, skipping for event ${eventId}`);
    return;
  }

  try {
    await notificationQueue.remove(`game-reminder-${eventId}-${userId}-12h`);
  } catch {
    // Job may not exist or already processed
  }
  try {
    await notificationQueue.remove(`game-reminder-${eventId}-${userId}-1h`);
  } catch {
    // Job may not exist or already processed
  }

  debugLog(`Cancelled game reminders for user ${userId} for event ${eventId}`);
}

/**
 * Verify push notification delivery receipts from Expo.
 * Queries recent notifications with a ticket_id in meta, checks receipts,
 * and clears stale push tokens on DeviceNotRegistered errors.
 */
export async function verifyPushReceipts(): Promise<void> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Find notifications with a ticket_id that haven't been receipt-checked yet
  const notifications = await prisma.notification.findMany({
    where: {
      created_at: { gte: twentyFourHoursAgo },
      meta: { not: undefined },
    },
    select: {
      id: true,
      user_id: true,
      meta: true,
    },
  });

  // Filter to those with ticket_id and no receipt_checked flag
  const unchecked = notifications.filter((n) => {
    const meta = n.meta as any;
    return meta?.ticket_id && !meta?.receipt_checked;
  });

  if (unchecked.length === 0) {
    debugLog('[verifyPushReceipts] No unchecked tickets found');
    return;
  }

  debugLog(`[verifyPushReceipts] Checking ${unchecked.length} ticket(s)`);

  // Build a map from ticketId -> notification
  const ticketMap = new Map<string, { id: string; user_id: string; meta: any }>();
  for (const n of unchecked) {
    const meta = n.meta as any;
    ticketMap.set(meta.ticket_id, { id: n.id, user_id: n.user_id, meta });
  }

  const allTicketIds = Array.from(ticketMap.keys());

  // Process in chunks of 1000 (Expo limit)
  for (let i = 0; i < allTicketIds.length; i += 1000) {
    const chunk = allTicketIds.slice(i, i + 1000);
    let receipts: Record<string, any>;

    try {
      receipts = await expo.getPushNotificationReceiptsAsync(chunk);
    } catch (error) {
      console.error('[verifyPushReceipts] Failed to fetch receipts:', error);
      continue;
    }

    for (const [ticketId, receipt] of Object.entries(receipts)) {
      const entry = ticketMap.get(ticketId);
      if (!entry) continue;

      try {
        if (receipt.status === 'ok') {
          await prisma.notification.update({
            where: { id: entry.id },
            data: {
              meta: { ...entry.meta, receipt_checked: true },
            },
          });
        } else if (receipt.status === 'error') {
          const details = receipt.details;

          if (details?.error === 'DeviceNotRegistered') {
            // Clear the stale push token from user preferences
            debugLog(`[verifyPushReceipts] Clearing stale push token for user ${entry.user_id}`);
            const user = await prisma.user.findUnique({
              where: { id: entry.user_id },
              select: { preferences: true },
            });
            if (user?.preferences) {
              const prefs = { ...(user.preferences as any) };
              delete prefs.push_token;
              await prisma.user.update({
                where: { id: entry.user_id },
                data: { preferences: prefs },
              });
            }
          } else {
            console.error(`[verifyPushReceipts] Receipt error for ticket ${ticketId}:`, receipt.message, details);
          }

          await prisma.notification.update({
            where: { id: entry.id },
            data: {
              meta: { ...entry.meta, receipt_checked: true, receipt_error: details?.error || receipt.message },
            },
          });
        }
      } catch (error) {
        console.error(`[verifyPushReceipts] Failed to process receipt for ticket ${ticketId}:`, error);
      }
    }
  }

  debugLog(`[verifyPushReceipts] Done processing ${allTicketIds.length} receipt(s)`);
}
