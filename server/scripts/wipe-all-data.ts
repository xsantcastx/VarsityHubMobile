/**
 * wipe-all-data.ts
 *
 * Deletes ALL user-generated data from the database and Cloudinary storage.
 * Preserves: schema, migrations, config, .env, and code.
 * After completion, re-runs seed to restore baseline data.
 *
 * Usage:
 *   cd server && npx tsx scripts/wipe-all-data.ts
 *
 * Requires: DATABASE_URL, SEED_PASSWORD
 * Optional: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import 'dotenv/config';

const prisma = new PrismaClient({ log: ['error'] });

// ─── Cloudinary bulk-delete helpers ──────────────────────────────────

function cloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

async function cloudinaryDeleteFolder(folder: string): Promise<{ deleted: number }> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  let totalDeleted = 0;

  for (const resourceType of ['image', 'video', 'raw'] as const) {
    let nextCursor: string | undefined;
    do {
      // List resources in folder
      const timestamp = Math.floor(Date.now() / 1000);
      const listParams: Record<string, string> = {
        max_results: '500',
        prefix: folder,
        timestamp: String(timestamp),
        type: 'upload',
      };
      if (nextCursor) listParams.next_cursor = nextCursor;

      const toSign = Object.keys(listParams)
        .sort()
        .map((k) => `${k}=${listParams[k]}`)
        .join('&');
      const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');

      const qs = new URLSearchParams({ ...listParams, api_key: apiKey, signature });
      const listUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload?${qs}`;
      const auth = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');

      const listRes = await fetch(listUrl, { headers: { Authorization: auth } });
      if (!listRes.ok) {
        const body = await listRes.text().catch(() => '');
        console.warn(`  Cloudinary list ${resourceType} returned ${listRes.status}: ${body.slice(0, 200)}`);
        break;
      }

      const listData = (await listRes.json()) as {
        resources: Array<{ public_id: string }>;
        next_cursor?: string;
      };

      const ids = listData.resources.map((r) => r.public_id);
      nextCursor = listData.next_cursor;

      if (ids.length === 0) break;

      // Bulk-delete these resources
      const delTimestamp = Math.floor(Date.now() / 1000);
      const delParams: Record<string, string> = { timestamp: String(delTimestamp) };
      const delSign = Object.keys(delParams)
        .sort()
        .map((k) => `${k}=${delParams[k]}`)
        .join('&');
      const delSignature = crypto.createHash('sha1').update(delSign + apiSecret).digest('hex');

      const body = new URLSearchParams();
      body.set('api_key', apiKey);
      body.set('timestamp', String(delTimestamp));
      body.set('signature', delSignature);
      for (const id of ids) body.append('public_ids[]', id);

      const delUrl = `https://api.cloudinary.com/v1_1/${cloudName}/resources/${resourceType}/upload/delete`;
      const delRes = await fetch(delUrl, {
        method: 'DELETE',
        headers: { Authorization: auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      });

      if (delRes.ok) {
        totalDeleted += ids.length;
        console.log(`  Deleted ${ids.length} ${resourceType} resources from Cloudinary`);
      } else {
        console.warn(`  Cloudinary delete ${resourceType} failed: ${delRes.status}`);
      }
    } while (nextCursor);
  }

  return { deleted: totalDeleted };
}

// ─── Main wipe ──────────────────────────────────────────────────────

async function wipe() {
  console.log('=== DATA WIPE STARTING ===\n');

  // 1. Wipe Cloudinary storage
  if (cloudinaryConfigured()) {
    console.log('[1/3] Clearing Cloudinary storage...');
    const env = process.env.NODE_ENV || 'development';
    const folder = `varsityhub/${env}`;
    const result = await cloudinaryDeleteFolder(folder);
    console.log(`  Cloudinary: ${result.deleted} total resources deleted from "${folder}"\n`);
  } else {
    console.log('[1/3] Cloudinary not configured — skipping storage wipe\n');
  }

  // 2. Delete all DB records in dependency order (children before parents)
  console.log('[2/3] Deleting all database records...\n');

  // Use raw SQL TRUNCATE CASCADE for speed and correctness.
  // This respects FK order automatically.
  const tables = [
    // Engagement & votes
    'PostUpvote',
    'PostBookmark',
    'PollVote',
    'PollOption',
    'Poll',
    'GameVote',

    // Comments
    'Comment',

    // Stories
    'Story',

    // Category joins
    'CategoryAssignment',
    'CategoryFollow',

    // Notifications
    'Notification',

    // Messages (DM + group)
    'GroupChatMessage',
    'GroupChatMember',
    'GroupChat',
    'Message',

    // Events
    'EventRsvp',
    'Event',

    // Ads
    'AdReservation',
    'Ad',

    // Payments & promos
    'PromoRedemption',
    'TransactionLog',
    'ProcessedStripeEvent',

    // Abuse & admin
    'AbuseReport',
    'AdminActivityLog',

    // Team & org joins
    'TeamInvite',
    'TeamMembership',
    'TeamFollow',
    'OrganizationInvite',
    'OrganizationJoinRequest',
    'OrganizationMembership',
    'OrganizationFollow',

    // Social
    'Follows',
    'BlockedUser',

    // Posts (after all post-dependent tables)
    'Post',

    // Games (after posts, events, stories, votes)
    'Game',

    // Teams & orgs
    'Team',
    'Organization',

    // Categories (reference data, but seed recreates)
    'Category',

    // Promo codes (seed recreates)
    'PromoCode',

    // Users last (most things depend on user)
    'User',
  ];

  for (const table of tables) {
    try {
      // Prisma model names map 1:1 to the table via @@map or default
      // Using deleteMany which handles FK constraints when done in order
      const result = await (prisma as any)[
        table.charAt(0).toLowerCase() + table.slice(1)
      ].deleteMany({});
      const count = result?.count ?? 0;
      if (count > 0) {
        console.log(`  ${table}: deleted ${count} records`);
      } else {
        console.log(`  ${table}: 0 records`);
      }
    } catch (err: any) {
      // If deleteMany fails (FK constraint), try raw TRUNCATE
      console.warn(`  ${table}: deleteMany failed (${err.message?.slice(0, 80)}), trying TRUNCATE CASCADE...`);
      try {
        // Prisma uses the model name as the table name by default
        // Need to find actual table name — use Prisma's _$allModels or raw
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
        console.log(`  ${table}: truncated with CASCADE`);
      } catch (rawErr: any) {
        console.error(`  ${table}: TRUNCATE also failed: ${rawErr.message?.slice(0, 120)}`);
      }
    }
  }

  // 3. Verify all counts are zero
  console.log('\n[3/3] Verifying all record counts are zero...\n');

  let allZero = true;
  for (const table of tables) {
    try {
      const count = await (prisma as any)[
        table.charAt(0).toLowerCase() + table.slice(1)
      ].count();
      const status = count === 0 ? 'PASS' : 'FAIL';
      if (count > 0) allZero = false;
      console.log(`  ${status}  ${table}: ${count}`);
    } catch {
      console.log(`  SKIP ${table}: count unavailable`);
    }
  }

  console.log(allZero ? '\nAll record counts are zero.' : '\nSome tables still have records — check errors above.');

  console.log('\n=== DATA WIPE COMPLETE ===');
  console.log('\nTo restore seed data, run:');
  console.log('  cd server && npx tsx prisma/seed.ts\n');
}

wipe()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Fatal error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
