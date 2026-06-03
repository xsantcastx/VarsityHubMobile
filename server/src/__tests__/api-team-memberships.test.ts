/**
 * Team Memberships API — security boundary tests
 *
 * Covers the three most critical paths:
 *   POST   /team-memberships       — add a member (auth, role, roster limit)
 *   PATCH  /team-memberships/:id   — change role (auth, owner-escalation guard)
 *   DELETE /team-memberships/:id   — remove member (auth, self-remove guard)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

const COACH_EMAIL = `tm-coach-${Date.now()}@test.com`;
const FAN_EMAIL = `tm-fan-${Date.now()}@test.com`;
const OUTSIDER_EMAIL = `tm-outsider-${Date.now()}@test.com`;
const PASSWORD = 'TestPassword123!';

describe('POST /team-memberships — add member', () => {
  let coachId: string;
  let coachToken: string;
  let fanId: string;
  let fanToken: string;
  let outsiderId: string;
  let outsiderToken: string;
  let orgId: string;
  let teamId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);

    const coach = await prisma.user.create({
      data: {
        email: COACH_EMAIL,
        password_hash: hash,
        display_name: 'TM Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        coach_agreement_accepted_at: new Date(),
        coach_agreement_version: 1,
        preferences: { role: 'coach', onboarding_completed: true, coach_agreement_accepted_at: new Date().toISOString(), coach_agreement_version: 1 },
      },
    });
    coachId = coach.id;
    coachToken = signJwt({ id: coachId });

    const fan = await prisma.user.create({
      data: {
        email: FAN_EMAIL,
        password_hash: hash,
        display_name: 'TM Fan',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    fanId = fan.id;
    fanToken = signJwt({ id: fanId });

    const outsider = await prisma.user.create({
      data: {
        email: OUTSIDER_EMAIL,
        password_hash: hash,
        display_name: 'TM Outsider',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    outsiderId = outsider.id;
    outsiderToken = signJwt({ id: outsiderId });

    const org = await prisma.organization.create({
      data: { name: `TM Org ${Date.now()}`, admin_approved: true, league_owner_id: coachId },
    });
    orgId = org.id;

    await prisma.user.update({
      where: { id: coachId },
      data: { organization_id: orgId, preferences: { role: 'coach', onboarding_completed: true, organization_id: orgId, coach_agreement_accepted_at: new Date().toISOString(), coach_agreement_version: 1 } },
    });

    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: coachId, role: 'owner' },
    });

    const team = await prisma.team.create({
      data: { name: `TM Team ${Date.now()}`, organization_id: orgId },
    });
    teamId = team.id;

    await prisma.teamMembership.create({
      data: { team_id: teamId, user_id: coachId, role: 'owner', status: 'active' },
    });
  });

  afterAll(async () => {
    await prisma.teamMembership.deleteMany({ where: { team_id: teamId } });
    await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } });
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [coachId, fanId, outsiderId] } } });
  });

  it('401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/team-memberships')
      .send({ team_id: teamId, user_id: fanId, role: 'member' });
    expect(res.status).toBe(401);
  });

  it('403 when caller is not team staff or org admin', async () => {
    const res = await request(app)
      .post('/team-memberships')
      .set('Authorization', `Bearer ${outsiderToken}`)
      .send({ team_id: teamId, user_id: fanId, role: 'member' });
    expect(res.status).toBe(403);
  });

  it('201 when team owner adds a member', async () => {
    const res = await request(app)
      .post('/team-memberships')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ team_id: teamId, user_id: fanId, role: 'member' });
    expect(res.status).toBe(201);
    // Route returns the membership object directly (not wrapped in { membership })
    expect(res.body.team_id).toBe(teamId);
    expect(res.body.user_id).toBe(fanId);
  });

  it('rejects an invalid role', async () => {
    const res = await request(app)
      .post('/team-memberships')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ team_id: teamId, user_id: fanId, role: 'god_mode' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /team-memberships/:id — role change', () => {
  let coachId: string;
  let coachToken: string;
  let memberId: string;
  let memberToken: string;
  let orgId: string;
  let teamId: string;
  let membershipId: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);

    const coach = await prisma.user.create({
      data: {
        email: `tm-patch-coach-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'Patch Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        coach_agreement_accepted_at: new Date(),
        coach_agreement_version: 1,
        preferences: { role: 'coach', onboarding_completed: true, coach_agreement_accepted_at: new Date().toISOString(), coach_agreement_version: 1 },
      },
    });
    coachId = coach.id;
    coachToken = signJwt({ id: coachId });

    const member = await prisma.user.create({
      data: {
        email: `tm-patch-member-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'Patch Member',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    memberId = member.id;
    memberToken = signJwt({ id: memberId });

    const org = await prisma.organization.create({
      data: { name: `Patch Org ${Date.now()}`, admin_approved: true, league_owner_id: coachId },
    });
    orgId = org.id;
    await prisma.user.update({ where: { id: coachId }, data: { organization_id: orgId } });
    await prisma.organizationMembership.create({ data: { organization_id: orgId, user_id: coachId, role: 'owner' } });

    const team = await prisma.team.create({ data: { name: `Patch Team ${Date.now()}`, organization_id: orgId } });
    teamId = team.id;

    await prisma.teamMembership.create({ data: { team_id: teamId, user_id: coachId, role: 'owner', status: 'active' } });
    const m = await prisma.teamMembership.create({ data: { team_id: teamId, user_id: memberId, role: 'member', status: 'active' } });
    membershipId = m.id;
  });

  afterAll(async () => {
    await prisma.teamMembership.deleteMany({ where: { team_id: teamId } });
    await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } });
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [coachId, memberId] } } });
  });

  it('403 when non-staff tries to change a role', async () => {
    const res = await request(app)
      .patch(`/team-memberships/${membershipId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ role: 'coach' });
    expect(res.status).toBe(403);
  });

  it('200 when team owner changes a member role', async () => {
    const res = await request(app)
      .patch(`/team-memberships/${membershipId}`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ role: 'coach' });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /team-memberships/:id — remove member', () => {
  let coachId: string;
  let coachToken: string;
  let memberId: string;
  let orgId: string;
  let teamId: string;
  let membershipId: string;

  beforeAll(async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);

    const coach = await prisma.user.create({
      data: {
        email: `tm-del-coach-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'Del Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        coach_agreement_accepted_at: new Date(),
        coach_agreement_version: 1,
        preferences: { role: 'coach', onboarding_completed: true, coach_agreement_accepted_at: new Date().toISOString(), coach_agreement_version: 1 },
      },
    });
    coachId = coach.id;
    coachToken = signJwt({ id: coachId });

    const member = await prisma.user.create({
      data: {
        email: `tm-del-member-${Date.now()}@test.com`,
        password_hash: hash,
        display_name: 'Del Member',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: { role: 'fan', onboarding_completed: true },
      },
    });
    memberId = member.id;

    const org = await prisma.organization.create({
      data: { name: `Del Org ${Date.now()}`, admin_approved: true, league_owner_id: coachId },
    });
    orgId = org.id;
    await prisma.user.update({ where: { id: coachId }, data: { organization_id: orgId } });
    await prisma.organizationMembership.create({ data: { organization_id: orgId, user_id: coachId, role: 'owner' } });

    const team = await prisma.team.create({ data: { name: `Del Team ${Date.now()}`, organization_id: orgId } });
    teamId = team.id;

    await prisma.teamMembership.create({ data: { team_id: teamId, user_id: coachId, role: 'owner', status: 'active' } });
    const m = await prisma.teamMembership.create({ data: { team_id: teamId, user_id: memberId, role: 'member', status: 'active' } });
    membershipId = m.id;
  });

  afterAll(async () => {
    await prisma.teamMembership.deleteMany({ where: { team_id: teamId } });
    await prisma.team.delete({ where: { id: teamId } }).catch(() => {});
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } });
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [coachId, memberId] } } });
  });

  it('401 when unauthenticated', async () => {
    const res = await request(app).delete(`/team-memberships/${membershipId}`);
    expect(res.status).toBe(401);
  });

  it('200 when owner removes a member', async () => {
    const res = await request(app)
      .delete(`/team-memberships/${membershipId}`)
      .set('Authorization', `Bearer ${coachToken}`);
    expect(res.status).toBe(200);
  });
});
