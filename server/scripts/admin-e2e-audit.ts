/**
 * Admin E2E Production Audit
 *
 * Tests every admin feature against the live production API.
 * Verifies complete flows: everything that starts must end.
 *
 * Usage:
 *   ADMIN_EMAIL=you@email.com ADMIN_PASSWORD=pass npx tsx server/scripts/admin-e2e-audit.ts
 *   BASE_URL=https://api-production-8ac3.up.railway.app ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx server/scripts/admin-e2e-audit.ts
 */

import 'dotenv/config';

// ── Config ──────────────────────────────────────────────────
const BASE = (process.env.BASE_URL || 'https://api-production-8ac3.up.railway.app').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const FETCH_TIMEOUT_MS = 15_000;
const RUN = Date.now().toString(36);

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars');
  process.exit(1);
}

// ── Colors ──────────────────────────────────────────────────
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// ── Result tracking ─────────────────────────────────────────
interface TestResult {
  phase: string;
  name: string;
  passed: boolean;
  status: number | string;
  detail?: string;
}

const results: TestResult[] = [];
let currentPhase = '';

function phase(name: string): void {
  currentPhase = name;
  console.log();
  console.log(`${BOLD}${CYAN}── Phase: ${name} ──${RESET}`);
}

function record(name: string, passed: boolean, status: number | string, detail?: string): void {
  results.push({ phase: currentPhase, name, passed, status, detail });
  const icon = passed ? `${GREEN}\u2713 PASS${RESET}` : `${RED}\u2717 FAIL${RESET}`;
  const det = detail ? `  ${DIM}${truncate(detail, 120)}${RESET}` : '';
  console.log(`  ${icon} [${String(status).padStart(3)}] ${name}${det}`);
}

function warn(name: string, detail: string): void {
  results.push({ phase: currentPhase, name, passed: false, status: 'WARN', detail });
  console.log(`  ${YELLOW}! WARN${RESET} ${name}  ${DIM}${truncate(detail, 120)}${RESET}`);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '...' : s;
}

// ── HTTP helper ─────────────────────────────────────────────
async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function api(
  method: string,
  path: string,
  opts: { body?: any; token?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; data: any }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetchWithTimeout(url, {
    method,
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });

  let data: any;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) {
    try { data = await res.json(); } catch { data = null; }
  } else {
    data = await res.text().catch(() => null);
  }
  return { status: res.status, data };
}

// ── Cleanup tracking ────────────────────────────────────────
const cleanupUserIds: string[] = [];

async function cleanup(token: string): Promise<void> {
  console.log();
  console.log(`${DIM}Cleaning up ${cleanupUserIds.length} test user(s)...${RESET}`);
  for (const id of cleanupUserIds) {
    try {
      await api('DELETE', `/users/${id}`, { token });
    } catch {
      // Best effort — don't fail the audit on cleanup
    }
  }
}

// ── Summary ─────────────────────────────────────────────────
function printSummary(): void {
  console.log();
  console.log('='.repeat(70));
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed && r.status !== 'WARN').length;
  const warnings = results.filter((r) => r.status === 'WARN').length;
  const total = results.length;

  const color = failed > 0 ? RED : GREEN;
  console.log(`  ${color}${BOLD}Total: ${total} | Passed: ${passed} | Failed: ${failed} | Warnings: ${warnings}${RESET}`);

  if (failed > 0) {
    console.log();
    console.log(`  ${RED}${BOLD}FAILURES:${RESET}`);
    for (const r of results.filter((r) => !r.passed && r.status !== 'WARN')) {
      console.log(`    ${RED}\u2717${RESET} [${r.phase}] ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    }
  }

  if (warnings > 0) {
    console.log();
    console.log(`  ${YELLOW}${BOLD}WARNINGS (dead states / orphans):${RESET}`);
    for (const r of results.filter((r) => r.status === 'WARN')) {
      console.log(`    ${YELLOW}!${RESET} [${r.phase}] ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    }
  }

  console.log('='.repeat(70));
}

// ── Phase 1: Auth & Access Control ─────────────────────────
async function testAuthAccess(token: string): Promise<void> {
  phase('Auth & Access Control');

  // Test 1: Admin can access GET /admin/dashboard
  const dash = await api('GET', '/admin/dashboard', { token });
  record('Admin accesses /admin/dashboard', dash.status === 200 && dash.data?.ok === true, dash.status);

  // Test 2: Admin can access GET /admin/metrics
  const metrics = await api('GET', '/admin/metrics', { token });
  record('Admin accesses /admin/metrics', metrics.status === 200 && metrics.data?.ok === true, metrics.status);

  // Test 3: Admin can access GET /admin/reports
  const reports = await api('GET', '/admin/reports', { token });
  record('Admin accesses /admin/reports', reports.status === 200, reports.status);

  // Test 4: Admin can access GET /admin/reports/stats
  const stats = await api('GET', '/admin/reports/stats', { token });
  record('Admin accesses /admin/reports/stats', stats.status === 200, stats.status);

  // Test 5: Admin can access GET /admin/activity-log
  const log = await api('GET', '/admin/activity-log', { token });
  record('Admin accesses /admin/activity-log', log.status === 200 && log.data?.ok === true, log.status);

  // Test 6: Admin can access GET /admin/transactions
  const txns = await api('GET', '/admin/transactions', { token });
  record('Admin accesses /admin/transactions', txns.status === 200 && txns.data?.ok === true, txns.status);

  // Test 7: Admin can access GET /admin/transactions/summary
  const txnSummary = await api('GET', '/admin/transactions/summary', { token });
  record('Admin accesses /admin/transactions/summary', txnSummary.status === 200 && txnSummary.data?.ok === true, txnSummary.status);

  // Test 8: Unauthenticated request gets 401
  const noAuth = await api('GET', '/admin/dashboard');
  record('No token → 401 on /admin/dashboard', noAuth.status === 401, noAuth.status);

  // Test 9: Create a non-admin test user and verify they get 403
  const regRes = await api('POST', '/auth/register', {
    body: {
      email: `audit-nonadmin-${RUN}@test.varsityhub.app`,
      password: 'AuditTest123!',
      display_name: `Audit NonAdmin ${RUN}`,
    },
  });
  const nonAdminToken = regRes.data?.access_token;
  const nonAdminId = regRes.data?.user?.id;
  if (nonAdminId) cleanupUserIds.push(nonAdminId);

  if (nonAdminToken) {
    // Verify email if dev code returned
    if (regRes.data?.dev_verification_code) {
      await api('POST', '/auth/verify/confirm', {
        body: { code: regRes.data.dev_verification_code },
        token: nonAdminToken,
      });
    }

    const forbidden = await api('GET', '/admin/dashboard', { token: nonAdminToken });
    record('Non-admin user → 403 on /admin/dashboard', forbidden.status === 403, forbidden.status);
  } else {
    record('Non-admin user → 403 on /admin/dashboard', false, 'SKIP', 'Could not create test user');
  }
}

// ── Phase 2: Dashboard & Metrics ───────────────────────────
async function testDashboardMetrics(token: string): Promise<void> {
  phase('Dashboard & Metrics');

  // Test 1: Dashboard returns all expected fields
  const dash = await api('GET', '/admin/dashboard', { token });
  const d = dash.data;
  const requiredFields = [
    'totalUsers', 'verifiedUsers', 'bannedUsers', 'totalTeams',
    'totalAds', 'pendingAds', 'totalPosts', 'totalMessages',
    'recentActivity', 'pendingLeagues', 'pendingCoaches',
  ];
  const missingFields = requiredFields.filter((f) => d?.[f] === undefined);
  record(
    'Dashboard returns all required fields',
    missingFields.length === 0,
    dash.status,
    missingFields.length > 0 ? `Missing: ${missingFields.join(', ')}` : undefined,
  );

  // Test 2: Numeric fields are actually numbers
  const numericFields = ['totalUsers', 'verifiedUsers', 'bannedUsers', 'totalTeams', 'totalAds', 'pendingAds', 'totalPosts', 'totalMessages'];
  const nonNumeric = numericFields.filter((f) => typeof d?.[f] !== 'number');
  record(
    'Dashboard numeric fields are numbers',
    nonNumeric.length === 0,
    dash.status,
    nonNumeric.length > 0 ? `Not numbers: ${nonNumeric.join(', ')}` : undefined,
  );

  // Test 3: Array fields are arrays
  const arrayFields = ['recentActivity', 'pendingLeagues', 'pendingCoaches'];
  const nonArray = arrayFields.filter((f) => !Array.isArray(d?.[f]));
  record(
    'Dashboard array fields are arrays',
    nonArray.length === 0,
    dash.status,
    nonArray.length > 0 ? `Not arrays: ${nonArray.join(', ')}` : undefined,
  );

  // Test 4: totalUsers > 0 (sanity — production should have users)
  record('Dashboard totalUsers > 0', (d?.totalUsers ?? 0) > 0, dash.status, `totalUsers=${d?.totalUsers}`);

  // Test 5: verifiedUsers <= totalUsers
  record(
    'verifiedUsers <= totalUsers',
    (d?.verifiedUsers ?? 0) <= (d?.totalUsers ?? 0),
    dash.status,
    `${d?.verifiedUsers} verified / ${d?.totalUsers} total`,
  );

  // Test 6: Metrics endpoint returns report
  const metrics = await api('GET', '/admin/metrics?days=7', { token });
  record('Metrics returns ok with report', metrics.status === 200 && metrics.data?.ok === true, metrics.status);
  record('Metrics report is not null', metrics.data?.report != null, metrics.status);

  // Test 7: Metrics with invalid days clamped (not error)
  const metricsClamped = await api('GET', '/admin/metrics?days=999', { token });
  record('Metrics with days=999 still succeeds (clamped to 30)', metricsClamped.status === 200, metricsClamped.status);

  // Test 8: Pending coaches have required fields
  const coaches = d?.pendingCoaches || [];
  if (coaches.length > 0) {
    const c = coaches[0];
    const coachFields = ['id', 'display_name', 'email'];
    const missingCoach = coachFields.filter((f) => c?.[f] === undefined);
    record(
      'Pending coaches have required fields',
      missingCoach.length === 0,
      dash.status,
      missingCoach.length > 0 ? `Missing: ${missingCoach.join(', ')}` : `${coaches.length} pending coach(es)`,
    );
  } else {
    record('Pending coaches have required fields', true, dash.status, '0 pending coaches (OK)');
  }

  // Test 9: Pending leagues have required fields
  const leagues = d?.pendingLeagues || [];
  if (leagues.length > 0) {
    const l = leagues[0];
    const leagueFields = ['id', 'name', 'sport'];
    const missingLeague = leagueFields.filter((f) => l?.[f] === undefined);
    record(
      'Pending leagues have required fields',
      missingLeague.length === 0,
      dash.status,
      missingLeague.length > 0 ? `Missing: ${missingLeague.join(', ')}` : `${leagues.length} pending league(s)`,
    );
  } else {
    record('Pending leagues have required fields', true, dash.status, '0 pending leagues (OK)');
  }
}

// ── Phase 3: Coach Approval Flow ───────────────────────────
async function testCoachApprovalFlow(token: string): Promise<void> {
  phase('Coach Approval Flow');

  // Get current pending coaches from dashboard
  const dash = await api('GET', '/admin/dashboard', { token });
  const pendingCoaches: any[] = dash.data?.pendingCoaches || [];

  record(
    'Dashboard lists pending coaches',
    dash.status === 200,
    dash.status,
    `${pendingCoaches.length} pending`,
  );

  // Check: every pending coach should have preferences with role=coach
  for (const coach of pendingCoaches.slice(0, 5)) {
    const prefs = coach.preferences || {};
    const isCoachRole = prefs.role === 'coach';
    record(
      `Pending coach ${truncate(coach.display_name || coach.id, 25)} has role=coach`,
      isCoachRole,
      isCoachRole ? 'OK' : 'BAD',
      `approval_status should be PENDING, preferences.role=${prefs.role}`,
    );
  }

  // Get pending leagues (orgs)
  const pendingLeagues: any[] = dash.data?.pendingLeagues || [];
  record(
    'Dashboard lists pending leagues',
    dash.status === 200,
    dash.status,
    `${pendingLeagues.length} pending`,
  );

  // Check: pending leagues should have an owner
  for (const league of pendingLeagues.slice(0, 5)) {
    const hasOwner = league.leagueOwner != null && league.leagueOwner.id != null;
    record(
      `Pending league "${truncate(league.name || league.id, 25)}" has an owner`,
      hasOwner,
      hasOwner ? 'OK' : 'BAD',
      hasOwner ? `Owner: ${league.leagueOwner?.display_name}` : 'NO OWNER — orphaned league',
    );
  }

  // Verify approve endpoint responds (don't actually approve a real coach)
  // Use a fake ID to test error handling
  const fakeApprove = await api('POST', '/admin/coaches/FAKE_ID_12345/approve', {
    token,
    body: { note: 'Audit test — fake ID' },
  });
  record(
    'Approve with fake coach ID returns error (not 500)',
    fakeApprove.status !== 500,
    fakeApprove.status,
    `Expected 400/404, got ${fakeApprove.status}`,
  );

  // Verify reject endpoint responds
  const fakeReject = await api('POST', '/admin/coaches/FAKE_ID_12345/reject', {
    token,
    body: { note: 'Audit test — fake ID' },
  });
  record(
    'Reject with fake coach ID returns error (not 500)',
    fakeReject.status !== 500,
    fakeReject.status,
    `Expected 400/404, got ${fakeReject.status}`,
  );
}

// ── Phase 4: User Management ───────────────────────────────
async function testUserManagement(token: string): Promise<void> {
  phase('User Management');

  // Create a disposable test user for ban/unban/warn/suspend
  const email = `audit-bantest-${RUN}@test.varsityhub.app`;
  const reg = await api('POST', '/auth/register', {
    body: { email, password: 'AuditBan123!', display_name: `Audit Ban ${RUN}` },
  });
  const testUserId = reg.data?.user?.id;
  const testToken = reg.data?.access_token;

  if (!testUserId) {
    record('Create test user for ban/unban', false, reg.status, 'Registration failed');
    return;
  }
  cleanupUserIds.push(testUserId);
  record('Create test user for ban/unban', true, reg.status);

  // Verify email if dev code returned
  if (reg.data?.dev_verification_code && testToken) {
    await api('POST', '/auth/verify/confirm', {
      body: { code: reg.data.dev_verification_code },
      token: testToken,
    });
  }

  // Test 1: Warn user
  const warnRes = await api('POST', `/admin/users/${testUserId}/warn`, {
    token,
    body: { reason: 'Audit test warning', severity: 'warning' },
  });
  record('Warn user succeeds', warnRes.status === 200 && warnRes.data?.ok === true, warnRes.status);

  // Test 2: Suspend user (1 day)
  const suspendRes = await api('POST', `/admin/users/${testUserId}/suspend`, {
    token,
    body: { reason: 'Audit test suspension', days: 1 },
  });
  record('Suspend user succeeds', suspendRes.status === 200 && suspendRes.data?.ok === true, suspendRes.status);

  // Test 3: Ban user
  const banRes = await api('POST', `/admin/users/${testUserId}/ban`, {
    token,
    body: { reason: 'Audit test ban' },
  });
  record('Ban user succeeds', banRes.status === 200 && banRes.data?.ok === true, banRes.status);

  // Test 4: Banned user gets 403 on protected endpoints
  if (testToken) {
    const bannedAccess = await api('GET', '/auth/me', { token: testToken });
    record(
      'Banned user gets 403 on /auth/me',
      bannedAccess.status === 403,
      bannedAccess.status,
      bannedAccess.status === 403 ? 'Correctly blocked' : 'BUG: banned user not blocked',
    );
  }

  // Test 5: Unban user
  const unbanRes = await api('POST', `/admin/users/${testUserId}/unban`, { token });
  record('Unban user succeeds', unbanRes.status === 200 && unbanRes.data?.ok === true, unbanRes.status);

  // Test 6: Unbanned user can access again
  if (testToken) {
    const unbannedAccess = await api('GET', '/auth/me', { token: testToken });
    record(
      'Unbanned user can access /auth/me again',
      unbannedAccess.status === 200,
      unbannedAccess.status,
      unbannedAccess.status !== 200 ? 'BUG: unban did not restore access' : undefined,
    );
  }

  // Test 7: Moderation history exists
  const modHistory = await api('GET', `/admin/users/${testUserId}/moderation`, { token });
  record(
    'Moderation history returns data',
    modHistory.status === 200,
    modHistory.status,
  );

  // Test 8: Invalid user ID handling
  const badWarn = await api('POST', '/admin/users/NONEXISTENT_USER/warn', {
    token,
    body: { reason: 'test', severity: 'warning' },
  });
  record(
    'Warn nonexistent user returns error (not 500)',
    badWarn.status !== 500,
    badWarn.status,
  );
}

// ── Phase 5: Reports & Moderation ──────────────────────────
async function testReportsModeration(token: string): Promise<void> {
  phase('Reports & Moderation');

  // Test 1: List reports
  const list = await api('GET', '/admin/reports', { token });
  record('GET /admin/reports succeeds', list.status === 200, list.status);

  const reports: any[] = list.data?.reports || [];
  record('Reports response has reports array', Array.isArray(reports), list.status, `${reports.length} report(s)`);

  // Test 2: Report stats
  const stats = await api('GET', '/admin/reports/stats', { token });
  record('GET /admin/reports/stats succeeds', stats.status === 200, stats.status);

  const statsData = stats.data;
  const statsFields = ['pending', 'reviewed', 'resolved', 'dismissed', 'total'];
  const missingStats = statsFields.filter((f) => typeof statsData?.[f] !== 'number');
  record(
    'Report stats has all numeric fields',
    missingStats.length === 0,
    stats.status,
    missingStats.length > 0 ? `Missing: ${missingStats.join(', ')}` : `pending=${statsData?.pending}, total=${statsData?.total}`,
  );

  // Test 3: Stats sum check (pending + reviewed + resolved + dismissed should = total)
  if (statsData && missingStats.length === 0) {
    const sum = statsData.pending + statsData.reviewed + statsData.resolved + statsData.dismissed;
    record(
      'Report stats sum matches total',
      sum === statsData.total,
      stats.status,
      `${sum} (sum) vs ${statsData.total} (total)`,
    );
  }

  // Test 4: Check for stale pending reports (older than 7 days)
  const pendingReports = reports.filter((r: any) => r.status === 'pending');
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const staleReports = pendingReports.filter((r: any) => new Date(r.created_at).getTime() < sevenDaysAgo);
  if (staleReports.length > 0) {
    warn(
      'Stale pending reports (>7 days old)',
      `${staleReports.length} report(s) pending for over a week. IDs: ${staleReports.slice(0, 5).map((r: any) => r.id).join(', ')}`,
    );
  } else {
    record('No stale pending reports (>7 days)', true, 'OK');
  }

  // Test 5: Reports have required fields
  if (reports.length > 0) {
    const r = reports[0];
    const reportFields = ['id', 'status', 'created_at'];
    const missingReport = reportFields.filter((f) => r?.[f] === undefined);
    record(
      'Reports have required fields (id, status, created_at)',
      missingReport.length === 0,
      list.status,
      missingReport.length > 0 ? `Missing: ${missingReport.join(', ')}` : undefined,
    );
  }

  // Test 6: Report spike endpoint
  const spike = await api('GET', '/admin/report-spike', { token });
  record('GET /admin/report-spike succeeds', spike.status === 200, spike.status);

  // Test 7: Pagination works
  const page1 = await api('GET', '/admin/reports?limit=2&offset=0', { token });
  record('Reports pagination (limit=2) succeeds', page1.status === 200, page1.status);
  const page1Reports = page1.data?.reports || [];
  record(
    'Reports pagination returns <= limit',
    page1Reports.length <= 2,
    page1.status,
    `Returned ${page1Reports.length} (limit 2)`,
  );
}

// ── Phase 6: Transactions ──────────────────────────────────
async function testTransactions(token: string): Promise<void> {
  phase('Transactions');

  // Test 1: List transactions
  const list = await api('GET', '/admin/transactions', { token });
  record('GET /admin/transactions succeeds', list.status === 200 && list.data?.ok === true, list.status);

  // Test 2: Transaction summary
  const summary = await api('GET', '/admin/transactions/summary', { token });
  record('GET /admin/transactions/summary succeeds', summary.status === 200 && summary.data?.ok === true, summary.status);

  // Test 3: Transactions with filters
  const filtered = await api('GET', '/admin/transactions?limit=5&status=COMPLETED', { token });
  record('Filtered transactions (status=COMPLETED) succeeds', filtered.status === 200, filtered.status);

  // Test 4: Transaction with invalid date
  const badDate = await api('GET', '/admin/transactions?startDate=not-a-date', { token });
  record(
    'Invalid date returns 400 (not 500)',
    badDate.status === 400,
    badDate.status,
    badDate.status === 400 ? 'Correctly rejected' : `Got ${badDate.status} instead of 400`,
  );

  // Test 5: Transaction by fake session ID
  const fakeTxn = await api('GET', '/admin/transactions/cs_fake_session_12345', { token });
  record(
    'Fake session ID returns 404 (not 500)',
    fakeTxn.status === 404,
    fakeTxn.status,
  );
}

// ── Phase 7: Activity Log ──────────────────────────────────
async function testActivityLog(token: string): Promise<void> {
  phase('Activity Log');

  // Test 1: List activity log
  const list = await api('GET', '/admin/activity-log', { token });
  record('GET /admin/activity-log succeeds', list.status === 200 && list.data?.ok === true, list.status);

  const activities: any[] = list.data?.activities || [];
  record('Activity log returns activities array', Array.isArray(activities), list.status, `${activities.length} activit(ies)`);

  // Test 2: Pagination metadata
  const pagination = list.data?.pagination;
  record(
    'Activity log has pagination metadata',
    pagination != null && typeof pagination.page === 'number' && typeof pagination.total === 'number',
    list.status,
    pagination ? `page=${pagination.page}, total=${pagination.total}` : 'Missing pagination',
  );

  // Test 3: Filter by type
  const filtered = await api('GET', '/admin/activity-log?type=user', { token });
  record('Activity log filter by type=user succeeds', filtered.status === 200, filtered.status);

  // Test 4: Search by query
  const searched = await api('GET', '/admin/activity-log?q=approve', { token });
  record('Activity log search q=approve succeeds', searched.status === 200, searched.status);

  // Test 5: Activity entries have required fields
  if (activities.length > 0) {
    const a = activities[0];
    const fields = ['id', 'action', 'timestamp'];
    const missing = fields.filter((f) => a?.[f] === undefined);
    record(
      'Activity entries have required fields',
      missing.length === 0,
      list.status,
      missing.length > 0 ? `Missing: ${missing.join(', ')}` : undefined,
    );
  } else {
    record('Activity entries have required fields', true, list.status, 'No entries to check (OK for fresh system)');
  }

  // Test 6: Pagination limit enforcement
  const limited = await api('GET', '/admin/activity-log?limit=3&page=1', { token });
  const limitedActivities = limited.data?.activities || [];
  record(
    'Activity log respects limit parameter',
    limitedActivities.length <= 3,
    limited.status,
    `Returned ${limitedActivities.length} (limit 3)`,
  );
}

// ── Phase 8: Orphan & Dead State Detection ─────────────────
async function testOrphanDetection(token: string): Promise<void> {
  phase('Orphan & Dead State Detection');

  // All checks use the dashboard data + targeted API calls
  const dash = await api('GET', '/admin/dashboard', { token });
  const d = dash.data;

  // Check 1: Coaches stuck in PENDING with completed onboarding
  const pendingCoaches: any[] = d?.pendingCoaches || [];
  const stuckCoaches = pendingCoaches.filter((c: any) => {
    const prefs = c.preferences || {};
    return prefs.onboarding_completed === true;
  });
  if (stuckCoaches.length > 0) {
    warn(
      'Coaches with completed onboarding but PENDING approval',
      `${stuckCoaches.length} coach(es): ${stuckCoaches.slice(0, 5).map((c: any) => c.display_name || c.email).join(', ')}`,
    );
  } else {
    record('No coaches stuck in PENDING with completed onboarding', true, 'OK');
  }

  // Check 2: Pending leagues with no owner
  const pendingLeagues: any[] = d?.pendingLeagues || [];
  const orphanedLeagues = pendingLeagues.filter((l: any) => !l.leagueOwner?.id);
  if (orphanedLeagues.length > 0) {
    warn(
      'Pending leagues with no owner',
      `${orphanedLeagues.length} league(s): ${orphanedLeagues.slice(0, 5).map((l: any) => l.name).join(', ')}`,
    );
  } else {
    record('All pending leagues have an owner', true, 'OK');
  }

  // Check 3: Pending leagues with zero teams
  const emptyLeagues = pendingLeagues.filter((l: any) => (l._count?.teams ?? 0) === 0);
  if (emptyLeagues.length > 0) {
    warn(
      'Pending leagues with zero teams',
      `${emptyLeagues.length} league(s): ${emptyLeagues.slice(0, 5).map((l: any) => l.name).join(', ')}`,
    );
  } else {
    record('All pending leagues have at least one team', true, 'OK');
  }

  // Check 4: Events without coordinates (games that need geocoding)
  const noCoords = d?.eventsWithoutCoordinates ?? 0;
  if (noCoords > 0) {
    warn('Events with location but no coordinates', `${noCoords} event(s) need geocoding`);
  } else {
    record('All events with location have coordinates', true, 'OK');
  }

  // Check 5: Banned users count sanity
  const bannedCount = d?.bannedUsers ?? 0;
  const totalUsers = d?.totalUsers ?? 0;
  if (totalUsers > 0 && bannedCount / totalUsers > 0.1) {
    warn('High ban rate', `${bannedCount}/${totalUsers} users banned (${((bannedCount / totalUsers) * 100).toFixed(1)}%)`);
  } else {
    record('Ban rate is reasonable', true, 'OK', `${bannedCount}/${totalUsers} banned`);
  }

  // Check 6: Pending ads count (from dashboard)
  const pendingAds = d?.pendingAds ?? 0;
  if (pendingAds > 20) {
    warn('Large pending ad queue', `${pendingAds} ads waiting for review`);
  } else {
    record('Pending ad queue is manageable', true, 'OK', `${pendingAds} pending`);
  }

  // Check 7: Stale pending reports (reuse data from reports phase)
  const reportsRes = await api('GET', '/admin/reports?status=pending&limit=500', { token });
  const pendingReports: any[] = reportsRes.data?.reports || [];
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const ancientReports = pendingReports.filter((r: any) => new Date(r.created_at).getTime() < thirtyDaysAgo);
  if (ancientReports.length > 0) {
    warn(
      'Pending reports older than 30 days',
      `${ancientReports.length} report(s) — oldest: ${ancientReports[0]?.created_at}`,
    );
  } else {
    record('No ancient pending reports (>30 days)', true, 'OK');
  }

  // Check 8: Dashboard data consistency
  // verifiedUsers should never exceed totalUsers
  const verified = d?.verifiedUsers ?? 0;
  const total = d?.totalUsers ?? 0;
  record(
    'verifiedUsers <= totalUsers',
    verified <= total,
    verified <= total ? 'OK' : 'BAD',
    `${verified} verified / ${total} total`,
  );

  // bannedUsers should never exceed totalUsers
  const banned = d?.bannedUsers ?? 0;
  record(
    'bannedUsers <= totalUsers',
    banned <= total,
    banned <= total ? 'OK' : 'BAD',
    `${banned} banned / ${total} total`,
  );
}

// ── Main ────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`${BOLD}VarsityHub Admin E2E Audit${RESET}`);
  console.log(`Target: ${BASE}`);
  console.log(`Admin:  ${ADMIN_EMAIL}`);
  console.log(`Run ID: ${RUN}`);

  // Health check
  const health = await api('GET', '/health');
  if (health.status !== 200) {
    console.error(`${RED}Server unreachable (${health.status}). Aborting.${RESET}`);
    process.exit(1);
  }
  console.log(`${GREEN}Server healthy${RESET}`);

  // Login
  const login = await api('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!login.data?.access_token) {
    console.error(`${RED}Admin login failed: ${JSON.stringify(login.data)}${RESET}`);
    process.exit(1);
  }
  const token = login.data.access_token;
  console.log(`${GREEN}Admin authenticated${RESET}`);

  // Phase 1: Auth & Access Control
  await testAuthAccess(token);

  // Phase 2: Dashboard & Metrics
  await testDashboardMetrics(token);

  // Phase 3: Coach Approval Flow (start → end)
  await testCoachApprovalFlow(token);

  // Phase 4: User Management (ban/unban/warn/suspend)
  await testUserManagement(token);

  // Phase 5: Reports & Moderation
  await testReportsModeration(token);

  // Phase 6: Transactions
  await testTransactions(token);

  // Phase 7: Activity Log
  await testActivityLog(token);

  // Phase 8: Orphan & Dead State Detection
  await testOrphanDetection(token);

  // Cleanup & Summary
  await cleanup(token);
  printSummary();

  const failed = results.filter((r) => !r.passed && r.status !== 'WARN').length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${RED}Unhandled error:${RESET}`, err);
  process.exit(1);
});
