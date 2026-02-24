/**
 * Mention notification helpers
 * Parse @username from content and create notifications for mentioned users
 */

import { prisma } from './prisma.js';
import { sendPushNotification } from './notifications.js';
import { debugLog } from './debugLog.js';

/** Extract @username mentions from text. Returns unique usernames (without @). */
export function parseMentions(content: string): string[] {
  if (!content || typeof content !== 'string') return [];
  // Match @username - word chars after @, support usernames with letters, numbers, underscores
  const matches = content.matchAll(/\B@([a-zA-Z0-9_]+)/g);
  const usernames = [...matches].map((m) => m[1].toLowerCase());
  return [...new Set(usernames)];
}

/**
 * Create in-app + push notifications for users mentioned in content
 */
export async function notifyMentions(params: {
  content: string;
  actorId: string;
  actorName: string;
  postId: string;
  commentId?: string | null;
  context: 'post' | 'comment';
}): Promise<void> {
  const { content, actorId, actorName, postId, commentId, context } = params;
  const usernames = parseMentions(content);
  if (usernames.length === 0) return;

  const users = await prisma.user.findMany({
    where: {
      OR: usernames.map((u) => ({ username: { equals: u, mode: 'insensitive' as const } })),
      id: { not: actorId },
      banned: false,
    },
    select: { id: true },
  });

  const recipientIds = users.map((u) => u.id);
  if (recipientIds.length === 0) return;

  const title = context === 'post'
    ? `${actorName} mentioned you in a post`
    : `${actorName} mentioned you in a comment`;

  for (const recipientId of recipientIds) {
    try {
      await prisma.notification.create({
        data: {
          user_id: recipientId,
          actor_id: actorId,
          type: 'MENTION',
          post_id: postId,
          comment_id: commentId ?? undefined,
        },
      });
      await sendPushNotification(
        recipientId,
        title,
        'Tap to view',
        {
          type: 'mention',
          actor_id: actorId,
          post_id: postId,
          comment_id: commentId ?? undefined,
          screen: 'post-detail',
          post_id_param: postId,
          comment_id_param: commentId ?? undefined,
        }
      );
    } catch (e) {
      console.error('[mentions] Failed to notify mentioned user:', recipientId, e);
    }
  }
  debugLog(`[mentions] Notified ${recipientIds.length} users for ${context}`);
}
