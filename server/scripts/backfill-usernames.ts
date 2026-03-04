/**
 * Backfill Usernames for Onboarded Users
 *
 * Finds users with onboarding_completed = true but no username set,
 * and generates usernames from their display_name or email.
 *
 * Username rules (matching onboarding step-2):
 *   - Lowercase letters, numbers, dots, underscores only: /^[a-z0-9_.]+$/
 *   - Min 3, max 20 characters
 *   - Must be unique
 *
 * Usage: npx tsx scripts/backfill-usernames.ts
 *   --dry-run   Preview changes without writing (default)
 *   --apply      Actually write to DB
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dryRun = !process.argv.includes('--apply');

const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const USERNAME_RE = /^[a-z0-9_.]+$/;

/** Sanitize a string into a valid username base */
function sanitize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, '_')       // spaces → underscores
    .replace(/[^a-z0-9_.]/g, '') // strip invalid chars
    .replace(/\.{2,}/g, '.')    // collapse consecutive dots
    .replace(/_{2,}/g, '_')     // collapse consecutive underscores
    .slice(0, 16);              // leave room for suffix
}

/** Generate a candidate username from display_name or email */
function generateBase(user: { display_name: string | null; email: string }): string {
  // Prefer display_name
  if (user.display_name && user.display_name.trim().length >= 2) {
    const base = sanitize(user.display_name.trim());
    if (base.length >= 3) return base;
  }

  // Fallback to email local part
  const local = user.email.split('@')[0];
  const base = sanitize(local);
  if (base.length >= 3) return base;

  // Last resort: pad with numbers
  return base.padEnd(3, '0');
}

async function main() {
  console.log(`\n${BOLD}${CYAN}═══ Backfill Usernames ═══${RESET}`);
  console.log(`${DIM}Mode: ${dryRun ? `${YELLOW}DRY RUN${RESET}${DIM} (use --apply to write)` : `${GREEN}APPLY${RESET}${DIM} (writing to DB)`}${RESET}\n`);

  // Find all users with onboarding_completed but no username
  const allUsers = await prisma.user.findMany({
    where: { username: null },
    select: { id: true, email: true, display_name: true, preferences: true },
  });

  // Filter to only those with onboarding_completed = true
  const affected = allUsers.filter((u) => {
    const prefs = u.preferences as any;
    return prefs?.onboarding_completed === true;
  });

  if (affected.length === 0) {
    console.log(`${GREEN}No users need backfilling.${RESET}\n`);
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${BOLD}${affected.length}${RESET} user(s) with onboarding_completed but no username:\n`);

  // Gather all existing usernames for uniqueness checks
  const existingRows = await prisma.user.findMany({
    where: { username: { not: null } },
    select: { username: true },
  });
  const taken = new Set(existingRows.map((r) => r.username!.toLowerCase()));

  let updated = 0;
  let failed = 0;

  for (const user of affected) {
    const base = generateBase(user);
    let candidate = base.slice(0, 20);
    let suffix = 0;

    // Ensure uniqueness
    while (taken.has(candidate.toLowerCase())) {
      suffix++;
      const suffixStr = String(suffix);
      candidate = base.slice(0, 20 - suffixStr.length) + suffixStr;
    }

    // Final validation
    if (!USERNAME_RE.test(candidate) || candidate.length < 3 || candidate.length > 20) {
      console.log(`  ${RED}SKIP${RESET}  ${user.email} → "${candidate}" (invalid format)`);
      failed++;
      continue;
    }

    console.log(`  ${user.email.padEnd(35)} → ${GREEN}${candidate}${RESET}${user.display_name ? ` ${DIM}(from "${user.display_name}")${RESET}` : ''}`);

    if (!dryRun) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { username: candidate },
        });
        updated++;
      } catch (err: any) {
        // Handle race condition / unique constraint violation
        if (err?.code === 'P2002') {
          console.log(`    ${RED}CONFLICT${RESET} — username "${candidate}" taken (race condition), retrying...`);
          const retry = candidate.slice(0, 17) + '_' + String(Date.now()).slice(-3);
          await prisma.user.update({
            where: { id: user.id },
            data: { username: retry },
          });
          console.log(`    ${GREEN}OK${RESET} → ${retry}`);
          updated++;
        } else {
          console.log(`    ${RED}ERROR${RESET} — ${err.message}`);
          failed++;
        }
      }
    } else {
      updated++;
    }

    taken.add(candidate.toLowerCase());
  }

  console.log(`\n${BOLD}Results:${RESET}`);
  console.log(`  ${GREEN}${updated}${RESET} username(s) ${dryRun ? 'would be' : ''} assigned`);
  if (failed > 0) console.log(`  ${RED}${failed}${RESET} skipped/failed`);
  if (dryRun) console.log(`\n${YELLOW}Run with --apply to write changes to the database.${RESET}`);
  console.log('');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(`${RED}Fatal:${RESET}`, err);
  prisma.$disconnect();
  process.exit(1);
});
