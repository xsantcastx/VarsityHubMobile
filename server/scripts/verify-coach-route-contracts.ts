/**
 * verify-coach-route-contracts.ts
 *
 * Static contract checks between API client routes and backend organization/admin routes.
 * Run: npm --prefix server run verify:coach-routes
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const entitiesPath = join(ROOT, '..', 'api', 'entities.ts');
const orgRoutesPath = join(ROOT, 'src', 'routes', 'organizations.ts');
const adminRoutesPath = join(ROOT, 'src', 'routes', 'admin.ts');

const entities = readFileSync(entitiesPath, 'utf8');
const orgRoutes = readFileSync(orgRoutesPath, 'utf8');
const adminRoutes = readFileSync(adminRoutesPath, 'utf8');

let failures = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`[PASS] ${name}`);
    return;
  }
  failures++;
  console.error(`[FAIL] ${name}${detail ? ` - ${detail}` : ''}`);
}

console.log('\n🔎 Verifying coach route contracts...\n');

check(
  'Client requestToJoin uses canonical /organizations/join-requests',
  entities.includes("requestToJoin: (organizationId: string, message?: string, role?: string) =>") &&
    entities.includes("httpPost('/organizations/join-requests', { organization_id: organizationId, message, role })"),
);

check(
  'Client rejectJoinRequest uses /deny',
  entities.includes('rejectJoinRequest: (requestId: string, reason?: string) => httpPost(`/organizations/join-requests/${encodeURIComponent(requestId)}/deny`, { reason })'),
);

check(
  'Client pendingCoaches uses /pending-coaches',
  entities.includes('pendingCoaches: (organizationId: string) => httpGet(`/organizations/${encodeURIComponent(organizationId)}/pending-coaches`)'),
);

check(
  'Server supports canonical join-requests endpoint',
  orgRoutes.includes("organizationsRouter.post('/join-requests', requireAuth as any, handleCreateJoinRequest);"),
);

check(
  'Server supports backward-compatible /:id/join-requests alias',
  orgRoutes.includes("organizationsRouter.post('/:id/join-requests', requireAuth as any"),
);

check(
  'Server supports backward-compatible /reject alias',
  orgRoutes.includes("organizationsRouter.post('/join-requests/:requestId/reject', requireAuth as any, handleDenyJoinRequest);"),
);

check(
  'Server supports backward-compatible /coaches/pending alias',
  orgRoutes.includes("organizationsRouter.get('/:id/coaches/pending', requireAuth as any, handleGetPendingCoaches);"),
);

check(
  'Wipe endpoint requires verified + admin middleware',
  adminRoutes.includes("adminRouter.post('/wipe-database', requireVerified as any, requireAdminMiddleware as any"),
);

if (failures > 0) {
  console.error(`\n${failures} contract check(s) failed.`);
  process.exit(1);
}

console.log('\nAll coach route contract checks passed.\n');
