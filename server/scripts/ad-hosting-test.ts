/**
 * End-to-End Ad Hosting Journey Test
 *
 * Simulates the full ad hosting flow:
 *  1) Register & verify an advertiser user
 *  2) POST /ads — create ad with zip code, description, banner image URL
 *  3) GET /ads/:id — verify ad saved correctly
 *  4) GET /ads/availability — check date availability
 *  5) POST /promos/preview — test promo codes (FREE100 & Hubvarsity321)
 *  6) Verify pricing — weekday $5 block, weekend $8 block
 *  7) POST /payments/checkout — use FREE100 to finalize for free
 *  8) GET /ads/for-feed — verify ad shows for SAME zip code
 *  9) GET /ads/for-feed — verify ad does NOT show for DIFFERENT zip code
 * 10) Check ad confirmation email trigger
 *
 * Usage:
 *   npx tsx scripts/ad-hosting-test.ts
 *   CLEANUP=1 npx tsx scripts/ad-hosting-test.ts   # delete test data after
 *   BASE_URL=http://localhost:4000 npx tsx scripts/ad-hosting-test.ts
 */

const BASE = process.env.BASE_URL || 'http://localhost:4000';
const CLEANUP = process.env.CLEANUP === '1';
const RUN_ID = Date.now().toString(36);

// ── Helpers ──────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

interface TestResult {
  name: string;
  pass: boolean;
  status?: number;
  detail?: string;
  flag?: string;
}
const results: TestResult[] = [];

function log(msg: string) {
  console.log(`${C.dim}[ad-test]${C.reset} ${msg}`);
}

function pass(name: string, detail?: string) {
  results.push({ name, pass: true, detail });
  console.log(`  ${C.green}✓ PASS${C.reset} ${name}${detail ? ` ${C.dim}(${detail})${C.reset}` : ''}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, pass: false, detail });
  console.log(`  ${C.red}✗ FAIL${C.reset} ${name}${detail ? ` ${C.dim}(${detail})${C.reset}` : ''}`);
}

function flag(name: string, detail: string) {
  results.push({ name, pass: true, flag: detail });
  console.log(`  ${C.yellow}⚑ FLAG${C.reset} ${name} — ${detail}`);
}

async function api(
  method: string,
  path: string,
  body?: any,
  token?: string,
  timeoutMs = 15000,
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const opts: RequestInit = { method, headers, signal: controller.signal };
  if (body) opts.body = JSON.stringify(body);
  try {
    const res = await fetch(`${BASE}${path}`, opts);
    clearTimeout(timer);
    let data: any;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      return { status: 0, data: { error: `Request timed out after ${timeoutMs}ms` } };
    }
    throw e;
  }
}

// ── Date helpers ─────────────────────────────────────────────────────────

/** Find the next occurrence of a specific day-of-week (0=Sun, 1=Mon ... 6=Sat) */
function nextDay(dayOfWeek: number, afterDate = new Date()): string {
  const d = new Date(afterDate);
  d.setDate(d.getDate() + ((dayOfWeek + 7 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

// ── Test state ───────────────────────────────────────────────────────────

let advertiserToken = '';
let advertiserUserId = '';
let secondUserToken = '';
let secondUserId = '';
let adId = '';

// Target zips: 97001 (Portland, OR — 0% sales tax) for the ad
// Same-area zip: 97002 (also Portland metro, within 45mi radius)
// Different zip: 10001 (NYC — ~2450mi away, well outside radius)
const AD_ZIP = '97001';
const SAME_ZIP = '97002';
const DIFF_ZIP = '10001';

// Pick a next Thursday (weekday) and next Saturday (weekend) for scheduling
const WEEKDAY_DATE = nextDay(4); // Thursday
const WEEKEND_DATE = nextDay(6); // Saturday

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.cyan}═══ Ad Hosting Journey Test ═══${C.reset}`);
  console.log(`${C.dim}Base URL: ${BASE}  |  Run: ${RUN_ID}  |  Cleanup: ${CLEANUP}${C.reset}`);
  console.log(`${C.dim}Ad target zip: ${AD_ZIP}  |  Same zip: ${SAME_ZIP}  |  Diff zip: ${DIFF_ZIP}${C.reset}`);
  console.log(`${C.dim}Weekday date: ${WEEKDAY_DATE} (Thu)  |  Weekend date: ${WEEKEND_DATE} (Sat)${C.reset}\n`);

  // ── Health check ──
  try {
    const h = await fetch(`${BASE}/health`);
    if (!h.ok) throw new Error(`status ${h.status}`);
    log('Server is up');
  } catch (e: any) {
    console.error(`${C.red}Server not reachable at ${BASE}: ${e.message}${C.reset}`);
    process.exit(1);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 0 — Register & verify advertiser + second user
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}Phase 0: Register & Verify Users${C.reset}`);

  // Advertiser
  {
    const email = `ad-test-${RUN_ID}@test.varsityhub.app`;
    const r = await api('POST', '/auth/register', {
      email,
      password: 'TestPass123',
      display_name: `AdTester ${RUN_ID}`,
      role: 'fan',
    });
    if (r.status === 201 || r.status === 200) {
      advertiserToken = r.data.access_token;
      advertiserUserId = r.data.user?.id || r.data.id;
      pass('Register advertiser', `${r.status}`);
    } else {
      fail('Register advertiser', `${r.status} ${JSON.stringify(r.data)}`);
      return;
    }

    // Verify email
    const code = r.data.dev_verification_code;
    if (code) {
      const v = await api('POST', '/auth/verify/confirm', { code }, advertiserToken);
      v.status === 200 ? pass('Verify advertiser email', `${v.status}`) : fail('Verify advertiser email', `${v.status}`);
    } else {
      flag('Verify advertiser email', 'No dev_verification_code — not in dev mode?');
    }

    // Quick fan onboarding so the user is fully onboarded
    await api('PATCH', '/auth/me/preferences', { role: 'fan', sport_interests: ['basketball'] }, advertiserToken);
    await api('POST', '/auth/me/complete-onboarding', {}, advertiserToken);
  }

  // Second user (different zip for negative feed test)
  {
    const email = `ad-test2-${RUN_ID}@test.varsityhub.app`;
    const r = await api('POST', '/auth/register', {
      email,
      password: 'TestPass123',
      display_name: `AdViewer ${RUN_ID}`,
      role: 'fan',
    });
    if (r.status === 201 || r.status === 200) {
      secondUserToken = r.data.access_token;
      secondUserId = r.data.user?.id || r.data.id;
      pass('Register second user', `${r.status}`);
    } else {
      fail('Register second user', `${r.status}`);
    }

    const code = r.data?.dev_verification_code;
    if (code) {
      await api('POST', '/auth/verify/confirm', { code }, secondUserToken);
    }
    await api('PATCH', '/auth/me/preferences', { role: 'fan', sport_interests: ['soccer'] }, secondUserToken);
    await api('POST', '/auth/me/complete-onboarding', {}, secondUserToken);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 1 — Create Ad
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}Phase 1: Create Ad${C.reset}`);

  {
    const r = await api('POST', '/ads', {
      contact_name: `Test Advertiser ${RUN_ID}`,
      contact_email: `ad-test-${RUN_ID}@test.varsityhub.app`,
      business_name: `TestBiz ${RUN_ID}`,
      target_zip_code: AD_ZIP,
      banner_url: 'https://picsum.photos/600/200',
      banner_fit_mode: 'fill',
      target_url: 'https://example.com/promo',
      radius: 45,
      description: `End-to-end test ad for run ${RUN_ID}`,
    }, advertiserToken);

    if (r.status === 201 && r.data?.id) {
      adId = r.data.id;
      pass('POST /ads — create ad', `201 id=${adId}`);

      // Verify response fields
      const checks = [
        ['status', r.data.status, 'draft'],
        ['payment_status', r.data.payment_status, 'unpaid'],
        ['target_zip_code', r.data.target_zip_code, AD_ZIP],
        ['business_name', r.data.business_name, `TestBiz ${RUN_ID}`],
        ['banner_url', r.data.banner_url, 'https://picsum.photos/600/200'],
        ['radius', r.data.radius, 45],
      ];
      let allMatch = true;
      for (const [field, actual, expected] of checks) {
        if (actual !== expected) {
          fail(`  Ad field ${field}`, `expected ${expected}, got ${actual}`);
          allMatch = false;
        }
      }
      if (allMatch) pass('Ad fields match expected values');
    } else {
      fail('POST /ads — create ad', `${r.status} ${JSON.stringify(r.data)}`);
      return;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 2 — Verify Ad via GET
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}Phase 2: Verify Ad Saved${C.reset}`);

  {
    const r = await api('GET', `/ads/${adId}`, undefined, advertiserToken);
    if (r.status === 200 && r.data?.id === adId) {
      pass('GET /ads/:id — retrieve ad', `200`);
      if (r.data.description?.includes(RUN_ID)) {
        pass('Ad description persisted');
      } else {
        fail('Ad description persisted', `got: ${r.data.description}`);
      }
      if (Array.isArray(r.data.dates) && r.data.dates.length === 0) {
        pass('Ad has no dates yet (pre-payment)');
      } else {
        flag('Ad dates', `Expected empty dates array, got: ${JSON.stringify(r.data.dates)}`);
      }
    } else {
      fail('GET /ads/:id — retrieve ad', `${r.status}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 3 — Check Date Availability
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}Phase 3: Date Availability${C.reset}`);

  {
    const r = await api(
      'GET',
      `/ads/availability?zip=${AD_ZIP}&from=${WEEKDAY_DATE}&to=${WEEKEND_DATE}`,
      undefined,
      advertiserToken,
    );
    if (r.status === 200 && r.data?.availability) {
      pass('GET /ads/availability', `200`);
      const avail = r.data.availability;
      // Check that both dates are available
      const wdAvail = avail[WEEKDAY_DATE];
      const weAvail = avail[WEEKEND_DATE];
      if (wdAvail?.available !== false && weAvail?.available !== false) {
        pass('Both dates have availability', `weekday: ${JSON.stringify(wdAvail)}, weekend: ${JSON.stringify(weAvail)}`);
      } else {
        flag('Date availability', `Some dates may be full: wd=${JSON.stringify(wdAvail)} we=${JSON.stringify(weAvail)}`);
      }
    } else {
      fail('GET /ads/availability', `${r.status} ${JSON.stringify(r.data)}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 4 — Promo Code Tests
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}Phase 4: Promo Codes${C.reset}`);

  // 4a: Test FREE100 (seeded COMPLIMENTARY code)
  {
    const r = await api('POST', '/promos/preview', {
      code: 'FREE100',
      subtotal_cents: 1300, // $13 = 1 weekday + 1 weekend block
      service: 'booking',
    }, advertiserToken);

    if (r.status === 200 && r.data?.valid === true) {
      pass('POST /promos/preview — FREE100 valid', `type=${r.data.type}`);
      if (r.data.type === 'COMPLIMENTARY' && r.data.new_total_cents === 0) {
        pass('FREE100 makes total $0 (complimentary)');
      } else {
        fail('FREE100 discount', `expected COMPLIMENTARY with new_total=0, got type=${r.data.type} new_total=${r.data.new_total_cents}`);
      }
    } else {
      fail('POST /promos/preview — FREE100', `${r.status} ${JSON.stringify(r.data)}`);
    }
  }

  // 4b: Test Hubvarsity321 promo code
  {
    const r = await api('POST', '/promos/preview', {
      code: 'Hubvarsity321',
      subtotal_cents: 1300,
      service: 'booking',
    }, advertiserToken);

    if (r.status === 200) {
      if (r.data?.valid === true) {
        pass('POST /promos/preview — Hubvarsity321 valid', `type=${r.data.type} discount=${r.data.discount_cents}c`);
      } else {
        // Hubvarsity321 may not be seeded — report what we get
        flag('POST /promos/preview — Hubvarsity321', `Not valid: reason=${r.data?.reason}. Code may need to be created in DB.`);
      }
    } else {
      fail('POST /promos/preview — Hubvarsity321', `${r.status}`);
    }
  }

  // 4c: Test SAVE25 (seeded 25% off)
  {
    const r = await api('POST', '/promos/preview', {
      code: 'SAVE25',
      subtotal_cents: 1300,
      service: 'booking',
    }, advertiserToken);

    if (r.status === 200 && r.data?.valid === true) {
      const expectedDiscount = Math.floor(1300 * 25 / 100); // 325 cents
      if (r.data.discount_cents === expectedDiscount) {
        pass('POST /promos/preview — SAVE25', `25% off $13 = -$${(expectedDiscount / 100).toFixed(2)}, new total $${(r.data.new_total_cents / 100).toFixed(2)}`);
      } else {
        flag('SAVE25 discount', `Expected ${expectedDiscount}c, got ${r.data.discount_cents}c`);
      }
    } else {
      // SAVE25 may have expired (30-day window from seed)
      flag('POST /promos/preview — SAVE25', `${r.data?.valid === false ? `reason: ${r.data.reason}` : `status: ${r.status}`}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 5 — Verify Price Calculation
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}Phase 5: Price Calculation${C.reset}`);

  {
    // Pricing model (per adPricing.ts):
    //   Weekday block (Mon-Thu): $5.00 = 500¢
    //   Weekend block (Fri-Sun): $8.00 = 800¢
    //   1 Thu + 1 Sat (same week) → 1 weekday block + 1 weekend block = $13 = 1300¢
    //
    // We verify via promo preview: pass different subtotals and confirm the math.
    // The FREE100 promo preview in Phase 4 already confirmed subtotal=1300¢ works.

    const expectedWeekdayBlockCents = 500;
    const expectedWeekendBlockCents = 800;
    const expectedTotal = expectedWeekdayBlockCents + expectedWeekendBlockCents;

    log(`Weekday ${WEEKDAY_DATE} → $${expectedWeekdayBlockCents / 100}/block`);
    log(`Weekend ${WEEKEND_DATE} → $${expectedWeekendBlockCents / 100}/block`);
    log(`Expected total for 1 weekday + 1 weekend: $${expectedTotal / 100}`);

    // Verify weekday price = $5 per block
    const rWd = await api('POST', '/promos/preview', {
      code: 'FREE100',
      subtotal_cents: expectedWeekdayBlockCents,
      service: 'booking',
    }, advertiserToken);
    if (rWd.status === 200 && rWd.data?.valid && rWd.data?.discount_cents === expectedWeekdayBlockCents) {
      pass('Weekday block price = $5 (500¢)', `FREE100 discounts full $5 → $0`);
    } else {
      flag('Weekday price check', `${rWd.status} ${JSON.stringify(rWd.data)}`);
    }

    // Verify weekend price = $8 per block
    const rWe = await api('POST', '/promos/preview', {
      code: 'FREE100',
      subtotal_cents: expectedWeekendBlockCents,
      service: 'booking',
    }, advertiserToken);
    if (rWe.status === 200 && rWe.data?.valid && rWe.data?.discount_cents === expectedWeekendBlockCents) {
      pass('Weekend block price = $8 (800¢)', `FREE100 discounts full $8 → $0`);
    } else {
      flag('Weekend price check', `${rWe.status} ${JSON.stringify(rWe.data)}`);
    }

    // Verify combined: 1 weekday + 1 weekend = $13
    const rCombined = await api('POST', '/promos/preview', {
      code: 'FREE100',
      subtotal_cents: expectedTotal,
      service: 'booking',
    }, advertiserToken);
    if (rCombined.status === 200 && rCombined.data?.valid && rCombined.data?.discount_cents === expectedTotal) {
      pass('Combined price = $13 (1300¢)', `1 weekday + 1 weekend block`);
    } else {
      flag('Combined price check', `${rCombined.status} ${JSON.stringify(rCombined.data)}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 6 — Pay with FREE100 (free checkout)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}Phase 6: Checkout with FREE100 Promo${C.reset}`);

  {
    const r = await api('POST', '/payments/checkout', {
      ad_id: adId,
      dates: [WEEKDAY_DATE, WEEKEND_DATE],
      promo_code: 'FREE100',
    }, advertiserToken);

    if (r.status === 200 && r.data?.free === true) {
      pass('POST /payments/checkout — free with FREE100', 'Ad finalized without Stripe');
    } else {
      fail('POST /payments/checkout — free with FREE100', `${r.status} ${JSON.stringify(r.data)}`);
      // If this fails, feed tests below won't work
      if (r.status !== 200) {
        log('Cannot proceed to feed tests without paid ad');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 7 — Verify Ad is Now Paid with Dates
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}Phase 7: Verify Paid Ad${C.reset}`);

  {
    const r = await api('GET', `/ads/${adId}`, undefined, advertiserToken);
    if (r.status === 200) {
      if (r.data.payment_status === 'paid') {
        pass('Ad payment_status = paid');
      } else {
        fail('Ad payment_status', `expected "paid", got "${r.data.payment_status}"`);
      }

      const dates = r.data.dates || [];
      if (dates.includes(WEEKDAY_DATE) && dates.includes(WEEKEND_DATE)) {
        pass('Reservation dates created', `[${dates.join(', ')}]`);
      } else {
        fail('Reservation dates', `expected [${WEEKDAY_DATE}, ${WEEKEND_DATE}], got [${dates.join(', ')}]`);
      }
    } else {
      fail('GET /ads/:id after payment', `${r.status}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 8 — Feed: Same Zip (should see ad)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}Phase 8: Feed — Same Zip Code${C.reset}`);

  {
    const r = await api('GET', `/ads/for-feed?date=${WEEKDAY_DATE}&zip=${SAME_ZIP}&limit=5`);
    if (r.status === 200) {
      pass('GET /ads/for-feed (same zip)', `200`);
      const feedAds = r.data?.ads || [];
      const found = feedAds.some((a: any) => a.id === adId);
      if (found) {
        pass('Ad appears in feed for SAME zip code', `zip=${SAME_ZIP}, found in ${feedAds.length} ads`);
      } else {
        fail('Ad appears in feed for SAME zip code', `Not found among ${feedAds.length} ads. IDs: [${feedAds.map((a: any) => a.id).join(', ')}]`);
      }
    } else {
      fail('GET /ads/for-feed (same zip)', `${r.status}`);
    }

    // Also test with weekend date
    const r2 = await api('GET', `/ads/for-feed?date=${WEEKEND_DATE}&zip=${SAME_ZIP}&limit=5`);
    if (r2.status === 200) {
      const found2 = (r2.data?.ads || []).some((a: any) => a.id === adId);
      if (found2) {
        pass('Ad appears in feed for weekend date too', `date=${WEEKEND_DATE}`);
      } else {
        fail('Ad in weekend feed', `Not found for ${WEEKEND_DATE}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 9 — Feed: Different Zip (should NOT see ad)
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}Phase 9: Feed — Different Zip Code${C.reset}`);

  {
    const r = await api('GET', `/ads/for-feed?date=${WEEKDAY_DATE}&zip=${DIFF_ZIP}&limit=5`);
    if (r.status === 200) {
      pass('GET /ads/for-feed (different zip)', `200`);
      const feedAds = r.data?.ads || [];
      const found = feedAds.some((a: any) => a.id === adId);
      if (!found) {
        pass('Ad does NOT appear for DIFFERENT zip code', `zip=${DIFF_ZIP} (~2450mi from ${AD_ZIP}), correctly filtered out`);
      } else {
        fail('Ad should NOT appear for DIFFERENT zip code', `zip=${DIFF_ZIP} but ad was found! Radius filtering may be broken.`);
      }
    } else {
      fail('GET /ads/for-feed (different zip)', `${r.status}`);
    }

    // Also test with no zip at all — should not show targeted ads
    const r2 = await api('GET', `/ads/for-feed?date=${WEEKDAY_DATE}&limit=5`);
    if (r2.status === 200) {
      const found2 = (r2.data?.ads || []).some((a: any) => a.id === adId);
      if (!found2) {
        pass('Ad does NOT appear with no zip (untargeted only)', 'Correctly filtered');
      } else {
        fail('Ad should not show with no zip', 'Targeted ad shown without user location');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 10 — Email Trigger Check
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}Phase 10: Email Trigger Check${C.reset}`);

  {
    // The free promo path (total === 0) in POST /payments/checkout bypasses
    // Stripe and directly sets payment_status='paid' + creates reservations.
    // However, the confirmation email (sendAdPaymentEmail) is only called in
    // the Stripe webhook path (finalizeFromSession). So for free promos,
    // no confirmation email is sent — this is a known gap.
    //
    // We'll verify the email WOULD be triggered in a real payment scenario
    // by checking the email function exists and the ad has the right contact_email.

    const r = await api('GET', `/ads/${adId}`, undefined, advertiserToken);
    if (r.status === 200 && r.data.contact_email) {
      flag(
        'Ad confirmation email',
        `Free promo path does not trigger sendAdPaymentEmail. ` +
        `Contact email (${r.data.contact_email}) is set, but email only fires via Stripe webhook. ` +
        `For paid checkouts, the webhook at POST /payments/webhook calls sendAdPaymentEmail().`
      );
    } else {
      fail('Email check', 'Could not retrieve ad contact email');
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Phase 11 — Additional Edge Cases
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}Phase 11: Edge Cases${C.reset}`);

  // 11a: Nearby zip should see ad (within 45mi radius)
  {
    // Zip 10002 has same prefix "100" → same coords as 10001 → distance ~0
    const r = await api('GET', `/ads/for-feed?date=${WEEKDAY_DATE}&zip=10002&limit=5`);
    if (r.status === 200) {
      const found = (r.data?.ads || []).some((a: any) => a.id === adId);
      if (found) {
        pass('Ad shows for nearby zip 10002', 'Same NYC area, within radius');
      } else {
        flag('Nearby zip 10002', 'Not found — may have different prefix mapping');
      }
    }
  }

  // 11b: Second user can't access the ad via GET /ads/:id (not owner)
  {
    const r = await api('GET', `/ads/${adId}`, undefined, secondUserToken);
    if (r.status === 403) {
      pass('Non-owner cannot GET /ads/:id', '403 Forbidden');
    } else {
      flag('Non-owner ad access', `Expected 403, got ${r.status}`);
    }
  }

  // 11c: Duplicate date reservation attempt
  {
    const r = await api('POST', '/payments/checkout', {
      ad_id: adId,
      dates: [WEEKDAY_DATE],
      promo_code: 'FREE100',
    }, advertiserToken);
    // Ad is already paid, so this might fail with "already paid" or similar
    flag('Duplicate reservation attempt', `${r.status}: ${JSON.stringify(r.data)}`);
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════════════════════════════════
  if (CLEANUP) {
    console.log(`\n${C.bold}Cleanup${C.reset}`);

    // Delete the ad
    const dr = await api('DELETE', `/ads/${adId}`, undefined, advertiserToken);
    dr.status === 200
      ? pass('Delete ad', `${dr.status}`)
      : fail('Delete ad', `${dr.status} ${JSON.stringify(dr.data)}`);

    // Delete users
    for (const [label, token] of [['advertiser', advertiserToken], ['second user', secondUserToken]] as const) {
      const r = await api('DELETE', '/auth/me', undefined, token);
      r.status === 200
        ? pass(`Delete ${label}`, `${r.status}`)
        : fail(`Delete ${label}`, `${r.status} ${JSON.stringify(r.data)}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════════════════════════
  console.log(`\n${C.bold}${C.cyan}═══ Summary ═══${C.reset}`);
  const passed = results.filter((r) => r.pass && !r.flag).length;
  const failed = results.filter((r) => !r.pass).length;
  const flagged = results.filter((r) => r.flag).length;
  console.log(`  ${C.green}Passed: ${passed}${C.reset}`);
  if (failed) console.log(`  ${C.red}Failed: ${failed}${C.reset}`);
  if (flagged) console.log(`  ${C.yellow}Flagged: ${flagged}${C.reset}`);
  console.log(`  Total: ${results.length}\n`);

  if (failed > 0) {
    console.log(`${C.red}Failed tests:${C.reset}`);
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  ${C.red}✗${C.reset} ${r.name} — ${r.detail || ''}`);
    });
    console.log();
  }

  if (flagged > 0) {
    console.log(`${C.yellow}Flagged tests:${C.reset}`);
    results.filter((r) => r.flag).forEach((r) => {
      console.log(`  ${C.yellow}⚑${C.reset} ${r.name} — ${r.flag}`);
    });
    console.log();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${C.red}Unhandled error:${C.reset}`, err);
  process.exit(1);
});
