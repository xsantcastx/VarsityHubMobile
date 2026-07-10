/**
 * Shared production wipe logic: database (preserve schema, categories, promo codes) and optional Cloudinary.
 * Used by scripts/wipe-production.ts and POST /admin/wipe-database.
 */

import crypto from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

export async function wipeDatabase(prisma: PrismaClient): Promise<{ deleted: Record<string, number> }> {
  const deleted: Record<string, number> = {};
  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    ['Notification', () => prisma.notification.deleteMany()],
    ['AdminActivityLog', () => prisma.adminActivityLog.deleteMany()],
    ['UserWarning', () => prisma.userWarning.deleteMany()],
    ['AbuseReport', () => prisma.abuseReport.deleteMany()],
    ['PollVote', () => prisma.pollVote.deleteMany()],
    ['PollOption', () => prisma.pollOption.deleteMany()],
    ['Poll', () => prisma.poll.deleteMany()],
    ['PostUpvote', () => prisma.postUpvote.deleteMany()],
    ['PostBookmark', () => prisma.postBookmark.deleteMany()],
    ['GameVote', () => prisma.gameVote.deleteMany()],
    ['Comment', () => prisma.comment.deleteMany()],
    ['CategoryAssignment', () => prisma.categoryAssignment.deleteMany()],
    ['Post', () => prisma.post.deleteMany()],
    ['Story', () => prisma.story.deleteMany()],
    ['GroupChatMessage', () => prisma.groupChatMessage.deleteMany()],
    ['GroupChatMember', () => prisma.groupChatMember.deleteMany()],
    ['GroupChat', () => prisma.groupChat.deleteMany()],
    ['Message', () => prisma.message.deleteMany()],
    ['EventRsvp', () => prisma.eventRsvp.deleteMany()],
    ['Event', () => prisma.event.deleteMany()],
    ['AdReservation', () => prisma.adReservation.deleteMany()],
    ['Ad', () => prisma.ad.deleteMany()],
    ['PromoRedemption', () => prisma.promoRedemption.deleteMany()],
    ['TransactionLog', () => prisma.transactionLog.deleteMany()],
    ['ProcessedStripeEvent', () => prisma.processedStripeEvent.deleteMany()],
    ['Follows', () => prisma.follows.deleteMany()],
    ['TeamFollow', () => prisma.teamFollow.deleteMany()],
    ['OrganizationFollow', () => prisma.organizationFollow.deleteMany()],
    ['ProgramFollow', () => prisma.programFollow.deleteMany()],
    ['CategoryFollow', () => prisma.categoryFollow.deleteMany()],
    ['BlockedUser', () => prisma.blockedUser.deleteMany()],
    ['TeamMembership', () => prisma.teamMembership.deleteMany()],
    ['TeamInvite', () => prisma.teamInvite.deleteMany()],
    ['OrganizationMembership', () => prisma.organizationMembership.deleteMany()],
    ['OrganizationInvite', () => prisma.organizationInvite.deleteMany()],
    ['OrganizationJoinRequest', () => prisma.organizationJoinRequest.deleteMany()],
    ['Game', () => prisma.game.deleteMany()],
    ['Team', () => prisma.team.deleteMany()],
    ['Organization', () => prisma.organization.deleteMany()],
    ['User', () => prisma.user.deleteMany()],
  ];

  for (const [name, deleteFn] of steps) {
    const result = await deleteFn();
    deleted[name] = result.count;
  }
  return { deleted };
}

export async function wipeCloudinary(): Promise<{ deleted: number }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return { deleted: 0 };
  }

  let totalDeleted = 0;
  for (const resourceType of ['image', 'video', 'raw'] as const) {
    let hasMore = true;
    let nextCursor: string | undefined;

    while (hasMore) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const params: Record<string, string> = {
        prefix: 'varsityhub/',
        timestamp,
        type: 'upload',
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      };
      const toSign = Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&');
      const signature = crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');

      const searchUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload?prefix=varsityhub/&max_results=500${nextCursor ? `&next_cursor=${nextCursor}` : ''}`;
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

      const listRes = await fetch(searchUrl, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!listRes.ok) break;

      const data = (await listRes.json()) as {
        resources: Array<{ public_id: string }>;
        next_cursor?: string;
      };
      if (data.resources.length === 0) break;

      const publicIds = data.resources.map((r) => r.public_id);
      const deleteUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload`;
      const deleteBody = new URLSearchParams();
      publicIds.forEach((id) => deleteBody.append('public_ids[]', id));

      const delRes = await fetch(`${deleteUrl}?${deleteBody.toString()}`, {
        method: 'DELETE',
        headers: { Authorization: `Basic ${auth}` },
      });
      if (delRes.ok) {
        const delData = (await delRes.json()) as { deleted: Record<string, string> };
        totalDeleted += Object.keys(delData.deleted || {}).length;
      }
      nextCursor = data.next_cursor;
      hasMore = !!nextCursor;
    }
  }
  return { deleted: totalDeleted };
}
