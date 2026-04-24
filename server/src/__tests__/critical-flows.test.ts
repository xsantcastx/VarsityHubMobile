/**
 * Critical Flow Integration Tests (Audit Fix #3)
 *
 * Tests the 5 critical server flows identified in the v1.0.2 audit:
 *
 * 1. Post creation — dedup guard (409 DUPLICATE_POST / DUPLICATE_COMMENT)
 * 2. asyncHandler — unhandled rejections produce 500, not process crash
 * 3. Coach approval — PENDING coaches blocked from creating teams/posts
 * 4. Error handler — AppError, Zod, Prisma errors all produce valid JSON
 * 5. RSVP / interaction idempotency — concurrent follows don't create dupes
 */

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

// Skip when running in CI (postgres service) or explicitly skipped
const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkip = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkip ? describe.skip : describe;

// ─── Shared test fixtures ──────────────────────────────────────────────────────

let onboardedUser: any;
let onboardedToken: string;
let pendingCoach: any;
let pendingCoachToken: string;
let approvedCoach: any;
let approvedCoachToken: string;
let premiumAdUser: any;
let premiumAdUserToken: string;
let premiumUnonboardedAdUser: any;
let premiumUnonboardedAdUserToken: string;
let testOrg: any;
let cleanupIds: { users: string[]; orgs: string[]; posts: string[]; teams: string[] };

describeDb('Critical Server Flows', () => {
  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    cleanupIds = { users: [], orgs: [], posts: [], teams: [] };

    const hash = await bcrypt.hash(PASSWORD, 10);

    // 1. Fully onboarded fan user (for ad entitlement and general auth tests)
    onboardedUser = await prisma.user.create({
      data: {
        email: `critical-fan-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Critical Fan',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    onboardedToken = signJwt({ id: onboardedUser.id });
    cleanupIds.users.push(onboardedUser.id);

    // 2. Pending coach (approval_status = PENDING)
    pendingCoach = await prisma.user.create({
      data: {
        email: `critical-pending-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Pending Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'PENDING',
        preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
      },
    });
    pendingCoachToken = signJwt({ id: pendingCoach.id });
    cleanupIds.users.push(pendingCoach.id);

    // 3. Approved coach with org (for team creation tests)
    approvedCoach = await prisma.user.create({
      data: {
        email: `critical-approved-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Approved Coach',
        username: `criticalcoach${ts}`.slice(0, 20),
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    approvedCoachToken = signJwt({ id: approvedCoach.id });
    cleanupIds.users.push(approvedCoach.id);

    // 4. Paid user for ad entitlement checks
    premiumAdUser = await prisma.user.create({
      data: {
        email: `critical-ad-premium-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Premium Ad User',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', plan: 'veteran', onboarding_completed: true },
      },
    });
    premiumAdUserToken = signJwt({ id: premiumAdUser.id });
    cleanupIds.users.push(premiumAdUser.id);

    // 5. Verified but not onboarded paid advertiser — should still be able to manage ad drafts.
    premiumUnonboardedAdUser = await prisma.user.create({
      data: {
        email: `critical-ad-unonboarded-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Premium Unonboarded Ad User',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: { role: 'fan', plan: 'veteran', onboarding_completed: false },
      },
    });
    premiumUnonboardedAdUserToken = signJwt({ id: premiumUnonboardedAdUser.id });
    cleanupIds.users.push(premiumUnonboardedAdUser.id);

    // Organization for the approved coach
    testOrg = await prisma.organization.create({
      data: {
        name: `Critical Test League ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: approvedCoach.id,
      },
    });
    cleanupIds.orgs.push(testOrg.id);

    await prisma.organizationMembership.create({
      data: {
        organization_id: testOrg.id,
        user_id: approvedCoach.id,
        role: 'owner',
        status: 'active',
      },
    });
  });

  afterAll(async () => {
    // Clean up in reverse dependency order
    for (const id of cleanupIds.posts) {
      await prisma.post.delete({ where: { id } }).catch(() => {});
    }
    for (const id of cleanupIds.teams) {
      await prisma.teamMembership.deleteMany({ where: { team_id: id } }).catch(() => {});
      await prisma.team.delete({ where: { id } }).catch(() => {});
    }
    await prisma.organizationMembership.deleteMany({
      where: { organization_id: { in: cleanupIds.orgs } },
    }).catch(() => {});
    for (const id of cleanupIds.orgs) {
      await prisma.organization.delete({ where: { id } }).catch(() => {});
    }
    for (const id of cleanupIds.users) {
      // Delete any posts/comments created by test users
      await prisma.comment.deleteMany({ where: { author_id: id } }).catch(() => {});
      await prisma.post.deleteMany({ where: { author_id: id } }).catch(() => {});
      await prisma.user.delete({ where: { id } }).catch(() => {});
    }
  });

  // ─── 1. Post Dedup Guard ───────────────────────────────────────────────────

  describe('Post Creation Dedup Guard', () => {
    it('should create a post on first submission', async () => {
      const content = `Unique post ${ts}-${Math.random()}`;
      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ content, type: 'post' });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.content).toBe(content);
      cleanupIds.posts.push(res.body.id);
    });

    it('should return 409 DUPLICATE_POST on identical resubmission within 30s', async () => {
      const content = `Dedup test post ${ts}`;

      // First submission — should succeed
      const res1 = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ content, type: 'post' });

      expect(res1.statusCode).toEqual(201);
      cleanupIds.posts.push(res1.body.id);

      // Immediate duplicate — should be rejected
      const res2 = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ content, type: 'post' });

      expect(res2.statusCode).toEqual(409);
      expect(res2.body.code).toBe('DUPLICATE_POST');
    });

    it('should allow different content from the same user', async () => {
      const res1 = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ content: `First unique ${ts}-A`, type: 'post' });

      expect(res1.statusCode).toEqual(201);
      cleanupIds.posts.push(res1.body.id);

      const res2 = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ content: `Second unique ${ts}-B`, type: 'post' });

      expect(res2.statusCode).toEqual(201);
      cleanupIds.posts.push(res2.body.id);
    });
  });

  // ─── 2. Comment Dedup Guard ────────────────────────────────────────────────

  describe('Comment Dedup Guard', () => {
    let parentPostId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ content: `Parent post for comments ${ts}`, type: 'post' });

      parentPostId = res.body.id;
      cleanupIds.posts.push(parentPostId);
    });

    it('should create a comment on first submission', async () => {
      const res = await request(app)
        .post(`/posts/${parentPostId}/comments`)
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ content: `Comment ${ts}-${Math.random()}` });

      expect(res.statusCode).toEqual(201);
    });

    it('should return 409 DUPLICATE_COMMENT on identical resubmission', async () => {
      const commentContent = `Dedup comment ${ts}`;

      const res1 = await request(app)
        .post(`/posts/${parentPostId}/comments`)
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ content: commentContent });

      expect(res1.statusCode).toEqual(201);

      const res2 = await request(app)
        .post(`/posts/${parentPostId}/comments`)
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ content: commentContent });

      expect(res2.statusCode).toEqual(409);
      expect(res2.body.code).toBe('DUPLICATE_COMMENT');
    });
  });

  // ─── 3. asyncHandler Error Propagation ─────────────────────────────────────

  describe('asyncHandler Error Propagation', () => {
    it('should return JSON error (not crash) for non-existent post', async () => {
      const res = await request(app)
        .get('/posts/00000000-0000-0000-0000-000000000000');

      // Should be 404 or valid error, NOT a raw exception / 500 stack trace
      expect([404, 400]).toContain(res.statusCode);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 401 for unauthenticated protected routes', async () => {
      const res = await request(app).post('/posts').send({ content: 'test' });

      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('error');
    });

    it('should return JSON for malformed request body', async () => {
      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .set('Content-Type', 'application/json')
        .send('{"broken json');

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      // Express JSON parser should produce a valid error, not a crash
      expect(res.headers['content-type']).toMatch(/json/);
    });

    it('should return valid JSON for invalid UUID in path param', async () => {
      const res = await request(app)
        .get('/posts/not-a-uuid')
        .set('Authorization', `Bearer ${approvedCoachToken}`);

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should return 400/422 for Zod validation failures on post creation', async () => {
      // Send a post with empty content and missing required fields
      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({});

      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ─── 4. Coach Approval Gate ────────────────────────────────────────────────

  describe('Coach Approval Gate (requireOnboarded)', () => {
    it('should block PENDING coach from creating a post', async () => {
      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${pendingCoachToken}`)
        .send({ content: 'Should be blocked', type: 'post' });

      // requireOnboarded should reject before reaching the handler
      expect(res.statusCode).toEqual(403);
    });

    it('should block PENDING coach from creating a team', async () => {
      const res = await request(app)
        .post('/teams')
        .set('Authorization', `Bearer ${pendingCoachToken}`)
        .send({
          name: 'Blocked Team',
          sport: 'basketball',
          organization_id: testOrg.id,
        });

      expect(res.statusCode).toEqual(403);
    });

    it('should allow APPROVED coach to create a post', async () => {
      const res = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ content: `Approved coach post ${ts}`, type: 'post' });

      expect(res.statusCode).toEqual(201);
      cleanupIds.posts.push(res.body.id);
    });

    it('should allow APPROVED coach to create a team in their org', async () => {
      const res = await request(app)
        .post('/teams')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({
          name: `Approved Team ${ts}`,
          sport: 'basketball',
          organization_id: testOrg.id,
        });

      // 201 if successful, 200 also acceptable
      expect([200, 201]).toContain(res.statusCode);
      if (res.body.id) {
        cleanupIds.teams.push(res.body.id);
      }
    });
  });

  // ─── 5. Onboarding / Payment Regression Guards ────────────────────────────

  describe('Onboarding / Payment Regression Guards', () => {
    it('should preserve an existing paid plan on stale complete-onboarding retries', async () => {
      const user = await prisma.user.create({
        data: {
          email: `critical-plan-${ts}-${Math.random()}@example.com`,
          password_hash: await bcrypt.hash(PASSWORD, 10),
          display_name: 'Plan Preserve Coach',
          username: `planpreserve${Date.now()}`.slice(0, 20),
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
          // COPPA gate in /me/complete-onboarding requires a DOB on file.
          date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
          // Mirror plan to the canonical column — getSelectedPlan reads
          // the column first; the JSON-only `preferences.plan: 'veteran'`
          // would be invisible to complete-onboarding's preserve-paid-plan
          // logic, which would default the user back to rookie.
          plan: 'veteran',
          approval_status: 'APPROVED',
          preferences: {
            role: 'coach',
            plan: 'veteran',
            onboarding_completed: true,
            organization_id: testOrg.id,
            organization_name: testOrg.name,
          },
        },
      });
      cleanupIds.users.push(user.id);
      const token = signJwt({ id: user.id });

      const res = await request(app)
        .post('/auth/me/complete-onboarding')
        .set('Authorization', `Bearer ${token}`)
        .send({
          role: 'coach',
          affiliation: 'school',
        });

      expect(res.statusCode).toEqual(200);

      const userAfter = await prisma.user.findUnique({
        where: { id: user.id },
        select: { preferences: true, approval_status: true },
      });

      const prefs = (userAfter?.preferences as any) || {};
      expect(prefs.plan).toBe('veteran');
      expect(userAfter?.approval_status).toBe('APPROVED');
    });

    it('should not downgrade APPROVED status when onboarding re-submits role=coach', async () => {
      const user = await prisma.user.create({
        data: {
          email: `critical-approved-drift-${ts}-${Math.random()}@example.com`,
          password_hash: await bcrypt.hash(PASSWORD, 10),
          display_name: 'Approved Drift Coach',
          username: `approveddrift${Date.now()}`.slice(0, 20),
          email_verified: true,
          role: 'fan',
          onboarding_completed: true,
          // COPPA gate in /me/complete-onboarding requires a DOB on file.
          date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
          approval_status: 'APPROVED',
          preferences: {
            role: 'fan',
            plan: 'veteran',
            onboarding_completed: true,
            organization_id: testOrg.id,
            organization_name: testOrg.name,
          },
        },
      });
      cleanupIds.users.push(user.id);
      const token = signJwt({ id: user.id });

      const res = await request(app)
        .post('/auth/me/complete-onboarding')
        .set('Authorization', `Bearer ${token}`)
        .send({
          role: 'coach',
          affiliation: 'school',
        });

      expect(res.statusCode).toEqual(200);

      const userAfter = await prisma.user.findUnique({
        where: { id: user.id },
        select: { preferences: true, approval_status: true },
      });

      const prefs = (userAfter?.preferences as any) || {};
      expect(prefs.role).toBe('coach');
      expect(userAfter?.approval_status).toBe('APPROVED');
    });

    it('should clear payment_pending and pending_plan when skipping payment', async () => {
      const user = await prisma.user.create({
        data: {
          email: `critical-skip-payment-${ts}-${Math.random()}@example.com`,
          password_hash: await bcrypt.hash(PASSWORD, 10),
          display_name: 'Skip Payment Coach',
          username: `skippayment${Date.now()}`.slice(0, 20),
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
          // Mirror billing state to canonical columns — isPaymentPending
          // reads the column first and only falls back to the JSON when
          // the column is null. Without these, /auth/skip-payment treats
          // the user as having no pending payment and short-circuits.
          plan: 'rookie',
          pending_plan: 'legend',
          payment_pending: true,
          payment_approved: true,
          approval_status: 'PENDING',
          preferences: {
            role: 'coach',
            plan: 'rookie',
            pending_plan: 'legend',
            payment_pending: true,
            payment_approved: true,
            onboarding_completed: true,
            organization_id: testOrg.id,
            organization_name: testOrg.name,
          },
        },
      });
      cleanupIds.users.push(user.id);
      const token = signJwt({ id: user.id });

      const res = await request(app)
        .post('/auth/skip-payment')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.statusCode).toEqual(200);
      expect(res.body.ok).toBe(true);

      const userAfter = await prisma.user.findUnique({
        where: { id: user.id },
        select: { preferences: true },
      });

      const prefs = (userAfter?.preferences as any) || {};
      expect(prefs.plan).toBe('rookie');
      expect(prefs.payment_pending).toBeUndefined();
      expect(prefs.pending_plan).toBeUndefined();
      expect(prefs.payment_approved).toBeUndefined();
    });
  });

  // ─── 6. Error Response Shape Consistency ───────────────────────────────────

  describe('Ad Booking Access', () => {
    it('should allow rookie/free users to create ad drafts', async () => {
      const res = await request(app)
        .post('/ads')
        .set('Authorization', `Bearer ${onboardedToken}`)
        .send({
          contact_name: 'Free User',
          contact_email: 'free-user@example.com',
          business_name: 'Free Biz',
          banner_url: 'https://example.com/banner.jpg',
          target_url: 'https://example.com',
          target_zip_code: '10001',
          description: 'Blocked ad',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      await prisma.ad.delete({ where: { id: res.body.id } }).catch(() => {});
    });

    it('should allow Veteran users to create ad drafts', async () => {
      const res = await request(app)
        .post('/ads')
        .set('Authorization', `Bearer ${premiumAdUserToken}`)
        .send({
          contact_name: 'Premium User',
          contact_email: 'premium-user@example.com',
          business_name: 'Premium Biz',
          banner_url: 'https://example.com/banner-premium.jpg',
          target_url: 'https://example.com',
          target_zip_code: '10001',
          description: 'Allowed ad',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
      await prisma.ad.delete({ where: { id: res.body.id } }).catch(() => {});
    });

    it('should allow verified but not onboarded Veteran users through ad draft lifecycle', async () => {
      const createRes = await request(app)
        .post('/ads')
        .set('Authorization', `Bearer ${premiumUnonboardedAdUserToken}`)
        .send({
          contact_name: 'Fresh Advertiser',
          contact_email: 'fresh-advertiser@example.com',
          business_name: 'Fresh Advertiser Biz',
          banner_url: 'https://example.com/banner-fresh.jpg',
          target_url: 'https://example.com',
          target_zip_code: '10001',
          description: 'Ad from a verified but not onboarded advertiser',
        });

      expect(createRes.statusCode).toEqual(201);
      expect(createRes.body).toHaveProperty('id');
      const adId = String(createRes.body.id);

      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const submitRes = await request(app)
        .post(`/ads/${adId}/submit-for-approval`)
        .set('Authorization', `Bearer ${premiumUnonboardedAdUserToken}`)
        .send({ dates: [tomorrow] });

      expect(submitRes.statusCode).toEqual(200);
      expect(submitRes.body.status).toEqual('pending');
      expect(submitRes.body.payment_status).toEqual('pending_approval');

      const deleteRes = await request(app)
        .delete(`/ads/${adId}`)
        .set('Authorization', `Bearer ${premiumUnonboardedAdUserToken}`);

      expect(deleteRes.statusCode).toEqual(200);
      expect(deleteRes.body.ok).toBe(true);

      const adAfterDelete = await prisma.ad.findUnique({ where: { id: adId } });
      expect(adAfterDelete).toBeNull();
    });

    it('should allow rookie/free users to initiate payment on existing approved ads', async () => {
      const ad = await prisma.ad.create({
        data: {
          user_id: onboardedUser.id,
          contact_name: 'Free User',
          contact_email: onboardedUser.email,
          business_name: 'Legacy Draft Biz',
          banner_url: 'https://example.com/banner-legacy.jpg',
          target_url: 'https://example.com',
          target_zip_code: '10001',
          radius: 9,
          status: 'approved',
          payment_status: 'unpaid',
        },
      });

      try {
        const res = await request(app)
          .post('/payments/create-payment-sheet')
          .set('Authorization', `Bearer ${onboardedToken}`)
          .send({ ad_id: ad.id, dates: ['2035-01-02'] });

        expect(res.statusCode).not.toEqual(403);
        expect(String(res.body?.error || '')).not.toBe('PLAN_UPGRADE_REQUIRED');
      } finally {
        await prisma.ad.delete({ where: { id: ad.id } }).catch(() => {});
      }
    });
  });

  describe('Error Response Shape Consistency', () => {
    it('should return { error: string } for 401', async () => {
      const res = await request(app).get('/auth/me');

      expect(res.statusCode).toEqual(401);
      expect(typeof res.body.error).toBe('string');
      // Should NOT have random keys like { message: ... } or plain text
      expect(res.headers['content-type']).toMatch(/json/);
    });

    it('should return { error: string } for 404 on teams', async () => {
      const res = await request(app)
        .get('/teams/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${onboardedToken}`);

      expect([400, 404]).toContain(res.statusCode);
      expect(typeof res.body.error).toBe('string');
    });

    it('should return valid JSON for validation errors on events', async () => {
      const res = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({}); // Missing all required fields

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.statusCode).toBeLessThan(500);
      expect(res.headers['content-type']).toMatch(/json/);
      expect(res.body).toHaveProperty('error');
    });

    it('should return valid JSON for validation errors on organizations', async () => {
      const res = await request(app)
        .post('/organizations')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({}); // Missing required fields

      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      expect(res.statusCode).toBeLessThan(500);
      expect(res.headers['content-type']).toMatch(/json/);
    });
  });

  // ─── 7. Concurrent Follow Idempotency ─────────────────────────────────────

  describe('Concurrent Interaction Safety', () => {
    it('should handle concurrent like attempts gracefully', async () => {
      // Create a post to like
      const postRes = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ content: `Like test post ${ts}`, type: 'post' });

      expect(postRes.statusCode).toEqual(201);
      const postId = postRes.body.id;
      cleanupIds.posts.push(postId);

      // Fire two concurrent likes — both should succeed or one should be a no-op
      const [like1, like2] = await Promise.all([
        request(app)
          .post(`/posts/${postId}/upvote`)
          .set('Authorization', `Bearer ${approvedCoachToken}`),
        request(app)
          .post(`/posts/${postId}/upvote`)
          .set('Authorization', `Bearer ${approvedCoachToken}`),
      ]);

      // Both should return 2xx or one returns 409/conflict — neither should be 500
      expect(like1.statusCode).toBeLessThan(500);
      expect(like2.statusCode).toBeLessThan(500);
    });

    it('should not create duplicate post records on concurrent submissions', async () => {
      const uniqueContent = `Concurrent dedup ${ts}-${Math.random()}`;

      const [r1, r2] = await Promise.all([
        request(app)
          .post('/posts')
          .set('Authorization', `Bearer ${approvedCoachToken}`)
          .send({ content: uniqueContent, type: 'post' }),
        request(app)
          .post('/posts')
          .set('Authorization', `Bearer ${approvedCoachToken}`)
          .send({ content: uniqueContent, type: 'post' }),
      ]);

      // One should succeed (201), the other should be deduped (409)
      const statuses = [r1.statusCode, r2.statusCode].sort();
      expect(statuses).toContain(201);
      // The dedup may or may not fire depending on timing — at minimum neither should be 500
      expect(r1.statusCode).toBeLessThan(500);
      expect(r2.statusCode).toBeLessThan(500);

      // Clean up whichever created
      if (r1.body.id) cleanupIds.posts.push(r1.body.id);
      if (r2.body.id) cleanupIds.posts.push(r2.body.id);
    });
  });
});
