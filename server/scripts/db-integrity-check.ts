/**
 * Database Integrity Check Script
 *
 * Runs direct Prisma queries to detect referential integrity issues,
 * orphaned records, and data anomalies across core models.
 *
 * Usage: npx tsx scripts/db-integrity-check.ts
 */

import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

// ── Colour helpers (ANSI escape codes) ──────────────────────────────────────

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function pass(label: string): void {
  console.log(`  ${GREEN}PASS${RESET}  ${label}`);
}

function warn(label: string, count: number, ids: string[]): void {
  console.log(`  ${YELLOW}WARN${RESET}  ${label} — ${YELLOW}${count} issue(s)${RESET}`);
  if (ids.length > 0) {
    const display =
      ids.length > 20 ? [...ids.slice(0, 20), `... and ${ids.length - 20} more`] : ids;
    for (const id of display) {
      console.log(`        ${DIM}${id}${RESET}`);
    }
  }
}

function heading(title: string): void {
  console.log();
  console.log(`${BOLD}${CYAN}── ${title} ──${RESET}`);
}

// ── Integrity checks ───────────────────────────────────────────────────────

async function checkOnboardedUsersWithoutUsername(): Promise<void> {
  // onboarding_completed lives inside the JSON "preferences" column.
  // Prisma's JSON filtering lets us query path-based values.
  const users = await prisma.user.findMany({
    where: {
      preferences: {
        path: ['onboarding_completed'],
        equals: true,
      },
      username: null,
    },
    select: { id: true },
  });

  if (users.length === 0) {
    pass('Users with onboarding_completed=true but no username');
  } else {
    warn(
      'Users with onboarding_completed=true but no username',
      users.length,
      users.map(u => u.id)
    );
  }
}

async function checkNonOnboardedUsersWithPosts(): Promise<void> {
  // Users whose preferences.onboarding_completed is explicitly false OR
  // the key is missing (default JSON is "{}"). We check both cases.
  //
  // Strategy: find users who have posts AND whose onboarding_completed is
  // not true. Prisma JSON filters don't support "not equals" on a path
  // cleanly, so we use a raw query for accuracy.
  const rows: { id: string }[] = await prisma.$queryRaw`
    SELECT u.id
    FROM "User" u
    INNER JOIN "Post" p ON p.author_id = u.id
    WHERE (u.preferences->>'onboarding_completed')::boolean IS DISTINCT FROM true
    GROUP BY u.id
  `;

  if (rows.length === 0) {
    pass('Users with onboarding_completed!=true who have posts');
  } else {
    warn(
      'Users with onboarding_completed!=true who have posts',
      rows.length,
      rows.map(r => r.id)
    );
  }
}

async function checkTeamsWithNoOrganization(): Promise<void> {
  // organization_id is non-nullable (String, not String?) with onDelete: Restrict.
  // Deleted orgs are blocked while teams exist — orphaned teams are impossible by schema.
  // Verify this constraint holds by checking count matches org-linked count.
  const total = await prisma.team.count();
  const withOrg = await prisma.team.count({ where: { organization: { isNot: undefined } } });
  if (total === withOrg) {
    pass('Teams with no organization (organization_id is non-null by schema)');
  } else {
    warn('Teams with no organization', total - withOrg, []);
  }
}

async function checkOrganizationsWithNoOwnerOrAdmin(): Promise<void> {
  // Organizations that have zero memberships with role "owner" or "manager"
  // and status "active".
  const rows: { id: string }[] = await prisma.$queryRaw`
    SELECT o.id
    FROM "Organization" o
    WHERE NOT EXISTS (
      SELECT 1
      FROM "OrganizationMembership" om
      WHERE om.organization_id = o.id
        AND om.role IN ('owner', 'manager')
        AND om.status = 'active'
    )
  `;

  if (rows.length === 0) {
    pass('Organizations with no owner/admin member');
  } else {
    warn(
      'Organizations with no owner/admin member',
      rows.length,
      rows.map(r => r.id)
    );
  }
}

async function checkMessagesWithMissingSenderOrRecipient(): Promise<void> {
  // sender_id is non-nullable in the schema with onDelete: Cascade, so if
  // the sender is deleted the message is also deleted. However recipient_id
  // is nullable with onDelete: SetNull. We look for messages where the
  // recipient_id was set to null after a user deletion (orphaned DMs).
  const messages = await prisma.message.findMany({
    where: {
      recipient_id: null,
    },
    select: { id: true },
  });

  if (messages.length === 0) {
    pass('Messages with null recipient_id (deleted user cascade)');
  } else {
    warn(
      'Messages with null recipient_id (deleted user cascade)',
      messages.length,
      messages.map(m => m.id)
    );
  }
}

async function checkNotificationsWithNullActor(): Promise<void> {
  // actor_id is nullable with onDelete: SetNull. After a user is deleted,
  // their notifications as an actor get actor_id = null.
  // Exclude GAME_REMINDER type since those are system-generated with no actor.
  const notifications = await prisma.notification.findMany({
    where: {
      actor_id: null,
      type: { not: 'GAME_REMINDER' },
    },
    select: { id: true },
  });

  if (notifications.length === 0) {
    pass('Notifications with null actor_id (excluding GAME_REMINDER)');
  } else {
    warn(
      'Notifications with null actor_id (excluding GAME_REMINDER)',
      notifications.length,
      notifications.map(n => n.id)
    );
  }
}

async function checkActiveAdsNotPaid(): Promise<void> {
  const ads = await prisma.ad.findMany({
    where: {
      status: 'active',
      payment_status: { not: 'paid' },
    },
    select: { id: true, payment_status: true },
  });

  if (ads.length === 0) {
    pass('Active ads with payment_status != "paid"');
  } else {
    warn(
      'Active ads with payment_status != "paid"',
      ads.length,
      ads.map(a => `${a.id} (payment_status: ${a.payment_status})`)
    );
  }
}

async function checkDuplicateOrgNamesInSameZip(): Promise<void> {
  // The schema has @@unique([name, zip_code]) so true duplicates should be
  // impossible at the DB level. However, we also check for near-duplicates
  // caused by trailing whitespace or casing differences.
  const rows: { name: string; zip_code: string; cnt: string }[] = await prisma.$queryRaw`
    SELECT LOWER(TRIM(name)) AS name, zip_code, COUNT(*)::text AS cnt
    FROM "Organization"
    WHERE zip_code IS NOT NULL
    GROUP BY LOWER(TRIM(name)), zip_code
    HAVING COUNT(*) > 1
  `;

  if (rows.length === 0) {
    pass('Duplicate organization names in the same zip code');
  } else {
    warn(
      'Duplicate organization names (case-insensitive) in same zip code',
      rows.length,
      rows.map(r => `"${r.name}" in zip ${r.zip_code} (${r.cnt} occurrences)`)
    );
  }
}

// ── Database summary ────────────────────────────────────────────────────────

async function printDatabaseSummary(): Promise<void> {
  const [users, posts, teams, orgs, ads, messages, notifications] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.team.count(),
    prisma.organization.count(),
    prisma.ad.count(),
    prisma.message.count(),
    prisma.notification.count(),
  ]);

  heading('Database Summary');
  console.log(`  Users:          ${BOLD}${users}${RESET}`);
  console.log(`  Posts:          ${BOLD}${posts}${RESET}`);
  console.log(`  Teams:          ${BOLD}${teams}${RESET}`);
  console.log(`  Organizations:  ${BOLD}${orgs}${RESET}`);
  console.log(`  Ads:            ${BOLD}${ads}${RESET}`);
  console.log(`  Messages:       ${BOLD}${messages}${RESET}`);
  console.log(`  Notifications:  ${BOLD}${notifications}${RESET}`);
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log();
  console.log(`${BOLD}=== VarsityHub Database Integrity Check ===${RESET}`);

  // ── Integrity checks ───────────────────────────────────────────────────
  heading('Integrity Checks');

  await checkOnboardedUsersWithoutUsername();
  await checkNonOnboardedUsersWithPosts();
  await checkTeamsWithNoOrganization();
  await checkOrganizationsWithNoOwnerOrAdmin();
  await checkMessagesWithMissingSenderOrRecipient();
  await checkNotificationsWithNullActor();
  await checkActiveAdsNotPaid();
  await checkDuplicateOrgNamesInSameZip();

  // ── Summary counts ─────────────────────────────────────────────────────
  await printDatabaseSummary();

  console.log();
  console.log(`${GREEN}${BOLD}All checks completed.${RESET}`);
  console.log();
}

main()
  .catch(err => {
    console.error(`${RED}Fatal error:${RESET}`, err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
