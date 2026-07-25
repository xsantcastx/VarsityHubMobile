/**
 * GET /teams/managed must match the authorization helper it mirrors.
 *
 * `canManageAnyTeam` grants team access two ways:
 *   1. an active TeamMembership in a staff role, OR
 *   2. being an org admin (owner/manager) of the team's organization.
 *
 * The /managed LIST only implemented (1). An organizer whose coaches created
 * the teams holds no TeamMembership row on them, so their own org's teams were
 * invisible — while `canManageTeam` says they may manage them. That drift is
 * why the game/event team pickers could not be pointed at /managed and were
 * left reading the PUBLIC team directory instead, which showed every team on
 * VarsityHub.
 *
 * Invariant (product spec): an organizer sees the teams inside their
 * organization; a coach sees only the teams they are assigned to; nobody sees
 * teams outside both.
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const suffix = String(ts).slice(-8);

const userIds: string[] = [];
const orgIds: string[] = [];

async function makeCoach(tag: string) {
  const u = await prisma.user.create({
    data: {
      email: `mtos-${tag}-${ts}@example.com`,
      username: `mtos${tag}${suffix}`,
      password_hash: 'x',
      display_name: `MTOS ${tag}`,
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
  userIds.push(u.id);
  return u;
}

async function makeOrg(tag: string, ownerId: string) {
  const org = await prisma.organization.create({
    data: {
      name: `MTOS Org ${tag} ${ts}`,
      league_owner_id: ownerId,
      admin_approved: true,
      approved_at: new Date(),
      supporting_document_url: 'https://example.com/d.pdf',
      updated_at: new Date(),
    },
  });
  orgIds.push(org.id);
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: ownerId, role: 'owner', status: 'active' },
  });
  return org;
}

/** A team owned by `staffUserId` (they get the TeamMembership), inside `orgId`. */
async function makeTeam(orgId: string, name: string, staffUserId: string) {
  const team = await prisma.team.create({
    data: { name: `${name} ${suffix}`, organization_id: orgId, sport: 'soccer', status: 'active' },
  });
  await prisma.teamMembership.create({
    data: { team_id: team.id, user_id: staffUserId, role: 'owner', status: 'active' },
  });
  return team;
}

async function managedTeamNames(token: string): Promise<string[]> {
  const res = await request(app).get('/teams/managed').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  const rows = Array.isArray(res.body) ? res.body : (res.body?.teams ?? res.body?.items ?? []);
  return rows.map((t: any) => String(t.name));
}

describe('GET /teams/managed org scope', () => {
  let organizerToken: string;
  let coachToken: string;
  let outsiderToken: string;
  let coachTeamName: string;
  let organizerOnlyTeamName: string;
  let foreignTeamName: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const organizer = await makeCoach('org');
    const coach = await makeCoach('co');
    const outsider = await makeCoach('out');
    organizerToken = signJwt({ id: organizer.id });
    coachToken = signJwt({ id: coach.id });
    outsiderToken = signJwt({ id: outsider.id });

    const org = await makeOrg('main', organizer.id);
    // The coach is an org member and owns one team inside the org.
    await prisma.organizationMembership.create({
      data: { organization_id: org.id, user_id: coach.id, role: 'member', status: 'active' },
    });
    const coachTeam = await makeTeam(org.id, 'Coach Team', coach.id);
    coachTeamName = coachTeam.name;

    // A team inside the SAME org the organizer has no TeamMembership on.
    const organizerOnlyTeam = await makeTeam(org.id, 'Other Coach Team', coach.id);
    organizerOnlyTeamName = organizerOnlyTeam.name;

    // A team in an unrelated org — nobody above should see it.
    const foreignOrg = await makeOrg('foreign', outsider.id);
    const foreignTeam = await makeTeam(foreignOrg.id, 'Foreign Team', outsider.id);
    foreignTeamName = foreignTeam.name;
  });

  afterAll(async () => {
    const teams = await prisma.team.findMany({
      where: { organization_id: { in: orgIds } },
      select: { id: true },
    });
    const teamIds = teams.map((t: any) => t.id);
    await prisma.teamMembership.deleteMany({ where: { team_id: { in: teamIds } } });
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.sportProgram.deleteMany({ where: { organization_id: { in: orgIds } } });
    await prisma.organizationMembership.deleteMany({ where: { organization_id: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('gives the organizer every team inside their organization', async () => {
    const names = await managedTeamNames(organizerToken);
    expect(names).toEqual(expect.arrayContaining([coachTeamName, organizerOnlyTeamName]));
  });

  it('gives the coach only the teams they are assigned to', async () => {
    const names = await managedTeamNames(coachToken);
    expect(names).toEqual(expect.arrayContaining([coachTeamName, organizerOnlyTeamName]));
    expect(names).not.toContain(foreignTeamName);
  });

  it('never leaks teams from an organization the caller has no role in', async () => {
    const organizerNames = await managedTeamNames(organizerToken);
    expect(organizerNames).not.toContain(foreignTeamName);

    const outsiderNames = await managedTeamNames(outsiderToken);
    expect(outsiderNames).not.toContain(coachTeamName);
    expect(outsiderNames).not.toContain(organizerOnlyTeamName);
  });
});
