/**
 * Wipe all user data and posts from production database + Cloudinary media.
 * Preserves schema, promo codes, and categories.
 *
 * Usage: cd server && npx tsx scripts/wipe-production.ts
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Run via: railway run npx tsx scripts/wipe-production.ts');
  process.exit(1);
}

// Safety check — must confirm
const args = process.argv.slice(2);
if (!args.includes('--confirm')) {
  console.log('\n⚠️  This will DELETE all users, posts, teams, games, messages, and media from the database.');
  console.log('   Categories and promo codes will be preserved.\n');
  console.log('   To proceed, run with --confirm flag:\n');
  console.log('   railway run npx tsx scripts/wipe-production.ts --confirm\n');
  process.exit(0);
}

const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

async function wipeCloudinary() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.log('⚠️  Cloudinary credentials not set, skipping media wipe.');
    console.log('   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET to wipe media.');
    return;
  }

  console.log('🗑️  Wiping Cloudinary media in varsityhub/ folder...');

  // Delete all resources in varsityhub/ prefix for both images and videos
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

      // Create signature for admin API
      const toSign = Object.keys(params)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&');
      const signature = crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');

      // List resources
      const searchUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload?prefix=varsityhub/&max_results=500${nextCursor ? `&next_cursor=${nextCursor}` : ''}`;
      const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

      const listRes = await fetch(searchUrl, {
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!listRes.ok) {
        const err = await listRes.text();
        console.log(`   ⚠️  Could not list ${resourceType} resources: ${listRes.status} ${err}`);
        break;
      }

      const data = (await listRes.json()) as {
        resources: Array<{ public_id: string }>;
        next_cursor?: string;
      };

      if (data.resources.length === 0) {
        console.log(`   No ${resourceType} resources found.`);
        break;
      }

      // Bulk delete
      const publicIds = data.resources.map((r) => r.public_id);
      console.log(`   Deleting ${publicIds.length} ${resourceType} resources...`);

      const deleteUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload`;
      const deleteBody = new URLSearchParams();
      publicIds.forEach((id) => deleteBody.append('public_ids[]', id));

      const delRes = await fetch(`${deleteUrl}?${deleteBody.toString()}`, {
        method: 'DELETE',
        headers: { Authorization: `Basic ${auth}` },
      });

      if (!delRes.ok) {
        const err = await delRes.text();
        console.log(`   ⚠️  Delete failed for ${resourceType}: ${delRes.status} ${err}`);
      } else {
        const delData = (await delRes.json()) as { deleted: Record<string, string> };
        const count = Object.keys(delData.deleted || {}).length;
        console.log(`   ✅ Deleted ${count} ${resourceType} resources`);
      }

      nextCursor = data.next_cursor;
      hasMore = !!nextCursor;
    }
  }

  console.log('✅ Cloudinary wipe complete.');
}

async function wipeDatabase() {
  console.log('🗑️  Wiping database (preserving schema, categories, promo codes)...\n');

  // Delete in FK-safe order: children first, then parents
  // Using deleteMany which respects cascade but we go explicit to be safe

  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    // Notifications & activity logs
    ['Notification', () => prisma.notification.deleteMany()],
    ['AdminActivityLog', () => prisma.adminActivityLog.deleteMany()],
    ['UserWarning', () => prisma.userWarning.deleteMany()],
    ['AbuseReport', () => prisma.abuseReport.deleteMany()],

    // Votes, bookmarks, upvotes
    ['PollVote', () => prisma.pollVote.deleteMany()],
    ['PollOption', () => prisma.pollOption.deleteMany()],
    ['Poll', () => prisma.poll.deleteMany()],
    ['PostUpvote', () => prisma.postUpvote.deleteMany()],
    ['PostBookmark', () => prisma.postBookmark.deleteMany()],
    ['GameVote', () => prisma.gameVote.deleteMany()],

    // Comments & posts & categories assignments
    ['Comment', () => prisma.comment.deleteMany()],
    ['CategoryAssignment', () => prisma.categoryAssignment.deleteMany()],
    ['Post', () => prisma.post.deleteMany()],

    // Stories
    ['Story', () => prisma.story.deleteMany()],

    // Messages & group chats
    ['GroupChatMessage', () => prisma.groupChatMessage.deleteMany()],
    ['GroupChatMember', () => prisma.groupChatMember.deleteMany()],
    ['GroupChat', () => prisma.groupChat.deleteMany()],
    ['Message', () => prisma.message.deleteMany()],

    // Events
    ['EventRsvp', () => prisma.eventRsvp.deleteMany()],
    ['Event', () => prisma.event.deleteMany()],

    // Ads & transactions
    ['AdReservation', () => prisma.adReservation.deleteMany()],
    ['Ad', () => prisma.ad.deleteMany()],
    ['PromoRedemption', () => prisma.promoRedemption.deleteMany()],
    ['TransactionLog', () => prisma.transactionLog.deleteMany()],
    ['ProcessedStripeEvent', () => prisma.processedStripeEvent.deleteMany()],

    // Social graph
    ['Follows', () => prisma.follows.deleteMany()],
    ['TeamFollow', () => prisma.teamFollow.deleteMany()],
    ['OrganizationFollow', () => prisma.organizationFollow.deleteMany()],
    ['CategoryFollow', () => prisma.categoryFollow.deleteMany()],
    ['BlockedUser', () => prisma.blockedUser.deleteMany()],

    // Teams & orgs memberships/invites
    ['TeamMembership', () => prisma.teamMembership.deleteMany()],
    ['TeamInvite', () => prisma.teamInvite.deleteMany()],
    ['OrganizationMembership', () => prisma.organizationMembership.deleteMany()],
    ['OrganizationInvite', () => prisma.organizationInvite.deleteMany()],
    ['OrganizationJoinRequest', () => prisma.organizationJoinRequest.deleteMany()],

    // Games (after posts/events that reference them)
    ['Game', () => prisma.game.deleteMany()],

    // Teams & orgs (after memberships)
    ['Team', () => prisma.team.deleteMany()],
    ['Organization', () => prisma.organization.deleteMany()],

    // Users last (everything that references users is gone)
    ['User', () => prisma.user.deleteMany()],
  ];

  for (const [name, deleteFn] of steps) {
    const result = await deleteFn();
    if (result.count > 0) {
      console.log(`   ✅ ${name}: deleted ${result.count} rows`);
    } else {
      console.log(`   ⏭️  ${name}: 0 rows`);
    }
  }

  console.log('\n✅ Database wipe complete. Categories and promo codes preserved.');
}

async function main() {
  try {
    await wipeDatabase();
    await wipeCloudinary();
    console.log('\n🎉 Production wipe complete. Clean slate ready.');
  } catch (err) {
    console.error('\n❌ Error during wipe:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
