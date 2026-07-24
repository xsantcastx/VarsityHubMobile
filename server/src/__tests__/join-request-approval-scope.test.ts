/**
 * Join-request approval scoping.
 *
 * A join request is a decision about ONE organization, but `approval_status`,
 * `paid_by_owner`, and `organization_id` are global User columns. Writing them
 * on every join request let an unrelated org owner disable an established
 * league owner's account:
 *
 *   1. Coach A (APPROVED) owns approved Org A and runs teams there.
 *   2. Coach A requests to join Org B  -> A demoted to PENDING, locked out of Org A.
 *   3. Org B's owner denies            -> A becomes REJECTED with a 48h cooldown.
 *
 * Invariant: a coach who already owns an approved organization keeps their
 * APPROVED status, their billing flag, and their active org through both the
 * request and a third party's denial. Coaches with no approved org of their
 * own still go PENDING/REJECTED as before — that is the vetting funnel.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();

async function makeCoach(tag: string, approved: boolean) {
  return prisma.user.create({
    data: {
      email: `jras-${tag}-${ts}@example.com`,
      username: `jras${tag}${String(ts).slice(-8)}`,
      password_hash: 'x',
      display_name: `JRAS ${tag}`,
      email_verified: true,
      role: 'coach',
      onboarding_completed: true,
      approval_status: approved ? 'APPROVED' : 'PENDING',
      coach_agreement_accepted_at: new Date(),
      coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
      preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
    },
  });
}

async function makeOrg(name: string, ownerId: string, adminApproved: boolean) {
  const org = await prisma.organization.create({
    data: {
      name: `${name} ${ts}`,
      league_owner_id: ownerId,
      admin_approved: adminApproved,
      approved_at: adminApproved ? new Date() : null,
      supporting_document_url: 'https://example.com/doc.pdf',
      updated_at: new Date(),
    },
  });
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: ownerId, role: 'owner', status: 'active' },
  });
  return org;
}

describe('join-request approval scoping', () => {
  let ownerCoachId: string;
  let ownerCoachToken: string;
  let ownOrgId: string;

  let plainCoachId: string;
  let plainCoachToken: string;

  let hostOwnerId: string;
  let hostOwnerToken: string;
  let hostOrgId: string;
  // Second host org so the approve case gets a fresh request instead of
  // colliding with the denial (and its 7-day re-apply cooldown) above.
  let hostOrg2Id: string;

  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const ownerCoach = await makeCoach('owner', true);
    ownerCoachId = ownerCoach.id;
    ownerCoachToken = signJwt({ id: ownerCoachId });

    const plainCoach = await makeCoach('plain', true);
    plainCoachId = plainCoach.id;
    plainCoachToken = signJwt({ id: plainCoachId });

    const hostOwner = await makeCoach('host', true);
    hostOwnerId = hostOwner.id;
    hostOwnerToken = signJwt({ id: hostOwnerId });

    createdUserIds.push(ownerCoachId, plainCoachId, hostOwnerId);

    const ownOrg = await makeOrg('JRAS Own League', ownerCoachId, true);
    ownOrgId = ownOrg.id;
    // A real league owner has their active org pointed at the org they run —
    // the fixture must match, otherwise "was it repointed?" is untestable.
    await prisma.user.update({
      where: { id: ownerCoachId },
      data: { organization_id: ownOrgId },
    });
    const hostOrg = await makeOrg('JRAS Host League', hostOwnerId, true);
    hostOrgId = hostOrg.id;
    const hostOrg2 = await makeOrg('JRAS Host League Two', hostOwnerId, true);
    hostOrg2Id = hostOrg2.id;
    createdOrgIds.push(ownOrgId, hostOrgId, hostOrg2Id);
  });

  afterAll(async () => {
    await prisma.organizationJoinRequest.deleteMany({
      where: { organization_id: { in: createdOrgIds } },
    });
    await prisma.organizationMembership.deleteMany({
      where: { organization_id: { in: createdOrgIds } },
    });
    await prisma.notification.deleteMany({
      where: { OR: [{ user_id: { in: createdUserIds } }, { actor_id: { in: createdUserIds } }] },
    });
    await prisma.adminActivityLog.deleteMany({ where: { admin_id: { in: createdUserIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: createdOrgIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  });

  it('keeps an existing approved league owner APPROVED when they request to join another org', async () => {
    const res = await request(app)
      .post('/organizations/join-requests')
      .set('Authorization', `Bearer ${ownerCoachToken}`)
      .send({ organization_id: hostOrgId, message: 'just looking' });

    expect(res.status).toBe(201);

    const after = await prisma.user.findUnique({
      where: { id: ownerCoachId },
      select: { approval_status: true, paid_by_owner: true, organization_id: true },
    });
    expect(after.approval_status).toBe('APPROVED');
    expect(after.paid_by_owner).toBe(false);
    expect(after.organization_id).toBe(ownOrgId);
  });

  it('leaves that league owner able to keep running their own org while the request is pending', async () => {
    const res = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${ownerCoachToken}`)
      .send({ name: `JRAS Team ${ts}`, sport: 'basketball', organization_id: ownOrgId });

    expect(res.status).toBe(201);

    await prisma.teamMembership.deleteMany({ where: { team_id: res.body.team.id } });
    await prisma.team.delete({ where: { id: res.body.team.id } });
    await prisma.sportProgram.deleteMany({ where: { organization_id: ownOrgId } });
  });

  it('does not let a third-party denial push an existing league owner into REJECTED', async () => {
    const joinRequest = await prisma.organizationJoinRequest.findFirst({
      where: { organization_id: hostOrgId, user_id: ownerCoachId },
      select: { id: true },
    });
    expect(joinRequest).toBeTruthy();

    const res = await request(app)
      .post(`/organizations/join-requests/${joinRequest.id}/deny`)
      .set('Authorization', `Bearer ${hostOwnerToken}`)
      .send({ reason: 'not our league' });

    expect(res.status).toBe(200);

    const after = await prisma.user.findUnique({
      where: { id: ownerCoachId },
      select: { approval_status: true, rejected_at: true, organization_id: true },
    });
    expect(after.approval_status).toBe('APPROVED');
    expect(after.rejected_at).toBeNull();
    expect(after.organization_id).toBe(ownOrgId);
  });

  it('does not move an existing league owner onto another org’s billing when approved', async () => {
    await request(app)
      .post('/organizations/join-requests')
      .set('Authorization', `Bearer ${ownerCoachToken}`)
      .send({ organization_id: hostOrg2Id });

    const joinRequest = await prisma.organizationJoinRequest.findFirst({
      where: { organization_id: hostOrg2Id, user_id: ownerCoachId },
      select: { id: true },
    });

    const res = await request(app)
      .post(`/organizations/join-requests/${joinRequest.id}/approve`)
      .set('Authorization', `Bearer ${hostOwnerToken}`)
      .send({});

    expect(res.status).toBe(200);

    const after = await prisma.user.findUnique({
      where: { id: ownerCoachId },
      select: { approval_status: true, paid_by_owner: true, organization_id: true },
    });
    expect(after.approval_status).toBe('APPROVED');
    expect(after.paid_by_owner).toBe(false);
    expect(after.organization_id).toBe(ownOrgId);

    const membership = await prisma.organizationMembership.findFirst({
      where: { organization_id: hostOrg2Id, user_id: ownerCoachId },
      select: { status: true },
    });
    expect(membership.status).toBe('active');
  });

  it('still moves a coach with no approved org of their own to PENDING on request', async () => {
    const res = await request(app)
      .post('/organizations/join-requests')
      .set('Authorization', `Bearer ${plainCoachToken}`)
      .send({ organization_id: hostOrgId });

    expect(res.status).toBe(201);

    const after = await prisma.user.findUnique({
      where: { id: plainCoachId },
      select: { approval_status: true, organization_id: true },
    });
    expect(after.approval_status).toBe('PENDING');
    expect(after.organization_id).toBe(hostOrgId);
  });

  it('still moves a coach with no approved org of their own to REJECTED on denial', async () => {
    const joinRequest = await prisma.organizationJoinRequest.findFirst({
      where: { organization_id: hostOrgId, user_id: plainCoachId },
      select: { id: true },
    });

    const res = await request(app)
      .post(`/organizations/join-requests/${joinRequest.id}/deny`)
      .set('Authorization', `Bearer ${hostOwnerToken}`)
      .send({ reason: 'no' });

    expect(res.status).toBe(200);

    const after = await prisma.user.findUnique({
      where: { id: plainCoachId },
      select: { approval_status: true, rejected_at: true },
    });
    expect(after.approval_status).toBe('REJECTED');
    expect(after.rejected_at).not.toBeNull();
  });
});
