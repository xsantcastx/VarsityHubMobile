#!/usr/bin/env npx tsx
/**
 * End-to-End Coach Journey Test
 *
 * Simulates the COMPLETE coach lifecycle via API calls:
 *   1)  Register coach account
 *   2)  Verify email
 *   3)  Walk through all 10 onboarding steps in sequence
 *   4)  Create an organization
 *   5)  Create a team under that org
 *   6)  Create an event for the team
 *   7)  Invite a user to the team
 *   8)  Create a post tagged to the team
 *   9)  Check team profile page data
 *   10) Check organization page data
 *
 * Usage:
 *   npx tsx scripts/coach-journey-test.ts
 *   CLEANUP=1 npx tsx scripts/coach-journey-test.ts
 *   BASE_URL=http://localhost:4000 npx tsx scripts/coach-journey-test.ts
 */

const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const RUN = Date.now().toString(36);

// ── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  phase: string;
  step: string;
  status: number | string;
  ok: boolean;
  detail?: string;
  flags?: string[];
}

const results: TestResult[] = [];
let currentPhase = '';

// ── State (populated as the journey progresses) ──────────────────────────────

const coach = {
  email: `coachjourney+${RUN}@test.varsityhub.app`,
  password: 'CoachPass2026',
  displayName: 'Coach Journey Test',
  username: `cj_${RUN}`,
  token: '',
  id: '',
  verificationCode: '',
  orgId: '',
  teamId: '',
  eventId: '',
  postId: '',
};

const fan = {
  email: `fanjourney+${RUN}@test.varsityhub.app`,
  password: 'FanPass2026',
  displayName: 'Fan Journey Test',
  username: `fj_${RUN}`,
  token: '',
  id: '',
  verificationCode: '',
};

// ── HTTP helpers ─────────────────────────────────────────────────────────────

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
    res = await fetch(url, {
      method,
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err: any) {
    const r: TestResult = { phase: currentPhase, step: opts.step, status: 'NETWORK_ERROR', ok: false, detail: err.message };
    results.push(r);
    log(r);
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
  const r: TestResult = {
    phase: currentPhase,
    step: opts.step,
    status: res.status,
    ok,
    detail: ok ? undefined : truncate(JSON.stringify(data), 200),
  };
  results.push(r);
  log(r);
  return { status: res.status, data, ok };
}

/** Fire-and-forget helper that also validates response shape */
async function apiExpect(
  method: string,
  path: string,
  opts: { body?: any; token?: string; step: string; expect?: (data: any) => string[] },
): Promise<{ status: number; data: any; ok: boolean }> {
  const result = await api(method, path, opts);
  if (result.ok && opts.expect) {
    const flags = opts.expect(result.data);
    if (flags.length > 0) {
      const last = results[results.length - 1];
      last.flags = flags;
      for (const f of flags) {
        console.log(`      ⚠️  ${f}`);
      }
    }
  }
  return result;
}

function log(r: TestResult) {
  const icon = r.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  const detail = r.detail ? `  → ${r.detail}` : '';
  console.log(`  ${icon} [${String(r.status).padStart(3)}] ${r.step}${detail}`);
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n) + '…' : s; }

function setPhase(name: string) {
  currentPhase = name;
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ${name}`);
  console.log(`${'─'.repeat(70)}`);
}

// ── Phase 0: Register & Verify ───────────────────────────────────────────────

async function phase0() {
  setPhase('Phase 0 — Register & Verify');

  // Register coach
  const { data: cd } = await apiExpect('POST', '/auth/register', {
    body: { email: coach.email, password: coach.password, display_name: coach.displayName, role: 'coach' },
    step: 'Register coach account',
    expect: (d) => {
      const f: string[] = [];
      if (!d.access_token) f.push('Missing access_token');
      if (!d.user?.id) f.push('Missing user.id');
      if (!d.dev_verification_code) f.push('Missing dev_verification_code (is this a production server?)');
      if (d.user?.preferences?.role !== 'coach') f.push(`Expected role=coach, got ${d.user?.preferences?.role}`);
      return f;
    },
  });
  if (cd) {
    coach.token = cd.access_token || '';
    coach.id = cd.user?.id || '';
    coach.verificationCode = cd.dev_verification_code || '';
  }

  // Register fan (needed later for team invite)
  const { data: fd } = await api('POST', '/auth/register', {
    body: { email: fan.email, password: fan.password, display_name: fan.displayName, role: 'fan' },
    step: 'Register fan account (for invite target)',
  });
  if (fd) {
    fan.token = fd.access_token || '';
    fan.id = fd.user?.id || '';
    fan.verificationCode = fd.dev_verification_code || '';
  }

  // Verify coach email
  if (coach.token && coach.verificationCode) {
    await apiExpect('POST', '/auth/verify/confirm', {
      body: { code: coach.verificationCode },
      token: coach.token,
      step: 'Verify coach email',
      expect: (d) => (d.ok ? [] : ['Verification did not return ok:true']),
    });
  }

  // Verify fan email
  if (fan.token && fan.verificationCode) {
    await api('POST', '/auth/verify/confirm', {
      body: { code: fan.verificationCode },
      token: fan.token,
      step: 'Verify fan email',
    });
  }

  // Complete fan onboarding (so they're a real user for invite target)
  if (fan.token) {
    await api('POST', '/auth/me/complete-onboarding', {
      body: { role: 'fan', username: fan.username, display_name: fan.displayName, zip: '06510', messaging_policy_accepted: true },
      token: fan.token,
      step: 'Complete fan onboarding (helper)',
    });
  }
}

// ── Phase 1: Coach Onboarding Steps 1-10 ─────────────────────────────────────

async function phase1() {
  setPhase('Phase 1 — Coach Onboarding (Steps 1–10)');
  if (!coach.token) {
    results.push({ phase: currentPhase, step: 'SKIP ALL', status: 'BLOCKED', ok: false, detail: 'No coach token' });
    return;
  }

  // ── Step 1: Role Selection ─────────────────────────────────────────────────
  console.log('\n  ┌─ Step 1: Role Selection');
  await apiExpect('GET', '/auth/me', {
    token: coach.token,
    step: 'Step 1 — GET /auth/me (load current role)',
    expect: (d) => {
      const f: string[] = [];
      if (!d.id) f.push('Missing user id');
      if (d.preferences?.role !== 'coach') f.push(`Expected role=coach, got ${d.preferences?.role}`);
      if (d.preferences?.onboarding_completed !== false) f.push('Expected onboarding_completed=false');
      return f;
    },
  });
  await apiExpect('PATCH', '/auth/me/preferences', {
    body: { role: 'coach' },
    token: coach.token,
    step: 'Step 1 — PATCH preferences (set role=coach)',
    expect: (d) => (d.preferences?.role === 'coach' ? [] : ['Role not set to coach']),
  });

  // ── Step 2: Basic Information ──────────────────────────────────────────────
  console.log('\n  ┌─ Step 2: Basic Information');
  await apiExpect('GET', `/users/username-available?username=${coach.username}`, {
    token: coach.token,
    step: 'Step 2 — Check username availability',
    expect: (d) => {
      const f: string[] = [];
      if (!d.available) f.push(`Username ${coach.username} not available`);
      if (!d.valid) f.push(`Username ${coach.username} invalid format`);
      return f;
    },
  });
  await apiExpect('PATCH', '/auth/me', {
    body: {
      username: coach.username,
      display_name: coach.displayName,
      preferences: {
        affiliation: 'independent',
        dob: '1990-06-15',
        zip_code: '06510',
      },
    },
    token: coach.token,
    step: 'Step 2 — PATCH /me (username, affiliation, DOB, zip)',
    expect: (d) => {
      const f: string[] = [];
      if (d.username !== coach.username) f.push(`Username mismatch: ${d.username}`);
      return f;
    },
  });

  // ── Step 3: Plan Selection ─────────────────────────────────────────────────
  console.log('\n  ┌─ Step 3: Plan Selection');
  await api('GET', '/payments/config-status', {
    token: coach.token,
    step: 'Step 3 — GET /payments/config-status (check Stripe)',
  });
  await apiExpect('PATCH', '/auth/me/preferences', {
    body: { plan: 'rookie' },
    token: coach.token,
    step: 'Step 3 — PATCH preferences (plan=rookie/free)',
    expect: (d) => (d.preferences?.plan === 'rookie' ? [] : ['Plan not set']),
  });

  // ── Step 4: Organization/Team Creation ─────────────────────────────────────
  console.log('\n  ┌─ Step 4: Organization & Team Creation');
  const orgName = `Journey Org ${RUN}`;
  const { data: orgData } = await apiExpect('POST', '/organizations', {
    body: {
      name: orgName,
      description: 'End-to-end test organization',
      sport: 'basketball',
      org_type: 'club',
      location: 'New Haven, CT',
      zip_code: '06510',
      season_start: '2026-03-01',
      season_end: '2026-08-31',
    },
    token: coach.token,
    step: 'Step 4 — POST /organizations (create org)',
    expect: (d) => {
      const f: string[] = [];
      if (!d.id) f.push('Missing organization id');
      if (d.name !== orgName) f.push(`Name mismatch: ${d.name}`);
      return f;
    },
  });
  if (orgData?.id) coach.orgId = orgData.id;

  // Create team under the org
  const teamName = `Journey Team ${RUN}`;
  const { data: teamData } = await apiExpect('POST', '/teams', {
    body: {
      name: teamName,
      description: 'End-to-end test team',
      season_start: '2026-03-01',
      season_end: '2026-08-31',
    },
    token: coach.token,
    step: 'Step 4 — POST /teams (create team)',
    expect: (d) => {
      const f: string[] = [];
      if (!d.id) f.push('Missing team id');
      if (d.name !== teamName) f.push(`Name mismatch: ${d.name}`);
      return f;
    },
  });
  if (teamData?.id) coach.teamId = teamData.id;

  // Confirm creation via GET /auth/me
  await apiExpect('GET', '/auth/me', {
    token: coach.token,
    step: 'Step 4 — GET /auth/me (verify org/team in profile)',
    expect: (d) => {
      const f: string[] = [];
      if (!d.id) f.push('Missing user id from /me');
      return f;
    },
  });

  // ── Step 5: (Skipped in UI) ────────────────────────────────────────────────
  console.log('\n  ┌─ Step 5: (Skipped — not used in coach flow)');
  results.push({ phase: currentPhase, step: 'Step 5 — (Skipped by design)', status: 'N/A', ok: true });
  console.log('  \x1b[32m✓\x1b[0m [N/A] Step 5 — (Skipped by design)');

  // ── Step 6: Authorized Users (Invite) ──────────────────────────────────────
  console.log('\n  ┌─ Step 6: Authorized Users');
  if (coach.teamId && fan.email) {
    await apiExpect('POST', `/teams/${coach.teamId}/invite`, {
      body: { email: fan.email, role: 'member' },
      token: coach.token,
      step: 'Step 6 — POST /teams/:id/invite (invite fan)',
      expect: (d) => {
        const f: string[] = [];
        if (!d.id) f.push('Missing invite id');
        if (d.status !== 'pending') f.push(`Expected status=pending, got ${d.status}`);
        if (d.email !== fan.email) f.push(`Email mismatch: ${d.email}`);
        return f;
      },
    });
  } else {
    results.push({ phase: currentPhase, step: 'Step 6 — Invite', status: 'BLOCKED', ok: false, detail: 'No team or fan email' });
  }

  // ── Step 7: Profile Setup ──────────────────────────────────────────────────
  console.log('\n  ┌─ Step 7: Profile Setup');
  await apiExpect('PATCH', '/auth/me', {
    body: {
      bio: 'Coach Journey test account — testing the complete onboarding flow.',
      preferences: {
        sports_interests: ['basketball', 'football', 'track_and_field'],
      },
    },
    token: coach.token,
    step: 'Step 7 — PATCH /me (bio, sports_interests)',
    expect: (d) => {
      const f: string[] = [];
      if (!d.bio) f.push('Bio not saved');
      return f;
    },
  });

  // ── Step 8: Primary Intents ────────────────────────────────────────────────
  console.log('\n  ┌─ Step 8: Primary Intents');
  await apiExpect('PATCH', '/auth/me/preferences', {
    body: {
      primary_intents: ['find_local_games', 'post_reviews_highlights', 'claim_my_team'],
    },
    token: coach.token,
    step: 'Step 8 — PATCH preferences (primary_intents)',
    expect: (d) => {
      const pi = d.preferences?.primary_intents;
      return Array.isArray(pi) && pi.length === 3 ? [] : ['primary_intents not saved correctly'];
    },
  });

  // ── Step 9: Features Configuration ─────────────────────────────────────────
  console.log('\n  ┌─ Step 9: Features Configuration');
  await apiExpect('PATCH', '/auth/me/preferences', {
    body: {
      location_enabled: true,
      notifications_enabled: true,
      messaging_policy_accepted: true,
    },
    token: coach.token,
    step: 'Step 9 — PATCH preferences (location, notifications, messaging)',
    expect: (d) => {
      const p = d.preferences;
      const f: string[] = [];
      if (p?.location_enabled !== true) f.push('location_enabled not true');
      if (p?.notifications_enabled !== true) f.push('notifications_enabled not true');
      if (p?.messaging_policy_accepted !== true) f.push('messaging_policy_accepted not true');
      return f;
    },
  });

  // ── Step 10: Confirmation & Final Submission ───────────────────────────────
  console.log('\n  ┌─ Step 10: Confirmation & Final Submission');

  // Pre-submission state check
  await apiExpect('GET', '/auth/me', {
    token: coach.token,
    step: 'Step 10 — GET /auth/me (pre-submission check)',
    expect: (d) => {
      const f: string[] = [];
      if (d.preferences?.onboarding_completed === true) f.push('Already completed before submission!');
      if (d.preferences?.role !== 'coach') f.push('Role is not coach');
      return f;
    },
  });

  // Complete onboarding
  await apiExpect('POST', '/auth/me/complete-onboarding', {
    body: {
      role: 'coach',
      username: coach.username,
      display_name: coach.displayName,
      organization_id: coach.orgId || undefined,
      organization_name: orgName,
      team_id: coach.teamId || undefined,
      team_name: teamName,
      zip: '06510',
      affiliation: 'independent',
      sport: 'basketball',
      season_start: '2026-03-01',
      season_end: '2026-08-31',
      bio: 'Coach Journey test account — testing the complete onboarding flow.',
      sports_interests: ['basketball', 'football', 'track_and_field'],
      primary_intents: ['find_local_games', 'post_reviews_highlights', 'claim_my_team'],
      location_enabled: true,
      notifications_enabled: true,
      messaging_policy_accepted: true,
    },
    token: coach.token,
    step: 'Step 10 — POST /me/complete-onboarding (final submission)',
    expect: (d) => {
      const f: string[] = [];
      if (d.message !== 'Onboarding completed successfully') f.push(`Unexpected message: ${d.message}`);
      if (!d.user) f.push('Missing user in response');
      if (d.user?.preferences?.onboarding_completed !== true) f.push('onboarding_completed not true');
      return f;
    },
  });

  // Post-submission verification
  await apiExpect('GET', '/auth/me', {
    token: coach.token,
    step: 'Step 10 — GET /auth/me (post-submission verify)',
    expect: (d) => {
      const f: string[] = [];
      if (d.preferences?.onboarding_completed !== true) f.push('onboarding_completed STILL false after submission');
      if (d.preferences?.role !== 'coach') f.push(`Role=${d.preferences?.role}, expected coach`);
      if (d.username !== coach.username) f.push(`Username=${d.username}, expected ${coach.username}`);
      return f;
    },
  });
}

// ── Phase 2: Post-Onboarding Actions ─────────────────────────────────────────

async function phase2() {
  setPhase('Phase 2 — Post-Onboarding Coach Actions');
  if (!coach.token) return;

  // 6. Create event for the team
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 14);
  const { data: eventData } = await apiExpect('POST', '/events', {
    body: {
      title: `Journey Test Game ${RUN}`,
      date: eventDate.toISOString(),
      location: 'Journey Arena, New Haven CT',
      latitude: 41.3083,
      longitude: -72.9279,
      description: 'An end-to-end test event created during the coach journey.',
      event_type: 'game',
      max_attendees: 200,
      contact_info: coach.email,
    },
    token: coach.token,
    step: 'Create event for team',
    expect: (d) => {
      const f: string[] = [];
      if (!d.id) f.push('Missing event id');
      if (d.approval_status !== 'approved') f.push(`Event not auto-approved: ${d.approval_status}`);
      if (d.creator_role !== 'coach') f.push(`creator_role=${d.creator_role}, expected coach`);
      return f;
    },
  });
  if (eventData?.id) coach.eventId = eventData.id;

  // 7. Invite fan to team (already done in Step 6, but test the direct endpoint too)
  if (coach.teamId) {
    // Try inviting with a different email to test the flow
    const altEmail = `altinvite+${RUN}@test.varsityhub.app`;
    await apiExpect('POST', `/teams/${coach.teamId}/invite`, {
      body: { email: altEmail, role: 'assistant_coach' },
      token: coach.token,
      step: 'Invite another user as assistant_coach',
      expect: (d) => {
        const f: string[] = [];
        if (!d.id) f.push('Missing invite id');
        if (d.role !== 'assistant_coach') f.push(`Role mismatch: ${d.role}`);
        return f;
      },
    });
  }

  // 8. Create post tagged to team
  const { data: postData } = await apiExpect('POST', '/posts', {
    body: {
      content: `Great practice session with the team today! Ready for the big game. #CoachLife #JourneyTest`,
      type: 'text',
      team_id: coach.teamId || undefined,
    },
    token: coach.token,
    step: 'Create text post tagged to team',
    expect: (d) => {
      const f: string[] = [];
      if (!d.id) f.push('Missing post id');
      if (d.team_id !== coach.teamId && coach.teamId) f.push(`team_id not set on post`);
      if (d.author_id !== coach.id) f.push(`author_id mismatch: ${d.author_id}`);
      return f;
    },
  });
  if (postData?.id) coach.postId = postData.id;

  // Also create an image post
  await apiExpect('POST', '/posts', {
    body: {
      content: `Game day prep 📸`,
      media_url: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      type: 'image',
      team_id: coach.teamId || undefined,
    },
    token: coach.token,
    step: 'Create image post tagged to team',
    expect: (d) => {
      const f: string[] = [];
      if (!d.id) f.push('Missing post id');
      if (!d.media_url) f.push('media_url not saved');
      return f;
    },
  });
}

// ── Phase 3: Verify Data Endpoints ───────────────────────────────────────────

async function phase3() {
  setPhase('Phase 3 — Verify Profile Data');
  if (!coach.token) return;

  // 9. Check team profile page data
  if (coach.teamId) {
    await apiExpect('GET', `/teams/${coach.teamId}`, {
      token: coach.token,
      step: 'GET /teams/:id (team profile page)',
      expect: (d) => {
        const f: string[] = [];
        if (!d.id) f.push('Missing team id');
        if (!d.name) f.push('Missing team name');
        if (typeof d.members === 'undefined' && typeof d._count?.memberships === 'undefined') {
          f.push('Missing member count');
        }
        return f;
      },
    });

    // Check team members list
    await apiExpect('GET', `/teams/${coach.teamId}/members`, {
      token: coach.token,
      step: 'GET /teams/:id/members (team members)',
      expect: (d) => {
        const f: string[] = [];
        const members = Array.isArray(d) ? d : d.members || [];
        if (members.length === 0) f.push('No members found — coach should be listed');
        const coachMember = members.find((m: any) => m.user_id === coach.id || m.user?.id === coach.id);
        if (!coachMember) f.push('Coach not found in team members');
        return f;
      },
    });
  } else {
    results.push({ phase: currentPhase, step: 'Team profile check', status: 'BLOCKED', ok: false, detail: 'No team ID' });
  }

  // 10. Check organization page data
  if (coach.orgId) {
    await apiExpect('GET', `/organizations/${coach.orgId}`, {
      token: coach.token,
      step: 'GET /organizations/:id (org profile page)',
      expect: (d) => {
        const f: string[] = [];
        if (!d.id) f.push('Missing org id');
        if (!d.name) f.push('Missing org name');
        if (!d.teams && !d.memberships) f.push('Missing teams or memberships arrays');
        if (Array.isArray(d.memberships)) {
          const me = d.memberships.find((m: any) => m.user_id === coach.id);
          if (!me) f.push('Coach not in org memberships');
          else if (me.role !== 'owner') f.push(`Coach role=${me.role}, expected owner`);
        }
        return f;
      },
    });

    // Check org members
    await apiExpect('GET', `/organizations/${coach.orgId}/members`, {
      token: coach.token,
      step: 'GET /organizations/:id/members',
      expect: (d) => {
        const members = Array.isArray(d) ? d : [];
        const f: string[] = [];
        if (members.length === 0) f.push('No org members found');
        return f;
      },
    });
  } else {
    results.push({ phase: currentPhase, step: 'Org profile check', status: 'BLOCKED', ok: false, detail: 'No org ID' });
  }

  // Check coach's own public profile
  await apiExpect('GET', `/users/${coach.id}`, {
    token: coach.token,
    step: 'GET /users/:id (coach public profile)',
    expect: (d) => {
      const f: string[] = [];
      if (d.display_name !== coach.displayName) f.push(`display_name mismatch: ${d.display_name}`);
      if (d.username !== coach.username) f.push(`username mismatch: ${d.username}`);
      if (typeof d.posts_count !== 'number') f.push('Missing posts_count');
      if ((d.posts_count ?? 0) < 2) f.push(`posts_count=${d.posts_count}, expected >= 2`);
      return f;
    },
  });

  // Check coach's posts via user posts endpoint
  await apiExpect('GET', `/users/${coach.id}/posts`, {
    token: coach.token,
    step: 'GET /users/:id/posts (coach posts list)',
    expect: (d) => {
      const items = d.items || d;
      const f: string[] = [];
      if (!Array.isArray(items)) f.push('Response is not an array/items');
      else if (items.length < 2) f.push(`Expected >= 2 posts, got ${items.length}`);
      return f;
    },
  });

  // Check coach's teams via user teams endpoint
  await apiExpect('GET', `/users/${coach.id}/teams`, {
    token: coach.token,
    step: 'GET /users/:id/teams (coach team memberships)',
    expect: (d) => {
      const teams = Array.isArray(d) ? d : [];
      const f: string[] = [];
      if (teams.length === 0) f.push('No team memberships found for coach');
      return f;
    },
  });
}

// ── Phase 4: Cleanup ─────────────────────────────────────────────────────────

async function phase4() {
  if (process.env.CLEANUP !== '1') {
    console.log('\n  ℹ️  Test users left in DB. Run with CLEANUP=1 to delete them.');
    return;
  }
  setPhase('Phase 4 — Cleanup');
  if (coach.token) await api('DELETE', '/users/me', { token: coach.token, step: 'Delete coach account' });
  if (fan.token) await api('DELETE', '/users/me', { token: fan.token, step: 'Delete fan account' });
}

// ── Summary ──────────────────────────────────────────────────────────────────

function printSummary() {
  console.log('\n' + '═'.repeat(70));
  console.log('  END-TO-END COACH JOURNEY — RESULTS');
  console.log('═'.repeat(70));

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const flagged = results.filter((r) => r.flags && r.flags.length > 0).length;
  const total = results.length;

  // Group by phase
  const phases = new Map<string, TestResult[]>();
  for (const r of results) {
    if (!phases.has(r.phase)) phases.set(r.phase, []);
    phases.get(r.phase)!.push(r);
  }

  for (const [phase, items] of phases) {
    const pPass = items.filter((r) => r.ok).length;
    const pFail = items.filter((r) => !r.ok).length;
    const pFlag = items.filter((r) => r.flags?.length).length;
    const color = pFail > 0 ? '\x1b[31m' : '\x1b[32m';
    console.log(`\n  ${color}${phase} — ${pPass}/${items.length} passed${pFail ? `, ${pFail} failed` : ''}${pFlag ? `, ${pFlag} flagged` : ''}\x1b[0m`);

    for (const r of items) {
      const icon = r.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
      const flagStr = r.flags?.length ? ` \x1b[33m[${r.flags.length} warning(s)]\x1b[0m` : '';
      console.log(`    ${icon} [${String(r.status).padStart(3)}] ${r.step}${flagStr}`);
      if (r.detail) console.log(`                ${r.detail}`);
      if (r.flags) {
        for (const f of r.flags) console.log(`                \x1b[33m⚠ ${f}\x1b[0m`);
      }
    }
  }

  // Final tally
  console.log('\n  ' + '─'.repeat(66));
  const fc = failed === 0 ? '\x1b[32m' : '\x1b[31m';
  console.log(`  ${fc}Total: ${total} | Passed: ${passed} | Failed: ${failed} | Flagged: ${flagged}\x1b[0m`);

  // Entity summary
  console.log('\n  Created entities:');
  console.log(`    Coach ID:   ${coach.id || '(none)'}`);
  console.log(`    Org ID:     ${coach.orgId || '(none)'}`);
  console.log(`    Team ID:    ${coach.teamId || '(none)'}`);
  console.log(`    Event ID:   ${coach.eventId || '(none)'}`);
  console.log(`    Post ID:    ${coach.postId || '(none)'}`);
  console.log(`    Fan ID:     ${fan.id || '(none)'}`);

  if (failed === 0 && flagged === 0) {
    console.log('\n  \x1b[32m🎉 Complete coach journey passed with no issues!\x1b[0m\n');
  } else if (failed === 0) {
    console.log('\n  \x1b[33m⚠️  All steps passed but some data warnings — review flagged items.\x1b[0m\n');
  } else {
    console.log('\n  \x1b[31m❌ Some steps failed — review details above.\x1b[0m\n');
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║           END-TO-END COACH JOURNEY TEST                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log(`  Server:  ${BASE}`);
  console.log(`  Run ID:  ${RUN}`);
  console.log(`  Time:    ${new Date().toISOString()}`);

  // Preflight
  try {
    const h = await fetch(`${BASE}/health`);
    if (!h.ok) { console.error(`\n❌ Health check failed (${h.status})`); process.exit(1); }
    console.log('  Health:  \x1b[32mOK\x1b[0m');
  } catch (e: any) {
    console.error(`\n❌ Cannot reach ${BASE}: ${e.message}\n   Start the server: npm run dev`);
    process.exit(1);
  }

  await phase0();
  await phase1();
  await phase2();
  await phase3();
  await phase4();
  printSummary();

  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => { console.error('Fatal:', err); process.exit(2); });
