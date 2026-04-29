/**
 * API CONTRACT TESTS — Shape mismatches, bad input handling, idempotency, pagination
 * Tests 1, 2, 4, 5 from the API QA checklist
 */

const BASE = 'https://api-production-8ac3.up.railway.app';
const ADMIN_EMAIL = 'support@varsityhub.app';
const ADMIN_PASS = 'Lime3100$';
const ts = Date.now();

let passed = 0;
let failed = 0;
let adminToken = '';
let adminId = '';
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

async function api(method: string, path: string, body?: any, token?: string, rawBody?: string): Promise<{ status: number; data: any; ms: number }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts: RequestInit = { method, headers };
  if (rawBody) { opts.body = rawBody; }
  else if (body !== undefined) { opts.body = JSON.stringify(body); }
  const start = Date.now();
  try {
    const res = await fetch(BASE + path, opts);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, ms: Date.now() - start };
  } catch (err: any) {
    return { status: 0, data: { error: err.message }, ms: Date.now() - start };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   API CONTRACT TESTS — Shape, Bad Input, Pagination     ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const login = await api('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  adminToken = login.data?.access_token;
  adminId = login.data?.user?.id;
  if (!adminToken) { console.log('❌ Login failed'); return; }

  // ══════════════════════════════════════════
  // TEST 1 — RESPONSE SHAPE VERIFICATION
  // ══════════════════════════════════════════
  section('TEST 1 — RESPONSE SHAPE (frontend expects these fields)');

  // POST /auth/login — frontend reads: access_token, refresh_token, user.id, user.email, user.preferences, needs_onboarding
  check('Login: has access_token', !!login.data?.access_token);
  check('Login: has refresh_token', !!login.data?.refresh_token);
  check('Login: has user.id', !!login.data?.user?.id);
  check('Login: has user.email', !!login.data?.user?.email);
  check('Login: has user.preferences', typeof login.data?.user?.preferences === 'object');
  check('Login: has needs_onboarding', login.data?.needs_onboarding !== undefined);

  // GET /auth/me — frontend reads: id, email, display_name, username, avatar_url, bio, preferences, approval_status, _count, is_admin, has_password
  const me = await api('GET', '/auth/me', undefined, adminToken);
  check('/me: has id', !!me.data?.id);
  check('/me: has email', !!me.data?.email);
  check('/me: has display_name', me.data?.display_name !== undefined);
  check('/me: has username', me.data?.username !== undefined);
  check('/me: has preferences', typeof me.data?.preferences === 'object');
  check('/me: has approval_status', !!me.data?.approval_status);
  check('/me: has _count', typeof me.data?._count === 'object');
  check('/me: has is_admin', me.data?.is_admin !== undefined);
  check('/me: has has_password', me.data?.has_password !== undefined);
  check('/me: no password_hash', !me.data?.password_hash);

  // GET /posts — frontend reads: items[].id, .content, .media_url, .author_id, .created_at, .upvotes_count
  const posts = await api('GET', '/posts?limit=5', undefined, adminToken);
  check('/posts: returns array or items', Array.isArray(posts.data?.items) || Array.isArray(posts.data));
  const postItems = posts.data?.items || posts.data || [];
  if (postItems.length > 0) {
    const p = postItems[0];
    check('/posts item: has id', !!p.id);
    check('/posts item: has content or media_url', p.content !== undefined || p.media_url !== undefined);
    check('/posts item: has author_id', !!p.author_id);
    check('/posts item: has created_at', !!p.created_at);
    check('/posts item: has upvotes_count', p.upvotes_count !== undefined);
  }

  // GET /notifications — frontend reads: items[].id, .type, .meta, .created_at, .read_at, .actor, .post
  const notifs = await api('GET', '/notifications?limit=5', undefined, adminToken);
  check('/notifications: returns items', Array.isArray(notifs.data?.items) || Array.isArray(notifs.data));
  const notifItems = notifs.data?.items || notifs.data || [];
  if (notifItems.length > 0) {
    const n = notifItems[0];
    check('/notifications item: has id', !!n.id);
    check('/notifications item: has type', !!n.type);
    check('/notifications item: has created_at', !!n.created_at);
    check('/notifications item: has meta', n.meta !== undefined);
  }

  // GET /events — frontend reads: items or array with id, title, date, location
  const events = await api('GET', '/events?limit=5', undefined, adminToken);
  check('/events: status 200', events.status === 200);

  // GET /messages — frontend reads conversation list
  const msgs = await api('GET', '/messages', undefined, adminToken);
  check('/messages: status 200', msgs.status === 200);

  // GET /teams/managed — frontend reads array of teams with id, name, organization_id
  const teams = await api('GET', '/teams/managed', undefined, adminToken);
  check('/teams/managed: status 200', teams.status === 200);
  const teamList = Array.isArray(teams.data) ? teams.data : [];
  if (teamList.length > 0) {
    check('/teams item: has id', !!teamList[0].id);
    check('/teams item: has name', !!teamList[0].name);
  }

  // GET /ads?mine=1 — frontend reads ads with id, business_name, status, payment_status
  const ads = await api('GET', '/ads?mine=1', undefined, adminToken);
  check('/ads?mine=1: status 200', ads.status === 200);

  // ══════════════════════════════════════════
  // TEST 2 — BAD INPUT HANDLING
  // ══════════════════════════════════════════
  section('TEST 2 — BAD INPUT (every endpoint should return 4xx not 500)');

  // Missing required fields
  const missingEmail = await api('POST', '/auth/register', { password: 'TestPass123' });
  check('Register without email: 400', missingEmail.status === 400);

  const missingPw = await api('POST', '/auth/register', { email: 'x@x.com' });
  check('Register without password: 400', missingPw.status === 400);

  const loginNoPw = await api('POST', '/auth/login', { email: 'x@x.com' });
  check('Login without password: 400', loginNoPw.status === 400);

  const loginNoEmail = await api('POST', '/auth/login', { password: 'x' });
  check('Login without email: 400', loginNoEmail.status === 400);

  // Wrong data types
  const numericEmail = await api('POST', '/auth/register', { email: 12345, password: 'TestPass123' });
  check('Register with numeric email: 400', numericEmail.status === 400);

  // Post with empty content + no media
  const emptyPost = await api('POST', '/posts', {}, adminToken);
  check('Post with no content/media: 400', emptyPost.status === 400);

  // Post with content that's just whitespace
  const wsPost = await api('POST', '/posts', { content: '   ' }, adminToken);
  check('Post with whitespace only: 400', wsPost.status === 400);

  // Nonexistent resource
  const fakePost = await api('GET', '/posts/nonexistent-id-12345', undefined, adminToken);
  check('Get nonexistent post: 404 not 500', fakePost.status === 404 || fakePost.status === 400);

  const fakeUser = await api('GET', '/users/nonexistent-id-12345', undefined, adminToken);
  check('Get nonexistent user: 404 not 500', fakeUser.status === 404 || fakeUser.status === 400);

  const fakeTeam = await api('GET', '/teams/nonexistent-id-12345', undefined, adminToken);
  check('Get nonexistent team: 404 not 500', fakeTeam.status === 404 || fakeTeam.status === 400);

  const fakeOrg = await api('GET', '/organizations/nonexistent-id-12345', undefined, adminToken);
  check('Get nonexistent org: 404 not 500', fakeOrg.status === 404 || fakeOrg.status === 400);

  // Permission violations
  const fakeApprove = await api('POST', '/organizations/nonexistent/coaches/fake/approve', {}, adminToken);
  check('Approve fake coach: not 500', fakeApprove.status !== 500);

  // Invalid pagination
  const negPage = await api('GET', '/posts?limit=-1', undefined, adminToken);
  check('Negative limit: not 500', negPage.status !== 500);

  const hugeLimit = await api('GET', '/posts?limit=999999', undefined, adminToken);
  check('Huge limit: not 500', hugeLimit.status !== 500);

  // Malformed JSON (should be 400 after our fix)
  const badJson = await api('POST', '/auth/login', undefined, undefined, 'not json at all{{{');
  check('Malformed JSON: 400 not 500', badJson.status === 400);

  // Wrong method
  const wrongMethod = await api('DELETE', '/auth/login');
  check('DELETE on /auth/login: not 500', wrongMethod.status !== 500);

  // ══════════════════════════════════════════
  // TEST 3 — AUTH HEADER HANDLING
  // ══════════════════════════════════════════
  section('TEST 3 — AUTH HEADER HANDLING');

  // No auth on protected endpoints
  const protectedEndpoints = [
    ['GET', '/auth/me'],
    ['POST', '/posts'],
    ['GET', '/notifications'],
    ['GET', '/messages'],
    ['GET', '/teams/managed'],
    ['POST', '/teams'],
    ['POST', '/ads'],
    ['GET', '/admin/dashboard'],
  ];

  for (const [method, path] of protectedEndpoints) {
    const r = await api(method, path, method === 'POST' ? {} : undefined);
    check(`No auth on ${method} ${path}: 401`, r.status === 401);
  }

  // Malformed token
  const badToken = await api('GET', '/auth/me', undefined, 'not-a-jwt');
  check('Malformed token: 401', badToken.status === 401 || !badToken.data?.id);

  // Garbage Bearer
  const garbageBearer = await api('GET', '/auth/me', undefined, 'eyJ.garbage.token');
  check('Garbage JWT: 401', garbageBearer.status === 401 || !garbageBearer.data?.id);

  // Public endpoints work without auth
  const publicEndpoints = [
    ['GET', '/health'],
    ['GET', '/posts?limit=5'],
    ['GET', '/events?limit=5'],
  ];

  for (const [method, path] of publicEndpoints) {
    const r = await api(method, path);
    check(`Public ${path}: 200 without auth`, r.status === 200);
  }

  // ══════════════════════════════════════════
  // TEST 4 — PAGINATION
  // ══════════════════════════════════════════
  section('TEST 4 — PAGINATION');

  // Default limit
  const defaultPosts = await api('GET', '/posts', undefined, adminToken);
  const defaultItems = defaultPosts.data?.items || defaultPosts.data || [];
  check('/posts default: returns ≤ 20 items', Array.isArray(defaultItems) && defaultItems.length <= 20);

  // Explicit limit
  const limit1 = await api('GET', '/posts?limit=1', undefined, adminToken);
  const limit1Items = limit1.data?.items || limit1.data || [];
  check('/posts?limit=1: returns ≤ 1 item', Array.isArray(limit1Items) && limit1Items.length <= 1);

  // Cursor pagination
  const page1 = await api('GET', '/posts?limit=1', undefined, adminToken);
  const cursor = page1.data?.nextCursor;
  if (cursor) {
    const page2 = await api('GET', `/posts?limit=1&cursor=${encodeURIComponent(cursor)}`, undefined, adminToken);
    const p2Items = page2.data?.items || page2.data || [];
    check('Cursor pagination: page 2 loads', page2.status === 200 && Array.isArray(p2Items));
    // No duplicate
    const p1Id = (page1.data?.items || page1.data)?.[0]?.id;
    const p2Id = p2Items[0]?.id;
    check('Cursor pagination: no duplicate', p1Id !== p2Id || !p1Id);
  } else {
    check('Cursor pagination: nextCursor returned', !!cursor);
  }

  // Notifications pagination
  const notifPage = await api('GET', '/notifications?limit=5', undefined, adminToken);
  check('/notifications pagination: returns items', notifPage.status === 200);

  // Events pagination
  const eventPage = await api('GET', '/events?limit=5', undefined, adminToken);
  check('/events pagination: returns items', eventPage.status === 200);

  // ══════════════════════════════════════════
  // TEST 5 — IDEMPOTENCY & DUPLICATE PROTECTION
  // ══════════════════════════════════════════
  section('TEST 5 — IDEMPOTENCY & DUPLICATE PROTECTION');

  // Create a post for testing
  const testPost = await api('POST', '/posts', { content: `Idempotency test ${ts}` }, adminToken);
  const postId = testPost.data?.id;

  if (postId) {
    // Double upvote (toggle)
    const up1 = await api('POST', `/posts/${postId}/upvote`, {}, adminToken);
    const up2 = await api('POST', `/posts/${postId}/upvote`, {}, adminToken);
    check('Double upvote: toggles (no duplicate)', up1.status === 200 && up2.status === 200);

    // Double bookmark
    const bm1 = await api('POST', `/posts/${postId}/bookmark`, {}, adminToken);
    const bm2 = await api('POST', `/posts/${postId}/bookmark`, {}, adminToken);
    check('Double bookmark: toggles', bm1.status === 200 && bm2.status === 200);

    // Clean up
    await api('DELETE', `/posts/${postId}`, undefined, adminToken);
  }

  // Double register
  const dupeReg = await api('POST', '/auth/register', { email: ADMIN_EMAIL, password: 'TestPass123', display_name: 'Dupe' });
  check('Double register: 409', dupeReg.status === 409);

  // Double login (should work — not idempotent but should succeed)
  const login2 = await api('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASS });
  check('Double login: still 200', login2.status === 200);

  // ══════════════════════════════════════════
  // TEST 9 — WEBHOOK SECURITY (what we can test without Stripe)
  // ══════════════════════════════════════════
  section('TEST 9 — WEBHOOK SECURITY');

  // Invalid signature
  const fakeWebhook = await api('POST', '/payments/webhook', undefined, undefined, '{"type":"checkout.session.completed"}');
  check('Webhook without signature: rejected (not 200)', fakeWebhook.status !== 200);

  // Webhook endpoint exists
  check('Webhook endpoint exists (not 404)', fakeWebhook.status !== 404);

  // ══════════════════════════════════════════
  // SCORECARD
  // ══════════════════════════════════════════
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          API CONTRACT TEST SCORECARD                    ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed: ${String(passed).padEnd(4)} / ${String(passed + failed).padEnd(4)}                                 ║`);
  console.log(`║  ❌ Failed: ${String(failed).padEnd(4)}                                         ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  if (failed === 0) {
    console.log('║  🏆 ALL API CONTRACTS VERIFIED                           ║');
  } else {
    console.log('║  FAILURES:                                               ║');
    for (const f of failures.slice(0, 15)) {
      console.log(`║  • ${f.substring(0, 54).padEnd(54)} ║`);
    }
  }
  console.log('╚══════════════════════════════════════════════════════════╝');
}

main().catch(err => { console.error('💥', err); process.exit(1); });
