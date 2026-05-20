/**
 * Regression: POST /organizations/create bulk-invite guards
 *
 * The onboarding org-create flow accepts an authorized_users array and creates
 * pending invites with `prisma.organizationInvite.createMany`. Before the fix,
 * that path:
 *   1. persisted the client-supplied role verbatim (so a malicious client could
 *      mint an `owner`/`admin` invite and bypass the role whitelist enforced on
 *      the standard /:id/invite endpoint), and
 *   2. ignored the per-org authorized-user plan cap (so a Rookie org could be
 *      seeded with more pending invites than the plan allows).
 *
 * The fix runs both the role whitelist and the cap check BEFORE the
 * org-creation transaction, so a rejected request must not leak a partial org.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

const __skipDbIntegrationSuites =
  String(process.env.CI ?? '').toLowerCase() === 'true' || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = __skipDbIntegrationSuites ? describe.skip : describe;



let prisma: any;
let signJwt: any;

const TEST_PASSWORD = 'TestPassword123!';

describeDb('POST /organizations/create bulk-invite guards', () => {
  let coachUserId: string;
  let coachToken: string;
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const coach = await prisma.user.create({
      data: {
        email: `org-create-invite-coach-${Date.now()}@example.com`,
        password_hash: await bcrypt.hash(TEST_PASSWORD, 10),
        display_name: 'Invite Guard Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        plan: 'rookie',
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    coachUserId = coach.id;
    coachToken = signJwt({ id: coachUserId });
  });

  afterAll(async () => {
    try {
      if (createdOrgIds.length > 0) {
        await prisma.organizationInvite.deleteMany({
          where: { organization_id: { in: createdOrgIds } },
        });
        await prisma.organizationMembership.deleteMany({
          where: { organization_id: { in: createdOrgIds } },
        });
        await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
      }
      // Belt-and-suspenders: scrub any orphan org/membership the fix is meant to prevent.
      await prisma.organizationMembership.deleteMany({ where: { user_id: coachUserId } });
      await prisma.organization.deleteMany({ where: { league_owner_id: coachUserId } });
      await prisma.user.deleteMany({ where: { id: coachUserId } });
    } catch (err) {
      console.warn('cleanup error (non-critical):', err);
    }
  });

  beforeEach(async () => {
    // Each test runs fresh: clear prefs.organization_id so the route doesn't
    // hit the "already has org" branch from a previous successful test.
    await prisma.user.update({
      where: { id: coachUserId },
      data: {
        approval_status: 'APPROVED',
        rejected_at: null,
        rejection_reason: null,
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
  });

  function basePayload(name: string) {
    return {
      name,
      org_type: 'club',
      sport: 'soccer',
      supporting_document_url: 'https://example.com/doc.pdf',
    };
  }

  it('rejects bulk invites that try to mint an owner role', async () => {
    const orgName = `Invite Guard Owner ${Date.now()}`;
    const response = await request(app)
      .post('/organizations/create')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        ...basePayload(orgName),
        authorized_users: [{ email: 'newowner@example.com', role: 'owner' }],
      })
      .expect(400);

    expect(response.body.code).toBe('INVALID_INVITE_ROLE');

    // Verify NO org leaked through the transaction.
    const leaked = await prisma.organization.findFirst({
      where: { name: { equals: orgName, mode: 'insensitive' } },
      select: { id: true },
    });
    expect(leaked).toBeNull();
  });

  it('rejects bulk invites with any non-whitelisted role', async () => {
    const orgName = `Invite Guard Admin ${Date.now()}`;
    const response = await request(app)
      .post('/organizations/create')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        ...basePayload(orgName),
        authorized_users: [
          { email: 'staff1@example.com', role: 'manager' }, // valid
          { email: 'staff2@example.com', role: 'admin' }, // not whitelisted
        ],
      })
      .expect(400);

    expect(response.body.code).toBe('INVALID_INVITE_ROLE');

    const leaked = await prisma.organization.findFirst({
      where: { name: { equals: orgName, mode: 'insensitive' } },
      select: { id: true },
    });
    expect(leaked).toBeNull();
  });

  it('rejects bulk invites that would exceed the rookie authorized-user cap', async () => {
    // Rookie plan: fixed cap of 6 authorized users per org. Owner consumes 1
    // seat, leaving 5 invites max. Sending 6 invites yields totalAuthorized=7,
    // which must trip USER_LIMIT_REACHED.
    const orgName = `Invite Guard Cap ${Date.now()}`;
    const tooMany = Array.from({ length: 6 }, (_, i) => ({
      email: `cap${i}-${Date.now()}@example.com`,
      role: 'member' as const,
    }));

    const response = await request(app)
      .post('/organizations/create')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        ...basePayload(orgName),
        authorized_users: tooMany,
      })
      .expect(403);

    expect(response.body.error).toBe('USER_LIMIT_REACHED');
    expect(response.body.limit).toBe(6);
    expect(response.body.current).toBe(7);

    const leaked = await prisma.organization.findFirst({
      where: { name: { equals: orgName, mode: 'insensitive' } },
      select: { id: true },
    });
    expect(leaked).toBeNull();
  });

  it('allows valid roles within the cap and persists invites', async () => {
    const orgName = `Invite Guard Happy ${Date.now()}`;
    const validInvites = [
      { email: `happy-mgr-${Date.now()}@example.com`, role: 'manager' as const },
      { email: `happy-mem-${Date.now()}@example.com`, role: 'member' as const },
    ];

    const response = await request(app)
      .post('/organizations/create')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        ...basePayload(orgName),
        authorized_users: validInvites,
      })
      .expect(201);

    expect(response.body.id).toBeDefined();
    createdOrgIds.push(response.body.id);

    const invites = await prisma.organizationInvite.findMany({
      where: { organization_id: response.body.id },
      select: { email: true, role: true },
      orderBy: { email: 'asc' },
    });
    expect(invites).toHaveLength(2);
    expect(invites.map((i: any) => i.role).sort()).toEqual(['manager', 'member']);
  });
});
