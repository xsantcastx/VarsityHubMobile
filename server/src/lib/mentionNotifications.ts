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
    select: { id: true, preferences: true },
  });

  if (users.length === 0) return;

  // Respect per-user `mentions_notifications` preference. Default: enabled.
  // Also respect blocking in both directions — a blocked mentioner must not be
  // able to notify the blocker (or vice versa).
  const [blocks, filteredRecipients] = await Promise.all([
    prisma.blockedUser.findMany({
      where: {
        OR: [
          { blocker_id: actorId, blocked_id: { in: users.map((u) => u.id) } },
          { blocked_id: actorId, blocker_id: { in: users.map((u) => u.id) } },
        ],
      },
      select: { blocker_id: true, blocked_id: true },
    }),
    Promise.resolve(users),
  ]);
  const blockedIds = new Set<string>();
  for (const b of blocks) {
    blockedIds.add(b.blocker_id === actorId ? b.blocked_id : b.blocker_id);
  }

  let recipients = filteredRecipients.filter((u) => {
    if (blockedIds.has(u.id)) return false;
    const prefs = u.preferences as any;
    if (prefs?.notifications?.mentions === false) return false;
    return true;
  });

  // Post-visibility gate: a mentioned user who can't actually see the post
  // shouldn't be notified about it. If the post belongs to a private team,
  // restrict recipients to users with a real relationship to that team
  // (member, follower, or org admin of the team's org). Public teams /
  // team-less posts skip this check — anyone can see the post, so the
  // notification is fine.
  //
  // Perf: fetch post + team in a single query via relation include. Saves a
  // round-trip on every mention-bearing post/comment.
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: {
      team_id: true,
      team: { select: { is_private: true, organization_id: true } as any },
    } as any,
  });
  const postAny = post as any;
  if (postAny?.team_id && recipients.length > 0) {
    const teamId = postAny.team_id as string;
    const teamAny = postAny.team;
    if (teamAny?.is_private) {
      const recipientIds = recipients.map((u) => u.id);
      const [teamMembers, teamFollowers, orgAdmins] = await Promise.all([
        prisma.teamMembership.findMany({
          where: {
            team_id: teamId,
            user_id: { in: recipientIds },
            status: 'active',
          },
          select: { user_id: true },
        }),
        prisma.teamFollow.findMany({
          where: { team_id: teamId, user_id: { in: recipientIds } },
          select: { user_id: true },
        }),
        teamAny.organization_id
          ? prisma.organizationMembership.findMany({
              where: {
                organization_id: teamAny.organization_id,
                user_id: { in: recipientIds },
                role: { in: ['owner', 'manager'] },
                status: 'active',
              },
              select: { user_id: true },
            })
          : Promise.resolve([] as Array<{ user_id: string }>),
      ]);
      const visibleUserIds = new Set<string>([
        ...teamMembers.map((m) => m.user_id),
        ...teamFollowers.map((f) => f.user_id),
        ...orgAdmins.map((a) => a.user_id),
      ]);
      recipients = recipients.filter((u) => visibleUserIds.has(u.id));
    }
  }

  const recipientIds = recipients.map((u) => u.id);
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
        context === 'post'
          ? 'Open the post to view the mention.'
          : 'Open the comment thread to view the mention.',
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
