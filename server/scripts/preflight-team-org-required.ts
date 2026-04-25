/**
 * Pre-flight check for migration `20260424220000_team_org_required`.
 *
 * Run this against the TARGET environment's DATABASE_URL BEFORE pushing the
 * migration. It counts orphan Team rows (NULL organization_id), prints the
 * worst offenders for inspection, and exits non-zero if the count exceeds
 * the migration's safety threshold.
 *
 * Usage:
 *   # Production check (read-only):
 *   cd server
 *   DATABASE_URL=postgresql://...prod-host... \
 *     npx tsx scripts/preflight-team-org-required.ts
 *
 * Exit codes:
 *   0  → safe to deploy (orphan count below threshold; migration will
 *        clean up the few rows and proceed)
 *   1  → orphan count exceeds threshold; do NOT push the migration until
 *        you understand where the nulls came from
 *   2  → connection / unexpected error
 *
 * The migration itself runs the same threshold check inside a `DO` block,
 * so a deploy that wasn't pre-flighted will still bail out — this script
 * is to fail fast in a CI / pre-deploy step instead of failing inside the
 * Railway container at startup.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const ORPHAN_THRESHOLD = 100;
const prisma = new PrismaClient();

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

async function main() {
  let count = 0;
  try {
    const rows = (await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      'SELECT COUNT(*)::bigint AS count FROM "Team" WHERE "organization_id" IS NULL'
    ));
    count = Number(rows[0]?.count ?? 0);
  } catch (err) {
    console.error(`${RED}Connection or query failed:${RESET}`, err);
    process.exit(2);
  }

  console.log(`Found ${count} orphan Team rows (organization_id IS NULL)`);
  console.log(`Threshold: ${ORPHAN_THRESHOLD}`);

  if (count === 0) {
    console.log(`${GREEN}✓ Safe to migrate. No orphan Team rows.${RESET}`);
    await prisma.$disconnect();
    process.exit(0);
  }

  // Show the worst offenders so an operator can sanity-check before the
  // migration deletes them.
  const sample = (await prisma.$queryRawUnsafe<Array<{
    id: string;
    name: string | null;
    status: string | null;
    created_at: Date;
  }>>(
    `SELECT id, name, status, created_at FROM "Team" WHERE "organization_id" IS NULL ORDER BY created_at DESC LIMIT 20`
  ));

  console.log(`\nFirst ${sample.length} orphan(s) (most recent):`);
  for (const t of sample) {
    console.log(`  ${t.id}  ${t.created_at.toISOString()}  status=${t.status ?? '?'}  name=${JSON.stringify(t.name)}`);
  }

  if (count > ORPHAN_THRESHOLD) {
    console.error(
      `\n${RED}✗ ABORT.${RESET} ${count} orphan rows exceeds threshold ${ORPHAN_THRESHOLD}. ` +
      `Investigate the data leak before deploying the migration.\n` +
      `If you've confirmed this is safe, raise ORPHAN_THRESHOLD in this script ` +
      `AND the migration's DO block to match (server/prisma/migrations/20260424220000_team_org_required/migration.sql).`
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(
    `\n${YELLOW}⚠ ${count} orphan row(s) will be deleted by the migration.${RESET} ` +
    `That's under the threshold (${ORPHAN_THRESHOLD}), so the deploy will proceed. ` +
    `Cascading FKs will clean up child TeamMembership / TeamFollow / TeamInvite / GroupChat rows; ` +
    `Event / Post team_id will be set NULL by their own FK rules.`
  );
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(`${RED}Unexpected error:${RESET}`, err);
  prisma.$disconnect();
  process.exit(2);
});
