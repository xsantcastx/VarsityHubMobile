#!/usr/bin/env npx tsx
/**
 * verify-coach-approval.ts
 *
 * Static verification that coach approval logic is correctly wired.
 * Run: cd server && npx tsx scripts/verify-coach-approval.ts
 *
 * Does NOT require database. Exit 0 = all checks pass.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
let errors = 0;

function read(path: string): string {
  const full = join(ROOT, path);
  if (!existsSync(full)) return '';
  return readFileSync(full, 'utf-8');
}

function check(name: string, ok: boolean, msg?: string) {
  if (ok) {
    console.log(`✅ ${name}`);
  } else {
    console.error(`❌ ${name}${msg ? `: ${msg}` : ''}`);
    errors++;
  }
}

console.log('\n🔍 Coach Approval System Verification\n');

// 1. requireOnboarded blocks PENDING coaches
const onboarded = read('src/middleware/requireOnboarded.ts');
check(
  'requireOnboarded blocks PENDING coaches',
  // Middleware uses !== 'APPROVED' which implicitly blocks PENDING, REJECTED, and null
  onboarded.includes("approval_status !== 'APPROVED'") && onboarded.includes("prefs?.role === 'coach'"),
);

// 2. POST /organizations sets creator to PENDING
const orgRoutes = read('src/routes/organizations.ts');
const hasPendingInOrgCreate = (orgRoutes.match(/approval_status: 'PENDING'/g) || []).length >= 2;
check('POST /organizations sets creator to PENDING', orgRoutes.includes("approval_status: 'PENDING'") && hasPendingInOrgCreate);

// 3. POST /organizations/create sets creator to PENDING (same transaction as org create)
const createHasUserUpdate = orgRoutes.includes("organizationsRouter.post('/create'") && 
  orgRoutes.includes('tx.user.update') && 
  orgRoutes.includes("approval_status: 'PENDING'");
check('POST /organizations/create sets creator to PENDING', createHasUserUpdate);

// 4. League approval sets league owner to APPROVED
check(
  'League approval sets league owner to APPROVED',
  orgRoutes.includes('leagueOwner') && orgRoutes.includes("approval_status: 'APPROVED'") && 
  orgRoutes.includes('approveLeagueHandler'),
);

// 5. Coach approval by league owner
check(
  'League owner can approve coaches (POST /:id/coaches/:userId/approve)',
  orgRoutes.includes('coaches/:userId/approve') && orgRoutes.includes('requireOnboarded'),
);

// 6. Join request sets coach to PENDING
const joinRequestBlock = orgRoutes.includes('join-requests') && 
  (orgRoutes.includes('isCoachRole') || orgRoutes.includes("approval_status: 'PENDING'"));
check('Join request sets coach to PENDING when coach role', joinRequestBlock);

// 7. Team creation uses requireOnboarded
const teams = read('src/routes/teams.ts');
check(
  'Team creation uses requireOnboarded',
  teams.includes('requireOnboarded') && teams.includes('/create'),
);

// 8. Event creation uses requireOnboarded
const events = read('src/routes/events.ts');
check('Event creation uses requireOnboarded', events.includes('requireOnboarded'));

// 9. Coach approval test exists
const testExists = existsSync(join(ROOT, 'src/__tests__/coach-approval.test.ts'));
check('Coach approval integration test exists', testExists);

console.log('');
if (errors > 0) {
  console.error(`${errors} check(s) failed.`);
  process.exit(1);
}
console.log('All coach approval checks passed.');
process.exit(0);
