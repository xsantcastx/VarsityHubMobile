#!/usr/bin/env npx tsx
/**
 * backfill-usernames.ts
 *
 * Assigns a username to every account that is onboarded but has none. The app
 * shows users by @username only (client utils/userHandle.ts), so a null username
 * used to surface the person's real name (display_name) or a generic "User".
 *
 * All signup paths now generate a username up front (register / Google / Apple
 * via src/lib/usernameGenerator.ts). This backfill closes the gap for legacy
 * accounts created before that. It reuses the SAME generator as signup — reserved
 * -name-safe, unique, valid /^[a-z0-9_.]+$/, 3–20 chars — so there is one source
 * of truth for how usernames are minted.
 *
 * Dry run by default. Use --apply to write.
 *   cd server
 *   npx tsx scripts/backfill-usernames.ts          # dry run
 *   npx tsx scripts/backfill-usernames.ts --apply
 */
import { prisma } from '../src/lib/prisma.js';
import { generateUniqueUsername } from '../src/lib/usernameGenerator.js';

const apply = process.argv.includes('--apply');

const C = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

async function main() {
  console.log(`\n${C.bold}${C.cyan}═══ Backfill Usernames ═══${C.reset}`);
  console.log(
    `${C.dim}Mode: ${apply ? `${C.green}APPLY${C.reset}${C.dim} (writing to DB)` : `${C.yellow}DRY RUN${C.reset}${C.dim} (use --apply to write)`}${C.reset}\n`
  );

  // Onboarded accounts with no username — the set that can already post and
  // therefore surface on public feeds. Non-onboarded users get a username when
  // they finish onboarding (step-2) and are blocked from posting until then by
  // the requireOnboarded username gate.
  const nullUsername = await prisma.user.findMany({
    where: { username: null, onboarding_completed: true },
    select: { id: true, email: true, display_name: true },
    take: 100000,
  });

  if (nullUsername.length === 0) {
    console.log(`${C.green}No users need backfilling.${C.reset}\n`);
    await prisma.$disconnect();
    return;
  }

  console.log(`Found ${C.bold}${nullUsername.length}${C.reset} onboarded user(s) with no username:\n`);

  // Handles chosen earlier in this run but (in dry run) not yet persisted — the
  // shared generator checks this set so it never proposes the same handle twice.
  const claimedThisRun = new Set<string>();
  let updated = 0;
  let failed = 0;

  for (const user of nullUsername) {
    // Prefer the display name (a legacy account's real name makes a friendlier
    // handle than an email token), falling back to the email local-part.
    const base = user.display_name?.trim() || user.email.split('@')[0];
    let candidate: string;
    try {
      candidate = await generateUniqueUsername(base, prisma, claimedThisRun);
    } catch (err: any) {
      console.log(`  ${C.red}SKIP${C.reset}  ${user.email} — generator error: ${err?.message}`);
      failed++;
      continue;
    }
    claimedThisRun.add(candidate.toLowerCase());

    console.log(
      `  ${user.email.padEnd(35)} → ${C.green}${candidate}${C.reset}${user.display_name ? ` ${C.dim}(from "${user.display_name}")${C.reset}` : ''}`
    );

    if (apply) {
      try {
        await prisma.user.update({ where: { id: user.id }, data: { username: candidate } });
        updated++;
      } catch (err: any) {
        // A concurrent claim (P2002) — regenerate once against the live DB.
        if (err?.code === 'P2002') {
          const retry = await generateUniqueUsername(base, prisma, claimedThisRun);
          claimedThisRun.add(retry.toLowerCase());
          await prisma.user.update({ where: { id: user.id }, data: { username: retry } });
          console.log(`    ${C.yellow}retried${C.reset} → ${C.green}${retry}${C.reset}`);
          updated++;
        } else {
          console.log(`    ${C.red}ERROR${C.reset} — ${err?.message}`);
          failed++;
        }
      }
    } else {
      updated++;
    }
  }

  console.log(`\n${C.bold}Results:${C.reset}`);
  console.log(`  ${C.green}${updated}${C.reset} username(s) ${apply ? 'assigned' : 'would be assigned'}`);
  if (failed > 0) console.log(`  ${C.red}${failed}${C.reset} skipped/failed`);
  if (!apply) console.log(`\n${C.yellow}Run with --apply to write changes to the database.${C.reset}`);
  console.log('');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(`${C.red}Fatal:${C.reset}`, err);
  void prisma.$disconnect();
  process.exit(1);
});
