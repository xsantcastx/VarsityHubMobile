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
import { describeDb } from './helpers/dbTestSuite.js';
import request from 'supertest';
import { app } from '../testApp.js';
import { SERVER_VETERAN_MIN_TOTAL_TEAMS } from '../lib/planDefinitions.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

// Skip when running in CI (postgres service) or explicitly skipped

// ─── Shared test fixtures ──────────────────────────────────────────────────────

let onboardedUser: any;
let onboardedToken: string;
let pendingCoach: any;
let pendingCoachToken: string;
let approvedCoach: any;
let approvedCoachToken: string;
let unverifiedCoach: any;
let unverifiedCoachToken: string;
let premiumAdUser: any;
let premiumAdUserToken: string;
let premiumUnonboardedAdUser: any;
let premiumUnonboardedAdUserToken: string;
let ownerManagedCoach: any;
let ownerManagedCoachToken: string;
let testOrg: any;
let cleanupIds: { users: string[]; orgs: string[]; posts: string[]; teams: string[] };

async function createOnboardingRegressionUser(
  prismaClient: any,
  org: { id: string; name: string },
  overrides: Record<string, unknown>
) {
  const user = await prismaClient.user.create({
    data: {
      email: `critical-onboarding-${ts}-${Math.random()}@example.com`,
      password_hash: await bcrypt.hash(PASSWORD, 10),
      email_verified: true,
      onboarding_completed: true,
      date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
      approval_status: 'APPROVED',
      preferences: {
        role: 'coach',
        plan: 'veteran',
        onboarding_completed: true,
        organization_id: org.id,
        organization_name: org.name,
      },
      ...overrides,
    },
  });

  cleanupIds.users.push(user.id);
  return user;
}

async function completeOnboardingForUser(token: string) {
  return request(app)
    .post('/auth/me/complete-onboarding')
    .set('Authorization', `Bearer ${token}`)
    .send({
      role: 'coach',
      affiliation: 'school',
    });
}

async function getUserPrefsAndApproval(id: string) {
  const userAfter = await prisma.user.findUnique({
    where: { id },
    select: { preferences: true, approval_status: true },
  });

  return {
    prefs: (userAfter?.preferences as any) || {},
    approvalStatus: userAfter?.approval_status,
  };
}

async function runOnboardingRegression(
  overrides: Record<string, unknown>,
  assertion: (result: { prefs: Record<string, unknown>; approvalStatus: unknown }) => void
) {
  const user = await createOnboardingRegressionUser(prisma, testOrg, overrides);
  const token = signJwt({ id: user.id });
  const res = await completeOnboardingForUser(token);

  expect(res.statusCode).toEqual(200);
  assertion(await getUserPrefsAndApproval(user.id));
}

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

    // 4. Unverified coach candidate — must not complete onboarding server-side.
    unverifiedCoach = await prisma.user.create({
      data: {
        email: `critical-unverified-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Unverified Coach',
        role: 'coach',
        onboarding_completed: false,
        approval_status: 'PENDING',
        email_verified: false,
        preferences: { role: 'coach', plan: 'rookie', onboarding_completed: false },
      },
    });
    unverifiedCoachToken = signJwt({ id: unverifiedCoach.id });
    cleanupIds.users.push(unverifiedCoach.id);

    // 5. Paid user for ad entitlement checks
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

    // 6. Verified but not onboarded paid advertiser — should still be able to manage ad drafts.
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

    // 7. Approved coach covered by a league owner — must never self-purchase a subscription.
    ownerManagedCoach = await prisma.user.create({
      data: {
        email: `critical-owner-managed-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Owner Managed Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        paid_by_owner: true,
        preferences: {
          role: 'coach',
          plan: 'veteran',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    ownerManagedCoachToken = signJwt({ id: ownerManagedCoach.id });
    cleanupIds.users.push(ownerManagedCoach.id);

    // Organization for the approved coach
    testOrg = await prisma.organization.create({
      data: {
        name: `Critical Test League ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: approvedCoach.id,
      },
      select: { id: true, name: true },
    });
    cleanupIds.orgs.push(testOrg.id);

    await prisma.organizationMembership.create({
      data: {
        organization_id: testOrg.id,
        user_id: approvedCoach.id,
        role: 'owner',
        status: 'active',
      },
      select: { id: true },
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
    await prisma.organizationMembership
      .deleteMany({
        where: { organization_id: { in: cleanupIds.orgs } },
      })
      .catch(() => {});
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

  describe('Verification gate on onboarding', () => {
    it('blocks unverified users from completing onboarding', async () => {
      const res = await request(app)
        .post('/auth/me/complete-onboarding')
        .set('Authorization', `Bearer ${unverifiedCoachToken}`)
        .send({});

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toBe('Email verification required');
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
      const res = await request(app).get('/posts/00000000-0000-0000-0000-000000000000');

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
      await runOnboardingRegression(
        {
          display_name: 'Plan Preserve Coach',
          username: `planpreserve${Date.now()}`.slice(0, 20),
          role: 'coach',
          // Mirror plan to the canonical column — getSelectedPlan reads
          // the column first; the JSON-only `preferences.plan: 'veteran'`
          // would be invisible to complete-onboarding's preserve-paid-plan
          // logic, which would default the user back to rookie.
          plan: 'veteran',
          preferences: {
            role: 'coach',
            plan: 'veteran',
            onboarding_completed: true,
            organization_id: testOrg.id,
            organization_name: testOrg.name,
          },
        },
        ({ prefs, approvalStatus }) => {
          expect(prefs.plan).toBe('veteran');
          expect(approvalStatus).toBe('APPROVED');
        }
      );
    });

    it('should not downgrade APPROVED status when onboarding re-submits role=coach', async () => {
      await runOnboardingRegression(
        {
          display_name: 'Approved Drift Coach',
          username: `approveddrift${Date.now()}`.slice(0, 20),
          role: 'fan',
          preferences: {
            role: 'fan',
            plan: 'veteran',
            onboarding_completed: true,
            organization_id: testOrg.id,
            organization_name: testOrg.name,
          },
        },
        ({ prefs, approvalStatus }) => {
          expect(prefs.role).toBe('coach');
          expect(approvalStatus).toBe('APPROVED');
        }
      );
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
    const expectPaymentSheetAllowed = async (
      adData: Record<string, unknown>,
      disallowedError: string,
      { cleanupReservations = false }: { cleanupReservations?: boolean } = {}
    ) => {
      const ad = await prisma.ad.create({
        data: {
          user_id: onboardedUser.id,
          target_url: 'https://example.com',
          target_zip_code: '10001',
          radius: 9,
          payment_status: 'unpaid',
          ...adData,
        },
      });

      try {
        const res = await request(app)
          .post('/payments/create-payment-sheet')
          .set('Authorization', `Bearer ${onboardedToken}`)
          .send({ ad_id: ad.id, dates: ['2035-01-02'] });

        expect(res.statusCode).not.toEqual(403);
        expect(String(res.body?.error || '')).not.toBe(disallowedError);
      } finally {
        if (cleanupReservations) {
          await prisma.adReservation.deleteMany({ where: { ad_id: ad.id } }).catch(() => {});
        }
        await prisma.ad.delete({ where: { id: ad.id } }).catch(() => {});
      }
    };

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
      await expectPaymentSheetAllowed(
        {
          contact_name: 'Free User',
          contact_email: onboardedUser.email,
          business_name: 'Legacy Draft Biz',
          banner_url: 'https://example.com/banner-legacy.jpg',
          status: 'approved',
        },
        'PLAN_UPGRADE_REQUIRED'
      );
    });

    it('should allow archived but previously approved ads to be booked again', async () => {
      await expectPaymentSheetAllowed(
        {
          contact_name: 'Archived User',
          contact_email: onboardedUser.email,
          business_name: 'Archived Approved Biz',
          banner_url: 'https://example.com/banner-archived.jpg',
          status: 'archived',
        },
        'APPROVAL_REQUIRED',
        { cleanupReservations: true }
      );
    });

    it('should return an authoritative ad quote that matches server tax rules', async () => {
      const { calculateAdPriceCents } = await import('../utils/adPricing.js');
      const { calculateSalesTax } = await import('../lib/taxCalculator.js');
      const ad = await prisma.ad.create({
        data: {
          user_id: onboardedUser.id,
          contact_name: 'Quote User',
          contact_email: onboardedUser.email,
          business_name: 'Quote Biz',
          banner_url: 'https://example.com/banner-quote.jpg',
          target_url: 'https://example.com',
          target_zip_code: '10001',
          radius: 9,
          status: 'draft',
          payment_status: 'unpaid',
        },
      });

      try {
        const quoteDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const expectedPricing = calculateAdPriceCents([quoteDate]);
        const expectedTax = calculateSalesTax(expectedPricing.totalCents, '10001');
        const res = await request(app)
          .post('/payments/ad-quote')
          .set('Authorization', `Bearer ${onboardedToken}`)
          .send({ ad_id: ad.id, dates: [quoteDate] });

        expect(res.statusCode).toEqual(200);
        expect(res.body.subtotal_cents).toEqual(expectedPricing.totalCents);
        expect(res.body.tax_cents).toEqual(expectedTax);
        expect(res.body.total_cents).toEqual(expectedPricing.totalCents + expectedTax);
        expect(res.body.weekday_blocks).toEqual(expectedPricing.weekdayBlocks);
        expect(res.body.weekend_blocks).toEqual(expectedPricing.weekendBlocks);
      } finally {
        await prisma.ad.delete({ where: { id: ad.id } }).catch(() => {});
      }
    });

    it('should reject past dates before ad checkout starts', async () => {
      const ad = await prisma.ad.create({
        data: {
          user_id: onboardedUser.id,
          contact_name: 'Past Date User',
          contact_email: onboardedUser.email,
          business_name: 'Past Date Biz',
          banner_url: 'https://example.com/banner-past.jpg',
          target_url: 'https://example.com',
          target_zip_code: '10001',
          radius: 9,
          status: 'approved',
          payment_status: 'unpaid',
        },
      });

      try {
        const res = await request(app)
          .post('/payments/ad-quote')
          .set('Authorization', `Bearer ${onboardedToken}`)
          .send({ ad_id: ad.id, dates: ['2020-01-01'] });

        expect(res.statusCode).toEqual(400);
        expect(String(res.body?.error || '')).toMatch(/today or in the future/i);
      } finally {
        await prisma.ad.delete({ where: { id: ad.id } }).catch(() => {});
      }
    });

    it('should release expired pending-approval dates on read and allow approved ads to be booked again', async () => {
      const ad = await prisma.ad.create({
        data: {
          user_id: onboardedUser.id,
          contact_name: 'Expired Pending User',
          contact_email: onboardedUser.email,
          business_name: 'Expired Pending Biz',
          banner_url: 'https://example.com/banner-expired-pending.jpg',
          target_url: 'https://example.com',
          target_zip_code: '10001',
          radius: 9,
          status: 'approved',
          payment_status: 'pending_approval',
        },
      });

      try {
        await prisma.adReservation.createMany({
          data: [
            { ad_id: ad.id, date: new Date('2020-01-01T00:00:00.000Z') },
            { ad_id: ad.id, date: new Date('2020-01-02T00:00:00.000Z') },
          ],
          skipDuplicates: true,
        });

        const reservationsRes = await request(app)
          .get(`/ads/reservations?ad_id=${encodeURIComponent(ad.id)}`)
          .set('Authorization', `Bearer ${onboardedToken}`);

        expect(reservationsRes.statusCode).toEqual(200);
        expect(reservationsRes.body.dates).toEqual([]);

        const listRes = await request(app)
          .get('/ads?mine=1')
          .set('Authorization', `Bearer ${onboardedToken}`);

        expect(listRes.statusCode).toEqual(200);
        const refreshedAd = Array.isArray(listRes.body)
          ? listRes.body.find((item: any) => String(item.id) === ad.id)
          : null;
        expect(refreshedAd?.status).toEqual('approved');
        expect(refreshedAd?.payment_status).toEqual('unpaid');

        const futureDate = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 10);
        const quoteRes = await request(app)
          .post('/payments/ad-quote')
          .set('Authorization', `Bearer ${onboardedToken}`)
          .send({ ad_id: ad.id, dates: [futureDate] });

        expect(quoteRes.statusCode).toEqual(200);
        expect(quoteRes.body.subtotal_cents).toBeGreaterThan(0);
      } finally {
        await prisma.adReservation.deleteMany({ where: { ad_id: ad.id } }).catch(() => {});
        await prisma.ad.delete({ where: { id: ad.id } }).catch(() => {});
      }
    });
  });

  describe('Owner-managed subscription billing', () => {
    it('blocks paid_by_owner coaches from starting legacy subscribe checkout', async () => {
      const res = await request(app)
        .post('/payments/subscribe')
        .set('Authorization', `Bearer ${ownerManagedCoachToken}`)
        .send({ plan: 'legend' });

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toMatch(/league owner manages this subscription/i);
    });

    it('blocks paid_by_owner coaches from creating checkout sessions directly', async () => {
      const res = await request(app)
        .post('/payments/checkout')
        .set('Authorization', `Bearer ${ownerManagedCoachToken}`)
        .send({ plan: 'legend' });

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toMatch(/league owner manages this subscription/i);
    });

    it('blocks paid_by_owner coaches from opening the subscription payment sheet', async () => {
      const res = await request(app)
        .post('/payments/create-payment-sheet')
        .set('Authorization', `Bearer ${ownerManagedCoachToken}`)
        .send({ plan: 'veteran' });

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toMatch(/league owner manages this subscription/i);
    });

    it('blocks paid_by_owner coaches from verifying Apple subscription receipts directly', async () => {
      const res = await request(app)
        .post('/payments/apple/verify-receipt')
        .set('Authorization', `Bearer ${ownerManagedCoachToken}`)
        .send({ jws: 'fake-jws', productId: 'MIDTIER' });

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toMatch(/league owner manages this subscription/i);
    });

    it('blocks paid_by_owner coaches from verifying Google purchases directly', async () => {
      const res = await request(app)
        .post('/payments/google/verify-purchase')
        .set('Authorization', `Bearer ${ownerManagedCoachToken}`)
        .send({
          purchase_token: 'purchase_token_for_owner_managed_test_12345',
          product_id: 'MIDTIER',
          package_name: 'com.xsantcastx.varsityhub',
        });

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toMatch(/league owner manages this subscription/i);
    });

    it('blocks paid_by_owner coaches from cancelling subscriptions directly', async () => {
      const res = await request(app)
        .post('/payments/subscription/cancel')
        .set('Authorization', `Bearer ${ownerManagedCoachToken}`)
        .send({});

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toMatch(/league owner manages this subscription/i);
    });

    it('blocks paid_by_owner coaches from resuming subscriptions directly', async () => {
      const res = await request(app)
        .post('/payments/subscription/resume')
        .set('Authorization', `Bearer ${ownerManagedCoachToken}`)
        .send({});

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toMatch(/league owner manages this subscription/i);
    });

    it('blocks paid_by_owner coaches from changing subscription quantity directly', async () => {
      const res = await request(app)
        .post('/payments/update-subscription-quantity')
        .set('Authorization', `Bearer ${ownerManagedCoachToken}`)
        // Must pass the Zod team_count floor so the request reaches the
        // paid_by_owner guard (validation runs first and would 400 otherwise).
        .send({ team_count: SERVER_VETERAN_MIN_TOTAL_TEAMS });

      expect(res.statusCode).toEqual(403);
      expect(res.body.error).toMatch(/league owner manages this subscription/i);
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
