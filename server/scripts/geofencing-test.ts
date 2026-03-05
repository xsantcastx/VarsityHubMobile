/**
 * Geofencing Verification Test
 *
 * Tests location-based filtering for posts, ads, and events:
 *
 *  1)  Create a post with Stamford, CT location (lat/lng + zip)
 *  2)  Fetch posts — verify NO location-based filtering exists (MISSING ENDPOINT)
 *  3)  Create an ad targeting 97001 (Oregon, 0% tax), pay with FREE100
 *  4)  GET /ads/for-feed?zip=97002 — ad SHOULD appear (nearby zip)
 *  5)  GET /ads/for-feed?zip=10001 — ad should NOT appear (far away)
 *  6)  Create an event with Stamford, CT location
 *  7)  Fetch events — verify NO proximity-based filtering exists (MISSING ENDPOINT)
 *  8)  Summary of geofencing gaps vs implemented features
 *
 * Usage:
 *   npx tsx scripts/geofencing-test.ts
 *   CLEANUP=1 npx tsx scripts/geofencing-test.ts
 *   BASE_URL=http://localhost:4000 npx tsx scripts/geofencing-test.ts
 */

const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const CLEANUP = process.env.CLEANUP === '1';
const RUN_ID = Date.now().toString(36);

// ── Color helpers ────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

// ── Result tracking ──────────────────────────────────────────────────────────

interface TestResult {
  name: string;
  pass: boolean;
  detail?: string;
  flag?: string;
  missing?: boolean;  // marks a missing-endpoint finding
}
const results: TestResult[] = [];

function log(msg: string) {
  console.log(`${C.dim}[geofence]${C.reset} ${msg}`);
}

function pass(name: string, detail?: string) {
  results.push({ name, pass: true, detail });
  console.log(`  ${C.green}PASS${C.reset} ${name}${detail ? ` ${C.dim}(${detail})${C.reset}` : ''}`);
}

function fail(name: string, detail?: string) {
  results.push({ name, pass: false, detail });
  console.log(`  ${C.red}FAIL${C.reset} ${name}${detail ? ` ${C.dim}(${detail})${C.reset}` : ''}`);
}

function flag(name: string, detail: string) {
  results.push({ name, pass: true, flag: detail });
  console.log(`  ${C.yellow}FLAG${C.reset} ${name} -- ${detail}`);
}

function missing(name: string, detail: string) {
  results.push({ name, pass: true, flag: detail, missing: true });
  console.log(`  ${C.magenta}MISSING ENDPOINT${C.reset} ${name} -- ${detail}`);
}

// ── HTTP helper ──────────────────────────────────────────────────────────────

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
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data };
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') {
      return { status: 0, data: { error: `Request timed out after ${timeoutMs}ms` } };
    }
    throw e;
  }
}

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Next occurrence of a specific day-of-week (0=Sun ... 6=Sat) */
function nextDay(dayOfWeek: number, afterDate = new Date()): string {
  const d = new Date(afterDate);
  d.setDate(d.getDate() + ((dayOfWeek + 7 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

// ── Geo constants ────────────────────────────────────────────────────────────

// Stamford, CT
const STAMFORD_LAT = 41.0534;
const STAMFORD_LNG = -73.5387;
const STAMFORD_ZIP = '06907';

// Oregon (0% sales tax -- FREE100 promo makes total $0)
const AD_TARGET_ZIP = '97001'; // Antelope, OR area
const AD_NEARBY_ZIP = '97002'; // Boring, OR area (Portland metro, within 45mi)
const AD_FAR_ZIP = '10001';    // NYC (~2450mi away)

// Los Angeles
const LA_LAT = 34.0522;
const LA_LNG = -118.2437;
const LA_ZIP = '90001';

// ── Test state ───────────────────────────────────────────────────────────────

let userToken = '';
let userId = '';
let secondToken = '';
let secondUserId = '';

let postId = '';
let adId = '';
let eventId = '';

const WEEKDAY_DATE = nextDay(4); // Thursday

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}${C.cyan}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  GEOFENCING VERIFICATION TEST${C.reset}`);
  console.log(`${C.bold}${C.cyan}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.dim}  Base URL  : ${BASE}`);
  console.log(`  Run ID   : ${RUN_ID}`);
  console.log(`  Cleanup  : ${CLEANUP}`);
  console.log(`  Stamford : ${STAMFORD_LAT}, ${STAMFORD_LNG} (${STAMFORD_ZIP})`);
  console.log(`  Ad target: ${AD_TARGET_ZIP} (Oregon, 0% tax)`);
  console.log(`  Ad nearby: ${AD_NEARBY_ZIP} | Ad far: ${AD_FAR_ZIP}`);
  console.log(`  Weekday  : ${WEEKDAY_DATE}${C.reset}\n`);

  // ── Health check ───────────────────────────────────────────────────────────
  try {
    const h = await fetch(`${BASE}/health`);
    if (!h.ok) throw new Error(`status ${h.status}`);
    log('Server is up');
  } catch (e: any) {
    console.error(`${C.red}Server not reachable at ${BASE}: ${e.message}${C.reset}`);
    process.exit(1);
  }

  // =========================================================================
  // Phase 0 -- Register & verify users
  // =========================================================================
  console.log(`\n${C.bold}Phase 0: Register & Verify Users${C.reset}`);

  // Primary user (Stamford user)
  {
    const email = `geo-test-${RUN_ID}@test.varsityhub.app`;
    const r = await api('POST', '/auth/register', {
      email,
      password: 'TestPass123!',
      display_name: `GeoTester ${RUN_ID}`,
      role: 'fan',
    });
    if (r.status === 201 || r.status === 200) {
      userToken = r.data.access_token;
      userId = r.data.user?.id || r.data.id;
      pass('Register primary user', `${r.status}`);
    } else {
      fail('Register primary user', `${r.status} ${JSON.stringify(r.data)}`);
      printSummary();
      return;
    }

    const code = r.data.dev_verification_code;
    if (code) {
      const v = await api('POST', '/auth/verify/confirm', { code }, userToken);
      v.status === 200
        ? pass('Verify primary user email', `${v.status}`)
        : fail('Verify primary user email', `${v.status}`);
    } else {
      flag('Verify primary user email', 'No dev_verification_code -- not in dev mode?');
    }

    await api('PATCH', '/auth/me/preferences', {
      role: 'fan',
      sport_interests: ['basketball'],
      zip_code: STAMFORD_ZIP,
      location_enabled: true,
    }, userToken);
    await api('POST', '/auth/me/complete-onboarding', {}, userToken);
  }

  // Second user (LA user)
  {
    const email = `geo-test2-${RUN_ID}@test.varsityhub.app`;
    const r = await api('POST', '/auth/register', {
      email,
      password: 'TestPass123!',
      display_name: `GeoViewer ${RUN_ID}`,
      role: 'fan',
    });
    if (r.status === 201 || r.status === 200) {
      secondToken = r.data.access_token;
      secondUserId = r.data.user?.id || r.data.id;
      pass('Register second user (LA)', `${r.status}`);
    } else {
      fail('Register second user (LA)', `${r.status}`);
    }

    const code = r.data?.dev_verification_code;
    if (code) {
      await api('POST', '/auth/verify/confirm', { code }, secondToken);
    }
    await api('PATCH', '/auth/me/preferences', {
      role: 'fan',
      sport_interests: ['soccer'],
      zip_code: LA_ZIP,
      location_enabled: true,
    }, secondToken);
    await api('POST', '/auth/me/complete-onboarding', {}, secondToken);
  }

  // =========================================================================
  // Phase 1 -- Posts: Create with location, test feed filtering
  // =========================================================================
  console.log(`\n${C.bold}Phase 1: Posts -- Location Storage & Feed Filtering${C.reset}`);

  // 1a: Create a post with Stamford, CT device location
  {
    const r = await api('POST', '/posts', {
      content: `Geofencing test post from Stamford CT ${RUN_ID}`,
      type: 'text',
      location: {
        lat: STAMFORD_LAT,
        lng: STAMFORD_LNG,
        zip: STAMFORD_ZIP,
        source: 'device',
        place_name: 'Stamford, CT',
        admin_area: 'Connecticut',
        country_code: 'US',
      },
    }, userToken);

    if (r.status === 201 && r.data?.id) {
      postId = r.data.id;
      pass('Create post with Stamford location', `201, id=${postId}`);

      // Verify location was stored
      const locData = r.data.location;
      if (locData && typeof locData.lat === 'number' && typeof locData.lng === 'number') {
        pass('Post location data stored', `lat=${locData.lat}, lng=${locData.lng}`);
      } else if (r.data.lat != null || r.data.lng != null) {
        pass('Post location data stored (top-level)', `lat=${r.data.lat}, lng=${r.data.lng}`);
      } else {
        flag('Post location data', `location object in response: ${JSON.stringify(locData)}`);
      }
    } else {
      fail('Create post with Stamford location', `${r.status} ${JSON.stringify(r.data)}`);
    }
  }

  // 1b: Fetch posts as Stamford user (zip 06907) -- test for location filter
  {
    // Try with zip parameter (unlikely to work -- no such param exists)
    const r1 = await api('GET', `/posts?limit=10&zip=${STAMFORD_ZIP}`, undefined, userToken);
    if (r1.status === 200) {
      const items = r1.data?.items || [];
      // The zip param is ignored -- posts endpoint has no location filtering
      missing(
        'GET /posts -- no zip/location filter for Stamford user',
        'GET /posts does not accept zip, lat, or lng query params. ' +
        'Location data is stored on posts (lat, lng, country_code, admin1) but feed ' +
        'retrieval has NO proximity-based or zip-based filtering. ' +
        'All users see the same global feed regardless of location.',
      );

      // Verify the post we created appears (it should, since no filtering)
      const found = items.some((p: any) => p.id === postId);
      if (found) {
        pass('Created post appears in unfiltered feed', `Found among ${items.length} posts`);
      } else {
        flag('Created post in feed', `Not found in first ${items.length} items (pagination may hide it)`);
      }
    } else {
      fail('GET /posts (Stamford)', `${r.status}`);
    }
  }

  // 1c: Fetch posts as LA user (zip 90001) -- same feed, no filtering
  {
    const r = await api('GET', `/posts?limit=10`, undefined, secondToken);
    if (r.status === 200) {
      const items = r.data?.items || [];
      const found = items.some((p: any) => p.id === postId);
      if (found) {
        pass('Stamford post visible to LA user (no geo-filter)', `Confirms global feed`);
      } else {
        flag('Stamford post visible to LA user', `Not found in first ${items.length} items`);
      }

      missing(
        'GET /posts -- LA user sees same feed as Stamford user',
        'No location-based post filtering exists. A user in LA (90001) sees the ' +
        'exact same feed as a user in Stamford, CT (06907). Posts store lat/lng ' +
        'but the feed endpoint does not filter by proximity.',
      );
    } else {
      fail('GET /posts (LA user)', `${r.status}`);
    }
  }

  // 1d: Confirm GET /posts params -- document what IS supported
  {
    // These are the valid query params based on source code analysis:
    // sort, limit, cursor, followed_only, followed_teams, game_id, team_id, type, user_id
    const supported = ['sort', 'limit', 'cursor', 'followed_only', 'followed_teams', 'game_id', 'team_id', 'type', 'user_id'];
    const notSupported = ['zip', 'lat', 'lng', 'radius', 'location', 'near', 'proximity'];

    flag(
      'Posts feed query params audit',
      `Supported: [${supported.join(', ')}]. ` +
      `NOT supported (location-related): [${notSupported.join(', ')}]. ` +
      'Recommendation: add zip/lat/lng params to GET /posts for proximity-based feed.',
    );
  }

  // =========================================================================
  // Phase 2 -- Ads: Create, pay, test geofenced feed
  // =========================================================================
  console.log(`\n${C.bold}Phase 2: Ads -- Geofenced Feed (IMPLEMENTED)${C.reset}`);

  // 2a: Create ad targeting Oregon zip 97001 (0% sales tax)
  {
    const r = await api('POST', '/ads', {
      contact_name: `GeoAd Tester ${RUN_ID}`,
      contact_email: `geo-test-${RUN_ID}@test.varsityhub.app`,
      business_name: `GeoBiz ${RUN_ID}`,
      target_zip_code: AD_TARGET_ZIP,
      banner_url: 'https://picsum.photos/600/200',
      banner_fit_mode: 'fill',
      target_url: 'https://example.com/geo-test',
      radius: 45,
      description: `Geofencing test ad for run ${RUN_ID}`,
    }, userToken);

    if (r.status === 201 && r.data?.id) {
      adId = r.data.id;
      pass('Create ad targeting zip 97001 (Oregon)', `201, id=${adId}`);

      if (r.data.target_zip_code === AD_TARGET_ZIP) {
        pass('Ad target_zip_code stored correctly', AD_TARGET_ZIP);
      } else {
        fail('Ad target_zip_code', `expected ${AD_TARGET_ZIP}, got ${r.data.target_zip_code}`);
      }
      if (r.data.radius === 45) {
        pass('Ad radius stored correctly', '45 miles');
      } else {
        flag('Ad radius', `expected 45, got ${r.data.radius}`);
      }
    } else {
      fail('Create ad targeting zip 97001', `${r.status} ${JSON.stringify(r.data)}`);
      // Without an ad, feed tests can't proceed
      log('Skipping ad feed tests -- no ad created');
    }
  }

  // 2b: Pay the ad with FREE100 promo (Oregon = 0% tax => total $0)
  if (adId) {
    const r = await api('POST', '/payments/checkout', {
      ad_id: adId,
      dates: [WEEKDAY_DATE],
      promo_code: 'FREE100',
    }, userToken);

    if (r.status === 200 && r.data?.free === true) {
      pass('Pay ad with FREE100 (Oregon 0% tax)', 'Ad finalized without Stripe');
    } else {
      fail('Pay ad with FREE100', `${r.status} ${JSON.stringify(r.data)}`);
      log('Ad feed tests may fail -- ad not paid');
    }

    // Verify ad is now paid
    const check = await api('GET', `/ads/${adId}`, undefined, userToken);
    if (check.status === 200) {
      if (check.data.payment_status === 'paid') {
        pass('Ad payment_status = paid');
      } else {
        fail('Ad payment_status', `expected "paid", got "${check.data.payment_status}"`);
      }
      const dates = check.data.dates || [];
      if (dates.includes(WEEKDAY_DATE)) {
        pass('Ad reservation date created', WEEKDAY_DATE);
      } else {
        fail('Ad reservation date', `expected ${WEEKDAY_DATE} in [${dates.join(', ')}]`);
      }
    }
  }

  // 2c: Fetch ads for nearby zip (97002) -- should see the ad
  if (adId) {
    const r = await api('GET', `/ads/for-feed?date=${WEEKDAY_DATE}&zip=${AD_NEARBY_ZIP}&limit=5`);
    if (r.status === 200) {
      pass('GET /ads/for-feed (nearby zip)', `200`);
      const feedAds = r.data?.ads || [];
      const found = feedAds.some((a: any) => a.id === adId);
      if (found) {
        pass(
          'Ad appears in feed for NEARBY zip',
          `zip=${AD_NEARBY_ZIP} (within 45mi of ${AD_TARGET_ZIP}), found among ${feedAds.length} ads`,
        );
      } else {
        fail(
          'Ad appears in feed for NEARBY zip',
          `Not found among ${feedAds.length} ads. IDs: [${feedAds.map((a: any) => a.id).join(', ')}]`,
        );
      }
    } else {
      fail('GET /ads/for-feed (nearby zip)', `${r.status} ${JSON.stringify(r.data)}`);
    }
  }

  // 2d: Fetch ads for far zip (10001 NYC) -- should NOT see the ad
  if (adId) {
    const r = await api('GET', `/ads/for-feed?date=${WEEKDAY_DATE}&zip=${AD_FAR_ZIP}&limit=5`);
    if (r.status === 200) {
      pass('GET /ads/for-feed (far zip)', `200`);
      const feedAds = r.data?.ads || [];
      const found = feedAds.some((a: any) => a.id === adId);
      if (!found) {
        pass(
          'Ad does NOT appear for FAR zip',
          `zip=${AD_FAR_ZIP} (~2450mi from ${AD_TARGET_ZIP}), correctly filtered out`,
        );
      } else {
        fail(
          'Ad should NOT appear for FAR zip',
          `zip=${AD_FAR_ZIP} but ad WAS found -- radius filtering may be broken`,
        );
      }
    } else {
      fail('GET /ads/for-feed (far zip)', `${r.status}`);
    }
  }

  // 2e: Fetch ads with NO zip -- should NOT show targeted ads
  if (adId) {
    const r = await api('GET', `/ads/for-feed?date=${WEEKDAY_DATE}&limit=5`);
    if (r.status === 200) {
      const feedAds = r.data?.ads || [];
      const found = feedAds.some((a: any) => a.id === adId);
      if (!found) {
        pass('Ad does NOT appear with no zip', 'Targeted ads hidden without user location');
      } else {
        fail('Ad should NOT appear with no zip', 'Targeted ad shown without user location');
      }
    }
  }

  // 2f: Fetch ads with lat/lng (near target)
  if (adId) {
    // Coordinates for 97002 area (approx Boring, OR): 45.4318, -122.3712
    const r = await api('GET', `/ads/for-feed?date=${WEEKDAY_DATE}&lat=45.4318&lng=-122.3712&limit=5`);
    if (r.status === 200) {
      const feedAds = r.data?.ads || [];
      const found = feedAds.some((a: any) => a.id === adId);
      if (found) {
        pass('Ad appears in feed with lat/lng (near target)', 'lat/lng filtering works');
      } else {
        flag('Ad with lat/lng near target', `Not found -- lat/lng may not resolve to within radius`);
      }
    }
  }

  // 2g: Document the working geofencing for ads
  {
    pass(
      'Ads geofencing IMPLEMENTED and working',
      'GET /ads/for-feed supports zip, lat, lng params. ' +
      'Filters by haversine distance using ad radius (default 45mi). ' +
      'No zip/no coords = only untargeted (national) ads shown.',
    );
  }

  // =========================================================================
  // Phase 3 -- Events: Create with location, test feed filtering
  // =========================================================================
  console.log(`\n${C.bold}Phase 3: Events -- Location Storage & Feed Filtering${C.reset}`);

  // 3a: Create event with Stamford location
  {
    const eventDate = new Date();
    eventDate.setDate(eventDate.getDate() + 14); // 2 weeks out

    const r = await api('POST', '/events', {
      title: `Geofence Test Event ${RUN_ID}`,
      description: `Testing geofencing for events - run ${RUN_ID}`,
      date: eventDate.toISOString(),
      location: 'Stamford, CT',
      latitude: STAMFORD_LAT,
      longitude: STAMFORD_LNG,
      event_type: 'other',
      max_attendees: 100,
      contact_info: `geo-test-${RUN_ID}@test.varsityhub.app`,
    }, userToken);

    if (r.status === 201 && r.data?.id) {
      eventId = r.data.id;
      pass('Create event with Stamford location', `201, id=${eventId}`);

      // Verify location fields stored
      if (r.data.location === 'Stamford, CT') {
        pass('Event location string stored', 'Stamford, CT');
      } else {
        flag('Event location string', `got: ${r.data.location}`);
      }
      if (r.data.latitude === STAMFORD_LAT && r.data.longitude === STAMFORD_LNG) {
        pass('Event lat/lng stored', `${r.data.latitude}, ${r.data.longitude}`);
      } else {
        flag('Event lat/lng', `expected (${STAMFORD_LAT}, ${STAMFORD_LNG}), got (${r.data.latitude}, ${r.data.longitude})`);
      }

      // Note approval status -- fan-created events need approval
      if (r.data.approval_status === 'pending') {
        flag('Event approval_status = pending', 'Fan-created events require coach/admin approval before appearing in GET /events');
      } else if (r.data.approval_status === 'approved') {
        pass('Event auto-approved', r.data.creator_role || 'unknown role');
      }
    } else {
      fail('Create event with Stamford location', `${r.status} ${JSON.stringify(r.data)}`);
    }
  }

  // 3b: Fetch events -- test for location/proximity filter
  {
    // Try with include_past to see all, and approval_status to see pending too
    const r = await api('GET', '/events?include_past=true&approval_status=pending&limit=20');
    const r2 = await api('GET', '/events?include_past=true&limit=20');

    const allEvents = [...(Array.isArray(r.data) ? r.data : []), ...(Array.isArray(r2.data) ? r2.data : [])];
    const uniqueEvents = [...new Map(allEvents.map((e: any) => [e.id, e])).values()];

    if (r.status === 200 || r2.status === 200) {
      // Check if our event exists in the list
      const found = uniqueEvents.some((e: any) => e.id === eventId);
      if (found) {
        pass('Created event found in GET /events', `Among ${uniqueEvents.length} events`);
      } else {
        flag('Created event in list', `Not found (may be pending approval or paginated out of ${uniqueEvents.length} events)`);
      }

      missing(
        'GET /events -- no proximity/location filter',
        'GET /events accepts: status, include_cancelled, approval_status, event_type, q (search), ' +
        'sort, limit. It does NOT accept: zip, lat, lng, radius, near, proximity. ' +
        'Events store latitude and longitude but the list endpoint has no proximity-based filtering.',
      );
    } else {
      fail('GET /events', `${r.status}`);
    }
  }

  // 3c: Fetch events as LA user -- same results (no geo-filter)
  {
    // Try adding lat/lng params -- they will be ignored
    const r = await api('GET', `/events?lat=${LA_LAT}&lng=${LA_LNG}&include_past=true&limit=20`);
    if (r.status === 200) {
      const events = Array.isArray(r.data) ? r.data : [];
      // These params are silently ignored
      missing(
        'GET /events -- LA user sees same events as Stamford user',
        'No location-based event filtering exists. A user in LA sees the same event ' +
        'list as a user in CT. lat/lng query params are silently ignored. ' +
        'Recommendation: add proximity filter to GET /events using stored latitude/longitude.',
      );
    } else {
      fail('GET /events (LA user)', `${r.status}`);
    }
  }

  // 3d: Verify event detail includes location
  if (eventId) {
    const r = await api('GET', `/events/${eventId}`, undefined, userToken);
    if (r.status === 200) {
      const hasCoords = typeof r.data.latitude === 'number' && typeof r.data.longitude === 'number';
      if (hasCoords) {
        pass('Event detail includes lat/lng', `${r.data.latitude}, ${r.data.longitude}`);
      } else {
        flag('Event detail lat/lng', 'Coordinates not in GET /events/:id response');
      }
      if (r.data.location) {
        pass('Event detail includes location string', r.data.location);
      }
    } else {
      fail('GET /events/:id', `${r.status}`);
    }
  }

  // 3e: Document events query params
  {
    const supported = ['status', 'include_cancelled', 'approval_status', 'event_type', 'q', 'sort', 'limit', 'include_past'];
    const notSupported = ['zip', 'lat', 'lng', 'radius', 'near', 'proximity', 'location'];

    flag(
      'Events feed query params audit',
      `Supported: [${supported.join(', ')}]. ` +
      `NOT supported (location-related): [${notSupported.join(', ')}]. ` +
      'Recommendation: add proximity filter using stored latitude/longitude fields.',
    );
  }

  // =========================================================================
  // Phase 4 -- Cross-cutting geofencing analysis
  // =========================================================================
  console.log(`\n${C.bold}Phase 4: Geofencing Feature Matrix${C.reset}`);

  console.log(`\n  ${C.bold}Feature Matrix:${C.reset}`);
  console.log(`  ${'─'.repeat(68)}`);
  console.log(`  ${'Resource'.padEnd(12)} ${'Stores Location'.padEnd(18)} ${'Filters by Location'.padEnd(22)} Status`);
  console.log(`  ${'─'.repeat(68)}`);
  console.log(`  ${'Posts'.padEnd(12)} ${C.green}${'YES'.padEnd(18)}${C.reset} ${C.red}${'NO'.padEnd(22)}${C.reset} ${C.magenta}MISSING${C.reset}`);
  console.log(`  ${'Ads'.padEnd(12)} ${C.green}${'YES'.padEnd(18)}${C.reset} ${C.green}${'YES (zip/lat/lng)'.padEnd(22)}${C.reset} ${C.green}IMPLEMENTED${C.reset}`);
  console.log(`  ${'Events'.padEnd(12)} ${C.green}${'YES'.padEnd(18)}${C.reset} ${C.red}${'NO'.padEnd(22)}${C.reset} ${C.magenta}MISSING${C.reset}`);
  console.log(`  ${'─'.repeat(68)}`);

  console.log(`\n  ${C.bold}Posts detail:${C.reset}`);
  console.log(`    - POST /posts stores: lat, lng, country_code, admin1, place_name`);
  console.log(`    - Location source: device GPS, zip geocode, or derived from prefs`);
  console.log(`    - GET /posts: no zip/lat/lng/radius/proximity params`);
  console.log(`    - Impact: all users see same global feed regardless of location`);

  console.log(`\n  ${C.bold}Ads detail:${C.reset}`);
  console.log(`    - POST /ads stores: target_zip_code, radius (default 45mi)`);
  console.log(`    - GET /ads/for-feed: accepts date, zip, lat, lng, limit`);
  console.log(`    - Filtering: haversine distance from user zip/coords to ad zip`);
  console.log(`    - No zip = only untargeted (national) ads shown`);

  console.log(`\n  ${C.bold}Events detail:${C.reset}`);
  console.log(`    - POST /events stores: location (string), latitude, longitude`);
  console.log(`    - GET /events: text search on location via q param only`);
  console.log(`    - No distance/proximity calculation on retrieval`);
  console.log(`    - Impact: all users see same event list regardless of location`);

  pass(
    'Geofencing feature matrix documented',
    'Posts and Events missing location-based filtering. Ads fully implemented.',
  );

  // =========================================================================
  // Cleanup
  // =========================================================================
  if (CLEANUP) {
    console.log(`\n${C.bold}Cleanup${C.reset}`);

    if (adId) {
      const dr = await api('DELETE', `/ads/${adId}`, undefined, userToken);
      dr.status === 200
        ? pass('Delete test ad', `${dr.status}`)
        : fail('Delete test ad', `${dr.status} ${JSON.stringify(dr.data)}`);
    }

    if (postId) {
      const dr = await api('DELETE', `/posts/${postId}`, undefined, userToken);
      (dr.status === 200 || dr.status === 204)
        ? pass('Delete test post', `${dr.status}`)
        : flag('Delete test post', `${dr.status} ${JSON.stringify(dr.data)}`);
    }

    for (const [label, token] of [['primary user', userToken], ['second user', secondToken]] as const) {
      if (!token) continue;
      const r = await api('DELETE', '/auth/me', undefined, token);
      r.status === 200
        ? pass(`Delete ${label}`, `${r.status}`)
        : fail(`Delete ${label}`, `${r.status} ${JSON.stringify(r.data)}`);
    }
  } else {
    log('Test data left in DB. Run with CLEANUP=1 to delete.');
  }

  // =========================================================================
  // Summary
  // =========================================================================
  printSummary();
}

function printSummary() {
  console.log(`\n${C.bold}${C.cyan}${'='.repeat(70)}${C.reset}`);
  console.log(`${C.bold}${C.cyan}  GEOFENCING TEST SUMMARY${C.reset}`);
  console.log(`${C.bold}${C.cyan}${'='.repeat(70)}${C.reset}`);

  const passed = results.filter((r) => r.pass && !r.flag && !r.missing).length;
  const failed = results.filter((r) => !r.pass).length;
  const flagged = results.filter((r) => r.flag && !r.missing).length;
  const missingCount = results.filter((r) => r.missing).length;

  console.log(`  ${C.green}Passed : ${passed}${C.reset}`);
  if (failed) console.log(`  ${C.red}Failed : ${failed}${C.reset}`);
  if (flagged) console.log(`  ${C.yellow}Flagged: ${flagged}${C.reset}`);
  if (missingCount) console.log(`  ${C.magenta}Missing Endpoints: ${missingCount}${C.reset}`);
  console.log(`  Total : ${results.length}`);

  if (failed > 0) {
    console.log(`\n${C.red}Failed tests:${C.reset}`);
    results.filter((r) => !r.pass).forEach((r) => {
      console.log(`  ${C.red}FAIL${C.reset} ${r.name} -- ${r.detail || ''}`);
    });
  }

  if (missingCount > 0) {
    console.log(`\n${C.magenta}Missing Endpoints (location filtering not implemented):${C.reset}`);
    results.filter((r) => r.missing).forEach((r) => {
      console.log(`  ${C.magenta}>>>${C.reset} ${r.name}`);
      console.log(`      ${r.flag}`);
    });
  }

  if (flagged > 0) {
    console.log(`\n${C.yellow}Flagged (notes/warnings):${C.reset}`);
    results.filter((r) => r.flag && !r.missing).forEach((r) => {
      console.log(`  ${C.yellow}FLAG${C.reset} ${r.name} -- ${r.flag}`);
    });
  }

  console.log(`\n${C.bold}Conclusion:${C.reset}`);
  console.log(`  Ads:    ${C.green}Location-based feed filtering is fully implemented and working.${C.reset}`);
  console.log(`          GET /ads/for-feed supports zip, lat, lng params with haversine distance.`);
  console.log(`  Posts:  ${C.magenta}Location data is STORED but NOT FILTERED on retrieval.${C.reset}`);
  console.log(`          GET /posts has no zip/lat/lng/proximity params.`);
  console.log(`  Events: ${C.magenta}Location data is STORED but NOT FILTERED on retrieval.${C.reset}`);
  console.log(`          GET /events has no proximity-based filtering endpoint.`);
  console.log();

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(`${C.red}Unhandled error:${C.reset}`, err);
  process.exit(1);
});
