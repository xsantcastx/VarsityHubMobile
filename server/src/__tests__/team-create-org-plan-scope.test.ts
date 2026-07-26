/**
 * Team-create billing scope: the ORGANIZATION's owner plan is the authority.
 *
 * Programs belong to an organization, but the create-gate used to resolve the
 * allowance from the CALLER: `paid_by_owner` coaches counted against the org,
 * everyone else counted against their own personally-owned teams. Accepting an
 * org invite never sets `paid_by_owner`, so every invited coach arrived with a
 * private copy of the free allowance and could keep minting programs inside an
 * org that was already at its cap:
 *
 *   rookie org at the 5-program cap
 *     -> owner blocked (correct)
 *     -> each invited member still creates 5 more (leak)
 *
 * Invariant: a team created under org X consumes org X's allowance and is
 * gated by org X's owner's plan, no matter who creates it or how they joined.
 * Existing over-cap orgs are grandfathered — the gate only blocks NEW creates.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import { SERVER_ROOKIE_PROGRAM_LIMIT } from '../lib/planDefinitions.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const suffix = String(ts).slice(-8);

async function makeCoach(tag: string, plan: string) {
  return prisma.user.create({
    data: {
      email: `tcops-${tag}-${ts}@example.com`,
      username: `tcops${tag}${suffix}`,
      password_hash: 'x',
      display_name: `TCOPS ${tag}`,
      email_verified: true,
      role: 'coach',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      coach_agreement_accepted_at: new Date(),
      coach_agreement_version: Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1),
      plan,
      preferences: { role: 'coach', plan, onboarding_completed: true },
    },
  });
}

async function makeOrg(name: string, ownerId: string) {
  const org = await prisma.organization.create({
    data: {
      name: `${name} ${ts}`,
      league_owner_id: ownerId,
      admin_approved: true,
      approved_at: new Date(),
      supporting_document_url: 'https://example.com/doc.pdf',
      updated_at: new Date(),
    },
  });
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: ownerId, role: 'owner', status: 'active' },
  });
  return org;
}

/** Fill an org to exactly `count` billable programs (each with one active team). */
async function fillOrgToCap(orgId: string, ownerId: string, count: number) {
  const sports = ['basketball', 'soccer', 'baseball', 'football', 'volleyball', 'wrestling'];
  for (let i = 0; i < count; i++) {
    const program = await prisma.sportProgram.create({
      data: { organization_id: orgId, sport: sports[i] },
    });
    const team = await prisma.team.create({
      data: {
        name: `Filler ${i} ${suffix}`,
        organization_id: orgId,
        program_id: program.id,
        sport: sports[i],
        status: 'active',
      },
    });
    await prisma.teamMembership.create({
      data: { team_id: team.id, user_id: ownerId, role: 'owner', status: 'active' },
    });
  }
}

describe('team-create billing is scoped to the organization owner plan', () => {
  let rookieOwnerId: string;
  let rookieOrgId: string;
  let rookieMemberToken: string;
  let rookieMemberId: string;

  let legendOwnerId: string;
  let legendOrgId: string;
  let legendMemberToken: string;
  let legendMemberId: string;

  const userIds: string[] = [];
  const orgIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const rookieOwner = await makeCoach('ro', 'rookie');
    rookieOwnerId = rookieOwner.id;
    const rookieOrg = await makeOrg('TCOPS Rookie League', rookieOwnerId);
    rookieOrgId = rookieOrg.id;

    // An invited coach: active org member, owns no org, so today they bill
    // personally and arrive with a fresh allowance.
    const rookieMember = await makeCoach('rm', 'rookie');
    rookieMemberId = rookieMember.id;
    rookieMemberToken = signJwt({ id: rookieMemberId });
    await prisma.organizationMembership.create({
      data: {
        organization_id: rookieOrgId,
        user_id: rookieMemberId,
        role: 'member',
        status: 'active',
      },
    });

    const legendOwner = await makeCoach('lo', 'legend');
    legendOwnerId = legendOwner.id;
    const legendOrg = await makeOrg('TCOPS Legend League', legendOwnerId);
    legendOrgId = legendOrg.id;

    const legendMember = await makeCoach('lm', 'rookie');
    legendMemberId = legendMember.id;
    legendMemberToken = signJwt({ id: legendMemberId });
    await prisma.organizationMembership.create({
      data: {
        organization_id: legendOrgId,
        user_id: legendMemberId,
        role: 'member',
        status: 'active',
      },
    });

    userIds.push(rookieOwnerId, rookieMemberId, legendOwnerId, legendMemberId);
    orgIds.push(rookieOrgId, legendOrgId);

    // Both orgs start already at the rookie cap.
    await fillOrgToCap(rookieOrgId, rookieOwnerId, SERVER_ROOKIE_PROGRAM_LIMIT);
    await fillOrgToCap(legendOrgId, legendOwnerId, SERVER_ROOKIE_PROGRAM_LIMIT);
  });

  afterAll(async () => {
    const teams = await prisma.team.findMany({
      where: { organization_id: { in: orgIds } },
      select: { id: true },
    });
    const teamIds = teams.map((t: any) => t.id);
    await prisma.groupChatMember.deleteMany({ where: { chat: { team_id: { in: teamIds } } } });
    await prisma.groupChat.deleteMany({ where: { team_id: { in: teamIds } } });
    await prisma.teamInvite.deleteMany({ where: { team_id: { in: teamIds } } });
    await prisma.teamMembership.deleteMany({ where: { team_id: { in: teamIds } } });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.sportProgram.deleteMany({ where: { organization_id: { in: orgIds } } });
    await prisma.organizationMembership.deleteMany({
      where: { organization_id: { in: orgIds } },
    });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('blocks an invited member from exceeding the rookie org owner’s program allowance', async () => {
    const res = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${rookieMemberToken}`)
      .send({ name: `TCOPS Overflow ${suffix}`, sport: 'lacrosse', organization_id: rookieOrgId });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROGRAM_LIMIT_EXCEEDED');
  });

  it('points a blocked non-owner at the league owner instead of their own billing', async () => {
    const res = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${rookieMemberToken}`)
      .send({ name: `TCOPS Overflow2 ${suffix}`, sport: 'golf', organization_id: rookieOrgId });

    expect(res.status).toBe(403);
    // They are gated by the OWNER's plan and cannot upgrade it themselves, so
    // "upgrade your plan" would be a dead end.
    expect(res.body.message).toMatch(/league owner|organization/i);
    expect(res.body.message).not.toMatch(/You've reached your free limit/i);
  });

  it('grandfathers the programs the org already has when a new create is blocked', async () => {
    const programs = await prisma.sportProgram.count({
      where: { organization_id: rookieOrgId, teams: { some: { status: 'active' } } },
    });
    expect(programs).toBe(SERVER_ROOKIE_PROGRAM_LIMIT);
  });

  it('lets an invited member create past the rookie cap when the org owner is on Legend', async () => {
    const res = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${legendMemberToken}`)
      .send({
        name: `TCOPS Legend Team ${suffix}`,
        sport: 'lacrosse',
        organization_id: legendOrgId,
      });

    expect(res.status).toBe(201);
  });
});
