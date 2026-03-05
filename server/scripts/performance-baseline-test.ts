#!/usr/bin/env npx tsx
/**
 * Performance Baseline Test Suite
 *
 * Measures API response times, detects common performance anti-patterns,
 * and audits route source code for potential issues.
 *
 *   1) Feed endpoint timing (GET /posts) - 5 runs, min/max/avg
 *   2) Notifications endpoint timing (GET /notifications) - 5 runs, min/max/avg
 *   3) Messages inbox timing (GET /messages) - 5 runs, min/max/avg
 *   4) Largest API response size across key endpoints
 *   5) N+1 query detection via source code analysis
 *   6) Missing pagination check (findMany without take/limit)
 *   7) Feed query count analysis (prisma calls in GET /posts handler)
 *
 * Usage:
 *   npx tsx scripts/performance-baseline-test.ts
 *   BASE_URL=https://staging.example.com npx tsx scripts/performance-baseline-test.ts
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const RUN = Date.now().toString(36);
const FETCH_TIMEOUT_MS = 20_000;
const TIMING_RUNS = 5;
const ROUTES_DIR = join(__dirname, '..', 'src', 'routes');

// ── Colours ──────────────────────────────────────────────────────────────────

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN   = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const DIM    = '\x1b[2m';
const BOLD   = '\x1b[1m';
const RESET  = '\x1b[0m';
const UNDERLINE = '\x1b[4m';

// ── Types ────────────────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  passed: boolean;
  detail?: string;
  durationMs?: number;
}

interface TimingResult {
  min: number;
  max: number;
  avg: number;
  runs: number[];
  status: number;
  bodySize: number;
}

interface RegisteredUser {
  token: string;
  id: string;
  email: string;
}

interface SourceCodeFinding {
  file: string;
  line: number;
  content: string;
  severity: 'warning' | 'error';
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
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
): Promise<{ status: number; data: any; bodyText: string }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetchWithTimeout(url, {
    method,
    headers,
    body: opts.body != null ? JSON.stringify(opts.body) : undefined,
  });

  const bodyText = await res.text().catch(() => '');
  let data: any;
  try {
    data = JSON.parse(bodyText);
  } catch {
    data = bodyText;
  }
  return { status: res.status, data, bodyText };
}

/**
 * Run a timed fetch against a URL multiple times and collect timing stats.
 */
async function measureEndpoint(
  path: string,
  opts: { token?: string; runs?: number } = {},
): Promise<TimingResult> {
  const runs: number[] = [];
  let lastStatus = 0;
  let lastBodySize = 0;
  const numRuns = opts.runs ?? TIMING_RUNS;

  for (let i = 0; i < numRuns; i++) {
    const url = `${BASE}${path}`;
    const headers: Record<string, string> = {};
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

    const start = Date.now();
    const res = await fetchWithTimeout(url, { method: 'GET', headers });
    const body = await res.text();
    const elapsed = Date.now() - start;

    runs.push(elapsed);
    lastStatus = res.status;
    lastBodySize = Buffer.byteLength(body, 'utf-8');
  }

  const sorted = [...runs].sort((a, b) => a - b);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(runs.reduce((sum, r) => sum + r, 0) / runs.length),
    runs,
    status: lastStatus,
    bodySize: lastBodySize,
  };
}

function printTimingTable(label: string, timing: TimingResult) {
  const bar = (ms: number) => {
    const blocks = Math.min(Math.round(ms / 50), 40);
    const color = ms < 200 ? GREEN : ms < 500 ? YELLOW : RED;
    return color + '\u2588'.repeat(blocks) + RESET;
  };

  console.log(`\n    ${CYAN}${label}${RESET}`);
  console.log(`    ${'─'.repeat(55)}`);
  console.log(`    Status   : ${timing.status === 200 ? GREEN : RED}${timing.status}${RESET}`);
  console.log(`    Runs     : ${timing.runs.map((r) => `${r}ms`).join(', ')}`);
  console.log(`    Min      : ${formatMs(timing.min)}  ${bar(timing.min)}`);
  console.log(`    Max      : ${formatMs(timing.max)}  ${bar(timing.max)}`);
  console.log(`    Avg      : ${formatMs(timing.avg)}  ${bar(timing.avg)}`);
  console.log(`    Body size: ${formatBytes(timing.bodySize)}`);
}

// ── Registration ─────────────────────────────────────────────────────────────

async function registerUser(): Promise<RegisteredUser | null> {
  const email = `perf-baseline-${RUN}@test.vh.app`;
  const password = 'TestPass123!';
  const display_name = `PerfTest ${RUN}`;

  const reg = await api('POST', '/auth/register', {
    body: { email, password, display_name, role: 'fan' },
  });
  if (reg.status !== 200 && reg.status !== 201) {
    console.log(`    ${YELLOW}[WARN] Registration failed: ${reg.status} ${truncate(JSON.stringify(reg.data), 120)}${RESET}`);
    return null;
  }

  const token = reg.data?.access_token;
  const id = reg.data?.user?.id || reg.data?.id;
  const verificationCode = reg.data?.dev_verification_code;

  if (!token || !id) {
    console.log(`    ${YELLOW}[WARN] Registration response missing token/id${RESET}`);
    return null;
  }

  // Verify email if dev verification code is available
  if (verificationCode) {
    await api('POST', '/auth/verify/confirm', { body: { code: verificationCode }, token });
  }

  // Complete onboarding
  await api('POST', '/auth/me/complete-onboarding', {
    body: {
      role: 'fan',
      username: `perf_${RUN}`,
      display_name,
      zip: '06510',
      messaging_policy_accepted: true,
    },
    token,
  });

  return { token, id, email };
}

// ── Source Code Analysis Helpers ──────────────────────────────────────────────

function getRouteFiles(): string[] {
  try {
    return readdirSync(ROUTES_DIR)
      .filter((f) => f.endsWith('.ts'))
      .map((f) => join(ROUTES_DIR, f));
  } catch {
    return [];
  }
}

function readFileLines(filePath: string): string[] {
  try {
    return readFileSync(filePath, 'utf-8').split('\n');
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  TEST 1: Feed Endpoint Timing
// ══════════════════════════════════════════════════════════════════════════════

async function testFeedTiming(user: RegisteredUser | null) {
  console.log(`\n${BOLD}${CYAN}[1/7] Feed Endpoint Timing (GET /posts)${RESET}`);
  console.log(`${'─'.repeat(60)}`);

  try {
    // Try unauthenticated first
    const unauthTiming = await measureEndpoint('/posts');
    printTimingTable('GET /posts (no auth)', unauthTiming);

    const feedOk = unauthTiming.status === 200 || unauthTiming.status === 401;
    if (unauthTiming.status === 200) {
      record(
        'Feed endpoint responds (no auth)',
        unauthTiming.avg < 2000,
        `avg=${formatMs(unauthTiming.avg)}, ${unauthTiming.avg < 2000 ? 'within 2s budget' : 'EXCEEDS 2s budget'}`,
        unauthTiming.avg,
      );
    }

    // With auth if available
    if (user) {
      const authTiming = await measureEndpoint('/posts', { token: user.token });
      printTimingTable('GET /posts (authenticated)', authTiming);
      record(
        'Feed endpoint responds (authenticated)',
        authTiming.status === 200 && authTiming.avg < 2000,
        `status=${authTiming.status}, avg=${formatMs(authTiming.avg)}`,
        authTiming.avg,
      );
    } else if (unauthTiming.status === 401) {
      record('Feed endpoint responds', false, 'Requires auth but no user registered');
    }
  } catch (err: any) {
    record('Feed endpoint responds', false, `Error: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  TEST 2: Notifications Endpoint Timing
// ══════════════════════════════════════════════════════════════════════════════

async function testNotificationsTiming(user: RegisteredUser | null) {
  console.log(`\n${BOLD}${CYAN}[2/7] Notifications Endpoint Timing (GET /notifications)${RESET}`);
  console.log(`${'─'.repeat(60)}`);

  if (!user) {
    record('Notifications endpoint timing', false, 'Skipped: no authenticated user');
    return;
  }

  try {
    const timing = await measureEndpoint('/notifications', { token: user.token });
    printTimingTable('GET /notifications', timing);

    record(
      'Notifications endpoint responds',
      timing.status === 200 && timing.avg < 2000,
      `status=${timing.status}, avg=${formatMs(timing.avg)}, body=${formatBytes(timing.bodySize)}`,
      timing.avg,
    );
  } catch (err: any) {
    record('Notifications endpoint responds', false, `Error: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  TEST 3: Messages Inbox Timing
// ══════════════════════════════════════════════════════════════════════════════

async function testMessagesTiming(user: RegisteredUser | null) {
  console.log(`\n${BOLD}${CYAN}[3/7] Messages Inbox Timing (GET /messages)${RESET}`);
  console.log(`${'─'.repeat(60)}`);

  if (!user) {
    record('Messages inbox timing', false, 'Skipped: no authenticated user');
    return;
  }

  try {
    const timing = await measureEndpoint('/messages', { token: user.token });
    printTimingTable('GET /messages', timing);

    record(
      'Messages inbox responds',
      timing.status === 200 && timing.avg < 2000,
      `status=${timing.status}, avg=${formatMs(timing.avg)}, body=${formatBytes(timing.bodySize)}`,
      timing.avg,
    );
  } catch (err: any) {
    record('Messages inbox responds', false, `Error: ${err.message}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  TEST 4: Largest API Response Size
// ══════════════════════════════════════════════════════════════════════════════

async function testLargestResponseSize(user: RegisteredUser | null) {
  console.log(`\n${BOLD}${CYAN}[4/7] Largest API Response Size${RESET}`);
  console.log(`${'─'.repeat(60)}`);

  const endpoints = [
    { path: '/posts?limit=50', label: 'GET /posts?limit=50', auth: false },
    { path: '/events', label: 'GET /events', auth: false },
  ];

  // Add auth endpoints if user is available
  if (user) {
    endpoints.push(
      { path: '/notifications?limit=50', label: 'GET /notifications?limit=50', auth: true },
    );
  }

  const sizes: { label: string; size: number; status: number }[] = [];

  for (const ep of endpoints) {
    try {
      const url = `${BASE}${ep.path}`;
      const headers: Record<string, string> = {};
      if (ep.auth && user) headers.Authorization = `Bearer ${user.token}`;

      const start = Date.now();
      const res = await fetchWithTimeout(url, { method: 'GET', headers });
      const body = await res.text();
      const elapsed = Date.now() - start;
      const bodySize = Buffer.byteLength(body, 'utf-8');

      sizes.push({ label: ep.label, size: bodySize, status: res.status });
      console.log(
        `    ${ep.label}: ${formatBytes(bodySize)} (${res.status}) ${DIM}${formatMs(elapsed)}${RESET}`,
      );
    } catch (err: any) {
      console.log(`    ${ep.label}: ${RED}Error: ${err.message}${RESET}`);
      sizes.push({ label: ep.label, size: 0, status: 0 });
    }
  }

  // Find largest
  sizes.sort((a, b) => b.size - a.size);
  const largest = sizes[0];

  if (largest) {
    console.log(`\n    ${BOLD}Largest response:${RESET} ${largest.label} = ${CYAN}${formatBytes(largest.size)}${RESET}`);

    // Warn if largest response exceeds 500KB
    const threshold = 500 * 1024;
    const passed = largest.size < threshold;
    record(
      'Largest response under 500KB',
      passed,
      `${largest.label} = ${formatBytes(largest.size)}${!passed ? ' -- consider adding pagination or field selection' : ''}`,
    );
  } else {
    record('Largest response measurement', false, 'No endpoints responded');
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  TEST 5: N+1 Query Detection (Source Code Analysis)
// ══════════════════════════════════════════════════════════════════════════════

function testNPlusOneDetection() {
  console.log(`\n${BOLD}${CYAN}[5/7] N+1 Query Detection (Source Code Analysis)${RESET}`);
  console.log(`${'─'.repeat(60)}`);

  const routeFiles = getRouteFiles();
  if (routeFiles.length === 0) {
    record('N+1 query detection', false, `No route files found in ${ROUTES_DIR}`);
    return;
  }

  const findings: SourceCodeFinding[] = [];

  for (const filePath of routeFiles) {
    const lines = readFileLines(filePath);
    const fileName = filePath.replace(ROUTES_DIR + '/', '');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Pattern 1: for (const/let ... followed by await prisma within 10 lines
      if (/^\s*for\s*\(\s*(const|let|var)\s/.test(line)) {
        const loopStart = i;
        // Look ahead up to 15 lines for await prisma calls inside the loop
        let braceDepth = 0;
        let foundOpenBrace = false;
        for (let j = i; j < Math.min(i + 20, lines.length); j++) {
          const checkLine = lines[j];
          for (const ch of checkLine) {
            if (ch === '{') { braceDepth++; foundOpenBrace = true; }
            if (ch === '}') braceDepth--;
          }
          if (foundOpenBrace && braceDepth <= 0) break;

          if (j > loopStart && /await\s+(prisma|tx)\b/.test(checkLine)) {
            findings.push({
              file: fileName,
              line: j + 1,
              content: `N+1: "await prisma" inside for-loop (loop at line ${loopStart + 1})`,
              severity: 'warning',
            });
          }
        }
      }

      // Pattern 2: .map(async ... with await prisma inside
      if (/\.map\(\s*async\b/.test(trimmed)) {
        const mapStart = i;
        let braceDepth = 0;
        let foundOpenBrace = false;
        for (let j = i; j < Math.min(i + 20, lines.length); j++) {
          const checkLine = lines[j];
          for (const ch of checkLine) {
            if (ch === '{' || ch === '(') { braceDepth++; foundOpenBrace = true; }
            if (ch === '}' || ch === ')') braceDepth--;
          }
          if (foundOpenBrace && braceDepth <= 0) break;

          if (j > mapStart && /await\s+(prisma|tx)\b/.test(checkLine)) {
            findings.push({
              file: fileName,
              line: j + 1,
              content: `Potential N+1: "await prisma" inside .map(async ...) (map at line ${mapStart + 1})`,
              severity: 'warning',
            });
          }
        }
      }

      // Pattern 3: .forEach(async ... with await prisma inside
      if (/\.forEach\(\s*async\b/.test(trimmed)) {
        const forEachStart = i;
        let braceDepth = 0;
        let foundOpenBrace = false;
        for (let j = i; j < Math.min(i + 20, lines.length); j++) {
          const checkLine = lines[j];
          for (const ch of checkLine) {
            if (ch === '{' || ch === '(') { braceDepth++; foundOpenBrace = true; }
            if (ch === '}' || ch === ')') braceDepth--;
          }
          if (foundOpenBrace && braceDepth <= 0) break;

          if (j > forEachStart && /await\s+(prisma|tx)\b/.test(checkLine)) {
            findings.push({
              file: fileName,
              line: j + 1,
              content: `Potential N+1: "await prisma" inside .forEach(async ...) (forEach at line ${forEachStart + 1})`,
              severity: 'warning',
            });
          }
        }
      }

      // Pattern 4: for...of with await prisma
      if (/^\s*for\s*\(\s*(const|let|var)\s+\w+\s+of\s/.test(line)) {
        const loopStart = i;
        let braceDepth = 0;
        let foundOpenBrace = false;
        for (let j = i; j < Math.min(i + 20, lines.length); j++) {
          const checkLine = lines[j];
          for (const ch of checkLine) {
            if (ch === '{') { braceDepth++; foundOpenBrace = true; }
            if (ch === '}') braceDepth--;
          }
          if (foundOpenBrace && braceDepth <= 0) break;

          if (j > loopStart && /await\s+(prisma|tx)\b/.test(checkLine)) {
            findings.push({
              file: fileName,
              line: j + 1,
              content: `N+1: "await prisma" inside for...of loop (loop at line ${loopStart + 1})`,
              severity: 'warning',
            });
          }
        }
      }
    }
  }

  // Deduplicate findings by file:line
  const seen = new Set<string>();
  const unique = findings.filter((f) => {
    const key = `${f.file}:${f.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (unique.length === 0) {
    console.log(`    ${GREEN}No N+1 query patterns detected in ${routeFiles.length} route files${RESET}`);
    record('N+1 query detection', true, `0 patterns found in ${routeFiles.length} route files`);
  } else {
    console.log(`    ${YELLOW}Found ${unique.length} potential N+1 query pattern(s):${RESET}\n`);
    for (const f of unique) {
      const color = f.severity === 'error' ? RED : YELLOW;
      console.log(`    ${color}[${f.severity.toUpperCase()}]${RESET} ${CYAN}${f.file}:${f.line}${RESET}`);
      console.log(`           ${DIM}${f.content}${RESET}`);
    }
    // N+1 patterns are warnings, not hard failures (may be intentional in some cases)
    record(
      'N+1 query detection',
      false,
      `${unique.length} potential N+1 pattern(s) found -- review for performance impact`,
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  TEST 6: Missing Pagination Check
// ══════════════════════════════════════════════════════════════════════════════

function testMissingPagination() {
  console.log(`\n${BOLD}${CYAN}[6/7] Missing Pagination Check (findMany without take/limit)${RESET}`);
  console.log(`${'─'.repeat(60)}`);

  const routeFiles = getRouteFiles();
  if (routeFiles.length === 0) {
    record('Missing pagination check', false, `No route files found in ${ROUTES_DIR}`);
    return;
  }

  const findings: SourceCodeFinding[] = [];

  for (const filePath of routeFiles) {
    const source = readFileSync(filePath, 'utf-8');
    const lines = source.split('\n');
    const fileName = filePath.replace(ROUTES_DIR + '/', '');

    // Find all findMany calls and check if they have take parameter
    // Strategy: look for prisma.<model>.findMany({ ... }) and check if the
    // argument block contains "take" or is bounded by a variable that contains take
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match findMany calls
      if (/\.findMany\s*\(/.test(line)) {
        // Gather the full argument block (may span multiple lines)
        let block = '';
        let braceDepth = 0;
        let started = false;
        for (let j = i; j < Math.min(i + 30, lines.length); j++) {
          const checkLine = lines[j];
          for (const ch of checkLine) {
            if (ch === '(' || ch === '{') {
              braceDepth++;
              started = true;
            }
            if (ch === ')' || ch === '}') braceDepth--;
          }
          block += checkLine + '\n';
          if (started && braceDepth <= 0) break;
        }

        // Check if the block contains 'take' or references a variable with take
        const hasTake = /\btake\b/.test(block);
        // Also check if limit is used via a variable
        const hasLimit = /\blimit\b/.test(block);

        if (!hasTake && !hasLimit) {
          // Exclude known patterns that are intentionally unbounded:
          //  - count queries (.count is not findMany)
          //  - queries for specific user's items that are naturally bounded
          //  - queries used to build sets (e.g., follows)

          // Check if this is a query that returns IDs only (used for set building)
          const isSetBuilder = /select:\s*\{\s*\w+_id:\s*true\s*\}/.test(block) ||
                               /select:\s*\{\s*id:\s*true\s*\}/.test(block);
          // Check if this is inside a loop/helper or is a simple relation lookup
          const isSimpleRelation = /\.findMany\(\s*\{\s*where:.*,\s*select:/.test(block.replace(/\n/g, ' '));

          if (!isSetBuilder) {
            findings.push({
              file: fileName,
              line: i + 1,
              content: truncate(line.trim(), 100),
              severity: 'warning',
            });
          }
        }
      }
    }
  }

  if (findings.length === 0) {
    console.log(`    ${GREEN}All findMany calls have pagination (take/limit) in ${routeFiles.length} route files${RESET}`);
    record('Missing pagination check', true, `All findMany calls paginated in ${routeFiles.length} files`);
  } else {
    console.log(`    ${YELLOW}Found ${findings.length} findMany call(s) without explicit take/limit:${RESET}\n`);
    for (const f of findings) {
      console.log(`    ${YELLOW}[WARN]${RESET} ${CYAN}${f.file}:${f.line}${RESET}`);
      console.log(`           ${DIM}${f.content}${RESET}`);
    }
    record(
      'Missing pagination check',
      false,
      `${findings.length} findMany call(s) without take/limit -- may return unbounded results`,
    );
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  TEST 7: Feed Query Count Analysis
// ══════════════════════════════════════════════════════════════════════════════

function testFeedQueryCount() {
  console.log(`\n${BOLD}${CYAN}[7/7] Feed Query Count Analysis (GET /posts handler)${RESET}`);
  console.log(`${'─'.repeat(60)}`);

  const postsFile = join(ROUTES_DIR, 'posts.ts');
  let source: string;
  try {
    source = readFileSync(postsFile, 'utf-8');
  } catch {
    record('Feed query count analysis', false, `Could not read ${postsFile}`);
    return;
  }

  const lines = source.split('\n');

  // Find the GET / handler
  let handlerStart = -1;
  let handlerEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/postsRouter\.get\(\s*['"`]\/['"`]/.test(lines[i])) {
      handlerStart = i;
      break;
    }
  }

  if (handlerStart === -1) {
    record('Feed query count analysis', false, 'Could not find GET / handler in posts.ts');
    return;
  }

  // Find the end of the handler by tracking brace depth
  let braceDepth = 0;
  let foundFirstBrace = false;
  for (let i = handlerStart; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { braceDepth++; foundFirstBrace = true; }
      if (ch === '}') braceDepth--;
    }
    if (foundFirstBrace && braceDepth <= 0) {
      handlerEnd = i;
      break;
    }
  }

  if (handlerEnd === -1) handlerEnd = lines.length - 1;

  const handlerBlock = lines.slice(handlerStart, handlerEnd + 1);
  const handlerText = handlerBlock.join('\n');

  // Count prisma queries in the handler
  const prismaCallPattern = /prisma\.\w+\.\w+\(/g;
  const prismaMatches = handlerText.match(prismaCallPattern) || [];

  // Also count Promise.all groups (batched queries count as 1 round-trip)
  const promiseAllCount = (handlerText.match(/Promise\.all\(/g) || []).length;

  // Categorize the queries
  const queryCategories: Record<string, string[]> = {};
  for (const match of prismaMatches) {
    const parts = match.replace('prisma.', '').replace('(', '').split('.');
    const model = parts[0];
    const method = parts[1];
    const key = `${model}.${method}`;
    if (!queryCategories[key]) queryCategories[key] = [];
    queryCategories[key].push(key);
  }

  console.log(`    ${BOLD}Handler location:${RESET} posts.ts lines ${handlerStart + 1}-${handlerEnd + 1}`);
  console.log(`    ${BOLD}Total prisma calls:${RESET} ${prismaMatches.length}`);
  console.log(`    ${BOLD}Promise.all batches:${RESET} ${promiseAllCount}`);
  console.log(`\n    ${UNDERLINE}Query breakdown:${RESET}`);

  for (const [key, calls] of Object.entries(queryCategories)) {
    const count = calls.length;
    console.log(`      prisma.${key} x${count}`);
  }

  // Estimate worst-case query round-trips for a single request
  // Each Promise.all batch = 1 round trip for its contents
  // Sequential awaits = 1 round trip each
  const sequentialQueries = prismaMatches.length;
  const estimated = sequentialQueries - (promiseAllCount > 0 ? promiseAllCount * 2 : 0);
  console.log(`\n    ${BOLD}Estimated round trips:${RESET} ~${Math.max(estimated, 1)}-${sequentialQueries} ${DIM}(depends on auth and code path)${RESET}`);

  // Check for conditional branches (different code paths = different query counts)
  const ifBlocks = (handlerText.match(/if\s*\(/g) || []).length;
  const sortBranch = /sort\s*===\s*['"`]trending['"`]/.test(handlerText);
  const followedBranch = /followedOnly/.test(handlerText);

  console.log(`\n    ${BOLD}Conditional branches:${RESET} ${ifBlocks} if-blocks`);
  if (sortBranch) console.log(`      - Trending sort branch (separate query path)`);
  if (followedBranch) console.log(`      - Followed-only feed branch (adds follows query)`);

  // Pass if reasonable number of queries (< 10 for a feed)
  const passed = prismaMatches.length <= 12;
  record(
    'Feed query count analysis',
    passed,
    `${prismaMatches.length} prisma calls in handler, ${promiseAllCount} batched via Promise.all${!passed ? ' -- consider reducing query count' : ''}`,
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${BOLD}${MAGENTA}  PERFORMANCE BASELINE TEST SUITE${RESET}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  ${DIM}Target: ${BASE}${RESET}`);
  console.log(`  ${DIM}Run ID: ${RUN}${RESET}`);
  console.log(`  ${DIM}Timing runs per endpoint: ${TIMING_RUNS}${RESET}`);
  console.log(`  ${DIM}Timeout: ${FETCH_TIMEOUT_MS}ms${RESET}`);
  console.log(`${'='.repeat(60)}`);

  // ── Check server connectivity ──────────────────────────────────────────
  console.log(`\n${BOLD}${CYAN}[Setup] Server Connectivity & User Registration${RESET}`);
  console.log(`${'─'.repeat(60)}`);

  let serverUp = false;
  try {
    const healthRes = await fetchWithTimeout(`${BASE}/health`, { method: 'GET' });
    serverUp = healthRes.status === 200;
    console.log(`  Server health: ${serverUp ? GREEN + 'OK' : RED + 'FAIL' + ' (status ' + healthRes.status + ')'}${RESET}`);
  } catch (err: any) {
    console.log(`  ${RED}Server unreachable: ${err.message}${RESET}`);
    console.log(`  ${YELLOW}Skipping live API tests. Running static analysis only.${RESET}`);
  }

  // ── Register a test user ───────────────────────────────────────────────
  let user: RegisteredUser | null = null;
  if (serverUp) {
    try {
      user = await registerUser();
      if (user) {
        console.log(`  Registered user: ${GREEN}${user.email}${RESET} (id: ${DIM}${user.id}${RESET})`);
      } else {
        console.log(`  ${YELLOW}Could not register user; some tests will be limited${RESET}`);
      }
    } catch (err: any) {
      console.log(`  ${YELLOW}Registration error: ${err.message}${RESET}`);
    }
  }

  // ── Run tests ──────────────────────────────────────────────────────────

  // Live API tests (only if server is up)
  if (serverUp) {
    await testFeedTiming(user);
    await testNotificationsTiming(user);
    await testMessagesTiming(user);
    await testLargestResponseSize(user);
  } else {
    console.log(`\n${YELLOW}  [SKIP] Live API tests (server not reachable)${RESET}`);
    record('Feed endpoint timing', false, 'Server not reachable');
    record('Notifications endpoint timing', false, 'Server not reachable');
    record('Messages inbox timing', false, 'Server not reachable');
    record('Largest response size', false, 'Server not reachable');
  }

  // Static analysis tests (always run)
  testNPlusOneDetection();
  testMissingPagination();
  testFeedQueryCount();

  // ── Summary ────────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${BOLD}${MAGENTA}  SUMMARY${RESET}`);
  console.log(`${'='.repeat(60)}`);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;

  // Timing summary table
  const timingResults = results.filter((r) => r.durationMs !== undefined);
  if (timingResults.length > 0) {
    console.log(`\n  ${BOLD}Timing Summary:${RESET}`);
    console.log(`  ${'─'.repeat(50)}`);
    console.log(`  ${'Endpoint'.padEnd(35)} ${'Avg'.padStart(8)}`);
    console.log(`  ${'─'.repeat(50)}`);
    for (const r of timingResults) {
      const color = (r.durationMs ?? 0) < 200 ? GREEN : (r.durationMs ?? 0) < 500 ? YELLOW : RED;
      console.log(`  ${r.name.padEnd(35)} ${color}${formatMs(r.durationMs!).padStart(8)}${RESET}`);
    }
    console.log(`  ${'─'.repeat(50)}`);
  }

  // Pass/Fail summary
  console.log(`\n  ${BOLD}Results:${RESET}`);
  for (const r of results) {
    const icon = r.passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    console.log(`    ${icon}  ${r.name}`);
  }

  console.log(`\n  ${BOLD}Total: ${total}${RESET} | ${GREEN}Passed: ${passed}${RESET} | ${RED}Failed: ${failed}${RESET}`);

  if (failed === 0) {
    console.log(`\n  ${GREEN}${BOLD}All performance checks passed!${RESET}\n`);
  } else {
    console.log(`\n  ${YELLOW}${BOLD}${failed} check(s) need attention.${RESET}\n`);
  }

  console.log(`${'='.repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${RED}Fatal error: ${err.message}${RESET}`);
  console.error(err.stack);
  process.exit(2);
});
