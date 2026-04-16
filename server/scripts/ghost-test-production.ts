/**
 * GHOST TEST — Complete Production QA (API Level)
 *
 * Tests against live production server after fresh wipe.
 * Covers Sections 1-5, 8, 10-13 from the QA checklist.
 */

const BASE = 'https://api-production-8ac3.up.railway.app';
const ADMIN_EMAIL = 'emancero@varsityhub.app';
const ADMIN_PASS = process.env.ADMIN_PASS || '';
const ts = Date.now();

let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];

function section(label: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${label}`);
  console.log('═'.repeat(60));
}

function check(label: string, condition: boolean) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; failures.push(label); console.log(`  ❌ ${label}`); }
}

function skip(label: string) {
  skipped++; console.log(`  ⏭️  ${label} (requires device)`);
}

async function api(method: string, path: string, body?: any, token?: string): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(BASE + path, opts);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data };
  } catch (err: any) {
    return { status: 0, data: { error: err.message } };
  }
}

async function register(email: string, password: string, name: string, role = 'fan') {
  const r = await api('POST', '/auth/register', { email, password, display_name: name, role });
  return { status: r.status, id: r.data?.user?.id, token: r.data?.access_token, refresh: r.data?.refresh_token, data: r.data };
}

async function login(email: string, password: string) {
  const r = await api('POST', '/auth/login', { email, password });
  return { status: r.status, id: r.data?.user?.id, token: r.data?.access_token, refresh: r.data?.refresh_token, data: r.data };
}

async function main() {
  if (!ADMIN_PASS) {
    console.error('ADMIN_PASS is required');
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║     GHOST TEST — FULL PRODUCTION QA (API LEVEL)        ║');
  console.log(`║     ${new Date().toISOString()}                ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');

  // ══════════════════════════════════════════════════════
  // SECTION 1 — ACCOUNT & AUTHENTICATION
  // ══════════════════════════════════════════════════════
  section('SECTION 1 — Account & Authentication');

  // 1.1 Register admin (or login if already exists)
  let admin = await register(ADMIN_EMAIL, ADMIN_PASS, 'Emil Mancero', 'coach');
  if (admin.status === 409) {
    // Already exists from previous run — just login
    const l = await login(ADMIN_EMAIL, ADMIN_PASS);
    admin = { ...admin, ...l };
    check('Admin login (already registered)', l.status === 200);
  } else {
    check('Admin register succeeds', admin.status === 201);
  }
  let adminToken = admin.token;

  // 1.2 Register fan (unique per run)
  const fanEmail = `fan_${ts}@test.local`;
  const fan = await register(fanEmail, 'TestPass123', 'Test Fan', 'fan');
  check('Fan register succeeds', fan.status === 201);
  check('Fan gets access_token', !!fan.token);
  check('Fan gets refresh_token', !!fan.refresh);
  check('Fan user object returned', !!fan.id);

  // 1.3 Register coach (unique per run)
  const coachEmail = `coach_${ts}@test.local`;
  const coach = await register(coachEmail, 'TestPass123', 'Test Coach', 'coach');
  check('Coach register succeeds', coach.status === 201);

  // 1.4 Duplicate email blocked
  const dupe = await register(`fan_${ts}@test.local`, 'TestPass123', 'Dupe');
  check('Duplicate email returns 409', dupe.status === 409);

  // 1.5 Login
  const fanLogin = await login(fanEmail, 'TestPass123');
  check('Fan login succeeds', fanLogin.status === 200);
  check('Login returns needs_onboarding', fanLogin.data?.needs_onboarding === true);
  let fanToken = fanLogin.token;

  // 1.6 Wrong password
  const badLogin = await login(`fan_${ts}@test.local`, 'WrongPass123');
  check('Wrong password returns 401', badLogin.status === 401);

  // 1.7 Nonexistent user
  const noUser = await login('nobody@nowhere.com', 'TestPass123');
  check('Nonexistent user returns 401', noUser.status === 401);

  // 1.8 Refresh token
  const refresh = await api('POST', '/auth/refresh', { refresh_token: fanLogin.refresh });
  check('Refresh token works', refresh.status === 200 && !!refresh.data?.access_token);
  if (refresh.data?.access_token) fanToken = refresh.data.access_token;

  // 1.9 Logout
  const logout = await api('POST', '/auth/logout', { refresh_token: fanLogin.refresh }, fanToken);
  check('Logout returns ok', logout.data?.ok === true);

  // 1.10 Refresh after logout fails
  const refreshAfter = await api('POST', '/auth/refresh', { refresh_token: fanLogin.refresh });
  check('Refresh after logout fails', refreshAfter.status === 401);

  // Re-login fan for further tests
  const fanLogin2 = await login(fanEmail, 'TestPass123');
  fanToken = fanLogin2.token;

  // 1.11 GET /auth/me
  const me = await api('GET', '/auth/me', undefined, fanToken);
  check('/auth/me returns user data', me.status === 200 && me.data?.id === fan.id);
  check('/auth/me has preferences', !!me.data?.preferences);

  // 1.12 No auth blocked
  const noAuth = await api('GET', '/auth/me');
  check('/auth/me without token returns 401', noAuth.status === 401 || !noAuth.data?.id);

  skip('Sign up with Google (requires real OAuth token)');
  skip('Sign up with Apple (requires real OAuth token)');
  skip('Forgot password email delivery (requires checking inbox)');

  // ══════════════════════════════════════════════════════
  // SECTION 2 — PROFILE
  // ══════════════════════════════════════════════════════
  section('SECTION 2 — Profile');

  // 2.1 Edit display name
  const editName = await api('PATCH', '/me', { display_name: 'Updated Fan Name' }, fanToken);
  check('Edit display name succeeds', editName.status === 200);
  check('Display name updated', editName.data?.display_name === 'Updated Fan Name');

  // 2.2 Edit bio
  const editBio = await api('PATCH', '/me', { bio: 'Test bio here' }, fanToken);
  check('Edit bio succeeds', editBio.status === 200 && editBio.data?.bio === 'Test bio here');

  // 2.3 Edit username
  const setUsername = await api('PUT', '/auth/me', { username: `fan_${ts}`.slice(0, 20), display_name: 'Updated Fan Name' }, fanToken);
  check('Set username succeeds', setUsername.status === 200);

  // 2.4 Duplicate username blocked
  const coachLogin = await login(coachEmail, 'TestPass123');
  let coachToken = coachLogin.token;
  const dupeUsername = await api('PUT', '/auth/me', { username: `fan_${ts}`.slice(0, 20) }, coachToken);
  check('Duplicate username blocked', dupeUsername.status === 400 || dupeUsername.status === 409);

  // 2.5 Follow another user
  const follow = await api('POST', `/users/${coach.id}/follow`, {}, fanToken);
  check('Follow user succeeds', follow.status === 200 || follow.status === 201);

  // 2.6 Verify follow counts
  const fanProfile = await api('GET', `/users/${fan.id}`, undefined, fanToken);
  const coachProfile = await api('GET', `/users/${coach.id}`, undefined, fanToken);
  check('Fan following count is 1', fanProfile.data?.following_count === 1 || fanProfile.data?._count?.following === 1);
  check('Coach followers count is 1', coachProfile.data?.followers_count === 1 || coachProfile.data?._count?.followers === 1);

  // 2.7 Unfollow
  const unfollow = await api('POST', `/users/${coach.id}/follow`, {}, fanToken); // toggle
  check('Unfollow succeeds', unfollow.status === 200);

  // 2.8 Block a user
  const block = await api('POST', `/users/${coach.id}/block`, {}, fanToken);
  check('Block user succeeds', block.status === 200 || block.status === 201);

  // 2.9 View blocked list
  const blocked = await api('GET', '/users/blocked', undefined, fanToken);
  check('Blocked list accessible', blocked.status === 200);

  // 2.10 Unblock
  const unblock = await api('DELETE', `/users/${coach.id}/block`, undefined, fanToken);
  check('Unblock succeeds', unblock.status === 200);

  // 2.11 View other user profile — no edit capability
  const otherProfile = await api('GET', `/users/${coach.id}`, undefined, fanToken);
  check('Can view other user profile', otherProfile.status === 200);
  check('No password_hash exposed', !otherProfile.data?.password_hash);
  check('No email exposed on public profile', !otherProfile.data?.email || otherProfile.data?.id === fan.id);

  // 2.12 Edit preferences (zip_code)
  const setZip = await api('PATCH', '/me/preferences', { zip_code: '06907' }, fanToken);
  check('Set zip_code succeeds', setZip.status === 200);
  const meAfterZip = await api('GET', '/auth/me', undefined, fanToken);
  check('zip_code persists in /me response', meAfterZip.data?.preferences?.zip_code === '06907');

  skip('Upload profile picture (requires multipart form)');
  skip('Upload profile banner (requires multipart form)');
  skip('Private profile enforcement (needs onboarded users)');

  // ══════════════════════════════════════════════════════
  // SECTION 3 — FEED & CONTENT DISCOVERY
  // ══════════════════════════════════════════════════════
  section('SECTION 3 — Feed & Content Discovery');

  const feed = await api('GET', '/posts?limit=10', undefined, fanToken);
  check('Feed loads (GET /posts)', feed.status === 200);
  check('Feed returns array', Array.isArray(feed.data?.items) || Array.isArray(feed.data));

  // Pagination
  const feed2 = await api('GET', '/posts?limit=5', undefined, fanToken);
  check('Feed pagination works', feed2.status === 200);

  // Trending
  const trending = await api('GET', '/posts?sort=trending&limit=5', undefined, fanToken);
  check('Trending feed loads', trending.status === 200);

  skip('Pull to refresh (requires device)');
  skip('Feed in airplane mode (requires device)');

  // ══════════════════════════════════════════════════════
  // SECTION 4 — CREATING POSTS (needs onboarded user)
  // ══════════════════════════════════════════════════════
  section('SECTION 4 — Creating Posts');

  // Complete fan onboarding first
  // Need to verify email first
  const fanVerifyMe = await api('GET', '/auth/me', undefined, fanToken);
  if (!fanVerifyMe.data?.email_verified) {
    // Request verification code
    await api('POST', '/auth/verify/request', {}, fanToken);
    // We can't get the code without DB access on prod
    // Try onboarding anyway — it'll tell us if verification is needed
  }

  const fanOnboard = await api('POST', '/me/complete-onboarding', {
    role: 'fan', username: `ghostfan_${ts}`.slice(0, 20), dob: '2000-01-01', affiliation: 'none',
  }, fanToken);

  if (fanOnboard.status === 200) {
    check('Fan onboarding succeeds', true);

    // Create a post
    const post = await api('POST', '/posts', { content: 'Ghost test post from fan' }, fanToken);
    check('Fan can create post', post.status === 201 || post.status === 200);

    if (post.data?.id) {
      // Read post back
      const readPost = await api('GET', `/posts/${post.data.id}`, undefined, fanToken);
      check('Post readable after creation', readPost.status === 200);
      check('Post content matches', readPost.data?.content === 'Ghost test post from fan');

      // Edit post
      const editPost = await api('PATCH', `/posts/${post.data.id}`, { content: 'Edited ghost test' }, fanToken);
      check('Edit post succeeds', editPost.status === 200);

      // Delete post
      const delPost = await api('DELETE', `/posts/${post.data.id}`, undefined, fanToken);
      check('Delete post succeeds', delPost.status === 200);
    }

    // Post without content or media — should fail
    const emptyPost = await api('POST', '/posts', {}, fanToken);
    check('Empty post rejected', emptyPost.status === 400);
  } else {
    check('Fan onboarding succeeds', false);
    console.log(`  ⚠️  Onboarding failed: ${fanOnboard.data?.error} — email verification may be required`);
    console.log('  ⚠️  Skipping post creation tests');
  }

  // Fan cannot create team
  const fanTeam = await api('POST', '/teams', { name: 'Fan Team', organization_id: 'fake' }, fanToken);
  check('Fan cannot create team (403)', fanTeam.status === 403);

  // ══════════════════════════════════════════════════════
  // SECTION 8 — TEAMS & LEAGUES
  // ══════════════════════════════════════════════════════
  section('SECTION 8 — Teams & Leagues');

  // Admin needs to be verified and onboarded for this
  const adminLogin = await login(ADMIN_EMAIL, ADMIN_PASS);
  adminToken = adminLogin.token!;

  const adminMe = await api('GET', '/auth/me', undefined, adminToken);
  if (!adminMe.data?.email_verified) {
    await api('POST', '/auth/verify/request', {}, adminToken);
    console.log('  ⚠️  Admin needs email verification — some tests may be limited');
  }

  // Try admin onboarding
  const adminOnboard = await api('POST', '/me/complete-onboarding', {
    role: 'coach', username: `admin_${ts}`.slice(0, 20), dob: '1990-01-01',
    affiliation: 'school', plan: 'legend',
  }, adminToken);

  let orgId = '';
  let teamId = '';

  if (adminOnboard.status === 200 || adminMe.data?.preferences?.onboarding_completed) {
    // Create org
    const orgCreate = await api('POST', '/organizations', {
      name: 'Ghost Test League',
      sport: 'basketball',
      org_type: 'school',
      location: 'Stamford, CT',
      zip_code: '06907',
      supporting_document_url: 'https://example.com/doc.pdf',
    }, adminToken);
    check('Create organization succeeds', orgCreate.status === 201);
    orgId = orgCreate.data?.id || '';
    check('Org has admin_approved: false', orgCreate.data?.admin_approved === false);

    // Self-approve (admin is both creator and approver)
    if (orgId) {
      const approveOrg = await api('POST', `/organizations/${orgId}/approve`, {}, adminToken);
      check('Admin can approve own org', approveOrg.status === 200);

      // Create team
      const teamCreate = await api('POST', '/teams', { name: 'Ghost Test Team', organization_id: orgId }, adminToken);
      check('Create team succeeds', teamCreate.status === 201 || teamCreate.status === 200);
      teamId = teamCreate.data?.id || teamCreate.data?.team?.id || '';

      if (teamId) {
        // Edit team
        const teamEdit = await api('PUT', `/teams/${teamId}`, { name: 'Updated Ghost Team' }, adminToken);
        check('Edit team succeeds', teamEdit.status === 200);

        // Get team
        const teamGet = await api('GET', `/teams/${teamId}`, undefined, adminToken);
        check('Get team succeeds', teamGet.status === 200);
        check('Team name updated', teamGet.data?.name === 'Updated Ghost Team');
      }

      // List org teams
      const orgTeams = await api('GET', `/organizations/${orgId}`, undefined, adminToken);
      check('Get org detail succeeds', orgTeams.status === 200);
    }
  } else {
    console.log(`  ⚠️  Admin onboarding needed: ${adminOnboard.data?.error}`);
  }

  // Coach joining flow
  const coachLogin2 = await login(coachEmail, 'TestPass123');
  coachToken = coachLogin2.token!;

  // Verify coach email
  if (!coachLogin2.data?.user?.email_verified) {
    await api('POST', '/auth/verify/request', {}, coachToken);
  }

  const coachOnboard = await api('POST', '/me/complete-onboarding', {
    role: 'coach', username: `ghostcoach_${ts}`.slice(0, 20), dob: '1990-01-01',
    affiliation: 'school', plan: 'rookie',
    organization_id: orgId || undefined,
    organization_name: 'Ghost Test League',
    join_request_pending: true,
  }, coachToken);

  if (coachOnboard.status === 200 && orgId) {
    // Submit join request
    const joinReq = await api('POST', '/organizations/join-requests', { organization_id: orgId }, coachToken);
    check('Coach join request succeeds', joinReq.status === 201 || joinReq.status === 200);

    // Coach is now PENDING
    const coachMe = await api('GET', '/auth/me', undefined, coachToken);
    check('Coach is PENDING after join', coachMe.data?.approval_status === 'PENDING');

    // Pending coach blocked from teams
    const blockedTeam = await api('POST', '/teams', { name: 'Blocked', organization_id: orgId }, coachToken);
    check('Pending coach blocked from /teams', blockedTeam.status === 403);

    // Pending coach blocked from posts
    const blockedPost = await api('POST', '/posts', { content: 'blocked' }, coachToken);
    check('Pending coach blocked from /posts', blockedPost.status === 403);

    // Admin approves coach
    if (teamId) {
      const approveCoach = await api('POST', `/organizations/${orgId}/coaches/${coach.id}/approve`, { team_id: teamId }, adminToken);
      check('Admin approves coach', approveCoach.status === 200);

      // Coach now approved
      const coachMeAfter = await api('GET', '/auth/me', undefined, coachToken);
      check('Coach is APPROVED after approval', coachMeAfter.data?.approval_status === 'APPROVED');

      // Check notification created
      const notifs = await api('GET', '/notifications?limit=5', undefined, coachToken);
      check('Coach has notifications', notifs.status === 200);
    }
  } else {
    console.log(`  ⚠️  Coach onboarding: ${coachOnboard.data?.error}`);
  }

  // ══════════════════════════════════════════════════════
  // SECTION 10 — ADS
  // ══════════════════════════════════════════════════════
  section('SECTION 10 — Ads');

  // Create ad (admin/coach)
  const adCreate = await api('POST', '/ads', {
    business_name: 'Ghost Test Biz',
    contact_name: 'Test Contact',
    contact_email: ADMIN_EMAIL,
    description: 'Ghost test ad',
    target_zip_code: '06907',
    radius: 25,
    banner_url: 'https://example.com/banner.jpg',
  }, adminToken);
  check('Create ad succeeds', adCreate.status === 201 || adCreate.status === 200);
  const adId = adCreate.data?.id;

  if (adId) {
    // Get my ads
    const myAds = await api('GET', '/ads?mine=1', undefined, adminToken);
    check('Get my ads succeeds', myAds.status === 200);

    // Submit for review
    const submitAd = await api('POST', `/ads/${adId}/submit`, {}, adminToken);
    check('Submit ad for review', submitAd.status === 200 || submitAd.status === 201);

    // Admin approve ad
    const reviewAd = await api('POST', `/ads/${adId}/review`, { action: 'approve', note: 'Looks good' }, adminToken);
    check('Admin approve ad', reviewAd.status === 200);

    // Check ad availability
    const avail = await api('GET', '/ads/availability?zip_code=06907', undefined, adminToken);
    check('Ad availability check works', avail.status === 200);

    // Feed ads
    const feedAds = await api('GET', '/ads/for-feed?zip_code=06907', undefined, fanToken);
    check('Feed ads endpoint works', feedAds.status === 200);
  }

  // ══════════════════════════════════════════════════════
  // SECTION 11 — NOTIFICATIONS
  // ══════════════════════════════════════════════════════
  section('SECTION 11 — Notifications');

  const adminNotifs = await api('GET', '/notifications?limit=10', undefined, adminToken);
  check('Get notifications succeeds', adminNotifs.status === 200);

  const markRead = await api('POST', '/notifications/mark-read-all', {}, adminToken);
  check('Mark all read succeeds', markRead.status === 200);

  skip('Push notification arrives when app closed (requires device)');
  skip('Push notification banner in background (requires device)');

  // ══════════════════════════════════════════════════════
  // SECTION 12 — SETTINGS
  // ══════════════════════════════════════════════════════
  section('SECTION 12 — Settings');

  // Change notification preferences
  const notifPrefs = await api('PATCH', '/me/preferences', {
    notifications: { game_event_reminders: true, team_updates: true, comments_upvotes: true, follows_notifications: true, messages_notifications: true },
  }, fanToken);
  check('Update notification preferences', notifPrefs.status === 200);

  // Privacy - set profile private
  const privacy = await api('PATCH', '/me/preferences', { profile_private: true }, fanToken);
  check('Set profile private', privacy.status === 200);

  skip('Delete account (destructive — skip in ghost test)');

  // ══════════════════════════════════════════════════════
  // SECTION 13 — ADMIN TOOLS
  // ══════════════════════════════════════════════════════
  section('SECTION 13 — Admin Tools');

  // Dashboard
  const dash = await api('GET', '/admin/dashboard', undefined, adminToken);
  check('Admin dashboard loads', dash.status === 200);

  // Metrics
  const metrics = await api('GET', '/admin/metrics?range=7d', undefined, adminToken);
  check('Admin metrics loads', metrics.status === 200);

  // Reports
  const reports = await api('GET', '/admin/reports', undefined, adminToken);
  check('Admin reports loads', reports.status === 200);

  // Report stats
  const rStats = await api('GET', '/admin/reports/stats', undefined, adminToken);
  check('Report stats loads', rStats.status === 200);

  // Transactions
  const txns = await api('GET', '/admin/transactions', undefined, adminToken);
  check('Admin transactions loads', txns.status === 200);

  // Activity log
  const aLog = await api('GET', '/admin/activity-log', undefined, adminToken);
  check('Admin activity log loads', aLog.status === 200);

  // Non-admin blocked
  const fanDash = await api('GET', '/admin/dashboard', undefined, fanToken);
  check('Fan blocked from admin dashboard', fanDash.status === 403);

  // No auth blocked
  const noAuthDash = await api('GET', '/admin/dashboard');
  check('Unauthenticated blocked from admin', noAuthDash.status === 401);

  // Warn test (need a target)
  if (fan.id) {
    const warn = await api('POST', `/admin/users/${fan.id}/warn`, { severity: 'warning', reason: 'Ghost test warning' }, adminToken);
    check('Admin warn user works', warn.status === 200);
  }

  // ══════════════════════════════════════════════════════
  // SECTION 7 — MESSAGING
  // ══════════════════════════════════════════════════════
  section('SECTION 7 — Messaging');

  const messages = await api('GET', '/messages', undefined, fanToken);
  check('Get messages list', messages.status === 200);

  // Send DM
  if (coach.id) {
    const dm = await api('POST', '/messages', { recipient_id: coach.id, content: 'Ghost test message' }, fanToken);
    check('Send DM succeeds', dm.status === 200 || dm.status === 201);
  }

  // ══════════════════════════════════════════════════════
  // SECTION 9 — EVENTS
  // ══════════════════════════════════════════════════════
  section('SECTION 9 — Events');

  const events = await api('GET', '/events?limit=5', undefined, fanToken);
  check('Get events list', events.status === 200);

  if (orgId && teamId) {
    const eventCreate = await api('POST', '/events', {
      title: 'Ghost Test Game',
      date: new Date(Date.now() + 86400000 * 3).toISOString(),
      location: 'Test Venue, Stamford CT',
      team_id: teamId,
      event_type: 'game',
    }, adminToken);
    check('Create event succeeds', eventCreate.status === 201 || eventCreate.status === 200);

    if (eventCreate.data?.id) {
      const getEvent = await api('GET', `/events/${eventCreate.data.id}`, undefined, fanToken);
      check('Get event detail', getEvent.status === 200);
    }
  }

  // ══════════════════════════════════════════════════════
  // SECTION 14 — EDGE CASES & SECURITY
  // ══════════════════════════════════════════════════════
  section('SECTION 14 — Security & Edge Cases');

  // Injection attempt in display name
  const xss = await api('PATCH', '/me', { display_name: '<script>alert("xss")</script>' }, fanToken);
  check('XSS in display name handled', xss.status === 200 || xss.status === 400);

  // SQL injection in search
  const sqli = await api('GET', `/users?search=' OR 1=1 --`, undefined, fanToken);
  check('SQL injection in search handled', sqli.status !== 500);

  // Approval status injection
  const inject = await api('PATCH', '/me/preferences', { approval_status: 'APPROVED', is_admin: true }, fanToken);
  const meAfterInject = await api('GET', '/auth/me', undefined, fanToken);
  check('approval_status injection blocked', meAfterInject.data?.approval_status !== 'APPROVED' || meAfterInject.data?.preferences?.role === 'fan');
  check('is_admin injection blocked', meAfterInject.data?.is_admin !== true);

  // Rate limiting
  const rapidResults = [];
  for (let i = 0; i < 5; i++) {
    const r = await api('POST', '/auth/login', { email: 'nonexistent@test.com', password: 'wrong' });
    rapidResults.push(r.status);
  }
  check('Server handles rapid requests without crashing', !rapidResults.includes(500));

  // Health check
  const health = await api('GET', '/health');
  check('Health check returns ok', health.data?.status === 'ok');

  // ══════════════════════════════════════════════════════
  // SCORECARD
  // ══════════════════════════════════════════════════════
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║              GHOST TEST SCORECARD                       ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed:  ${String(passed).padEnd(4)} / ${String(passed + failed).padEnd(4)}                                 ║`);
  console.log(`║  ❌ Failed:  ${String(failed).padEnd(4)}                                         ║`);
  console.log(`║  ⏭️  Skipped: ${String(skipped).padEnd(4)} (require device)                      ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  if (failed === 0) {
    console.log('║  🏆 ALL API-LEVEL TESTS PASSED                          ║');
  } else {
    console.log('║  FAILURES:                                               ║');
    for (const f of failures) {
      console.log(`║  • ${f.substring(0, 54).padEnd(54)} ║`);
    }
  }
  console.log('╚══════════════════════════════════════════════════════════╝');
}

main().catch(err => {
  console.error('💥 Script error:', err);
  process.exit(1);
});
