#!/usr/bin/env npx tsx
/**
 * Concurrent API Access Test Suite
 *
 * Tests race conditions and concurrent access patterns:
 *   1) 5 simultaneous upvotes on the same post
 *   2) 3 simultaneous DMs to the same user
 *   3) 2 users registering the same username simultaneously
 *   4) 10 simultaneous feed fetches (timing benchmark)
 *   5) Simultaneous ad slot claims for the same zip/date
 *
 * Usage:
 *   npx tsx scripts/concurrent-test.ts
 *   BASE_URL=https://staging.example.com npx tsx scripts/concurrent-test.ts
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
  name: string;
  passed: boolean;
  detail?: string;
  durationMs?: number;
}

interface RegisteredUser {
  token: string;
  id: string;
  email: string;
  label: string;
}

const results: TestResult[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function record(name: string, passed: boolean, detail?: string, durationMs?: number) {
  results.push({ name, passed, detail, durationMs });
  const icon = passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  const timing = durationMs !== undefined ? `  ${DIM}(${durationMs.toFixed(0)}ms)${RESET}` : '';
  const det = detail ? `  ${DIM}${detail}${RESET}` : '';
  console.log(`  ${icon}  ${name}${det}${timing}`);
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '...' : s;
}

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
  opts: { body?: any; token?: string } = {},
): Promise<{ status: number; data: any }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
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

// ── Registration helpers ─────────────────────────────────────────────────────

async function registerUser(label: string, suffix: string): Promise<RegisteredUser | null> {
  const email = `concurrent-${suffix}-${RUN}@test.vh.app`;
  const password = 'TestPass123';
  const display_name = `Concurrent ${label} ${RUN}`;

  // Register
  const reg = await api('POST', '/auth/register', {
    body: { email, password, display_name, role: 'fan' },
  });
  if (reg.status !== 200 && reg.status !== 201) {
    console.log(`    ${YELLOW}[WARN] Could not register ${label}: ${reg.status} ${truncate(JSON.stringify(reg.data), 120)}${RESET}`);
    return null;
  }

  const token = reg.data?.access_token;
  const id = reg.data?.user?.id || reg.data?.id;
  const verificationCode = reg.data?.dev_verification_code;

  if (!token || !id) {
    console.log(`    ${YELLOW}[WARN] Registration response missing token/id for ${label}${RESET}`);
    return null;
  }

  // Verify email
  if (verificationCode) {
    await api('POST', '/auth/verify/confirm', { body: { code: verificationCode }, token });
  }

  // Complete onboarding
  await api('POST', '/auth/me/complete-onboarding', {
    body: {
      role: 'fan',
      username: `conc_${suffix}_${RUN}`,
      display_name,
      zip: '06510',
      messaging_policy_accepted: true,
    },
    token,
  });

  return { token, id, email, label };
}

async function registerUsers(count: number, prefix: string): Promise<RegisteredUser[]> {
  const users: RegisteredUser[] = [];
  for (let i = 0; i < count; i++) {
    const label = `${prefix}${i + 1}`;
    const user = await registerUser(label, `${prefix.toLowerCase()}${i + 1}`);
    if (user) users.push(user);
  }
  return users;
}

// ── Section helpers ──────────────────────────────────────────────────────────

function sectionHeader(title: string) {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`  ${BOLD}${CYAN}${title}${RESET}`);
  console.log(`${'─'.repeat(72)}`);
}

// ── Test 1: 5 Simultaneous Upvotes on Same Post ─────────────────────────────

async function test1_simultaneousUpvotes() {
  sectionHeader('Test 1: 5 Simultaneous Upvotes on Same Post');

  console.log(`  ${DIM}Registering 6 users (1 author + 5 voters)...${RESET}`);
  const author = await registerUser('Author', 't1-author');
  if (!author) {
    record('Register author', false, 'Could not register author user');
    return;
  }
  record('Register author', true, `id=${author.id}`);

  const voters = await registerUsers(5, 't1-voter');
  if (voters.length < 5) {
    record('Register 5 voters', false, `Only registered ${voters.length}/5 voters`);
    return;
  }
  record('Register 5 voters', true, `${voters.length} voters ready`);

  // Author creates a post
  console.log(`  ${DIM}Author creating post...${RESET}`);
  const postRes = await api('POST', '/posts', {
    body: { content: `Concurrent upvote test post ${RUN}`, type: 'text' },
    token: author.token,
  });
  if (postRes.status !== 200 && postRes.status !== 201) {
    record('Create post', false, `${postRes.status}: ${truncate(JSON.stringify(postRes.data), 100)}`);
    return;
  }
  const postId = postRes.data?.id;
  if (!postId) {
    record('Create post', false, 'No post ID returned');
    return;
  }
  record('Create post', true, `id=${postId}`);

  // All 5 voters upvote at the exact same time
  console.log(`  ${DIM}Firing 5 simultaneous upvotes...${RESET}`);
  const t0 = Date.now();
  const upvoteResults = await Promise.all(
    voters.map((voter) =>
      api('POST', `/posts/${postId}/upvote`, { token: voter.token })
        .then((r) => ({ voter: voter.label, status: r.status, data: r.data, error: null }))
        .catch((err: any) => ({ voter: voter.label, status: 0, data: null, error: err.message }))
    ),
  );
  const upvoteDuration = Date.now() - t0;

  const successes = upvoteResults.filter((r) => r.status === 200);
  const failures = upvoteResults.filter((r) => r.status !== 200);

  record(
    '5 concurrent upvotes fired',
    successes.length === 5,
    `${successes.length}/5 succeeded, ${failures.length} failed` +
      (failures.length > 0 ? ` [${failures.map((f) => `${f.voter}:${f.status}`).join(', ')}]` : ''),
    upvoteDuration,
  );

  // Fetch the post and verify upvotes_count === 5
  console.log(`  ${DIM}Fetching post to verify count...${RESET}`);
  const getRes = await api('GET', `/posts/${postId}`, { token: author.token });
  if (getRes.status !== 200) {
    record('Fetch post after upvotes', false, `status ${getRes.status}`);
    return;
  }

  const actualCount = getRes.data?.upvotes_count ?? getRes.data?.upvote_count ?? 'N/A';
  const countCorrect = actualCount === 5;
  record(
    'upvotes_count === 5',
    countCorrect,
    `actual upvotes_count = ${actualCount}`,
  );
}

// ── Test 2: 3 Simultaneous DMs to Same User ─────────────────────────────────

async function test2_simultaneousDMs() {
  sectionHeader('Test 2: 3 Simultaneous DMs to Same User');

  console.log(`  ${DIM}Registering 4 users (3 senders + 1 receiver)...${RESET}`);
  const receiver = await registerUser('Receiver', 't2-recv');
  if (!receiver) {
    record('Register receiver', false, 'Could not register receiver');
    return;
  }
  record('Register receiver', true, `id=${receiver.id}`);

  const senders = await registerUsers(3, 't2-sender');
  if (senders.length < 3) {
    record('Register 3 senders', false, `Only registered ${senders.length}/3`);
    return;
  }
  record('Register 3 senders', true, `${senders.length} senders ready`);

  // All 3 senders fire DMs to receiver at the same time
  console.log(`  ${DIM}Firing 3 simultaneous DMs...${RESET}`);
  const t0 = Date.now();
  const dmResults = await Promise.all(
    senders.map((sender, i) =>
      api('POST', '/messages', {
        body: {
          content: `Concurrent DM #${i + 1} from ${sender.label} — ${RUN}`,
          recipient_id: receiver.id,
        },
        token: sender.token,
      })
        .then((r) => ({ sender: sender.label, status: r.status, data: r.data, error: null }))
        .catch((err: any) => ({ sender: sender.label, status: 0, data: null, error: err.message })),
    ),
  );
  const dmDuration = Date.now() - t0;

  const successes = dmResults.filter((r) => r.status === 200 || r.status === 201);
  const failures = dmResults.filter((r) => r.status !== 200 && r.status !== 201);

  record(
    '3 concurrent DMs sent',
    successes.length === 3,
    `${successes.length}/3 succeeded` +
      (failures.length > 0
        ? ` | failures: [${failures.map((f) => `${f.sender}:${f.status}=${truncate(JSON.stringify(f.data), 60)}`).join(', ')}]`
        : ''),
    dmDuration,
  );

  // Verify all 3 statuses are 200 or 201
  for (const r of dmResults) {
    const ok = r.status === 200 || r.status === 201;
    record(
      `DM from ${r.sender}`,
      ok,
      ok ? `status ${r.status}` : `status ${r.status}: ${truncate(JSON.stringify(r.data), 80)}`,
    );
  }
}

// ── Test 3: 2 Users Registering Same Username Simultaneously ─────────────────

async function test3_duplicateUsername() {
  sectionHeader('Test 3: 2 Users Setting Same Username Simultaneously');

  // Register 2 fresh users (each with their own unique username during onboarding)
  console.log(`  ${DIM}Registering 2 users for username conflict test...${RESET}`);

  const userA = await registerUser('UserA', 't3-a');
  const userB = await registerUser('UserB', 't3-b');

  if (!userA || !userB) {
    record('Register 2 users for username test', false, 'Could not register both users');
    return;
  }
  record('Register 2 users', true, `A=${userA.id}, B=${userB.id}`);

  // Both try to set the SAME username via PATCH /auth/me at the same time
  const conflictUsername = `contested_${RUN}`;
  console.log(`  ${DIM}Both users setting username "${conflictUsername}" simultaneously...${RESET}`);

  const t0 = Date.now();
  const [resA, resB] = await Promise.all([
    api('PATCH', '/auth/me', {
      body: { username: conflictUsername },
      token: userA.token,
    }).catch((err: any) => ({ status: 0, data: { error: err.message } })),
    api('PATCH', '/auth/me', {
      body: { username: conflictUsername },
      token: userB.token,
    }).catch((err: any) => ({ status: 0, data: { error: err.message } })),
  ]);
  const duration = Date.now() - t0;

  const aOk = resA.status === 200;
  const bOk = resB.status === 200;

  console.log(`    ${DIM}User A: status ${resA.status}${RESET}`);
  console.log(`    ${DIM}User B: status ${resB.status}${RESET}`);

  if (aOk && bOk) {
    // Both succeeded — possible race condition (no DB-level unique constraint)
    record(
      'Username uniqueness enforced',
      false,
      'Both users got 200 — username uniqueness may not be enforced at DB level (only app-level check)',
      duration,
    );
  } else if ((aOk && !bOk) || (!aOk && bOk)) {
    // Exactly one succeeded — correct behavior
    const winner = aOk ? 'A' : 'B';
    const loserStatus = aOk ? resB.status : resA.status;
    record(
      'Username uniqueness enforced',
      true,
      `User ${winner} got the username, other got ${loserStatus}`,
      duration,
    );
  } else {
    // Neither succeeded — might be fine if the endpoint does not support setting username this way
    record(
      'Username uniqueness enforced',
      false,
      `Neither succeeded: A=${resA.status}, B=${resB.status}. Endpoint may not support username updates via PATCH /auth/me.`,
      duration,
    );
  }
}

// ── Test 4: 10 Simultaneous Feed Fetches ─────────────────────────────────────

async function test4_simultaneousFeedFetches() {
  sectionHeader('Test 4: 10 Simultaneous Feed Fetches');

  // We need at least one token for authenticated feed fetches
  const viewer = await registerUser('Viewer', 't4-viewer');
  if (!viewer) {
    record('Register viewer for feed test', false, 'Could not register viewer');
    return;
  }

  console.log(`  ${DIM}Firing 10 concurrent GET /posts requests...${RESET}`);

  const t0 = Date.now();
  const feedResults = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      (() => {
        const reqStart = Date.now();
        return api('GET', '/posts', { token: viewer.token })
          .then((r) => ({
            index: i,
            status: r.status,
            durationMs: Date.now() - reqStart,
            error: null,
          }))
          .catch((err: any) => ({
            index: i,
            status: 0,
            durationMs: Date.now() - reqStart,
            error: err.message,
          }));
      })(),
    ),
  );
  const totalDuration = Date.now() - t0;

  const allOk = feedResults.every((r) => r.status === 200);
  const timings = feedResults.map((r) => r.durationMs);
  const min = Math.min(...timings);
  const max = Math.max(...timings);
  const avg = timings.reduce((a, b) => a + b, 0) / timings.length;
  const allUnder3s = timings.every((t) => t <= 3000);

  record(
    '10 concurrent GET /posts all return 200',
    allOk,
    allOk
      ? `All 10 returned 200`
      : `Failures: ${feedResults.filter((r) => r.status !== 200).map((r) => `#${r.index}:${r.status}`).join(', ')}`,
    totalDuration,
  );

  record(
    'All responses within 3 seconds',
    allUnder3s,
    `min=${min}ms, max=${max}ms, avg=${avg.toFixed(0)}ms`,
  );

  // Print individual timings
  console.log(`\n  ${DIM}Individual request timings:${RESET}`);
  for (const r of feedResults) {
    const bar = '#'.repeat(Math.ceil(r.durationMs / 50));
    const colour = r.durationMs <= 1000 ? GREEN : r.durationMs <= 2000 ? YELLOW : RED;
    console.log(`    ${DIM}Req #${String(r.index + 1).padStart(2)}: ${colour}${String(r.durationMs).padStart(5)}ms${RESET} ${colour}${bar}${RESET}  [${r.status}]`);
  }
  console.log(`    ${DIM}Total wall time: ${totalDuration}ms${RESET}`);
}

// ── Test 5: Simultaneous Ad Slot Claim ───────────────────────────────────────

async function test5_simultaneousAdClaim() {
  sectionHeader('Test 5: Simultaneous Ad Slot Claim (Same Zip/Date)');

  console.log(`  ${DIM}Registering 2 users for ad claim race...${RESET}`);
  const userA = await registerUser('AdUserA', 't5-ad-a');
  const userB = await registerUser('AdUserB', 't5-ad-b');
  if (!userA || !userB) {
    record('Register 2 ad users', false, 'Could not register both users');
    return;
  }
  record('Register 2 ad users', true, `A=${userA.id}, B=${userB.id}`);

  const AD_ZIP = '06510';
  // Pick a date far enough in the future to guarantee availability
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 30);
  const AD_DATE = futureDate.toISOString().slice(0, 10);

  // Each user creates an ad for the same zip
  console.log(`  ${DIM}Each user creating an ad for zip ${AD_ZIP}...${RESET}`);

  const adARes = await api('POST', '/ads', {
    body: {
      contact_name: `ConcTest A ${RUN}`,
      contact_email: userA.email,
      business_name: `TestBiz A ${RUN}`,
      target_zip_code: AD_ZIP,
      banner_url: 'https://picsum.photos/600/200',
      banner_fit_mode: 'fill',
      target_url: 'https://example.com/a',
      radius: 25,
      description: `Concurrent ad test A - ${RUN}`,
    },
    token: userA.token,
  });

  const adBRes = await api('POST', '/ads', {
    body: {
      contact_name: `ConcTest B ${RUN}`,
      contact_email: userB.email,
      business_name: `TestBiz B ${RUN}`,
      target_zip_code: AD_ZIP,
      banner_url: 'https://picsum.photos/600/200',
      banner_fit_mode: 'fill',
      target_url: 'https://example.com/b',
      radius: 25,
      description: `Concurrent ad test B - ${RUN}`,
    },
    token: userB.token,
  });

  if (adARes.status !== 201 || !adARes.data?.id) {
    record('Create ad A', false, `${adARes.status}: ${truncate(JSON.stringify(adARes.data), 100)}`);
    return;
  }
  if (adBRes.status !== 201 || !adBRes.data?.id) {
    record('Create ad B', false, `${adBRes.status}: ${truncate(JSON.stringify(adBRes.data), 100)}`);
    return;
  }

  const adAId = adARes.data.id;
  const adBId = adBRes.data.id;
  record('Create 2 ads', true, `A=${adAId}, B=${adBId}`);

  // Both users pay with FREE100 promo for the same date simultaneously
  console.log(`  ${DIM}Both users claiming date ${AD_DATE} with FREE100 simultaneously...${RESET}`);

  const t0 = Date.now();
  const [payA, payB] = await Promise.all([
    api('POST', '/payments/checkout', {
      body: { ad_id: adAId, dates: [AD_DATE], promo_code: 'FREE100' },
      token: userA.token,
    }).catch((err: any) => ({ status: 0, data: { error: err.message } })),
    api('POST', '/payments/checkout', {
      body: { ad_id: adBId, dates: [AD_DATE], promo_code: 'FREE100' },
      token: userB.token,
    }).catch((err: any) => ({ status: 0, data: { error: err.message } })),
  ]);
  const payDuration = Date.now() - t0;

  const payAOk = payA.status === 200;
  const payBOk = payB.status === 200;

  console.log(`    ${DIM}Ad A checkout: status ${payA.status}${RESET}`);
  console.log(`    ${DIM}Ad B checkout: status ${payB.status}${RESET}`);

  // Max 3 ads per slot, so both should succeed
  record(
    'Both ad claims succeed (max 3 per slot)',
    payAOk && payBOk,
    payAOk && payBOk
      ? 'Both ads paid and reserved for same date'
      : `A=${payA.status} B=${payB.status}` +
        (!payAOk ? ` A-err: ${truncate(JSON.stringify(payA.data), 80)}` : '') +
        (!payBOk ? ` B-err: ${truncate(JSON.stringify(payB.data), 80)}` : ''),
    payDuration,
  );

  // Verify both ads appear in feed for that zip + date
  if (payAOk && payBOk) {
    console.log(`  ${DIM}Checking if both ads appear in feed...${RESET}`);
    const feedRes = await api('GET', `/ads/for-feed?date=${AD_DATE}&zip=${AD_ZIP}&limit=10`);
    if (feedRes.status === 200) {
      const feedAds = feedRes.data?.ads || [];
      const feedIds = feedAds.map((a: any) => a.id);
      const foundA = feedIds.includes(adAId);
      const foundB = feedIds.includes(adBId);
      record(
        'Both ads appear in feed',
        foundA && foundB,
        `Feed has ${feedAds.length} ads. A found: ${foundA}, B found: ${foundB}` +
          (!foundA || !foundB ? ` | Feed IDs: [${feedIds.join(', ')}]` : ''),
      );
    } else {
      record('Fetch ad feed', false, `status ${feedRes.status}`);
    }
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

function printSummary() {
  console.log(`\n${'='.repeat(72)}`);
  console.log(`  ${BOLD}CONCURRENT ACCESS TEST SUITE — RESULTS${RESET}`);
  console.log(`${'='.repeat(72)}`);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  // Group by test section
  let currentSection = '';
  for (const r of results) {
    const icon = r.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    const timing = r.durationMs !== undefined ? `  ${DIM}(${r.durationMs.toFixed(0)}ms)${RESET}` : '';
    const det = r.detail ? `  ${DIM}${r.detail}${RESET}` : '';
    console.log(`  ${icon}  ${r.name}${det}${timing}`);
  }

  console.log(`\n  ${'─'.repeat(68)}`);

  // Timing summary for timed tests
  const timedResults = results.filter((r) => r.durationMs !== undefined);
  if (timedResults.length > 0) {
    console.log(`\n  ${BOLD}Timing Summary:${RESET}`);
    for (const r of timedResults) {
      const colour = (r.durationMs || 0) <= 1000 ? GREEN : (r.durationMs || 0) <= 3000 ? YELLOW : RED;
      console.log(`    ${colour}${String(r.durationMs?.toFixed(0) || '?').padStart(6)}ms${RESET}  ${r.name}`);
    }
    console.log();
  }

  const summaryColour = failed === 0 ? GREEN : RED;
  console.log(`  ${summaryColour}${BOLD}Total: ${total}  |  Passed: ${passed}  |  Failed: ${failed}${RESET}`);

  if (failed === 0) {
    console.log(`\n  ${GREEN}All concurrency tests passed.${RESET}\n`);
  } else {
    console.log(`\n  ${RED}${failed} test(s) failed — review details above.${RESET}`);
    console.log(`  ${DIM}Failed tests:${RESET}`);
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`    ${RED}x${RESET} ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
    }
    console.log();
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`${'='.repeat(72)}`);
  console.log(`  ${BOLD}${CYAN}CONCURRENT API ACCESS TEST SUITE${RESET}`);
  console.log(`${'='.repeat(72)}`);
  console.log(`  Server:   ${BASE}`);
  console.log(`  Run ID:   ${RUN}`);
  console.log(`  Time:     ${new Date().toISOString()}`);
  console.log(`  Timeout:  ${FETCH_TIMEOUT_MS}ms per request`);

  // Health check
  try {
    const h = await fetchWithTimeout(`${BASE}/health`);
    if (!h.ok) {
      console.error(`\n${RED}Health check failed (${h.status})${RESET}`);
      process.exit(1);
    }
    console.log(`  Health:   ${GREEN}OK${RESET}`);
  } catch (e: any) {
    console.error(`\n${RED}Cannot reach ${BASE}: ${e.message}${RESET}`);
    console.error('  Start the server with: npm run dev');
    process.exit(1);
  }

  // Run all 5 tests
  await test1_simultaneousUpvotes();
  await test2_simultaneousDMs();
  await test3_duplicateUsername();
  await test4_simultaneousFeedFetches();
  await test5_simultaneousAdClaim();

  // Print summary
  printSummary();

  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${RED}Fatal error:${RESET}`, err);
  process.exit(2);
});
