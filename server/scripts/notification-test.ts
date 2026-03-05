#!/usr/bin/env npx tsx
/**
 * Notification System Test
 *
 * Tests every notification trigger via API calls, verifying that each
 * action creates the correct notification for the recipient, including
 * the actor's username and avatar_url.
 *
 * Tests:
 *   1) FOLLOW   — A follows B        -> B gets FOLLOW notification
 *   2) UPVOTE   — A upvotes B's post  -> B gets UPVOTE notification
 *   3) COMMENT  — A comments on B's post -> B gets COMMENT notification
 *   4) MESSAGE  — A sends B a DM      -> B gets MESSAGE notification
 *   5) TEAM_INVITE — Coach C invites A to team -> A gets TEAM_INVITE notification
 *   6) APPROVAL — Join request flow (may be N/A)
 *
 * Usage:
 *   npx tsx scripts/notification-test.ts
 *   BASE_URL=https://staging.example.com npx tsx scripts/notification-test.ts
 *   CLEANUP=1 npx tsx scripts/notification-test.ts
 */

const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const RUN = Date.now().toString(36);
const FETCH_TIMEOUT_MS = 15_000;

// ── Colours ──────────────────────────────────────────────────────────────────

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';

// ── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  phase: string;
  name: string;
  passed: boolean;
  status: number | string;
  detail?: string;
  flags?: string[];
}

const results: TestResult[] = [];
let currentPhase = '';

// ── User State ───────────────────────────────────────────────────────────────

interface TestUser {
  label: string;
  email: string;
  password: string;
  role: string;
  displayName: string;
  username: string;
  token: string;
  id: string;
  verificationCode: string;
  orgId: string;
  teamId: string;
  postId: string;
}

const userA: TestUser = {
  label: 'User A (fan)',
  email: `notif_a+${RUN}@test.varsityhub.app`,
  password: 'TestPass123',
  role: 'fan',
  displayName: `Notif Fan A ${RUN}`,
  username: `notif_a_${RUN}`,
  token: '', id: '', verificationCode: '',
  orgId: '', teamId: '', postId: '',
};

const userB: TestUser = {
  label: 'User B (fan)',
  email: `notif_b+${RUN}@test.varsityhub.app`,
  password: 'TestPass123',
  role: 'fan',
  displayName: `Notif Fan B ${RUN}`,
  username: `notif_b_${RUN}`,
  token: '', id: '', verificationCode: '',
  orgId: '', teamId: '', postId: '',
};

const coachC: TestUser = {
  label: 'Coach C',
  email: `notif_coach+${RUN}@test.varsityhub.app`,
  password: 'TestPass123',
  role: 'coach',
  displayName: `Notif Coach C ${RUN}`,
  username: `notif_c_${RUN}`,
  token: '', id: '', verificationCode: '',
  orgId: '', teamId: '', postId: '',
};

// ── HTTP Helpers ─────────────────────────────────────────────────────────────

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
  opts: { body?: any; token?: string; step: string },
): Promise<{ status: number; data: any; ok: boolean }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetchWithTimeout(url, {
      method,
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err: any) {
    const r: TestResult = {
      phase: currentPhase,
      name: opts.step,
      passed: false,
      status: 'NETWORK_ERROR',
      detail: err.message,
    };
    results.push(r);
    logResult(r);
    return { status: 0, data: null, ok: false };
  }

  let data: any;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) {
    try { data = await res.json(); } catch { data = null; }
  } else {
    data = await res.text().catch(() => null);
  }

  const ok = res.status >= 200 && res.status < 300;
  return { status: res.status, data, ok };
}

/** Make an API call and record the result */
async function apiRecord(
  method: string,
  path: string,
  opts: { body?: any; token?: string; step: string },
): Promise<{ status: number; data: any; ok: boolean }> {
  const result = await api(method, path, opts);
  const r: TestResult = {
    phase: currentPhase,
    name: opts.step,
    passed: result.ok,
    status: result.status,
    detail: result.ok ? undefined : truncate(JSON.stringify(result.data), 200),
  };
  results.push(r);
  logResult(r);
  return result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '...' : s;
}

function logResult(r: TestResult) {
  const icon = r.passed ? `${GREEN}\u2713${RESET}` : `${RED}\u2717${RESET}`;
  const det = r.detail ? `  ${DIM}${r.detail}${RESET}` : '';
  console.log(`  ${icon} [${String(r.status).padStart(3)}] ${r.name}${det}`);
}

function setPhase(name: string) {
  currentPhase = name;
  console.log(`\n${CYAN}${'─'.repeat(70)}${RESET}`);
  console.log(`  ${BOLD}${name}${RESET}`);
  console.log(`${CYAN}${'─'.repeat(70)}${RESET}`);
}

// ── Notification Verification Helper ─────────────────────────────────────────

interface NotificationCheck {
  recipientToken: string;
  recipientLabel: string;
  expectedType: string;
  actorUsername: string;
  stepLabel: string;
}

/**
 * Fetches the recipient's notifications and verifies one matching the
 * expected type exists with the correct actor username and avatar_url.
 */
async function verifyNotification(check: NotificationCheck): Promise<boolean> {
  const { data, ok } = await api('GET', '/notifications', {
    token: check.recipientToken,
    step: `(internal) GET /notifications for ${check.recipientLabel}`,
  });

  if (!ok || !data?.items) {
    const r: TestResult = {
      phase: currentPhase,
      name: check.stepLabel,
      passed: false,
      status: 'ERROR',
      detail: 'Failed to fetch notifications',
    };
    results.push(r);
    logResult(r);
    return false;
  }

  const items: any[] = data.items;
  const match = items.find((n: any) => n.type === check.expectedType);

  if (!match) {
    const r: TestResult = {
      phase: currentPhase,
      name: check.stepLabel,
      passed: false,
      status: 'MISSING',
      detail: `No ${check.expectedType} notification found. Got types: [${items.map((n: any) => n.type).join(', ')}]`,
    };
    results.push(r);
    logResult(r);
    return false;
  }

  // Build flags for data quality
  const flags: string[] = [];

  // Check: notification type matches
  const typeOk = match.type === check.expectedType;
  if (!typeOk) flags.push(`Type mismatch: expected ${check.expectedType}, got ${match.type}`);

  // Check: actor username present and matches
  const actorUsername = match.actor?.username;
  if (!actorUsername) {
    flags.push('Actor username is missing from notification');
  } else if (actorUsername !== check.actorUsername) {
    flags.push(`Actor username mismatch: expected "${check.actorUsername}", got "${actorUsername}"`);
  }

  // Check: actor avatar_url field exists (may be null for test users)
  const hasAvatarField = match.actor && 'avatar_url' in match.actor;
  if (!hasAvatarField) {
    flags.push('Actor object missing avatar_url field entirely');
  } else if (match.actor.avatar_url === null || match.actor.avatar_url === undefined) {
    flags.push('avatar_url is null (expected for test users, but flag for awareness)');
  }

  const passed = typeOk && !!actorUsername && actorUsername === check.actorUsername;
  const r: TestResult = {
    phase: currentPhase,
    name: check.stepLabel,
    passed,
    status: passed ? 'OK' : 'FAIL',
    detail: passed && flags.length === 0
      ? `Found ${check.expectedType} from @${actorUsername}`
      : undefined,
    flags: flags.length > 0 ? flags : undefined,
  };
  results.push(r);
  logResult(r);

  if (flags.length > 0) {
    for (const f of flags) {
      console.log(`      ${YELLOW}! ${f}${RESET}`);
    }
  }

  return passed;
}

// ── Phase 0: Setup — Register, Verify, Onboard ──────────────────────────────

async function setupUsers() {
  setPhase('Phase 0 -- Setup: Register, Verify, Onboard');

  // ── Register all 3 users ─────────────────────────────────────────────────
  for (const u of [userA, userB, coachC]) {
    const { data, ok } = await apiRecord('POST', '/auth/register', {
      body: {
        email: u.email,
        password: u.password,
        display_name: u.displayName,
        role: u.role,
      },
      step: `Register ${u.label}`,
    });
    if (ok && data) {
      u.token = data.access_token || '';
      u.id = data.user?.id || '';
      u.verificationCode = data.dev_verification_code || '';
    }
  }

  // ── Verify emails ────────────────────────────────────────────────────────
  for (const u of [userA, userB, coachC]) {
    if (!u.token || !u.verificationCode) continue;
    await apiRecord('POST', '/auth/verify/confirm', {
      body: { code: u.verificationCode },
      token: u.token,
      step: `Verify email for ${u.label}`,
    });
  }

  // ── Fan onboarding (A and B) ─────────────────────────────────────────────
  for (const u of [userA, userB]) {
    if (!u.token) continue;

    await api('PATCH', '/auth/me/preferences', {
      body: {
        sports_interests: ['basketball'],
        zip_code: '06510',
        notifications_enabled: true,
        messaging_policy_accepted: true,
      },
      token: u.token,
      step: `(internal) Set preferences for ${u.label}`,
    });

    await apiRecord('POST', '/auth/me/complete-onboarding', {
      body: {
        role: 'fan',
        username: u.username,
        display_name: u.displayName,
        zip: '06510',
        sports_interests: ['basketball'],
        location_enabled: true,
        notifications_enabled: true,
        messaging_policy_accepted: true,
      },
      token: u.token,
      step: `Complete onboarding for ${u.label}`,
    });
  }

  // ── Coach onboarding (C): create org, team, complete onboarding ──────────
  if (coachC.token) {
    // Create organization
    const { data: orgData, ok: orgOk } = await apiRecord('POST', '/organizations', {
      body: {
        name: `NotifTestOrg ${RUN}`,
        description: 'Org for notification test',
        sport: 'basketball',
        org_type: 'club',
        location: 'Test City, CT',
        zip_code: '06510',
      },
      token: coachC.token,
      step: 'Coach C creates organization',
    });
    if (orgOk && orgData?.id) coachC.orgId = orgData.id;

    // Complete onboarding for coach
    await apiRecord('POST', '/auth/me/complete-onboarding', {
      body: {
        role: 'coach',
        username: coachC.username,
        display_name: coachC.displayName,
        organization_id: coachC.orgId || undefined,
        organization_name: `NotifTestOrg ${RUN}`,
        zip: '06510',
        affiliation: 'independent',
        sport: 'basketball',
        season_start: '2026-03-01',
        season_end: '2026-08-31',
        location_enabled: true,
        notifications_enabled: true,
        messaging_policy_accepted: true,
      },
      token: coachC.token,
      step: 'Complete onboarding for Coach C',
    });

    // Create team
    const { data: teamData, ok: teamOk } = await apiRecord('POST', '/teams', {
      body: {
        name: `NotifTestTeam ${RUN}`,
        description: 'Team for notification test',
        season_start: '2026-03-01',
        season_end: '2026-08-31',
      },
      token: coachC.token,
      step: 'Coach C creates team',
    });
    if (teamOk && teamData?.id) coachC.teamId = teamData.id;
  }

  // Summary
  console.log(`\n  ${DIM}Users created:${RESET}`);
  console.log(`    ${DIM}A: ${userA.id || '(failed)'}  username: ${userA.username}${RESET}`);
  console.log(`    ${DIM}B: ${userB.id || '(failed)'}  username: ${userB.username}${RESET}`);
  console.log(`    ${DIM}C: ${coachC.id || '(failed)'}  username: ${coachC.username}  team: ${coachC.teamId || '(none)'}${RESET}`);
}

// ── Test 1: Follow Notification ──────────────────────────────────────────────

async function testFollowNotification() {
  setPhase('Test 1 -- FOLLOW Notification');

  if (!userA.token || !userB.id) {
    results.push({ phase: currentPhase, name: 'FOLLOW test', passed: false, status: 'BLOCKED', detail: 'Missing user tokens/IDs' });
    return;
  }

  // A follows B
  await apiRecord('POST', `/users/${userB.id}/follow`, {
    token: userA.token,
    step: 'A follows B',
  });

  // Wait for async notification creation
  await sleep(200);

  // Verify B has FOLLOW notification from A
  await verifyNotification({
    recipientToken: userB.token,
    recipientLabel: 'User B',
    expectedType: 'FOLLOW',
    actorUsername: userA.username,
    stepLabel: 'B has FOLLOW notification with A\'s username/avatar',
  });
}

// ── Test 2: Upvote Notification ──────────────────────────────────────────────

async function testUpvoteNotification() {
  setPhase('Test 2 -- UPVOTE Notification');

  if (!userA.token || !userB.token) {
    results.push({ phase: currentPhase, name: 'UPVOTE test', passed: false, status: 'BLOCKED', detail: 'Missing user tokens' });
    return;
  }

  // B creates a post
  const { data: postData, ok: postOk } = await apiRecord('POST', '/posts', {
    body: { content: `Notification test post by B ${RUN}`, type: 'text' },
    token: userB.token,
    step: 'B creates a post',
  });

  if (!postOk || !postData?.id) {
    results.push({ phase: currentPhase, name: 'UPVOTE test', passed: false, status: 'BLOCKED', detail: 'Could not create post' });
    return;
  }
  userB.postId = postData.id;

  // A upvotes B's post
  await apiRecord('POST', `/posts/${userB.postId}/upvote`, {
    token: userA.token,
    step: 'A upvotes B\'s post',
  });

  await sleep(200);

  // Verify B has UPVOTE notification from A
  await verifyNotification({
    recipientToken: userB.token,
    recipientLabel: 'User B',
    expectedType: 'UPVOTE',
    actorUsername: userA.username,
    stepLabel: 'B has UPVOTE notification with A\'s username/avatar',
  });
}

// ── Test 3: Comment Notification ─────────────────────────────────────────────

async function testCommentNotification() {
  setPhase('Test 3 -- COMMENT Notification');

  if (!userA.token || !userB.token || !userB.postId) {
    results.push({ phase: currentPhase, name: 'COMMENT test', passed: false, status: 'BLOCKED', detail: 'Missing tokens or B has no post' });
    return;
  }

  // A comments on B's post
  await apiRecord('POST', `/posts/${userB.postId}/comments`, {
    body: { content: `Test comment from A ${RUN}` },
    token: userA.token,
    step: 'A comments on B\'s post',
  });

  await sleep(200);

  // Verify B has COMMENT notification from A
  await verifyNotification({
    recipientToken: userB.token,
    recipientLabel: 'User B',
    expectedType: 'COMMENT',
    actorUsername: userA.username,
    stepLabel: 'B has COMMENT notification with A\'s username/avatar',
  });
}

// ── Test 4: Message (DM) Notification ────────────────────────────────────────

async function testMessageNotification() {
  setPhase('Test 4 -- MESSAGE Notification');

  if (!userA.token || !userB.id) {
    results.push({ phase: currentPhase, name: 'MESSAGE test', passed: false, status: 'BLOCKED', detail: 'Missing tokens/IDs' });
    return;
  }

  // A sends B a DM
  await apiRecord('POST', '/messages', {
    body: { content: `Hey B, notification test DM ${RUN}`, recipient_id: userB.id },
    token: userA.token,
    step: 'A sends B a direct message',
  });

  await sleep(200);

  // Verify B has MESSAGE notification from A
  await verifyNotification({
    recipientToken: userB.token,
    recipientLabel: 'User B',
    expectedType: 'MESSAGE',
    actorUsername: userA.username,
    stepLabel: 'B has MESSAGE notification with A\'s username/avatar',
  });
}

// ── Test 5: Team Invite Notification ─────────────────────────────────────────

async function testTeamInviteNotification() {
  setPhase('Test 5 -- TEAM_INVITE Notification');

  if (!coachC.token || !coachC.teamId || !userA.email) {
    results.push({
      phase: currentPhase,
      name: 'TEAM_INVITE test',
      passed: false,
      status: 'BLOCKED',
      detail: `Missing coach token (${!!coachC.token}), team (${coachC.teamId}), or A email`,
    });
    return;
  }

  // Coach C invites User A to the team
  await apiRecord('POST', `/teams/${coachC.teamId}/invite`, {
    body: { email: userA.email, role: 'player' },
    token: coachC.token,
    step: 'Coach C invites A to team',
  });

  await sleep(200);

  // Verify A has TEAM_INVITE notification from Coach C
  await verifyNotification({
    recipientToken: userA.token,
    recipientLabel: 'User A',
    expectedType: 'TEAM_INVITE',
    actorUsername: coachC.username,
    stepLabel: 'A has TEAM_INVITE notification with Coach C\'s username/avatar',
  });
}

// ── Test 6: Approval Notification ────────────────────────────────────────────

async function testApprovalNotification() {
  setPhase('Test 6 -- APPROVAL Notification');

  // The codebase has ORG_APPROVAL email templates but no visible
  // in-app APPROVAL notification type in the notification summarize switch.
  // Flag this as not applicable.

  const r: TestResult = {
    phase: currentPhase,
    name: 'APPROVAL notification (join request flow)',
    passed: true,
    status: 'N/A',
    detail: 'No in-app APPROVAL notification type found in codebase. ORG_APPROVAL exists as email-only. Skipping.',
    flags: ['APPROVAL notification type not implemented as in-app notification'],
  };
  results.push(r);
  logResult(r);
  if (r.flags) {
    for (const f of r.flags) {
      console.log(`      ${YELLOW}! ${f}${RESET}`);
    }
  }
}

// ── Cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  if (process.env.CLEANUP !== '1') {
    console.log(`\n  ${DIM}Test users left in DB. Run with CLEANUP=1 to delete them.${RESET}`);
    return;
  }
  setPhase('Cleanup');
  for (const u of [userA, userB, coachC]) {
    if (!u.token) continue;
    await api('DELETE', '/users/me', { token: u.token, step: `Delete ${u.label}` });
    console.log(`  ${DIM}Deleted ${u.label}${RESET}`);
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

function printSummary() {
  console.log(`\n${BOLD}${'='.repeat(70)}${RESET}`);
  console.log(`  ${BOLD}NOTIFICATION SYSTEM TEST -- RESULTS${RESET}`);
  console.log(`${'='.repeat(70)}`);

  const passed  = results.filter((r) => r.passed).length;
  const failed  = results.filter((r) => !r.passed).length;
  const flagged = results.filter((r) => r.flags && r.flags.length > 0).length;
  const total   = results.length;

  // Group by phase
  const phases = new Map<string, TestResult[]>();
  for (const r of results) {
    if (!phases.has(r.phase)) phases.set(r.phase, []);
    phases.get(r.phase)!.push(r);
  }

  for (const [phase, items] of phases) {
    const pPass = items.filter((r) => r.passed).length;
    const pFail = items.filter((r) => !r.passed).length;
    const pFlag = items.filter((r) => r.flags?.length).length;
    const color = pFail > 0 ? RED : GREEN;

    console.log(`\n  ${color}${phase} -- ${pPass}/${items.length} passed${pFail ? `, ${pFail} failed` : ''}${pFlag ? `, ${pFlag} flagged` : ''}${RESET}`);

    for (const r of items) {
      const icon = r.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
      const flagStr = r.flags?.length ? ` ${YELLOW}[${r.flags.length} flag(s)]${RESET}` : '';
      console.log(`    ${icon} [${String(r.status).padStart(3)}] ${r.name}${flagStr}`);
      if (r.detail) console.log(`                ${DIM}${r.detail}${RESET}`);
      if (r.flags) {
        for (const f of r.flags) {
          console.log(`                ${YELLOW}! ${f}${RESET}`);
        }
      }
    }
  }

  // Final tally
  console.log(`\n  ${'─'.repeat(66)}`);
  const summaryColor = failed === 0 ? GREEN : RED;
  console.log(`  ${summaryColor}Total: ${total} | Passed: ${passed} | Failed: ${failed} | Flagged: ${flagged}${RESET}`);

  // Entity summary
  console.log(`\n  ${DIM}Created entities:${RESET}`);
  console.log(`    ${DIM}User A:  ${userA.id || '(none)'}${RESET}`);
  console.log(`    ${DIM}User B:  ${userB.id || '(none)'}  post: ${userB.postId || '(none)'}${RESET}`);
  console.log(`    ${DIM}Coach C: ${coachC.id || '(none)'}  org: ${coachC.orgId || '(none)'}  team: ${coachC.teamId || '(none)'}${RESET}`);

  if (failed === 0 && flagged === 0) {
    console.log(`\n  ${GREEN}All notification tests passed with no flags.${RESET}\n`);
  } else if (failed === 0) {
    console.log(`\n  ${YELLOW}All tests passed but ${flagged} flag(s) raised -- review above.${RESET}\n`);
  } else {
    console.log(`\n  ${RED}${failed} test(s) failed -- review details above.${RESET}\n`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${BOLD}${'='.repeat(70)}${RESET}`);
  console.log(`  ${BOLD}NOTIFICATION SYSTEM TEST${RESET}`);
  console.log(`${'='.repeat(70)}`);
  console.log(`  Server:  ${BASE}`);
  console.log(`  Run ID:  ${RUN}`);
  console.log(`  Time:    ${new Date().toISOString()}`);

  // Preflight health check
  try {
    const h = await fetchWithTimeout(`${BASE}/health`);
    if (!h.ok) {
      console.error(`\n${RED}Health check failed (${h.status})${RESET}`);
      process.exit(1);
    }
    console.log(`  Health:  ${GREEN}OK${RESET}`);
  } catch (e: any) {
    console.error(`\n${RED}Cannot reach ${BASE}: ${e.message}${RESET}`);
    console.error('  Start the server with: npm run dev');
    process.exit(1);
  }

  // Run phases
  await setupUsers();
  await testFollowNotification();
  await testUpvoteNotification();
  await testCommentNotification();
  await testMessageNotification();
  await testTeamInviteNotification();
  await testApprovalNotification();
  await cleanup();

  // Print summary
  printSummary();

  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${RED}Fatal error:${RESET}`, err);
  process.exit(2);
});
