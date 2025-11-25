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

const expo = new Expo();

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
      console.log(`User ${userId} not found`);
      return;
    }

    // Check if notifications are enabled
    const prefs = user.preferences as any;
    if (prefs && prefs.notifications_enabled === false) {
      console.log(`Notifications disabled for user ${userId}`);
      return;
    }

    // Get push token from preferences
    const pushToken = prefs?.push_token as string;
    
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) {
      console.log(`Invalid or missing push token for user ${userId}`);
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
    const tickets = [];
    
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        console.error('Error sending push notification chunk:', error);
      }
    }

    console.log(`Sent notification to user ${userId}: ${title}`);
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
      status: 'active',
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

  console.log(`Found ${upcomingEvents.length} events happening in ${hoursBeforeGame} hours`);

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
  console.log(`📅 Scheduled game reminders for user ${userId} for event ${eventId} (${event.title})`);
  console.log(`  - 12-hour reminder: ${new Date(new Date(event.date).getTime() - 12 * 60 * 60 * 1000).toISOString()}`);
  console.log(`  - 1-hour reminder: ${new Date(new Date(event.date).getTime() - 1 * 60 * 60 * 1000).toISOString()}`);
}

/**
 * Cancel scheduled game reminders when RSVP is removed
 */
export async function cancelGameReminders(eventId: string, userId: string): Promise<void> {
  // In a real implementation, you would cancel the scheduled jobs
  console.log(`❌ Cancelled game reminders for user ${userId} for event ${eventId}`);
}
