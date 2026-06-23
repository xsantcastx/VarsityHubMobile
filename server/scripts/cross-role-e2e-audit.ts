/**
 * Cross-Role E2E Production Audit
 *
 * Tests that EVERY flow that starts also ends, across ALL three user roles
 * (fan, coach, admin) interacting together. Philosophy: "everything that
 * starts must end, and everything that ends must come from a start."
 *
 * Usage:
 *   ADMIN_EMAIL=you@email.com ADMIN_PASSWORD=pass npx tsx server/scripts/cross-role-e2e-audit.ts
 *   BASE_URL=https://api-production-8ac3.up.railway.app ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx server/scripts/cross-role-e2e-audit.ts
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
type TestStatus = 'PASS' | 'FAIL' | 'WARN' | 'SKIP';

interface TestResult {
  phase: string;
  name: string;
  passed: boolean;
  status: number | string;
  testStatus: TestStatus;
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
  results.push({ phase: currentPhase, name, passed, status, testStatus: passed ? 'PASS' : 'FAIL', detail });
  const icon = passed ? `${GREEN}\u2713 PASS${RESET}` : `${RED}\u2717 FAIL${RESET}`;
  const det = detail ? `  ${DIM}${truncate(detail, 120)}${RESET}` : '';
  console.log(`  ${icon} [${String(status).padStart(3)}] ${name}${det}`);
}

function warn(name: string, detail: string): void {
  results.push({ phase: currentPhase, name, passed: true, status: 'WARN', testStatus: 'WARN', detail });
  console.log(`  ${YELLOW}! WARN${RESET} ${name}  ${DIM}${truncate(detail, 120)}${RESET}`);
}

function skip(name: string, detail: string): void {
  results.push({ phase: currentPhase, name, passed: true, status: 'SKIP', testStatus: 'SKIP', detail });
  console.log(`  ${YELLOW}~ SKIP${RESET} ${name}  ${DIM}${truncate(detail, 120)}${RESET}`);
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

// ── Actor state ─────────────────────────────────────────────
interface Actor {
  token: string;
  id: string;
  email: string;
}

let admin: Actor = { token: '', id: '', email: ADMIN_EMAIL! };
let fan: Actor = { token: '', id: '', email: '' };
let coach: Actor = { token: '', id: '', email: '' };

// Created entities (for cleanup)
let orgId = '';
let teamId = '';
let postId = '';
let commentId = '';

// ── Phase 1: Setup — Create all three actors ────────────────
async function phase1_setup(): Promise<boolean> {
  phase('1 — Setup: Create all three actors');

  // 1a. Login as admin
  const loginRes = await api('POST', '/auth/login', {
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!loginRes.data?.access_token) {
    record('Admin login', false, loginRes.status, 'No access_token — cannot continue');
    return false;
  }
  admin.token = loginRes.data.access_token;
  admin.id = loginRes.data.user?.id || '';
  record('Admin login', true, loginRes.status, `id=${admin.id}`);

  // 1b. Register test fan
  const fanEmail = `audit-fan-${RUN}@test.varsityhub.app`;
  const fanReg = await api('POST', '/auth/register', {
    body: { email: fanEmail, password: 'AuditFan123!', display_name: `Audit Fan ${RUN}` },
  });
  if (!fanReg.data?.access_token || !fanReg.data?.user?.id) {
    record('Register fan', false, fanReg.status, truncate(JSON.stringify(fanReg.data), 120));
    return false;
  }
  fan = { token: fanReg.data.access_token, id: fanReg.data.user.id, email: fanEmail };
  record('Register fan', true, fanReg.status, `id=${fan.id}`);

  // Verify fan email
  if (fanReg.data.dev_verification_code) {
    const v = await api('POST', '/auth/verify/confirm', {
      body: { code: fanReg.data.dev_verification_code },
      token: fan.token,
    });
    record('Verify fan email', v.status === 200, v.status);
  } else {
    skip('Verify fan email', 'No dev_verification_code (production server?)');
  }

  // 1c. Register test coach
  const coachEmail = `audit-coach-${RUN}@test.varsityhub.app`;
  const coachReg = await api('POST', '/auth/register', {
    body: { email: coachEmail, password: 'AuditCoach123!', display_name: `Audit Coach ${RUN}` },
  });
  if (!coachReg.data?.access_token || !coachReg.data?.user?.id) {
    record('Register coach', false, coachReg.status, truncate(JSON.stringify(coachReg.data), 120));
    return false;
  }
  coach = { token: coachReg.data.access_token, id: coachReg.data.user.id, email: coachEmail };
  record('Register coach', true, coachReg.status, `id=${coach.id}`);

  // Verify coach email
  if (coachReg.data.dev_verification_code) {
    const v = await api('POST', '/auth/verify/confirm', {
      body: { code: coachReg.data.dev_verification_code },
      token: coach.token,
    });
    record('Verify coach email', v.status === 200, v.status);
  } else {
    skip('Verify coach email', 'No dev_verification_code (production server?)');
  }

  return true;
}

// ── Phase 2: Fan Onboarding (start -> end) ──────────────────
async function phase2_fanOnboarding(): Promise<void> {
  phase('2 — Fan Onboarding');

  // Complete fan onboarding
  const onboard = await api('POST', '/auth/me/complete-onboarding', {
    body: {
      role: 'fan',
      username: `audit_fan_${RUN}`,
      display_name: `Audit Fan ${RUN}`,
      dob: '1990-01-01',
      zip_code: '10001',
      sports_interests: ['Football'],
      primary_intents: ['find_local_games'],
      messaging_policy_accepted: true,
    },
    token: fan.token,
  });
  record(
    'Fan completes onboarding',
    onboard.status === 200 || onboard.status === 201,
    onboard.status,
    onboard.data?.message || truncate(JSON.stringify(onboard.data), 100),
  );

  // Verify fan can access feed
  const feed = await api('GET', '/posts', { token: fan.token });
  record('Fan can access feed (GET /posts)', feed.status === 200, feed.status);

  // Verify fan CANNOT create a team. A fan has no organization_id, so the
  // request is rejected by Zod (400, "organization_id required") before it can
  // reach the COACH_ROLE_REQUIRED service-layer gate (teams.ts createTeamWithGuardrails).
  // intent: accept 400 OR 403 — both mean "rejected, no team created"; the
  // security invariant (a non-coach never creates a team) holds either way.
  const teamAttempt = await api('POST', '/teams', {
    body: { name: `FanTeam_${RUN}`, description: 'Should fail' },
    token: fan.token,
  });
  record(
    'Fan CANNOT create a team (rejected, not created)',
    (teamAttempt.status === 403 || teamAttempt.status === 400) && !teamAttempt.data?.id,
    teamAttempt.status,
    `code=${teamAttempt.data?.code || teamAttempt.data?.error || 'N/A'}`,
  );

  // Verify fan profile is complete
  const me = await api('GET', '/auth/me', { token: fan.token });
  const prefs = me.data?.preferences || {};
  record(
    'Fan profile shows onboarding_completed=true',
    prefs.onboarding_completed === true,
    me.status,
    `onboarding_completed=${prefs.onboarding_completed}`,
  );
}

// ── Phase 3: Coach Onboarding (start -> blocked -> approved -> end) ──
async function phase3_coachOnboarding(): Promise<void> {
  phase('3 — Coach Onboarding & Approval');

  // The real coach flow (verified against server routes) is ordered:
  //   set DOB -> upgrade-to-coach (role=coach, approval PENDING, onboarding reset)
  //   -> create org (becomes owner) -> create team -> complete onboarding.
  // complete-onboarding now requires org/team (auth.ts ORG_TEAM_REQUIRED), and a
  // PENDING coach may only create a team while they own an org AND onboarding is
  // incomplete (teams.ts createTeamWithGuardrails). Hence org/team BEFORE onboarding.

  // 3a. Set DOB — required before coach upgrade (server-side 18+ / COPPA gate)
  const dobSet = await api('PATCH', '/auth/me/preferences', {
    body: { dob: '1990-01-01' },
    token: coach.token,
  });
  record(
    'Coach sets date of birth',
    dobSet.status === 200,
    dobSet.status,
    truncate(JSON.stringify(dobSet.data), 80),
  );

  // 3b. Upgrade to coach (canonical flow — direct coach registration is disabled)
  const upgrade = await api('POST', '/auth/upgrade-to-coach', {
    body: { plan: 'rookie' },
    token: coach.token,
  });
  record(
    'Coach upgrades to coach role (approval PENDING)',
    upgrade.status === 200 || upgrade.status === 201,
    upgrade.status,
    upgrade.data?.message || truncate(JSON.stringify(upgrade.data), 100),
  );

  // 3c. Coach creates org (onboarding=true bypasses requireOnboarded; coach becomes owner)
  const orgRes = await api('POST', '/organizations', {
    body: {
      name: `Audit League ${RUN}`,
      sport: 'Football',
      org_type: 'club',
      location: 'New York, NY',
      zip_code: '10001',
      // Org verification doc is now required by createOrganizationSchema (must be a valid URL).
      supporting_document_url: 'https://res.cloudinary.com/demo/image/upload/audit-supporting-doc.pdf',
      onboarding: true,
    },
    token: coach.token,
  });
  if (orgRes.data?.id) {
    orgId = orgRes.data.id;
  }
  record(
    'Coach creates organization',
    orgRes.status === 200 || orgRes.status === 201,
    orgRes.status,
    orgId ? `orgId=${orgId}` : truncate(JSON.stringify(orgRes.data), 100),
  );

  // 3d. Coach creates team under org (onboarding=true; allowed while org-owner + not onboarded)
  if (orgId) {
    const teamRes = await api('POST', '/teams', {
      body: {
        name: `Audit Team ${RUN}`,
        organization_id: orgId,
        onboarding: true,
      },
      token: coach.token,
    });
    if (teamRes.data?.id) {
      teamId = teamRes.data.id;
    }
    record(
      'Coach creates team',
      teamRes.status === 200 || teamRes.status === 201,
      teamRes.status,
      teamId ? `teamId=${teamId}` : truncate(JSON.stringify(teamRes.data), 100),
    );
  } else {
    skip('Coach creates team', 'No org created');
  }

  // 3e. Complete coach onboarding (now has org/team to satisfy ORG_TEAM_REQUIRED)
  const onboard = await api('POST', '/auth/me/complete-onboarding', {
    body: {
      role: 'coach',
      plan: 'rookie',
      username: `audit_coach_${RUN}`,
      display_name: `Audit Coach ${RUN}`,
      dob: '1990-01-01',
      zip_code: '10001',
      organization_id: orgId || undefined,
      team_id: teamId || undefined,
      messaging_policy_accepted: true,
    },
    token: coach.token,
  });
  record(
    'Coach completes onboarding',
    onboard.status === 200 || onboard.status === 201,
    onboard.status,
    onboard.data?.message || truncate(JSON.stringify(onboard.data), 100),
  );

  // 3f. Verify coach is BLOCKED from creating content (APPROVAL_REQUIRED)
  const blockedPost = await api('POST', '/posts', {
    body: { content: `Should be blocked ${RUN}`, type: 'text' },
    token: coach.token,
  });
  record(
    'Coach BLOCKED from creating content (APPROVAL_REQUIRED)',
    blockedPost.status === 403 && blockedPost.data?.code === 'APPROVAL_REQUIRED',
    blockedPost.status,
    `code=${blockedPost.data?.code || 'N/A'}`,
  );

  // 3g. Admin approves the organization first (required before coach approval)
  if (orgId) {
    const orgApprove = await api('POST', `/organizations/${orgId}/approve`, {
      token: admin.token,
      body: { note: 'Audit test approval' },
    });
    record(
      'Admin approves organization',
      orgApprove.status === 200,
      orgApprove.status,
      truncate(JSON.stringify(orgApprove.data), 100),
    );
  } else {
    skip('Admin approves organization', 'No org to approve');
  }

  // 3h. Admin approves coach
  const approveRes = await api('POST', `/admin/coaches/${coach.id}/approve`, {
    token: admin.token,
    body: { note: 'Audit test approval' },
  });
  record(
    'Admin approves coach',
    approveRes.status === 200 && approveRes.data?.ok === true,
    approveRes.status,
    approveRes.data?.message || truncate(JSON.stringify(approveRes.data), 100),
  );

  // 3i. Verify coach can NOW create content
  const allowedPost = await api('POST', '/posts', {
    body: { content: `Audit test post ${RUN}`, type: 'text' },
    token: coach.token,
  });
  if (allowedPost.data?.id) {
    postId = allowedPost.data.id;
  }
  record(
    'Coach can create content after approval',
    (allowedPost.status === 200 || allowedPost.status === 201) && !!allowedPost.data?.id,
    allowedPost.status,
    postId ? `postId=${postId}` : truncate(JSON.stringify(allowedPost.data), 100),
  );
}

// ── Phase 4: Content Interaction (fan <-> coach) ────────────
async function phase4_contentInteraction(): Promise<void> {
  phase('4 — Content Interaction (fan <-> coach)');

  // 4a. Fan views feed
  const feed = await api('GET', '/posts', { token: fan.token });
  record('Fan views feed', feed.status === 200, feed.status);

  if (!postId) {
    skip('Fan upvotes coach post', 'No post created');
    skip('Fan comments on coach post', 'No post created');
    skip('Coach gets notifications', 'No post created');
  } else {
    // 4b. Fan upvotes coach's post
    const upvote = await api('POST', `/posts/${postId}/upvote`, { token: fan.token });
    record(
      'Fan upvotes coach post',
      upvote.status === 200 || upvote.status === 201,
      upvote.status,
    );

    // 4c. Fan comments on coach's post
    const comment = await api('POST', `/posts/${postId}/comments`, {
      body: { content: `Audit comment ${RUN}` },
      token: fan.token,
    });
    if (comment.data?.id) {
      commentId = comment.data.id;
    }
    record(
      'Fan comments on coach post',
      (comment.status === 200 || comment.status === 201) && !!comment.data?.id,
      comment.status,
      commentId ? `commentId=${commentId}` : truncate(JSON.stringify(comment.data), 100),
    );

    // 4d. Coach checks notifications
    const notifs = await api('GET', '/notifications', { token: coach.token });
    record(
      'Coach can view notifications',
      notifs.status === 200,
      notifs.status,
      `count=${Array.isArray(notifs.data) ? notifs.data.length : (notifs.data?.notifications?.length ?? '?')}`,
    );
  }

  // 4e. Fan follows coach
  const follow = await api('POST', `/users/${coach.id}/follow`, { token: fan.token });
  record(
    'Fan follows coach',
    follow.status === 200 || follow.status === 201,
    follow.status,
    truncate(JSON.stringify(follow.data), 80),
  );

  // 4f. Verify follow shows in coach's followers
  const followers = await api('GET', `/users/${coach.id}/followers`, { token: coach.token });
  const followerList = Array.isArray(followers.data)
    ? followers.data
    : (followers.data?.items || followers.data?.followers || []);
  const fanInFollowers = followerList.some(
    (f: any) => f.follower_id === fan.id || f.id === fan.id || f.user?.id === fan.id,
  );
  record(
    'Fan appears in coach followers list',
    followers.status === 200 && fanInFollowers,
    followers.status,
    `found fan in followers: ${fanInFollowers}`,
  );
}

// ── Phase 5: Messaging (fan -> coach -> fan) ────────────────
async function phase5_messaging(): Promise<void> {
  phase('5 — Messaging (fan -> coach -> fan)');

  // 5a. Fan sends DM to coach
  const dm = await api('POST', '/messages', {
    body: { recipient_id: coach.id, content: `Audit DM ${RUN}` },
    token: fan.token,
  });
  record(
    'Fan sends DM to coach',
    dm.status === 200 || dm.status === 201,
    dm.status,
    dm.data?.id ? `messageId=${dm.data.id}` : truncate(JSON.stringify(dm.data), 100),
  );

  // 5b. Coach checks unread count
  const unread = await api('GET', '/messages/unread-count', { token: coach.token });
  record(
    'Coach unread count >= 1',
    unread.status === 200 && (unread.data?.count >= 1 || unread.data?.unreadCount >= 1),
    unread.status,
    `count=${unread.data?.count ?? unread.data?.unreadCount ?? 'N/A'}`,
  );

  // 5c. Coach reads messages
  const inbox = await api('GET', '/messages', { token: coach.token });
  record(
    'Coach can read messages',
    inbox.status === 200,
    inbox.status,
  );
}

// ── Phase 6: Team Interaction (fan joins coach's team) ──────
async function phase6_teamInteraction(): Promise<void> {
  phase('6 — Team Interaction');

  if (!teamId) {
    skip('Coach invites fan to team', 'No team created');
    return;
  }

  // 6a. Coach invites fan to team
  const invite = await api('POST', `/teams/${teamId}/invite`, {
    body: { email: fan.email, role: 'member' },
    token: coach.token,
  });
  record(
    'Coach invites fan to team',
    invite.status === 200 || invite.status === 201,
    invite.status,
    invite.data?.id ? `inviteId=${invite.data.id}` : truncate(JSON.stringify(invite.data), 100),
  );

  // 6b. Fan checks for team invites
  const invites = await api('GET', '/teams/invites/me', { token: fan.token });
  if (invites.status === 200) {
    const inviteList = Array.isArray(invites.data) ? invites.data : (invites.data?.invites || []);
    const found = inviteList.some((inv: any) => inv.team_id === teamId || inv.team?.id === teamId);
    record(
      'Fan sees team invite',
      found,
      invites.status,
      `invites count=${inviteList.length}, found for team: ${found}`,
    );
  } else {
    skip('Fan sees team invite', `Endpoint returned ${invites.status}`);
  }
}

// ── Phase 7: Admin Oversight ────────────────────────────────
async function phase7_adminOversight(): Promise<void> {
  phase('7 — Admin Oversight');

  // 7a. Admin views dashboard
  const dash = await api('GET', '/admin/dashboard', { token: admin.token });
  record(
    'Admin views dashboard',
    dash.status === 200 && dash.data?.ok === true,
    dash.status,
    `totalUsers=${dash.data?.totalUsers}, totalPosts=${dash.data?.totalPosts}`,
  );

  // 7b. Admin views activity log (coach approval should be logged)
  const log = await api('GET', '/admin/activity-log', { token: admin.token });
  record(
    'Admin views activity log',
    log.status === 200 && log.data?.ok === true,
    log.status,
  );

  // Check if coach approval is in the log
  const activities = log.data?.activities || [];
  const approvalEntry = activities.find(
    (a: any) => a.action === 'APPROVE_COACH' && a.target_id === coach.id,
  );
  if (approvalEntry) {
    record(
      'Coach approval logged in activity log',
      true,
      'OK',
      `action=${approvalEntry.action}`,
    );
  } else {
    warn('Coach approval in activity log', 'Not found in first page of activity log (may be paginated)');
  }

  // 7c. Admin can see test users
  const coachProfile = await api('GET', `/users/${coach.id}`, { token: admin.token });
  record(
    'Admin can view coach profile',
    coachProfile.status === 200,
    coachProfile.status,
  );

  const fanProfile = await api('GET', `/users/${fan.id}`, { token: admin.token });
  record(
    'Admin can view fan profile',
    fanProfile.status === 200,
    fanProfile.status,
  );
}

// ── Phase 8: Blocking & Moderation ──────────────────────────
async function phase8_blocking(): Promise<void> {
  phase('8 — Blocking & Moderation');

  // 8a. Fan blocks coach
  const block = await api('POST', `/users/${coach.id}/block`, { token: fan.token });
  record(
    'Fan blocks coach',
    block.status === 200 || block.status === 201,
    block.status,
  );

  // 8b. Verify fan can't message blocked coach
  const blockedDM = await api('POST', '/messages', {
    body: { recipient_id: coach.id, content: `Blocked DM attempt ${RUN}` },
    token: fan.token,
  });
  record(
    'Fan CANNOT message blocked coach',
    blockedDM.status === 403 || blockedDM.status === 400,
    blockedDM.status,
    `error=${blockedDM.data?.error || 'N/A'}`,
  );

  // 8c. Fan unblocks coach
  const unblock = await api('DELETE', `/users/${coach.id}/block`, { token: fan.token });
  record(
    'Fan unblocks coach',
    unblock.status === 200,
    unblock.status,
  );

  // 8d. Verify messaging restored
  const restoredDM = await api('POST', '/messages', {
    body: { recipient_id: coach.id, content: `Restored DM ${RUN}` },
    token: fan.token,
  });
  record(
    'Fan CAN message coach after unblock',
    restoredDM.status === 200 || restoredDM.status === 201,
    restoredDM.status,
  );
}

// ── Phase 9: Cleanup ────────────────────────────────────────
async function phase9_cleanup(): Promise<void> {
  phase('9 — Cleanup');

  // Delete test post
  if (postId) {
    const del = await api('DELETE', `/posts/${postId}`, { token: coach.token });
    if (del.status === 200 || del.status === 204) {
      record('Delete test post', true, del.status);
    } else {
      warn('Delete test post', `status=${del.status}: ${truncate(JSON.stringify(del.data), 80)}`);
    }
  }

  // Delete test team
  if (teamId) {
    const del = await api('DELETE', `/teams/${teamId}`, { token: coach.token });
    if (del.status === 200 || del.status === 204) {
      record('Delete test team', true, del.status);
    } else {
      warn('Delete test team', `status=${del.status}: ${truncate(JSON.stringify(del.data), 80)}`);
    }
  }

  // Delete test org
  if (orgId) {
    const del = await api('DELETE', `/organizations/${orgId}`, { token: coach.token });
    if (del.status === 200 || del.status === 204) {
      record('Delete test org', true, del.status);
    } else {
      warn('Delete test org', `status=${del.status}: ${truncate(JSON.stringify(del.data), 80)}`);
    }
  }

  // Delete test fan user
  if (fan.id) {
    const del = await api('DELETE', '/users/me', { token: fan.token });
    if (del.status === 200 || del.status === 204) {
      record('Delete test fan user', true, del.status);
    } else {
      // Try admin delete as fallback
      const adminDel = await api('DELETE', `/users/${fan.id}`, { token: admin.token });
      if (adminDel.status === 200 || adminDel.status === 204) {
        record('Delete test fan user (via admin)', true, adminDel.status);
      } else {
        warn('Delete test fan user', `self=${del.status}, admin=${adminDel.status}`);
      }
    }
  }

  // Delete test coach user
  if (coach.id) {
    const del = await api('DELETE', '/users/me', { token: coach.token });
    if (del.status === 200 || del.status === 204) {
      record('Delete test coach user', true, del.status);
    } else {
      const adminDel = await api('DELETE', `/users/${coach.id}`, { token: admin.token });
      if (adminDel.status === 200 || adminDel.status === 204) {
        record('Delete test coach user (via admin)', true, adminDel.status);
      } else {
        warn('Delete test coach user', `self=${del.status}, admin=${adminDel.status}`);
      }
    }
  }
}

// ── Phase 10: Summary ───────────────────────────────────────
function printSummary(): void {
  console.log();
  console.log('='.repeat(70));
  console.log(`  ${BOLD}CROSS-ROLE E2E AUDIT — RESULTS${RESET}`);
  console.log('='.repeat(70));

  const passed = results.filter((r) => r.testStatus === 'PASS').length;
  const failed = results.filter((r) => r.testStatus === 'FAIL').length;
  const warnings = results.filter((r) => r.testStatus === 'WARN').length;
  const skipped = results.filter((r) => r.testStatus === 'SKIP').length;
  const total = results.length;

  // Group by phase
  const phases = new Map<string, TestResult[]>();
  for (const r of results) {
    if (!phases.has(r.phase)) phases.set(r.phase, []);
    phases.get(r.phase)!.push(r);
  }

  for (const [phaseName, items] of phases) {
    const pPass = items.filter((r) => r.testStatus === 'PASS').length;
    const pFail = items.filter((r) => r.testStatus === 'FAIL').length;
    const pWarn = items.filter((r) => r.testStatus === 'WARN').length;
    const pSkip = items.filter((r) => r.testStatus === 'SKIP').length;
    const color = pFail > 0 ? RED : GREEN;
    const counts = [
      `${pPass}/${items.length} passed`,
      pFail > 0 ? `${pFail} failed` : '',
      pWarn > 0 ? `${pWarn} warn` : '',
      pSkip > 0 ? `${pSkip} skip` : '',
    ].filter(Boolean).join(', ');
    console.log(`\n  ${color}${BOLD}${phaseName}${RESET} ${DIM}(${counts})${RESET}`);

    for (const r of items) {
      let icon: string;
      switch (r.testStatus) {
        case 'PASS': icon = `${GREEN}PASS${RESET}`; break;
        case 'FAIL': icon = `${RED}FAIL${RESET}`; break;
        case 'WARN': icon = `${YELLOW}WARN${RESET}`; break;
        case 'SKIP': icon = `${YELLOW}SKIP${RESET}`; break;
      }
      const det = r.detail ? `  ${DIM}${truncate(r.detail, 80)}${RESET}` : '';
      console.log(`    ${icon} [${String(r.status).padStart(4)}] ${r.name}${det}`);
    }
  }

  // Final tally
  console.log();
  console.log('='.repeat(70));
  const color = failed > 0 ? RED : GREEN;
  console.log(`  ${color}${BOLD}Total: ${total} | Passed: ${passed} | Failed: ${failed} | Warnings: ${warnings} | Skipped: ${skipped}${RESET}`);

  if (failed > 0) {
    console.log();
    console.log(`  ${RED}${BOLD}FAILURES:${RESET}`);
    for (const r of results.filter((r) => r.testStatus === 'FAIL')) {
      console.log(`    ${RED}\u2717${RESET} [${r.phase}] ${r.name}${r.detail ? ` -- ${r.detail}` : ''}`);
    }
  }

  console.log('='.repeat(70));

  // Entity summary
  console.log();
  console.log(`  ${DIM}Created entities (should be cleaned up):${RESET}`);
  console.log(`    Fan ID:   ${fan.id || '(none)'}`);
  console.log(`    Coach ID: ${coach.id || '(none)'}`);
  console.log(`    Org ID:   ${orgId || '(none)'}`);
  console.log(`    Team ID:  ${teamId || '(none)'}`);
  console.log(`    Post ID:  ${postId || '(none)'}`);
  console.log();
}

// ── Main ────────────────────────────────────────────────────
async function main(): Promise<void> {
  console.log(`${BOLD}VarsityHub Cross-Role E2E Audit${RESET}`);
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

  // Phase 1: Setup
  const setupOk = await phase1_setup();
  if (!setupOk) {
    console.error(`${RED}Setup failed — cannot continue without all three actors.${RESET}`);
    // Still attempt cleanup of whatever was created
    await phase9_cleanup();
    printSummary();
    process.exit(1);
  }

  // Phase 2-8: Test flows
  try {
    await phase2_fanOnboarding();
    await phase3_coachOnboarding();
    await phase4_contentInteraction();
    await phase5_messaging();
    await phase6_teamInteraction();
    await phase7_adminOversight();
    await phase8_blocking();
  } catch (err: any) {
    console.error(`${RED}Unhandled error in test phase:${RESET}`, err?.message || err);
    record('Unhandled error', false, 'ERR', err?.message || String(err));
  }

  // Phase 9: Cleanup (always runs)
  await phase9_cleanup();

  // Phase 10: Summary
  printSummary();

  const failed = results.filter((r) => r.testStatus === 'FAIL').length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${RED}Unhandled error:${RESET}`, err);
  process.exit(1);
});
