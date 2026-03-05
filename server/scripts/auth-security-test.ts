#!/usr/bin/env npx tsx
/**
 * Authentication & Security Edge-Case Test Suite
 *
 * Tests authentication edge cases and security hardening via live API calls:
 *   1)  No token on protected endpoints -> 401
 *   2)  Expired JWT -> 401
 *   3)  Malformed tokens -> 401
 *   4)  Admin endpoint with regular user -> 403
 *   5)  Upload .exe file -> rejected
 *   6)  Upload .svg file -> rejected
 *   7)  HTML in post body -> stripped
 *   8)  Post over character limit -> rejected (400)
 *   9)  Fan creating a team -> 403 COACH_ROLE_REQUIRED
 *   10) Fan accessing GET /events/pending -> 403
 *
 * Usage:
 *   npx tsx scripts/auth-security-test.ts
 *   BASE_URL=https://staging.example.com npx tsx scripts/auth-security-test.ts
 */

import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

// Load .env so we have JWT_SECRET
config();

const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const RUN = Date.now().toString(36);
const FETCH_TIMEOUT_MS = 15_000;

// ── Colours ──────────────────────────────────────────────────────────────────

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// ── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  status: number | string;
  detail?: string;
}

const results: TestResult[] = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function record(name: string, passed: boolean, status: number | string, detail?: string) {
  results.push({ name, passed, status, detail });
  const icon = passed ? `${GREEN}\u2713 PASS${RESET}` : `${RED}\u2717 FAIL${RESET}`;
  const det = detail ? `  ${DIM}${detail}${RESET}` : '';
  console.log(`  ${icon} [${String(status).padStart(3)}] ${name}${det}`);
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '...' : s;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** JSON request helper */
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

/** Multipart file upload helper using built-in FormData + Blob */
async function uploadFile(
  path: string,
  fileName: string,
  mimeType: string,
  token: string,
): Promise<{ status: number; data: any }> {
  const url = `${BASE}${path}`;
  const fakeContent = Buffer.from('MZ\x90\x00FAKEBINARY');
  const blob = new Blob([fakeContent], { type: mimeType });

  const formData = new FormData();
  formData.append('file', blob, fileName);

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
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

// ── User registration & verification helpers ─────────────────────────────────

interface RegisteredUser {
  token: string;
  id: string;
  email: string;
}

async function registerAndVerify(label: string, role: string): Promise<RegisteredUser | null> {
  const email = `sectest-${role}-${RUN}@test.varsityhub.app`;
  const password = 'TestPass123';
  const display_name = `SecTest ${role} ${RUN}`;

  // Register
  const reg = await api('POST', '/auth/register', {
    body: { email, password, display_name, role },
  });
  if (reg.status !== 200 && reg.status !== 201) {
    console.log(`    ${YELLOW}[WARN] Could not register ${label}: ${reg.status} ${truncate(JSON.stringify(reg.data), 120)}${RESET}`);
    return null;
  }

  const token = reg.data?.access_token;
  const id = reg.data?.user?.id;
  const verificationCode = reg.data?.dev_verification_code;

  if (!token || !id) {
    console.log(`    ${YELLOW}[WARN] Registration response missing token or id for ${label}${RESET}`);
    return null;
  }

  // Verify email
  if (verificationCode) {
    const ver = await api('POST', '/auth/verify/confirm', {
      body: { code: verificationCode },
      token,
    });
    if (ver.status !== 200 && ver.status !== 201) {
      console.log(`    ${YELLOW}[WARN] Email verification failed for ${label}: ${ver.status}${RESET}`);
    }
  }

  // Complete onboarding
  const username = `sectest_${role}_${RUN}`;
  await api('POST', '/auth/me/complete-onboarding', {
    body: {
      role,
      username,
      display_name,
      zip: '06510',
      messaging_policy_accepted: true,
    },
    token,
  });

  return { token, id, email };
}

// ── Test sections ────────────────────────────────────────────────────────────

function sectionHeader(title: string) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(70)}`);
}

// ── 1. No Token -> 401 ──────────────────────────────────────────────────────

async function testNoToken() {
  sectionHeader('1. No Token -> 401');

  const endpoints: Array<{ method: string; path: string; body?: any }> = [
    { method: 'GET', path: '/auth/me' },
    { method: 'GET', path: '/notifications' },
    { method: 'POST', path: '/posts', body: { content: 'test' } },
  ];

  for (const ep of endpoints) {
    const { status, data } = await api(ep.method, ep.path, { body: ep.body });
    const passed = status === 401;
    record(
      `${ep.method} ${ep.path} without token`,
      passed,
      status,
      passed ? undefined : `Expected 401, got ${status}: ${truncate(JSON.stringify(data), 100)}`,
    );
  }
}

// ── 2. Expired Token -> 401 ─────────────────────────────────────────────────

async function testExpiredToken() {
  sectionHeader('2. Expired Token -> 401');

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    record('Expired JWT -> GET /auth/me', false, 'SKIP', 'JWT_SECRET not found in environment');
    return;
  }

  // Create a token that expired 1 hour ago
  const expiredToken = jwt.sign(
    { id: 'fake-user-id', exp: Math.floor(Date.now() / 1000) - 3600 },
    secret,
  );

  const { status, data } = await api('GET', '/auth/me', { token: expiredToken });
  // The auth middleware sets req.user = undefined for invalid tokens, then requireAuth returns 401
  const passed = status === 401;
  record(
    'Expired JWT -> GET /auth/me',
    passed,
    status,
    passed ? undefined : `Expected 401, got ${status}: ${truncate(JSON.stringify(data), 100)}`,
  );
}

// ── 3. Malformed Tokens -> 401 ──────────────────────────────────────────────

async function testMalformedTokens() {
  sectionHeader('3. Malformed Tokens -> 401');

  const malformedValues = [
    'garbage123',
    '',
    'null',
  ];

  for (const val of malformedValues) {
    const displayVal = val === '' ? '(empty string)' : val;
    const { status, data } = await api('GET', '/auth/me', {
      headers: { Authorization: `Bearer ${val}` },
    });
    const passed = status === 401;
    record(
      `Bearer "${displayVal}" -> GET /auth/me`,
      passed,
      status,
      passed ? undefined : `Expected 401, got ${status}: ${truncate(JSON.stringify(data), 100)}`,
    );
  }
}

// ── 4. Admin Endpoint with Regular User -> 403 ──────────────────────────────

async function testAdminEndpointWithRegularUser(fanUser: RegisteredUser | null) {
  sectionHeader('4. Admin Endpoint with Regular User -> 403');

  if (!fanUser) {
    record('Regular user -> GET /admin/dashboard', false, 'SKIP', 'No fan user registered');
    return;
  }

  const { status, data } = await api('GET', '/admin/dashboard', { token: fanUser.token });
  const passed = status === 403;
  record(
    'Regular user -> GET /admin/dashboard',
    passed,
    status,
    passed ? undefined : `Expected 403, got ${status}: ${truncate(JSON.stringify(data), 100)}`,
  );
}

// ── 5. Upload .exe File -> Rejected ─────────────────────────────────────────

async function testUploadExe(fanUser: RegisteredUser | null) {
  sectionHeader('5. Upload .exe File -> Rejected');

  if (!fanUser) {
    record('Upload test.exe -> POST /uploads/files', false, 'SKIP', 'No user registered');
    return;
  }

  const { status, data } = await uploadFile(
    '/uploads/files',
    'test.exe',
    'application/x-msdownload',
    fanUser.token,
  );
  // Should be rejected — 400 from file filter, or 500 etc.
  const passed = status === 400 || status === 415 || status === 422;
  record(
    'Upload test.exe -> POST /uploads/files',
    passed,
    status,
    `Response: ${truncate(JSON.stringify(data), 150)}`,
  );
}

// ── 6. Upload .svg File -> Rejected ─────────────────────────────────────────

async function testUploadSvg(fanUser: RegisteredUser | null) {
  sectionHeader('6. Upload .svg File -> Rejected');

  if (!fanUser) {
    record('Upload test.svg -> POST /uploads/files', false, 'SKIP', 'No user registered');
    return;
  }

  const { status, data } = await uploadFile(
    '/uploads/files',
    'test.svg',
    'image/svg+xml',
    fanUser.token,
  );
  const passed = status === 400 || status === 415 || status === 422;
  record(
    'Upload test.svg -> POST /uploads/files',
    passed,
    status,
    `Response: ${truncate(JSON.stringify(data), 150)}`,
  );
}

// ── 7. HTML in Post Body -> Stripped ─────────────────────────────────────────

async function testHtmlStripping(verifiedUser: RegisteredUser | null) {
  sectionHeader('7. HTML in Post Body -> Stripped');

  if (!verifiedUser) {
    record('HTML in post content -> stripped', false, 'SKIP', 'No verified user registered');
    return;
  }

  const htmlContent = "<script>alert('xss')</script><b>bold</b> normal text";

  // Create the post
  const createRes = await api('POST', '/posts', {
    body: { content: htmlContent, type: 'text' },
    token: verifiedUser.token,
  });

  if (createRes.status !== 200 && createRes.status !== 201) {
    record(
      'Create post with HTML content',
      false,
      createRes.status,
      `Failed to create post: ${truncate(JSON.stringify(createRes.data), 120)}`,
    );
    return;
  }

  const postId = createRes.data?.id;
  if (!postId) {
    record('Create post with HTML content', false, createRes.status, 'No post ID in response');
    return;
  }

  // Fetch the post back
  const getRes = await api('GET', `/posts/${postId}`, { token: verifiedUser.token });
  if (getRes.status !== 200) {
    record(
      'Fetch post to check HTML stripping',
      false,
      getRes.status,
      `Failed to fetch post: ${truncate(JSON.stringify(getRes.data), 120)}`,
    );
    return;
  }

  const savedContent: string = getRes.data?.content || '';
  const hasScript = savedContent.includes('<script');
  const hasBoldTag = savedContent.includes('<b>');
  const hasNormalText = savedContent.includes('normal text');
  const hasBoldText = savedContent.includes('bold');

  const passed = !hasScript && !hasBoldTag && hasNormalText && hasBoldText;
  record(
    'HTML in post content -> stripped',
    passed,
    getRes.status,
    `Saved content: "${truncate(savedContent, 120)}" | <script> present: ${hasScript} | <b> present: ${hasBoldTag}`,
  );
}

// ── 8. Post Over Character Limit -> Rejected ────────────────────────────────

async function testPostCharLimit(verifiedUser: RegisteredUser | null) {
  sectionHeader('8. Post Over Character Limit -> 400');

  if (!verifiedUser) {
    record('Post 4001+ chars -> 400', false, 'SKIP', 'No verified user registered');
    return;
  }

  // Zod schema allows max 4000 chars on content
  const oversizedContent = 'A'.repeat(4001);

  const { status, data } = await api('POST', '/posts', {
    body: { content: oversizedContent, type: 'text' },
    token: verifiedUser.token,
  });

  const passed = status === 400;
  record(
    'Post with 4001 chars -> 400',
    passed,
    status,
    passed
      ? `Correctly rejected: ${truncate(JSON.stringify(data), 120)}`
      : `Expected 400, got ${status}: ${truncate(JSON.stringify(data), 120)}`,
  );
}

// ── 9. Fan Creating a Team -> 403 COACH_ROLE_REQUIRED ───────────────────────

async function testFanCreateTeam(fanUser: RegisteredUser | null) {
  sectionHeader('9. Fan Creating a Team -> 403 COACH_ROLE_REQUIRED');

  if (!fanUser) {
    record('Fan -> POST /teams (create)', false, 'SKIP', 'No fan user registered');
    return;
  }

  const { status, data } = await api('POST', '/teams', {
    body: {
      name: `FanTeam_${RUN}`,
      description: 'A fan should not be able to create this',
    },
    token: fanUser.token,
  });

  const passed = status === 403 && (data?.error === 'COACH_ROLE_REQUIRED' || data?.code === 'COACH_ROLE_REQUIRED');
  record(
    'Fan -> POST /teams (create)',
    passed,
    status,
    `error: ${data?.error || data?.code || 'N/A'} | message: ${truncate(data?.message || '', 80)}`,
  );
}

// ── 10. Fan Accessing GET /events/pending -> 403 ────────────────────────────

async function testFanEventsPending(fanUser: RegisteredUser | null) {
  sectionHeader('10. Fan -> GET /events/pending -> 403');

  if (!fanUser) {
    record('Fan -> GET /events/pending', false, 'SKIP', 'No fan user registered');
    return;
  }

  const { status, data } = await api('GET', '/events/pending', { token: fanUser.token });
  const passed = status === 403;
  record(
    'Fan -> GET /events/pending',
    passed,
    status,
    passed
      ? `Correctly blocked: ${truncate(JSON.stringify(data), 120)}`
      : `Expected 403, got ${status}: ${truncate(JSON.stringify(data), 120)}`,
  );
}

// ── Summary ──────────────────────────────────────────────────────────────────

function printSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('  AUTH & SECURITY TEST SUITE — RESULTS');
  console.log('='.repeat(70));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  for (const r of results) {
    const icon = r.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    const det = r.detail ? `  ${DIM}${r.detail}${RESET}` : '';
    console.log(`  ${icon} [${String(r.status).padStart(3)}] ${r.name}${det}`);
  }

  console.log('\n  ' + '-'.repeat(66));
  const summaryColor = failed === 0 ? GREEN : RED;
  console.log(`  ${summaryColor}Total: ${total} | Passed: ${passed} | Failed: ${failed}${RESET}`);

  if (failed === 0) {
    console.log(`\n  ${GREEN}All security tests passed.${RESET}\n`);
  } else {
    console.log(`\n  ${RED}${failed} test(s) failed — review details above.${RESET}\n`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(70));
  console.log('  AUTH & SECURITY EDGE-CASE TEST SUITE');
  console.log('='.repeat(70));
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

  // ── Register test users ────────────────────────────────────────────────────

  sectionHeader('Setup: Register test users');
  console.log(`  Registering fan user...`);
  const fanUser = await registerAndVerify('fan', 'fan');
  if (fanUser) {
    console.log(`    ${GREEN}Fan registered${RESET}: ${fanUser.email} (${fanUser.id})`);
  } else {
    console.log(`    ${RED}Fan registration failed — some tests will be skipped${RESET}`);
  }

  // For the HTML stripping and char limit tests, we need a verified user.
  // The fan user is already verified and onboarded, so reuse them.
  const verifiedUser = fanUser;

  // ── Run all tests ──────────────────────────────────────────────────────────

  await testNoToken();
  await testExpiredToken();
  await testMalformedTokens();
  await testAdminEndpointWithRegularUser(fanUser);
  await testUploadExe(fanUser);
  await testUploadSvg(fanUser);
  await testHtmlStripping(verifiedUser);
  await testPostCharLimit(verifiedUser);
  await testFanCreateTeam(fanUser);
  await testFanEventsPending(fanUser);

  // ── Print summary ──────────────────────────────────────────────────────────

  printSummary();

  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
