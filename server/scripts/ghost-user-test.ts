#!/usr/bin/env npx tsx
/**
 * Ghost User Test — Simulates real-world usage with 5 ghost users.
 *
 * Usage:
 *   npx tsx scripts/ghost-user-test.ts                  # default: http://localhost:4000
 *   BASE_URL=https://staging.example.com npx tsx scripts/ghost-user-test.ts
 *
 * Requirements:
 *   • Server must be running on the target URL
 *   • Must be a dev/test environment (registration returns dev_verification_code)
 *   • Uses unique @test.varsityhub.app emails so it won't collide with real users
 *
 * What it does:
 *   1. Registers 3 fans + 2 coaches
 *   2. Verifies emails & completes onboarding (fans pick sports; coaches create org + team)
 *   3. Fans follow 2 other users each
 *   4. Each user creates 1 text post + 1 image post
 *   5. Users upvote each other's posts
 *   6. 2 users exchange DMs
 *   7. 1 coach creates an event
 *   8. Logs every response status and prints a pass/fail summary
 */

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const RUN_ID = Date.now().toString(36); // unique per run to avoid email collisions

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface GhostUser {
  label: string;
  email: string;
  password: string;
  role: 'fan' | 'coach';
  displayName: string;
  username: string;
  token: string;
  id: string;
  verificationCode: string;
  orgId?: string;
  teamId?: string;
  postIds: string[];
}

interface TestResult {
  step: string;
  status: number | string;
  ok: boolean;
  detail?: string;
}

const results: TestResult[] = [];

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
async function api(
  method: string,
  path: string,
  opts: { body?: any; token?: string; step: string },
): Promise<{ status: number; data: any; ok: boolean }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err: any) {
    const result: TestResult = {
      step: opts.step,
      status: 'NETWORK_ERROR',
      ok: false,
      detail: err.message,
    };
    results.push(result);
    log(result);
    return { status: 0, data: null, ok: false };
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  const ok = res.status >= 200 && res.status < 300;
  const result: TestResult = {
    step: opts.step,
    status: res.status,
    ok,
    detail: ok ? undefined : JSON.stringify(data)?.slice(0, 200),
  };
  results.push(result);
  log(result);
  return { status: res.status, data, ok };
}

function log(r: TestResult) {
  const icon = r.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  const detail = r.detail ? `  → ${r.detail}` : '';
  console.log(`  ${icon} [${r.status}] ${r.step}${detail}`);
}

// ---------------------------------------------------------------------------
// Ghost user definitions
// ---------------------------------------------------------------------------
function createGhostUsers(): GhostUser[] {
  return [
    {
      label: 'Fan 1',
      email: `ghostfan1+${RUN_ID}@test.varsityhub.app`,
      password: 'TestPass123!',
      role: 'fan',
      displayName: 'Ghost Fan One',
      username: `ghostfan1_${RUN_ID}`,
      token: '',
      id: '',
      verificationCode: '',
      postIds: [],
    },
    {
      label: 'Fan 2',
      email: `ghostfan2+${RUN_ID}@test.varsityhub.app`,
      password: 'TestPass123!',
      role: 'fan',
      displayName: 'Ghost Fan Two',
      username: `ghostfan2_${RUN_ID}`,
      token: '',
      id: '',
      verificationCode: '',
      postIds: [],
    },
    {
      label: 'Fan 3',
      email: `ghostfan3+${RUN_ID}@test.varsityhub.app`,
      password: 'TestPass123!',
      role: 'fan',
      displayName: 'Ghost Fan Three',
      username: `ghostfan3_${RUN_ID}`,
      token: '',
      id: '',
      verificationCode: '',
      postIds: [],
    },
    {
      label: 'Coach 1',
      email: `ghostcoach1+${RUN_ID}@test.varsityhub.app`,
      password: 'TestPass123!',
      role: 'coach',
      displayName: 'Ghost Coach Alpha',
      username: `ghostcoach1_${RUN_ID}`,
      token: '',
      id: '',
      verificationCode: '',
      postIds: [],
    },
    {
      label: 'Coach 2',
      email: `ghostcoach2+${RUN_ID}@test.varsityhub.app`,
      password: 'TestPass123!',
      role: 'coach',
      displayName: 'Ghost Coach Beta',
      username: `ghostcoach2_${RUN_ID}`,
      token: '',
      id: '',
      verificationCode: '',
      postIds: [],
    },
  ];
}

// ---------------------------------------------------------------------------
// Test phases
// ---------------------------------------------------------------------------

async function phase1_register(users: GhostUser[]) {
  console.log('\n📝 Phase 1 — Register users');
  for (const u of users) {
    const { data, ok } = await api('POST', '/auth/register', {
      body: {
        email: u.email,
        password: u.password,
        display_name: u.displayName,
        role: u.role,
      },
      step: `Register ${u.label} (${u.role})`,
    });
    if (ok && data) {
      u.token = data.access_token;
      u.id = data.user?.id || '';
      u.verificationCode = data.dev_verification_code || '';
    }
  }
}

async function phase2_verify(users: GhostUser[]) {
  console.log('\n✉️  Phase 2 — Verify emails');
  for (const u of users) {
    if (!u.token || !u.verificationCode) {
      results.push({
        step: `Verify ${u.label}`,
        status: 'SKIPPED',
        ok: false,
        detail: 'No token or verification code from registration',
      });
      continue;
    }
    await api('POST', '/auth/verify/confirm', {
      body: { code: u.verificationCode },
      token: u.token,
      step: `Verify email ${u.label}`,
    });
  }
}

async function phase3_onboarding(users: GhostUser[]) {
  console.log('\n🎓 Phase 3 — Complete onboarding');

  const fans = users.filter((u) => u.role === 'fan');
  const coaches = users.filter((u) => u.role === 'coach');

  // Fan onboarding — set sports interests, then complete
  for (const u of fans) {
    if (!u.token) continue;

    await api('PATCH', '/auth/me/preferences', {
      body: {
        sports_interests: ['basketball', 'football', 'soccer'],
        zip_code: '06510',
        notifications_enabled: true,
        messaging_policy_accepted: true,
      },
      token: u.token,
      step: `Set preferences ${u.label}`,
    });

    await api('POST', '/auth/me/complete-onboarding', {
      body: {
        role: 'fan',
        username: u.username,
        display_name: u.displayName,
        zip: '06510',
        sports_interests: ['basketball', 'football', 'soccer'],
        location_enabled: true,
        notifications_enabled: true,
        messaging_policy_accepted: true,
      },
      token: u.token,
      step: `Complete onboarding ${u.label}`,
    });
  }

  // Coach onboarding — create org, complete onboarding, then create team
  for (const [i, u] of coaches.entries()) {
    if (!u.token) continue;

    // Create organization
    const orgName = `Ghost Org ${i + 1} ${RUN_ID}`;
    const { data: orgData, ok: orgOk } = await api('POST', '/organizations', {
      body: {
        name: orgName,
        description: `Test organization for ${u.label}`,
        sport: 'basketball',
        org_type: 'club',
        location: 'Test City, CT',
        zip_code: '06510',
      },
      token: u.token,
      step: `Create org ${u.label}`,
    });
    if (orgOk && orgData) {
      u.orgId = orgData.id;
    }

    // Complete onboarding with org reference
    await api('POST', '/auth/me/complete-onboarding', {
      body: {
        role: 'coach',
        username: u.username,
        display_name: u.displayName,
        organization_id: u.orgId,
        organization_name: orgName,
        zip: '06510',
        affiliation: 'independent',
        sport: 'basketball',
        season_start: '2026-03-01',
        season_end: '2026-06-30',
        location_enabled: true,
        notifications_enabled: true,
        messaging_policy_accepted: true,
      },
      token: u.token,
      step: `Complete onboarding ${u.label}`,
    });

    // Create team
    const teamName = `Ghost Team ${i + 1} ${RUN_ID}`;
    const { data: teamData, ok: teamOk } = await api('POST', '/teams', {
      body: {
        name: teamName,
        description: `Test team for ${u.label}`,
        season_start: '2026-03-01',
        season_end: '2026-06-30',
      },
      token: u.token,
      step: `Create team ${u.label}`,
    });
    if (teamOk && teamData) {
      u.teamId = teamData.id;
    }
  }
}

async function phase4_follows(users: GhostUser[]) {
  console.log('\n👥 Phase 4 — Fans follow 2 other users each');
  const fans = users.filter((u) => u.role === 'fan');
  const allIds = users.filter((u) => u.id).map((u) => u.id);

  for (const fan of fans) {
    if (!fan.token || !fan.id) continue;
    // Pick 2 users that aren't this fan
    const targets = allIds.filter((id) => id !== fan.id).slice(0, 2);
    for (const targetId of targets) {
      const targetUser = users.find((u) => u.id === targetId);
      await api('POST', `/users/${targetId}/follow`, {
        token: fan.token,
        step: `${fan.label} → follow ${targetUser?.label || targetId}`,
      });
    }
  }
}

async function phase5_posts(users: GhostUser[]) {
  console.log('\n📝 Phase 5 — Each user creates 1 text post + 1 image post');

  const PLACEHOLDER_IMAGE = 'https://res.cloudinary.com/demo/image/upload/sample.jpg';

  for (const u of users) {
    if (!u.token) continue;

    // Text post
    const { data: textPost, ok: textOk } = await api('POST', '/posts', {
      body: {
        content: `Hello from ${u.displayName}! This is a test text post. 🏀 #VarsityHub #GhostTest`,
        type: 'text',
      },
      token: u.token,
      step: `${u.label} creates text post`,
    });
    if (textOk && textPost?.id) {
      u.postIds.push(textPost.id);
    }

    // Image post
    const { data: imgPost, ok: imgOk } = await api('POST', '/posts', {
      body: {
        content: `Game day photo from ${u.displayName}! 📸`,
        media_url: PLACEHOLDER_IMAGE,
        type: 'image',
      },
      token: u.token,
      step: `${u.label} creates image post`,
    });
    if (imgOk && imgPost?.id) {
      u.postIds.push(imgPost.id);
    }
  }
}

async function phase6_upvotes(users: GhostUser[]) {
  console.log('\n👍 Phase 6 — Users upvote each other\'s posts');

  // Each user upvotes 2 posts from different users
  for (const voter of users) {
    if (!voter.token) continue;

    const otherPosts = users
      .filter((u) => u.id !== voter.id)
      .flatMap((u) => u.postIds.map((pid) => ({ pid, label: u.label })));

    // Upvote up to 2 posts from others
    const toUpvote = otherPosts.slice(0, 2);
    for (const { pid, label } of toUpvote) {
      await api('POST', `/posts/${pid}/upvote`, {
        token: voter.token,
        step: `${voter.label} upvotes ${label}'s post`,
      });
    }
  }
}

async function phase7_dms(users: GhostUser[]) {
  console.log('\n💬 Phase 7 — 2 users exchange DMs');

  const [user1, user2] = users.filter((u) => u.token && u.id);
  if (!user1 || !user2) {
    results.push({ step: 'DM exchange', status: 'SKIPPED', ok: false, detail: 'Not enough users' });
    return;
  }

  // User 1 sends DM to User 2
  await api('POST', '/messages', {
    body: {
      content: `Hey ${user2.displayName}! This is a test DM from ${user1.displayName}.`,
      recipient_id: user2.id,
    },
    token: user1.token,
    step: `${user1.label} → DM → ${user2.label}`,
  });

  // User 2 replies
  await api('POST', '/messages', {
    body: {
      content: `Hey back! Got your message, ${user1.displayName}. Great to connect!`,
      recipient_id: user1.id,
    },
    token: user2.token,
    step: `${user2.label} → DM → ${user1.label}`,
  });

  // User 1 sends another
  await api('POST', '/messages', {
    body: {
      content: 'Are you coming to the game this weekend?',
      recipient_id: user2.id,
    },
    token: user1.token,
    step: `${user1.label} → DM #2 → ${user2.label}`,
  });
}

async function phase8_event(users: GhostUser[]) {
  console.log('\n📅 Phase 8 — Coach creates an event');

  const coach = users.find((u) => u.role === 'coach' && u.token);
  if (!coach) {
    results.push({ step: 'Create event', status: 'SKIPPED', ok: false, detail: 'No coach available' });
    return;
  }

  // Set event date 7 days from now
  const eventDate = new Date();
  eventDate.setDate(eventDate.getDate() + 7);

  await api('POST', '/events', {
    body: {
      title: `Ghost Test Game — ${RUN_ID}`,
      date: eventDate.toISOString(),
      location: 'VarsityHub Arena, Test City CT 06510',
      latitude: 41.3083,
      longitude: -72.9279,
      description: 'A test event created by the ghost user test script.',
      event_type: 'game',
      max_attendees: 100,
      contact_info: coach.email,
    },
    token: coach.token,
    step: `${coach.label} creates event`,
  });
}

// ---------------------------------------------------------------------------
// Cleanup helper (optional — call with CLEANUP=1 env var)
// ---------------------------------------------------------------------------
async function cleanup(users: GhostUser[]) {
  console.log('\n🧹 Cleanup — Deleting ghost user accounts');
  for (const u of users) {
    if (!u.token) continue;
    await api('DELETE', '/users/me', {
      token: u.token,
      step: `Delete ${u.label}`,
    });
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
function printSummary() {
  console.log('\n' + '='.repeat(70));
  console.log('  GHOST USER TEST SUMMARY');
  console.log('='.repeat(70));

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const total = results.length;

  // Group by phase
  const phases = new Map<string, TestResult[]>();
  for (const r of results) {
    // Extract phase name from step prefix
    const phase = r.step.split(' ')[0] || 'Other';
    if (!phases.has(phase)) phases.set(phase, []);
    phases.get(phase)!.push(r);
  }

  // Detailed results
  console.log('\n  Detailed Results:');
  console.log('  ' + '-'.repeat(66));

  for (const r of results) {
    const icon = r.ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
    const statusStr = String(r.status).padStart(4);
    console.log(`  ${icon} [${statusStr}] ${r.step}`);
    if (r.detail) {
      console.log(`              ${r.detail}`);
    }
  }

  // Summary
  console.log('\n  ' + '-'.repeat(66));
  const color = failed === 0 ? '\x1b[32m' : '\x1b[31m';
  console.log(`  ${color}Total: ${total} | Passed: ${passed} | Failed: ${failed}\x1b[0m`);

  if (failed === 0) {
    console.log('\n  \x1b[32m🎉 All tests passed!\x1b[0m\n');
  } else {
    console.log('\n  \x1b[31m⚠️  Some tests failed. Check details above.\x1b[0m\n');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║              VARSITYHUB GHOST USER TEST                         ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(`  Server:  ${BASE}`);
  console.log(`  Run ID:  ${RUN_ID}`);
  console.log(`  Time:    ${new Date().toISOString()}`);

  // Preflight — check server is reachable
  try {
    const health = await fetch(`${BASE}/health`);
    if (!health.ok) {
      console.error(`\n❌ Server health check failed (${health.status}). Is the server running?`);
      process.exit(1);
    }
    console.log('  Health:  \x1b[32mOK\x1b[0m');
  } catch (err: any) {
    console.error(`\n❌ Cannot reach server at ${BASE}: ${err.message}`);
    console.error('   Start the server first:  npm run dev');
    process.exit(1);
  }

  const users = createGhostUsers();

  await phase1_register(users);
  await phase2_verify(users);
  await phase3_onboarding(users);
  await phase4_follows(users);
  await phase5_posts(users);
  await phase6_upvotes(users);
  await phase7_dms(users);
  await phase8_event(users);

  // Optional cleanup
  if (process.env.CLEANUP === '1') {
    await cleanup(users);
  } else {
    console.log('\n  ℹ️  Ghost users left in DB. Run with CLEANUP=1 to delete them.');
  }

  printSummary();

  // Exit with appropriate code
  const failed = results.filter((r) => !r.ok).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
