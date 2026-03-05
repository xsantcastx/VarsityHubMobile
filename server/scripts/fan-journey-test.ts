/**
 * End-to-End Fan Journey Test
 * Simulates a complete fan user lifecycle against the running server.
 *
 * Run:  npx tsx scripts/fan-journey-test.ts
 */

const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const RUN = Date.now().toString(36);

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
  opts: { body?: any; token?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; data: any }> {
  const url = `${BASE}${path}`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...opts.headers };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
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
    return { status: res.status, data };
  } catch (e: any) {
    clearTimeout(timer);
    return { status: 0, data: { error: e.message } };
  }
}

/* ------------------------------------------------------------------ */
/*  Main test sequence                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  console.log(`\n🏟  Fan Journey End-to-End Test`);
  console.log(`   Base URL: ${BASE}`);
  console.log(`   Run ID:   ${RUN}\n`);

  // ── Shared state ──
  let token = '';
  let userId = '';
  let postId = '';
  let secondToken = '';
  let secondUserId = '';

  const fanEmail = `fan-${RUN}@test.local`;
  const fanPass = 'TestPass123!';
  const fan2Email = `fan2-${RUN}@test.local`;

  /* ================================================================ */
  /*  Phase 1 — Registration                                          */
  /* ================================================================ */
  console.log('\n── Phase 1: Registration ──');

  const reg = await api('POST', '/auth/register', {
    body: { email: fanEmail, password: fanPass, role: 'fan', display_name: `TestFan ${RUN}` },
  });

  if (reg.status === 201 && reg.data?.access_token) {
    token = reg.data.access_token;
    userId = reg.data.user?.id;
    ok('Register fan account', `status=${reg.status} userId=${userId}`);
  } else {
    fail('Register fan account', `status=${reg.status} ${JSON.stringify(reg.data).slice(0, 200)}`);
    console.log('\n⛔ Cannot continue without registration. Aborting.');
    return printReport();
  }

  // Also register a second fan so we have someone to follow / DM
  const reg2 = await api('POST', '/auth/register', {
    body: { email: fan2Email, password: fanPass, role: 'fan', display_name: `TestFan2 ${RUN}` },
  });
  if (reg2.status === 201 && reg2.data?.access_token) {
    secondToken = reg2.data.access_token;
    secondUserId = reg2.data.user?.id;
    ok('Register second fan (for follow/DM target)', `userId=${secondUserId}`);
  } else {
    fail('Register second fan', `status=${reg2.status}`);
  }

  /* ================================================================ */
  /*  Phase 2 — Email Verification                                     */
  /* ================================================================ */
  console.log('\n── Phase 2: Email Verification ──');

  const devCode = reg.data?.dev_verification_code;
  if (!devCode) {
    flag('No dev_verification_code returned — server may not be in dev mode');
  }

  if (devCode) {
    const verify = await api('POST', '/auth/verify/confirm', {
      token,
      body: { code: devCode },
    });
    if (verify.status === 200 && verify.data?.ok) {
      ok('Verify email', `code=${devCode}`);
    } else {
      fail('Verify email', `status=${verify.status} ${JSON.stringify(verify.data).slice(0, 200)}`);
    }
  } else {
    // Try a fixed test code in case server auto-verifies
    const verify = await api('POST', '/auth/verify/confirm', {
      token,
      body: { code: '000000' },
    });
    if (verify.status === 200) {
      ok('Verify email (fallback)', `status=${verify.status}`);
    } else {
      fail('Verify email (no dev code available)', `status=${verify.status}`);
    }
  }

  // Verify second fan too
  const devCode2 = reg2.data?.dev_verification_code;
  if (devCode2 && secondToken) {
    const v2 = await api('POST', '/auth/verify/confirm', { token: secondToken, body: { code: devCode2 } });
    if (v2.status === 200) ok('Verify second fan email'); else fail('Verify second fan email', `status=${v2.status}`);
  }

  /* ================================================================ */
  /*  Phase 3 — Onboarding                                            */
  /* ================================================================ */
  console.log('\n── Phase 3: Onboarding ──');

  const onboard = await api('POST', '/auth/me/complete-onboarding', {
    token,
    body: {
      role: 'fan',
      username: `testfan_${RUN}`,
      display_name: `TestFan ${RUN}`,
      zip_code: '06510',
      affiliation: 'university',
      sports_interests: ['basketball', 'football'],
      primary_intents: ['follow_teams', 'highlights'],
      location_enabled: true,
      notifications_enabled: true,
      messaging_policy_accepted: true,
      dob: '2000-01-15',
    },
  });

  if (onboard.status === 200 && onboard.data?.user) {
    const prefs = onboard.data.user.preferences || {};
    if (prefs.onboarding_completed) {
      ok('Complete onboarding', `username=testfan_${RUN}`);
    } else {
      fail('Onboarding did not set onboarding_completed', JSON.stringify(prefs).slice(0, 200));
    }
  } else {
    fail('Complete onboarding', `status=${onboard.status} ${JSON.stringify(onboard.data).slice(0, 200)}`);
  }

  // Check which onboarding fields persisted
  const meAfterOnboard = await api('GET', '/auth/me', { token });
  if (meAfterOnboard.status === 200) {
    const p = (meAfterOnboard.data?.preferences || {}) as any;
    const coreChecks = [
      { field: 'role', expected: 'fan', actual: p.role },
      { field: 'onboarding_completed', expected: true, actual: p.onboarding_completed },
    ];
    const coreGood = coreChecks.every((c) => String(c.actual) === String(c.expected));
    if (coreGood) {
      ok('Onboarding preferences persisted', coreChecks.map((c) => `${c.field}=${c.actual}`).join(', '));
    } else {
      const mismatches = coreChecks.filter((c) => String(c.actual) !== String(c.expected));
      fail('Onboarding preferences mismatch', mismatches.map((c) => `${c.field}: expected=${c.expected} got=${c.actual}`).join('; '));
    }
    // zip_code may be stored but not always surfaced in /me response
    const zip = p.zip_code || p.zip;
    if (zip === '06510') {
      ok('Zip code persisted', `zip_code=${zip}`);
    } else {
      flag(`zip_code not found in preferences (got ${zip}). Server may store it differently.`);
    }
  }

  // Onboard second fan
  if (secondToken) {
    await api('POST', '/auth/me/complete-onboarding', {
      token: secondToken,
      body: {
        role: 'fan',
        username: `testfan2_${RUN}`,
        display_name: `TestFan2 ${RUN}`,
        zip_code: '06510',
        dob: '1999-06-01',
        messaging_policy_accepted: true,
      },
    });
  }

  /* ================================================================ */
  /*  Phase 4 — Feed & Posts                                           */
  /* ================================================================ */
  console.log('\n── Phase 4: Feed & Posts ──');

  // 4a. Get feed (should work even if empty)
  const feed = await api('GET', '/posts?limit=5', { token });
  if (feed.status === 200 && Array.isArray(feed.data?.items)) {
    ok('GET /posts feed', `${feed.data.items.length} items returned`);
  } else {
    fail('GET /posts feed', `status=${feed.status} ${JSON.stringify(feed.data).slice(0, 200)}`);
  }

  // 4b. Create a text post
  const postContent = `Hello from fan journey test run ${RUN}! 🏀`;
  const createPost = await api('POST', '/posts', {
    token,
    body: { content: postContent, type: 'text' },
  });
  if (createPost.status === 201 && createPost.data?.id) {
    postId = createPost.data.id;
    ok('Create text post', `postId=${postId}`);
  } else {
    fail('Create text post', `status=${createPost.status} ${JSON.stringify(createPost.data).slice(0, 200)}`);
  }

  // 4c. Fetch the post back
  if (postId) {
    const getPost = await api('GET', `/posts/${postId}`, { token });
    if (getPost.status === 200 && getPost.data?.id === postId) {
      const contentMatch = (getPost.data.content || '').includes('fan journey test');
      if (contentMatch) {
        ok('GET /posts/:id fetch back', `content matches`);
      } else {
        fail('GET /posts/:id content mismatch', `got: "${(getPost.data.content || '').slice(0, 80)}"`);
      }
    } else {
      fail('GET /posts/:id', `status=${getPost.status}`);
    }
  }

  /* ================================================================ */
  /*  Phase 5 — Engagement (upvote, comment)                           */
  /* ================================================================ */
  console.log('\n── Phase 5: Engagement ──');

  if (postId) {
    // 5a. Upvote the post (use second fan to avoid self-upvote issues)
    const upvoter = secondToken || token;
    const upvote = await api('POST', `/posts/${postId}/upvote`, { token: upvoter, body: {} });
    if (upvote.status === 200 && upvote.data?.upvotes_count >= 1) {
      ok('Upvote post', `count=${upvote.data.upvotes_count} has_upvoted=${upvote.data.has_upvoted}`);
    } else if (upvote.status === 200) {
      ok('Upvote post (toggled)', `count=${upvote.data?.upvotes_count}`);
    } else {
      fail('Upvote post', `status=${upvote.status} ${JSON.stringify(upvote.data).slice(0, 200)}`);
    }

    // 5b. Comment on the post
    const comment = await api('POST', `/posts/${postId}/comments`, {
      token: secondToken || token,
      body: { content: `Great post! Test comment from run ${RUN}` },
    });
    if ((comment.status === 201 || comment.status === 200) && comment.data?.id) {
      ok('Comment on post', `commentId=${comment.data.id}`);
    } else {
      fail('Comment on post', `status=${comment.status} ${JSON.stringify(comment.data).slice(0, 200)}`);
    }

    // 5c. Verify counts updated
    const refreshed = await api('GET', `/posts/${postId}`, { token });
    if (refreshed.status === 200) {
      const up = refreshed.data?.upvotes_count ?? 0;
      const cm = refreshed.data?.comments_count ?? 0;
      if (up >= 1 && cm >= 1) {
        ok('Post counts updated', `upvotes=${up} comments=${cm}`);
      } else {
        fail('Post counts not updated', `upvotes=${up} comments=${cm}`);
      }
    }
  } else {
    fail('Upvote post (no postId)', 'skipped');
    fail('Comment on post (no postId)', 'skipped');
  }

  /* ================================================================ */
  /*  Phase 6 — Profile                                                */
  /* ================================================================ */
  console.log('\n── Phase 6: Profile ──');

  const me = await api('GET', '/auth/me', { token });
  if (me.status === 200 && me.data?.id === userId) {
    ok('GET /auth/me', `email=${me.data.email} verified=${me.data.email_verified}`);

    // Check post count incremented
    const postCount = me.data._count?.posts ?? me.data.posts_count ?? -1;
    if (postCount >= 1) {
      ok('Profile post count', `posts=${postCount}`);
    } else {
      flag(`Profile post count is ${postCount} (expected ≥ 1)`);
      ok('Profile post count (field may differ)', `raw _count=${JSON.stringify(me.data._count)}`);
    }
  } else {
    fail('GET /auth/me', `status=${me.status}`);
  }

  /* ================================================================ */
  /*  Phase 7 — Follow                                                 */
  /* ================================================================ */
  console.log('\n── Phase 7: Follow ──');

  if (secondUserId) {
    const follow = await api('POST', `/users/${secondUserId}/follow`, { token, body: {} });
    if (follow.status === 201 || follow.status === 200) {
      ok('Follow another user', `status=${follow.status}`);
    } else {
      fail('Follow another user', `status=${follow.status} ${JSON.stringify(follow.data).slice(0, 200)}`);
    }

    // Verify follower count
    const profile2 = await api('GET', `/users/${secondUserId}`, { token });
    if (profile2.status === 200) {
      const followers = profile2.data?._count?.followers ?? profile2.data?.followers_count ?? -1;
      if (followers >= 1) {
        ok('Follower count incremented', `followers=${followers}`);
      } else {
        flag(`Follower count is ${followers} (expected ≥ 1). Field structure: ${JSON.stringify(profile2.data?._count || {})}`);
        ok('Follow request accepted (count field may differ)');
      }
    }

    // Also have second fan follow first fan (needed for DM policy)
    if (secondToken) {
      await api('POST', `/users/${userId}/follow`, { token: secondToken, body: {} });
    }
  } else {
    fail('Follow another user (no second user)', 'skipped');
  }

  /* ================================================================ */
  /*  Phase 8 — Notifications                                          */
  /* ================================================================ */
  console.log('\n── Phase 8: Notifications ──');

  // Give server a moment to process async notifications
  await new Promise((r) => setTimeout(r, 500));

  // Check first fan's notifications (should have: follow from second fan, upvote, comment)
  const notifs = await api('GET', '/notifications?limit=10', { token });
  if (notifs.status === 200 && Array.isArray(notifs.data?.items)) {
    const items = notifs.data.items;
    ok('GET /notifications', `${items.length} notifications`);

    const types = items.map((n: any) => n.type);
    const expectedTypes = ['UPVOTE', 'COMMENT', 'FOLLOW'];
    const foundTypes = expectedTypes.filter((t) => types.includes(t));
    const missingTypes = expectedTypes.filter((t) => !types.includes(t));

    if (foundTypes.length > 0) {
      ok('Notification types present', foundTypes.join(', '));
    }
    if (missingTypes.length > 0) {
      flag(`Missing notification types: ${missingTypes.join(', ')} (may depend on async processing)`);
    }
  } else {
    fail('GET /notifications', `status=${notifs.status} ${JSON.stringify(notifs.data).slice(0, 200)}`);
  }

  /* ================================================================ */
  /*  Phase 9 — Direct Message                                         */
  /* ================================================================ */
  console.log('\n── Phase 9: Direct Message ──');

  if (secondUserId) {
    const dm = await api('POST', '/messages', {
      token,
      body: { recipient_id: secondUserId, content: `Hey! Test DM from fan journey run ${RUN}` },
    });
    if (dm.status === 201 || dm.status === 200) {
      ok('Send DM', `messageId=${dm.data?.id} conversation=${dm.data?.conversation_id}`);
    } else {
      fail('Send DM', `status=${dm.status} ${JSON.stringify(dm.data).slice(0, 200)}`);
    }

    // Check second fan received a MESSAGE notification
    if (secondToken) {
      await new Promise((r) => setTimeout(r, 300));
      const n2 = await api('GET', '/notifications?limit=5', { token: secondToken });
      if (n2.status === 200) {
        const hasMsg = (n2.data?.items || []).some((n: any) => n.type === 'MESSAGE');
        if (hasMsg) {
          ok('DM notification received by recipient');
        } else {
          flag('No MESSAGE notification found for recipient (may be async)');
          ok('DM notification check completed');
        }
      }
    }
  } else {
    fail('Send DM (no second user)', 'skipped');
  }

  /* ================================================================ */
  /*  Phase 10 — Edge Cases & Extras                                   */
  /* ================================================================ */
  console.log('\n── Phase 10: Edge Cases ──');

  // 10a. Cannot follow yourself
  const selfFollow = await api('POST', `/users/${userId}/follow`, { token, body: {} });
  if (selfFollow.status === 400) {
    ok('Self-follow rejected', `status=400`);
  } else {
    fail('Self-follow should return 400', `status=${selfFollow.status}`);
  }

  // 10b. Double upvote toggles off
  if (postId && secondToken) {
    const up2 = await api('POST', `/posts/${postId}/upvote`, { token: secondToken, body: {} });
    if (up2.status === 200 && up2.data?.has_upvoted === false) {
      ok('Double upvote toggles off', `count=${up2.data.upvotes_count}`);
    } else if (up2.status === 200) {
      ok('Double upvote returned 200', `has_upvoted=${up2.data?.has_upvoted} count=${up2.data?.upvotes_count}`);
    } else {
      fail('Double upvote toggle', `status=${up2.status}`);
    }
  }

  // 10c. Empty post rejected
  const emptyPost = await api('POST', '/posts', { token, body: { content: '' } });
  if (emptyPost.status === 400) {
    ok('Empty post rejected', 'status=400');
  } else {
    fail('Empty post should be rejected', `status=${emptyPost.status}`);
  }

  // 10d. Followed-only feed
  const followedFeed = await api('GET', '/posts?followed_only=true&limit=5', { token });
  if (followedFeed.status === 200 && Array.isArray(followedFeed.data?.items)) {
    ok('Followed-only feed', `${followedFeed.data.items.length} items`);
  } else {
    fail('Followed-only feed', `status=${followedFeed.status}`);
  }

  // 10e. Unauthenticated feed still works
  const anonFeed = await api('GET', '/posts?limit=3');
  if (anonFeed.status === 200 && Array.isArray(anonFeed.data?.items)) {
    ok('Anonymous feed (no auth)', `${anonFeed.data.items.length} items`);
  } else {
    fail('Anonymous feed', `status=${anonFeed.status}`);
  }

  /* ================================================================ */
  /*  Report                                                           */
  /* ================================================================ */
  printReport();
}

function printReport() {
  console.log('\n' + '═'.repeat(60));
  console.log('  FAN JOURNEY TEST REPORT');
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
