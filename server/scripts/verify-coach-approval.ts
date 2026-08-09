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
  // Middleware now uses canonical role helpers rather than reading prefs.role
  // directly; the approval gate still blocks any coach whose status is not
  // explicitly APPROVED.
  /role === 'coach' && u\?\.approval_status !== 'APPROVED'/.test(onboarded),
);

// 2. POST /organizations conditionally sets creator to PENDING when approval must be re-checked
const orgRoutes = read('src/routes/organizations.ts');
const conditionalPendingWrite = /\.\.\.\(shouldForcePendingApproval \? \{ approval_status: 'PENDING' \} : \{\}\)/;
check(
  'POST /organizations conditionally sets creator to PENDING',
  conditionalPendingWrite.test(orgRoutes)
);

// 3. POST /organizations/create routes through the shared create handler with
// the force-pending decision computed for that route too.
const createRouteHasConditionalPending =
  /organizationsRouter\.post\(\s*['"]\/create['"][\s\S]*?shouldForcePendingApprovalOnOrganizationCreate[\s\S]*?handleOrganizationCreateRequest[\s\S]*?routeTag:\s*['"]\/create['"]/m
    .test(orgRoutes);
check(
  'POST /organizations/create uses shared conditional pending approval flow',
  createRouteHasConditionalPending
);

// 4. League approval routes through the shared approval handler and writes approved status
check(
  'League approval routes through the shared approval handler',
  orgRoutes.includes('league_owner_id') &&
   orgRoutes.includes("approval_status: 'approved'") &&
  orgRoutes.includes('approveLeagueHandler'),
);

// 5. Coach approval by league owner
check(
  'League owner can approve coaches (POST /join-requests/:requestId/approve)',
  orgRoutes.includes('/join-requests/:requestId/approve') &&
   orgRoutes.includes('Only the organization owner can approve coach requests') &&
   orgRoutes.includes("approval_status: 'approved'"),
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
