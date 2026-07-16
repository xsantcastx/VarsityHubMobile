import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();

async function makeOnboardedUser(prisma: any, signJwt: any, tag: string) {
  const u = await prisma.user.create({
    data: {
      email: `xfer-ep-${tag}-${ts}@example.com`,
      password_hash: await bcrypt.hash('TestPassword123!', 10),
      display_name: `Xfer ${tag}`,
      email_verified: true,
      role: 'coach',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      date_of_birth: new Date('1990-01-01'),
      coach_agreement_accepted_at: new Date().toISOString(),
      preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
    },
  });
  return { id: u.id as string, token: signJwt({ id: u.id }) as string };
}

describe('Accept-based ownership transfer endpoints', () => {
  let owner: { id: string; token: string };
  let recipient: { id: string; token: string };
  let outsider: { id: string; token: string };
  let orgId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    owner = await makeOnboardedUser(prisma, signJwt, 'owner');
    recipient = await makeOnboardedUser(prisma, signJwt, 'recip');
    outsider = await makeOnboardedUser(prisma, signJwt, 'out');
  });

  beforeEach(async () => {
    const org = await prisma.organization.create({
      data: {
        name: `XferEp Org ${ts}-${Math.round(Math.random() * 1e9)}`,
        league_owner_id: owner.id,
        admin_approved: true,
        status: 'active',
      },
      select: { id: true },
    });
    orgId = org.id;
    await prisma.organizationMembership.createMany({
      data: [
        { organization_id: orgId, user_id: owner.id, role: 'owner', status: 'active' },
        { organization_id: orgId, user_id: recipient.id, role: 'manager', status: 'active' },
      ],
    });
  });

  it('initiate returns pending, does NOT move ownership, and notifies the recipient', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/transfer-ownership`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ new_owner_id: recipient.id });
    expect(res.status).toBe(200);
    expect(res.body.pending).toBe(true);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { league_owner_id: true },
    });
    expect(org.league_owner_id).toBe(owner.id); // unchanged — not moved yet

    const notif = await prisma.notification.findFirst({
      where: { user_id: recipient.id, type: 'ORG_OWNERSHIP_TRANSFER_OFFER' },
      orderBy: { created_at: 'desc' },
    });
    expect(notif).toBeTruthy();
  });

  it('recipient accept moves ownership; league_owner_id flips', async () => {
    await request(app)
      .post(`/organizations/${orgId}/transfer-ownership`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ new_owner_id: recipient.id });

    const res = await request(app)
      .post(`/organizations/${orgId}/transfer-ownership/accept`)
      .set('Authorization', `Bearer ${recipient.token}`)
      .send({});
    expect(res.status).toBe(200);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { league_owner_id: true },
    });
    expect(org.league_owner_id).toBe(recipient.id);
  });

  it('a non-recipient cannot accept', async () => {
    await request(app)
      .post(`/organizations/${orgId}/transfer-ownership`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ new_owner_id: recipient.id });

    const res = await request(app)
      .post(`/organizations/${orgId}/transfer-ownership/accept`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({});
    expect(res.status).toBe(400);

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { league_owner_id: true },
    });
    expect(org.league_owner_id).toBe(owner.id); // still the original owner
  });

  it('a non-owner cannot initiate', async () => {
    const res = await request(app)
      .post(`/organizations/${orgId}/transfer-ownership`)
      .set('Authorization', `Bearer ${recipient.token}`)
      .send({ new_owner_id: outsider.id });
    expect(res.status).toBe(400);
  });

  it('GET /:id surfaces the pending transfer to both sides', async () => {
    await request(app)
      .post(`/organizations/${orgId}/transfer-ownership`)
      .set('Authorization', `Bearer ${owner.token}`)
      .send({ new_owner_id: recipient.id });

    const res = await request(app)
      .get(`/organizations/${orgId}`)
      .set('Authorization', `Bearer ${recipient.token}`);
    expect(res.status).toBe(200);
    expect(res.body.pending_ownership_transfer?.to_user_id).toBe(recipient.id);
    expect(res.body.pending_ownership_transfer?.from_user_id).toBe(owner.id);
  });

  afterAll(async () => {
    const orgs = await prisma.organization.findMany({
      where: { name: { startsWith: `XferEp Org ${ts}` } },
      select: { id: true },
      take: 200,
    });
    const orgIds = orgs.map((o: any) => o.id);
    await prisma.organizationOwnershipTransfer.deleteMany({ where: { organization_id: { in: orgIds } } });
    await prisma.organizationMembership.deleteMany({ where: { organization_id: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.notification.deleteMany({
      where: { user_id: { in: [owner.id, recipient.id, outsider.id] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, recipient.id, outsider.id] } } });
    await prisma.$disconnect();
  });
});
