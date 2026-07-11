/**
 * Veteran per-rail enforcement (Phase 4 billing re-unit) — the bug fix.
 *
 * Veteran has two billing rails and they must be enforced differently:
 *   - IAP (Apple/Google flat MIDTIER, no Stripe subscription_id in
 *     preferences): per-unit metering is impossible on a flat purchase, so
 *     the rail grants UNLIMITED sport programs. Before this fix, the
 *     absence of subscription_id threw NO_ACTIVE_SUBSCRIPTION and blocked
 *     every mobile veteran from creating any team past their existing set.
 *   - Stripe (subscription_id present): still metered, gated on
 *     allowance.totalTeamAllowance computed over billable programs
 *     (5 + Stripe quantity).
 *
 * Modeled on the harness in role-tier-enforcement.test.ts (same app
 * bootstrap + auth-token helper).
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
const IAP_EMAIL = `test-veteran-iap-${ts}@example.com`;
const STRIPE_EMAIL = `test-veteran-stripe-${ts}@example.com`;
const PASSWORD = 'TestPassword123!';

let iapVeteranId: string, iapVeteranToken: string;
let stripeVeteranId: string, stripeVeteranToken: string;
let iapOrgId: string;
let stripeOrgId: string;
const seededProgramIds: string[] = [];
const seededTeamIds: string[] = [];
const createdTeamIds: string[] = [];

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

async function createTeamViaApi(
  token: string,
  teamName: string,
  organizationId: string,
  sport?: string
) {
  return request(app)
    .post('/teams/create')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: teamName,
      description: `${teamName} description`,
      organization_id: organizationId,
      club_type: 'sport',
      // Pass a real sport so each distinct sport is a distinct program. Without
      // it the server groups every sport-less team into one 'other' program, so
      // "N differently-named teams" would NOT be N distinct billable programs.
      ...(sport ? { sport } : {}),
    });
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

  ({ id: iapVeteranId, token: iapVeteranToken } = await createVeteranUser(
    IAP_EMAIL,
    'IAP Veteran Coach'
  ));
  // IAP veteran: no Stripe subscription_id — stamp an apple_product_id
  // instead, matching a real flat-tier mobile purchase.
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

  ({ id: stripeVeteranId, token: stripeVeteranToken } = await createVeteranUser(
    STRIPE_EMAIL,
    'Stripe Veteran Coach'
  ));
  await prisma.user.update({
    where: { id: stripeVeteranId },
    data: {
      preferences: {
        role: 'coach',
        onboarding_completed: true,
        plan: 'veteran',
        coach_agreement_accepted_at: new Date().toISOString(),
        subscription_id: 'sub_test_veteran_rail',
      },
    },
  });

  iapOrgId = await createOrgForUser(iapVeteranId, `IAP Veteran League ${ts}`);
  stripeOrgId = await createOrgForUser(stripeVeteranId, `Stripe Veteran League ${ts}`);

  // Seed 5 active sport programs for each veteran — the rookie-equivalent
  // free floor. IAP veteran should still be able to add a 6th (unlimited);
  // Stripe veteran's mocked subscription quantity=2 => totalTeamAllowance=7,
  // so their 6th program should also succeed but the 8th should not.
  const sports5 = ['basketball', 'soccer', 'baseball', 'football', 'volleyball'];
  for (const sport of sports5) {
    await seedActiveProgram(iapOrgId, iapVeteranId, sport);
    await seedActiveProgram(stripeOrgId, stripeVeteranId, sport);
  }
});

afterAll(async () => {
  try {
    const allTeamIds = [...seededTeamIds, ...createdTeamIds].filter(Boolean);
    if (allTeamIds.length) {
      await prisma.teamMembership.deleteMany({ where: { team_id: { in: allTeamIds } } });
      await prisma.team.deleteMany({ where: { id: { in: allTeamIds } } });
    }
    if (seededProgramIds.length) {
      await prisma.sportProgram.deleteMany({ where: { id: { in: seededProgramIds } } });
    }
    const orgIds = [iapOrgId, stripeOrgId].filter(Boolean);
    if (orgIds.length) {
      await prisma.organizationMembership.deleteMany({
        where: { organization_id: { in: orgIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    }
    const userIds = [iapVeteranId, stripeVeteranId].filter(Boolean);
    if (userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
  } catch (e) {
    console.warn('Cleanup error (non-critical):', e);
  }
});

describe('Veteran IAP rail — unlimited programs (regression)', () => {
  it('a veteran with NO subscription_id can create a team in a 6th sport (no NO_ACTIVE_SUBSCRIPTION)', async () => {
    const res = await createTeamViaApi(
      iapVeteranToken,
      `IAP Veteran Tennis ${ts}`,
      iapOrgId,
      'tennis'
    );
    expect(res.body.code).not.toBe('NO_ACTIVE_SUBSCRIPTION');
    expect(res.status).toBe(201);
    createdTeamIds.push(res.body.team.id);
  });
});

describe('Veteran Stripe rail — metered by program', () => {
  it('a veteran with a subscription_id routes through the Stripe allowance path and is granted the 6th sport (quantity=2 => allowance 7)', async () => {
    const res = await createTeamViaApi(
      stripeVeteranToken,
      `Stripe Veteran Tennis ${ts}`,
      stripeOrgId,
      'tennis'
    );
    expect(mockRetrieve).toHaveBeenCalledWith('sub_test_veteran_rail');
    expect(res.status).toBe(201);
    createdTeamIds.push(res.body.team.id);
  });

  it('the same veteran is blocked once billable programs reach the Stripe allowance (7)', async () => {
    // Programs now: 5 seeded + 1 created above = 6. One more brand-new sport
    // reaches the allowance of 7 (5 + quantity 2), so this 7th program is
    // still allowed but the 8th is not — add one more to hit the boundary.
    const res1 = await createTeamViaApi(
      stripeVeteranToken,
      `Stripe Veteran Lacrosse ${ts}`,
      stripeOrgId,
      'lacrosse'
    );
    expect(res1.status).toBe(201);
    createdTeamIds.push(res1.body.team.id);

    const res2 = await createTeamViaApi(
      stripeVeteranToken,
      `Stripe Veteran Hockey ${ts}`,
      stripeOrgId,
      'ice_hockey'
    );
    expect(res2.status).toBe(403);
    expect(res2.body.code).toBe('SUBSCRIPTION_QUANTITY_EXCEEDED');
    expect(res2.body.allowed_total_programs).toBe(7);
  });
});
