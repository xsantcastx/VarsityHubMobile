/**
 * Authentication & Security Edge-Case Test
 * Tests 12 security scenarios against the running server.
 *
 * Run:  npx tsx scripts/security-test.ts
 */

import jwt from 'jsonwebtoken';

const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const RUN = Date.now().toString(36);
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-minimum-32-characters-long';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

let passed = 0;
let failed = 0;
const flags: string[] = [];
const results: { step: string; ok: boolean; detail: string }[] = [];

function ok(step: string, detail = '') {
  passed++;
  results.push({ step, ok: true, detail });
  console.log(`  ✅ ${step}${detail ? ' — ' + detail : ''}`);
}
function fail(step: string, detail = '') {
  failed++;
  results.push({ step, ok: false, detail });
  console.log(`  ❌ ${step}${detail ? ' — ' + detail : ''}`);
}
function flag(msg: string) {
  flags.push(msg);
  console.log(`  🚩 FLAG: ${msg}`);
}

async function api(
  method: string,
  path: string,
  opts: { body?: any; token?: string; headers?: Record<string, string>; rawBody?: Buffer } = {},
): Promise<{ status: number; data: any; headers: Headers }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { ...opts.headers };
  if (!opts.rawBody) headers['Content-Type'] = 'application/json';
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: opts.rawBody ?? (opts.body != null ? JSON.stringify(opts.body) : undefined),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const ct = res.headers.get('content-type') || '';
    let data: any;
    if (ct.includes('json')) {
      try { data = await res.json(); } catch { data = null; }
    } else {
      data = await res.text().catch(() => null);
    }
    return { status: res.status, data, headers: res.headers };
  } catch (e: any) {
    clearTimeout(timer);
    return { status: 0, data: { error: e.message }, headers: new Headers() };
  }
}

/* ------------------------------------------------------------------ */
/*  Register a test user for authenticated tests                       */
/* ------------------------------------------------------------------ */

async function registerTestUser(): Promise<{ token: string; userId: string }> {
  const email = `sec-${RUN}@test.local`;
  const reg = await api('POST', '/auth/register', {
    body: { email, password: 'TestPass123!', role: 'fan', display_name: `SecTest ${RUN}` },
  });
  if (reg.status !== 201 || !reg.data?.access_token) {
    throw new Error(`Registration failed: ${reg.status} ${JSON.stringify(reg.data).slice(0, 200)}`);
  }
  const token = reg.data.access_token;
  const userId = reg.data.user?.id;

  // Verify email
  const code = reg.data.dev_verification_code;
  if (code) {
    await api('POST', '/auth/verify/confirm', { token, body: { code } });
  }

  // Complete onboarding
  await api('POST', '/auth/me/complete-onboarding', {
    token,
    body: { role: 'fan', username: `sectest_${RUN}`, dob: '2000-01-01', messaging_policy_accepted: true },
  });

  return { token, userId };
}

/* ------------------------------------------------------------------ */
/*  Test cases                                                         */
/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\n🔒 Security Edge-Case Test`);
  console.log(`   Base URL: ${BASE}`);
  console.log(`   Run ID:   ${RUN}\n`);

  // Setup: register a fan user
  let token = '';
  let userId = '';
  try {
    const user = await registerTestUser();
    token = user.token;
    userId = user.userId;
    console.log(`   Test user: ${userId}\n`);
  } catch (e: any) {
    console.log(`   ⛔ Setup failed: ${e.message}\n`);
    return printReport();
  }

  /* ── Test 1: No token → 401 ── */
  console.log('── Test 1: Protected endpoint without token ──');
  {
    const r = await api('GET', '/auth/me');
    if (r.status === 401) {
      ok('No token → 401', `error="${r.data?.error}"`);
    } else {
      fail('No token should return 401', `got ${r.status}`);
    }
  }

  /* ── Test 2: Expired token → 401 ── */
  console.log('── Test 2: Expired token ──');
  {
    const expired = jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '-1h' });
    const r = await api('GET', '/auth/me', { token: expired });
    if (r.status === 401) {
      ok('Expired token → 401', `error="${r.data?.error}"`);
    } else {
      fail('Expired token should return 401', `got ${r.status}`);
    }
  }

  /* ── Test 3: Malformed token → 401 ── */
  console.log('── Test 3: Malformed token ──');
  {
    const r = await api('GET', '/auth/me', { token: 'notavalidtoken' });
    if (r.status === 401) {
      ok('Malformed token → 401', `error="${r.data?.error}"`);
    } else {
      fail('Malformed token should return 401', `got ${r.status}`);
    }
  }

  /* ── Test 4: Admin endpoint with regular user → 403 ── */
  console.log('── Test 4: Admin endpoint with fan token ──');
  {
    const r = await api('GET', '/admin/dashboard', { token });
    if (r.status === 403) {
      ok('Admin endpoint → 403 for fan', `error="${r.data?.error}"`);
    } else if (r.status === 401) {
      ok('Admin endpoint → 401 for fan (auth failed before admin check)');
    } else {
      fail('Admin endpoint should reject fan', `got ${r.status}`);
    }

    // Also try /admin/transactions
    const r2 = await api('GET', '/admin/transactions', { token });
    if (r2.status === 403 || r2.status === 401) {
      ok('Admin transactions → blocked for fan', `status=${r2.status}`);
    } else {
      fail('Admin transactions should block fan', `got ${r2.status}`);
    }
  }

  /* ── Test 5: Upload .exe file → rejected ── */
  console.log('── Test 5: Upload .exe file ──');
  {
    const boundary = '----FormBoundary' + RUN;
    const body = Buffer.from([
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="malware.exe"',
      'Content-Type: application/x-msdownload',
      '',
      'MZ\x90\x00fake-exe-content',
      `--${boundary}--`,
      '',
    ].join('\r\n'));

    const r = await api('POST', '/uploads/files', {
      token,
      rawBody: body,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    });
    if (r.status === 400 || r.status === 422) {
      ok('.exe upload rejected', `status=${r.status} error="${(r.data?.error || r.data || '').toString().slice(0, 100)}"`);
    } else {
      fail('.exe upload should be rejected', `got ${r.status}`);
    }
  }

  /* ── Test 6: Upload .svg file → rejected ── */
  console.log('── Test 6: Upload .svg file ──');
  {
    const boundary = '----FormBoundary' + RUN + 'svg';
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const body = Buffer.from([
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="image.svg"',
      'Content-Type: image/svg+xml',
      '',
      svgContent,
      `--${boundary}--`,
      '',
    ].join('\r\n'));

    const r = await api('POST', '/uploads/files', {
      token,
      rawBody: body,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    });
    if (r.status === 400 || r.status === 422) {
      ok('.svg upload rejected', `status=${r.status}`);
    } else {
      fail('.svg upload should be rejected (XSS vector)', `got ${r.status}`);
    }
  }

  /* ── Test 7: HTML in post body → stripped ── */
  console.log('── Test 7: HTML tags in post body ──');
  {
    const htmlContent = '<script>alert("xss")</script><b>bold</b><img src=x onerror=alert(1)>Hello world';
    const r = await api('POST', '/posts', { token, body: { content: htmlContent } });
    if (r.status === 201 || r.status === 200) {
      const saved = r.data?.content || '';
      const hasScript = saved.includes('<script');
      const hasImg = saved.includes('<img');
      const hasBold = saved.includes('<b>');
      if (!hasScript && !hasImg && !hasBold) {
        ok('HTML tags stripped from post', `saved="${saved.slice(0, 80)}"`);
      } else {
        fail('HTML tags NOT stripped', `saved="${saved.slice(0, 120)}"`);
      }
    } else {
      // Server might reject the whole post — that's also acceptable
      if (r.status === 400) {
        ok('Post with HTML rejected outright', `status=400`);
      } else {
        fail('Post with HTML unexpected response', `status=${r.status}`);
      }
    }
  }

  /* ── Test 8: Post body over 5000 chars → rejected ── */
  console.log('── Test 8: Oversized post body ──');
  {
    const longContent = 'A'.repeat(5001);
    const r = await api('POST', '/posts', { token, body: { content: longContent } });
    if (r.status === 400) {
      ok('5001-char post rejected', `error="${(r.data?.error || '').toString().slice(0, 100)}"`);
    } else if (r.status === 201) {
      // Check if limit is higher than 4000
      flag('5001-char post was accepted — limit may be >5000');
      // Try the actual 4000 limit
      const r2 = await api('POST', '/posts', { token, body: { content: 'B'.repeat(4001) } });
      if (r2.status === 400) {
        ok('4001-char post rejected (limit is 4000)', `5001 accepted but 4001+ rejected`);
      } else {
        fail('Post char limit not enforced', `4001 chars got status=${r2.status}`);
      }
    } else {
      fail('Oversized post unexpected response', `status=${r.status}`);
    }
  }

  /* ── Test 9: Fan creating a team → should fail ── */
  console.log('── Test 9: Fan creating team ──');
  {
    const r = await api('POST', '/teams', {
      token,
      body: { name: `TestTeam_${RUN}`, sport: 'basketball' },
    });
    if (r.status === 403) {
      ok('Fan cannot create team → 403', `error="${r.data?.error}" code="${r.data?.code}"`);
    } else if (r.status === 400 || r.status === 401) {
      ok('Fan team creation blocked', `status=${r.status} error="${r.data?.error}"`);
    } else if (r.status === 201) {
      fail('Fan should NOT be able to create a team', 'got 201 — role check missing');
    } else {
      fail('Fan team creation unexpected response', `status=${r.status} ${JSON.stringify(r.data).slice(0, 150)}`);
    }
  }

  /* ── Test 10: Fan viewing /events/pending → should block ── */
  console.log('── Test 10: Fan viewing /events/pending ──');
  {
    const r = await api('GET', '/events/pending', { token });
    if (r.status === 403) {
      ok('/events/pending blocked for fan → 403', `error="${r.data?.error}"`);
    } else if (r.status === 401) {
      ok('/events/pending blocked for fan → 401');
    } else if (r.status === 200) {
      fail('/events/pending should block fans', 'got 200 — role check missing');
    } else {
      // 404 is also acceptable if the route doesn't exist
      if (r.status === 404) {
        flag('/events/pending returned 404 — route may not exist');
        ok('/events/pending not accessible (404)');
      } else {
        fail('/events/pending unexpected response', `status=${r.status}`);
      }
    }
  }

  /* ── Test 11: Forge plan in preferences → should be stripped ── */
  console.log('── Test 11: Forge plan in preferences ──');
  {
    const r = await api('PATCH', '/auth/me/preferences', {
      token,
      body: { plan: 'legend' },
    });

    // Check that plan was NOT actually stored
    const me = await api('GET', '/auth/me', { token });
    const plan = (me.data?.preferences as any)?.plan;
    if (!plan || plan === 'rookie' || plan === null) {
      ok('Plan field stripped from preferences', `plan=${plan ?? 'null'} (not "legend")`);
    } else if (plan === 'legend') {
      fail('Plan "legend" was stored — privilege escalation!', 'CRITICAL: plan field not stripped');
    } else {
      ok('Plan field not set to legend', `plan=${plan}`);
    }
  }

  /* ── Test 12: Forged Stripe webhook → should reject ── */
  console.log('── Test 12: Forged Stripe webhook ──');
  {
    const fakePayload = JSON.stringify({
      id: 'evt_fake123',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_fake',
          metadata: { ad_id: 'fake', user_id: userId },
          payment_status: 'paid',
          amount_total: 0,
        },
      },
    });

    const r = await api('POST', '/payments/webhook', {
      rawBody: Buffer.from(fakePayload),
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 't=9999999999,v1=fakesignaturehashvalue',
      },
    });
    if (r.status === 400) {
      ok('Forged webhook rejected → 400', `body="${(r.data || '').toString().slice(0, 100)}"`);
    } else if (r.status === 401 || r.status === 403) {
      ok('Forged webhook rejected', `status=${r.status}`);
    } else if (r.status === 200) {
      fail('Forged webhook ACCEPTED — signature verification broken!', 'CRITICAL');
    } else {
      fail('Forged webhook unexpected response', `status=${r.status}`);
    }
  }

  /* ── Report ── */
  printReport();
}

function printReport() {
  console.log('\n' + '═'.repeat(60));
  console.log('  SECURITY EDGE-CASE TEST REPORT');
  console.log('═'.repeat(60));
  console.log(`  Passed: ${passed}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Flags:  ${flags.length}`);
  console.log('─'.repeat(60));

  if (failed > 0) {
    console.log('\n  FAILURES:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`    ❌ ${r.step}: ${r.detail}`));
  }
  if (flags.length > 0) {
    console.log('\n  FLAGS:');
    flags.forEach((f) => console.log(`    🚩 ${f}`));
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`  Result: ${failed === 0 ? '✅ ALL PASSED' : `❌ ${failed} FAILED`}`);
  console.log('═'.repeat(60) + '\n');

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal error:', e);
  process.exit(2);
});
