/**
 * Team creation requires a coach account — a staff MEMBERSHIP is not a substitute.
 *
 * `createTeamWithGuardrails` gated on `isCoach || hasTeamStaffRole || hasOrgRole`
 * (org owner/manager). But a coach in "proceed as fan" mode still has
 * role === 'coach' (getCanonicalUserRole reads the column), so the non-coach
 * bypass never protected a real coach — it only ever admitted genuine FAN
 * accounts that happened to hold a staff membership. A fan invited as an org
 * MANAGER (or added as team staff) could therefore create teams with no coach
 * application, agreement, or approval — contradicting the documented invariant
 * "Only coach accounts can create teams" and "org managers have zero admin
 * power at the org level".
 *
 * Invariant: only a coach account (canonical role) can create a team. Holding
 * an org-manager or team-staff membership does not grant it.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const suffix = String(ts).slice(-8);

async function makeUser(tag: string, role: 'coach' | 'fan') {
  return prisma.user.create({
    data: {
      email: `tcrc-${tag}-${ts}@example.com`,
      username: `tcrc${tag}${suffix}`,
      password_hash: 'x',
      display_name: `TCRC ${tag}`,
      email_verified: true,
      role,
      onboarding_completed: true,
      approval_status: 'APPROVED',
      ...(role === 'coach'
        ? {
            coach_agreement_accepted_at: new Date(),
            coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
          }
        : {}),
      plan: 'rookie',
      preferences: { role, plan: 'rookie', onboarding_completed: true },
    },
  });
}

describe('team creation requires a coach account', () => {
  let coachId: string;
  let orgId: string;
  let teamId: string;

  let fanManagerToken: string;
  let fanStaffToken: string;
  let coachToken: string;

  const userIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const coach = await makeUser('coach', 'coach');
    coachId = coach.id;
    coachToken = signJwt({ id: coachId });

    const org = await prisma.organization.create({
      data: {
        name: `TCRC League ${ts}`,
        league_owner_id: coachId,
        admin_approved: true,
        approved_at: new Date(),
        supporting_document_url: 'https://example.com/doc.pdf',
        updated_at: new Date(),
      },
    });
    orgId = org.id;
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: coachId, role: 'owner', status: 'active' },
    });

    const team = await prisma.team.create({
      data: {
        name: `TCRC Team ${suffix}`,
        organization_id: orgId,
        sport: 'basketball',
        status: 'active',
      },
    });
    teamId = team.id;
    await prisma.teamMembership.create({
      data: { team_id: teamId, user_id: coachId, role: 'owner', status: 'active' },
    });

    // A fan invited as an ORG MANAGER.
    const fanManager = await makeUser('fanmgr', 'fan');
    fanManagerToken = signJwt({ id: fanManager.id });
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: fanManager.id, role: 'manager', status: 'active' },
    });

    // A fan added as TEAM STAFF (coach role on the roster).
    const fanStaff = await makeUser('fanstaff', 'fan');
    fanStaffToken = signJwt({ id: fanStaff.id });
    await prisma.teamMembership.create({
      data: { team_id: teamId, user_id: fanStaff.id, role: 'coach', status: 'active' },
    });

    userIds.push(coachId, fanManager.id, fanStaff.id);
  });

  afterAll(async () => {
    const teams = await prisma.team.findMany({
      where: { organization_id: orgId },
      select: { id: true },
    });
    const teamIds = teams.map((t: any) => t.id);
    await prisma.groupChatMember.deleteMany({ where: { chat: { team_id: { in: teamIds } } } });
    await prisma.groupChat.deleteMany({ where: { team_id: { in: teamIds } } });
    await prisma.teamInvite.deleteMany({ where: { team_id: { in: teamIds } } });
    await prisma.teamMembership.deleteMany({ where: { team_id: { in: teamIds } } });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.sportProgram.deleteMany({ where: { organization_id: orgId } });
    await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('blocks a fan holding an org-manager role from creating a team', async () => {
    const res = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${fanManagerToken}`)
      .send({ name: `TCRC FanMgr ${suffix}`, sport: 'soccer', organization_id: orgId });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('COACH_ROLE_REQUIRED');
  });

  it('blocks a fan holding a team-staff role from creating a team', async () => {
    const res = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${fanStaffToken}`)
      .send({ name: `TCRC FanStaff ${suffix}`, sport: 'soccer', organization_id: orgId });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('COACH_ROLE_REQUIRED');
  });

  it('still lets an approved coach create a team', async () => {
    const res = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ name: `TCRC CoachOK ${suffix}`, sport: 'baseball', organization_id: orgId });

    expect(res.status).toBe(201);
  });
});
