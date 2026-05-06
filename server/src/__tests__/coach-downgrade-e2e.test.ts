import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';

let prisma: any;
let request: any;
let app: import('express').Express;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';
const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkip = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkip ? describe.skip : describe;

function adultDob(): Date {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - 30);
  return d;
}

describeDb('POST /auth/downgrade-to-fan', () => {
  const userIds: string[] = [];
  const orgIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    request = (await import('supertest')).default;
    ({ app } = await import('../authTestApp.js'));
  });

  afterAll(async () => {
    await prisma.teamMembership.deleteMany({ where: { user_id: { in: userIds } } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { user_id: { in: userIds } } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  });

  it('downgrades an unattached rookie coach back to fan', async () => {
    const coach = await prisma.user.create({
      data: {
        email: `coach-downgrade-${ts}@example.com`,
        password_hash: await bcrypt.hash(PASSWORD, 10),
        display_name: 'Downgrade Coach',
        email_verified: true,
        approval_status: 'APPROVED',
        role: 'coach',
        onboarding_completed: true,
        date_of_birth: adultDob(),
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
          coach_agreement_version: 1,
        },
      },
    });
    userIds.push(coach.id);
    const token = signJwt({ id: coach.id });

    const res = await request(app)
      .post('/auth/downgrade-to-fan')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const updated = await prisma.user.findUnique({ where: { id: coach.id } });
    expect(updated).not.toBeNull();
    const prefs = updated!.preferences as any;
    expect(updated!.role).toBe('fan');
    expect(updated!.approval_status).toBe('APPROVED');
    expect(updated!.organization_id).toBeNull();
    expect(updated!.paid_by_owner).toBe(false);
    expect(prefs.role).toBe('fan');
    expect(prefs.plan).toBe('rookie');
    expect(prefs.coach_agreement_accepted_at).toBeUndefined();
    expect(prefs.coach_agreement_version).toBeUndefined();
  });

  it('blocks downgrade while the coach still owns an organization', async () => {
    const owner = await prisma.user.create({
      data: {
        email: `coach-downgrade-owner-${ts}@example.com`,
        password_hash: await bcrypt.hash(PASSWORD, 10),
        display_name: 'Owning Coach',
        email_verified: true,
        approval_status: 'APPROVED',
        role: 'coach',
        onboarding_completed: true,
        date_of_birth: adultDob(),
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
        },
      },
    });
    userIds.push(owner.id);

    const org = await prisma.organization.create({
      data: {
        name: `Downgrade Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        league_owner_id: owner.id,
      },
      select: { id: true },
    });
    orgIds.push(org.id);

    await prisma.organizationMembership.createMany({
      data: [
        {
          organization_id: org.id,
          user_id: owner.id,
          role: 'owner',
          status: 'active',
        },
      ],
    });

    const token = signJwt({ id: owner.id });
    const res = await request(app)
      .post('/auth/downgrade-to-fan')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('ORG_OWNERSHIP_TRANSFER_REQUIRED');

    const unchanged = await prisma.user.findUnique({ where: { id: owner.id } });
    expect(unchanged?.role).toBe('coach');
  });
});
