/**
 * The `authorized_users` block on team create must respect the plan cap.
 *
 * POST /teams/:id/invite and POST /team-invites both enforce
 * `maxAuthorizedUsers` inside a Serializable transaction. The create-time
 * `authorized_users` fan-out enforced only a role whitelist and a hard
 * `.max(50)`, so a rookie coach (cap 6) could mint 20 pending invites in one
 * request — 20 people received staff invite emails, and the accept-time
 * backstop then rejected 14 of them with a limit error they could do nothing
 * about.
 *
 * Invariant: the cap is checked BEFORE the team is created (mirroring
 * POST /organizations, which already validates its invite list up front), so
 * an over-cap request fails cleanly instead of leaving a half-provisioned team
 * and a pile of invites that cannot be accepted.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import { getAuthorizedUsersPerTeam } from '../lib/planLimits.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const suffix = String(ts).slice(-8);
const ROOKIE_AUTHORIZED_CAP = getAuthorizedUsersPerTeam('rookie') as number;

describe('team create authorized_users respects the plan cap', () => {
  let coachId: string;
  let coachToken: string;
  let orgId: string;

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
    await prisma.user.deleteMany({ where: { id: coachId } });
  });

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const coach = await prisma.user.create({
      data: {
        email: `tcauc-${ts}@example.com`,
        username: `tcauc${suffix}`,
        password_hash: 'x',
        display_name: 'TCAUC Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        coach_agreement_accepted_at: new Date(),
        coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
        plan: 'rookie',
        preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
      },
    });
    coachId = coach.id;
    coachToken = signJwt({ id: coachId });

    const org = await prisma.organization.create({
      data: {
        name: `TCAUC League ${ts}`,
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
  });

  it('rejects a create carrying more authorized_users than the plan allows', async () => {
    const authorizedUsers = Array.from({ length: ROOKIE_AUTHORIZED_CAP + 5 }, (_, i) => ({
      email: `tcauc-staff-${i}-${suffix}@example.com`,
      role: 'coach',
    }));

    const res = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        name: `TCAUC Over Cap ${suffix}`,
        sport: 'basketball',
        organization_id: orgId,
        authorized_users: authorizedUsers,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('USER_LIMIT_REACHED');
  });

  it('does not leave a half-provisioned team or stray invites behind', async () => {
    const team = await prisma.team.findFirst({
      where: { organization_id: orgId, name: { contains: 'Over Cap' } },
      select: { id: true },
    });
    expect(team).toBeNull();

    const invites = await prisma.teamInvite.count({
      where: { email: { contains: `-${suffix}@example.com` } },
    });
    expect(invites).toBe(0);
  });

  it('still creates a team whose authorized_users fit inside the cap', async () => {
    const authorizedUsers = Array.from({ length: ROOKIE_AUTHORIZED_CAP }, (_, i) => ({
      email: `tcauc-ok-${i}-${suffix}@example.com`,
      role: 'coach',
    }));

    const res = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({
        name: `TCAUC Under Cap ${suffix}`,
        sport: 'soccer',
        organization_id: orgId,
        authorized_users: authorizedUsers,
      });

    expect(res.status).toBe(201);

    const invites = await prisma.teamInvite.count({
      where: { team_id: res.body.team.id, status: 'pending' },
    });
    expect(invites).toBe(ROOKIE_AUTHORIZED_CAP);
  });
});
