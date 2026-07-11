/**
 * GET /teams/limits — program-based, per-rail, `metered` flag (Phase 4).
 *
 * Reworks the limits response to count billable SPORT PROGRAMS (not raw
 * team count) and to enforce each plan rail differently:
 *   - Rookie: free floor of SERVER_ROOKIE_PROGRAM_LIMIT (5) programs.
 *   - Veteran IAP (no Stripe subscription_id): unlimited, not metered —
 *     this is also the bug fix: the old handler derived `max_teams` from
 *     `ownedTeamsCount` but compared it against a program-based allowance,
 *     so "remaining" was wrong, and IAP veterans with no subscription_id
 *     were incorrectly reported as blocked (can_create_more=false).
 *   - Veteran Stripe (subscription_id present): metered=true, allowance
 *     comes from getVeteranSubscriptionAllowance (5 + Stripe quantity).
 *   - Legend: unlimited, not metered.
 *
 * Harness modeled on veteran-rail-gate.test.ts and
 * program-limit-enforcement.test.ts (same app bootstrap, stripe mock, and
 * seedActiveProgram helper that bypasses the route to avoid burning the
 * team-creation rate limit).
 */
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import request from 'supertest';

// Mock the 'stripe' package's subscriptions.retrieve so the Stripe-rail case
// doesn't need a live Stripe subscription. getVeteranSubscriptionAllowance
// (server/src/routes/teams.ts) does `await import('stripe')` then
// `new stripeLib.default(...)`, so mocking the default export here is
// intercepted by that dynamic import.
const mockRetrieve = jest.fn(async () => ({
  status: 'active',
  items: { data: [{ quantity: 2 }] },
}));

jest.unstable_mockModule('stripe', () => ({
  default: class MockStripe {
    subscriptions = { retrieve: mockRetrieve };
  },
}));

const { app } = await import('../testApp.js');

let prisma: any;
let signJwt: any;

const ts = Date.now();
const ROOKIE_EMAIL = `test-limits-rookie-${ts}@example.com`;
const IAP_EMAIL = `test-limits-veteran-iap-${ts}@example.com`;
const STRIPE_EMAIL = `test-limits-veteran-stripe-${ts}@example.com`;
const PASSWORD = 'TestPassword123!';

let rookieId: string, rookieToken: string;
let iapVeteranId: string, iapVeteranToken: string;
let stripeVeteranId: string, stripeVeteranToken: string;
let rookieOrgId: string;
let iapOrgId: string;
let stripeOrgId: string;
const seededProgramIds: string[] = [];
const seededTeamIds: string[] = [];

async function createOrgForUser(userId: string, orgName: string): Promise<string> {
  const org = await prisma.organization.create({
    data: {
      name: orgName,
      description: 'Test org',
      org_type: 'club',
      admin_approved: true,
      approved_at: new Date(),
      league_owner_id: userId,
      updated_at: new Date(),
    },
  });
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: userId, role: 'owner' },
  });
  return org.id;
}

// Seeds a SportProgram with one active team owned by `userId` — bypasses the
// route entirely so seeding doesn't burn the 5/day team-creation rate limit.
async function seedActiveProgram(orgId: string, userId: string, sportSlug: string) {
  const program = await prisma.sportProgram.create({
    data: { organization_id: orgId, sport: sportSlug },
  });
  const team = await prisma.team.create({
    data: {
      name: `${sportSlug} Varsity ${ts}`,
      organization_id: orgId,
      program_id: program.id,
      sport: sportSlug,
      status: 'active',
    },
  });
  await prisma.teamMembership.create({
    data: { team_id: team.id, user_id: userId, role: 'owner', status: 'active' },
  });
  seededProgramIds.push(program.id);
  seededTeamIds.push(team.id);
  return { programId: program.id as string, teamId: team.id as string };
}

async function getLimits(token: string) {
  return request(app).get('/teams/limits').set('Authorization', `Bearer ${token}`);
}

async function createVeteranUser(email: string, displayName: string) {
  const bcrypt = (await import('bcrypt')).default;
  const hash = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password_hash: hash,
      display_name: displayName,
      email_verified: true,
      role: 'coach',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      plan: 'veteran',
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        plan: 'veteran',
        coach_agreement_accepted_at: new Date().toISOString(),
      },
    },
  });
  return { id: user.id as string, token: signJwt({ id: user.id }) as string };
}

beforeAll(async () => {
  ({ prisma } = await import('../lib/prisma.js'));
  ({ signJwt } = await import('../lib/jwt.js'));

  const { createTestUser } = await import('./helpers/createTestUser.js');

  ({ id: rookieId, token: rookieToken } = await createTestUser({
    prisma,
    signJwt,
    password: PASSWORD,
    email: ROOKIE_EMAIL,
    displayName: 'Limits Rookie Coach',
    role: 'coach',
    plan: 'rookie',
  }));
  rookieOrgId = await createOrgForUser(rookieId, `Limits Rookie League ${ts}`);

  // Rookie at the 5-program free floor.
  const sports5 = ['basketball', 'soccer', 'baseball', 'football', 'volleyball'];
  for (const sport of sports5) {
    await seedActiveProgram(rookieOrgId, rookieId, sport);
  }

  // IAP veteran: no Stripe subscription_id — stamp an apple_product_id
  // instead, matching a real flat-tier mobile purchase.
  ({ id: iapVeteranId, token: iapVeteranToken } = await createVeteranUser(
    IAP_EMAIL,
    'Limits IAP Veteran Coach'
  ));
  await prisma.user.update({
    where: { id: iapVeteranId },
    data: {
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        plan: 'veteran',
        coach_agreement_accepted_at: new Date().toISOString(),
        apple_product_id: 'com.varsityhub.veteran.monthly',
      },
    },
  });
  iapOrgId = await createOrgForUser(iapVeteranId, `Limits IAP Veteran League ${ts}`);
  for (const sport of sports5) {
    await seedActiveProgram(iapOrgId, iapVeteranId, sport);
  }

  // Stripe veteran: subscription_id present, mocked quantity=2 =>
  // totalTeamAllowance = 5 + 2 = 7.
  ({ id: stripeVeteranId, token: stripeVeteranToken } = await createVeteranUser(
    STRIPE_EMAIL,
    'Limits Stripe Veteran Coach'
  ));
  await prisma.user.update({
    where: { id: stripeVeteranId },
    data: {
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        plan: 'veteran',
        coach_agreement_accepted_at: new Date().toISOString(),
        subscription_id: 'sub_test_limits_veteran',
      },
    },
  });
  stripeOrgId = await createOrgForUser(stripeVeteranId, `Limits Stripe Veteran League ${ts}`);
  for (const sport of sports5) {
    await seedActiveProgram(stripeOrgId, stripeVeteranId, sport);
  }
});

afterAll(async () => {
  try {
    if (seededTeamIds.length) {
      await prisma.teamMembership.deleteMany({ where: { team_id: { in: seededTeamIds } } });
      await prisma.team.deleteMany({ where: { id: { in: seededTeamIds } } });
    }
    if (seededProgramIds.length) {
      await prisma.sportProgram.deleteMany({ where: { id: { in: seededProgramIds } } });
    }
    const orgIds = [rookieOrgId, iapOrgId, stripeOrgId].filter(Boolean);
    if (orgIds.length) {
      await prisma.organizationMembership.deleteMany({
        where: { organization_id: { in: orgIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    const userIds = [rookieId, iapVeteranId, stripeVeteranId].filter(Boolean);
    if (userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  } catch (e) {
    console.warn('Cleanup error (non-critical):', e);
  }
});

describe('GET /teams/limits — Rookie rail', () => {
  it('reports the 5-program free floor as exhausted', async () => {
    const res = await getLimits(rookieToken);
    expect(res.status).toBe(200);
    expect(res.body.owned_programs).toBe(5);
    expect(res.body.max_programs).toBe(5);
    expect(res.body.metered).toBe(false);
    expect(res.body.can_create_more).toBe(false);
    // Legacy fields stay populated for older client bundles.
    expect(res.body.owned_teams).toBe(5);
    expect(res.body.max_teams).toBe(5);
    expect(res.body.remaining).toBe(0);
    expect(res.body.upgrade_required).toBe(true);
  });
});

describe('GET /teams/limits — Veteran IAP rail (regression)', () => {
  it('is unlimited and not metered even with 5 active programs and no subscription_id', async () => {
    const res = await getLimits(iapVeteranToken);
    expect(res.status).toBe(200);
    expect(res.body.owned_programs).toBe(5);
    expect(res.body.max_programs).toBeNull();
    expect(res.body.metered).toBe(false);
    // The bug: can_create_more must be true — a flat-tier IAP purchase has
    // no Stripe quantity to meter against, so it must never read as blocked.
    expect(res.body.can_create_more).toBe(true);
    expect(res.body.upgrade_required).toBe(false);
    // Legacy display value for "unlimited".
    expect(res.body.max_teams).toBe(999);
  });
});

describe('GET /teams/limits — Veteran Stripe rail', () => {
  it('is metered against the Stripe allowance (5 + quantity 2 = 7)', async () => {
    const res = await getLimits(stripeVeteranToken);
    expect(res.status).toBe(200);
    expect(mockRetrieve).toHaveBeenCalledWith('sub_test_limits_veteran');
    expect(res.body.owned_programs).toBe(5);
    expect(res.body.max_programs).toBe(7);
    expect(res.body.metered).toBe(true);
    expect(res.body.can_create_more).toBe(true);
    expect(res.body.remaining).toBe(2);
    // Legacy fields mirror the program-based values now.
    expect(res.body.owned_teams).toBe(5);
    expect(res.body.max_teams).toBe(7);
  });
});
