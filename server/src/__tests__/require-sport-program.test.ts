import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import { createTestUser } from './helpers/createTestUser.js';

// Rule: every SPORT team must belong to a SportProgram (no ungrouped billable
// units). The server auto-resolves/creates the org's (org, sport) program when
// no program_id is supplied; custom/unrecognized sports fall back to the
// taxonomy 'other' program; extracurricular clubs are exempt.

let prisma: any;
let signJwt: any;
const ts = Date.now();
let coachId = '';
let coachToken = '';
let orgId = '';

async function createOrg(userId: string, name: string): Promise<string> {
  const org = await prisma.organization.create({
    data: {
      name,
      description: 'require-program test',
      org_type: 'club',
      admin_approved: true,
      approved_at: new Date(),
      league_owner_id: userId,
      updated_at: new Date(),
    },
  });
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: userId, role: 'owner', status: 'active' },
  });
  return org.id;
}

function createTeam(token: string, body: Record<string, unknown>) {
  return request(app).post('/teams/create').set('Authorization', `Bearer ${token}`).send(body);
}

async function teamByName(name: string) {
  return prisma.team.findFirst({ where: { organization_id: orgId, name } });
}

describe('require a SportProgram for every sport team', () => {
  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    // Legend so team count + extracurricular are unrestricted for the test.
    ({ id: coachId, token: coachToken } = await createTestUser({
      prisma,
      signJwt,
      password: 'TestPassword123!',
      email: `rsp-coach-${ts}@t.co`,
      displayName: 'RSP Coach',
      role: 'coach',
      plan: 'legend',
    }));
    orgId = await createOrg(coachId, `RSP Org ${ts}`);
  });

  afterAll(async () => {
    await prisma.team.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.sportProgram.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organizationMembership
      .deleteMany({ where: { organization_id: orgId } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: coachId } }).catch(() => {});
  });

  it('auto-assigns a program to a canonical-sport team with no program_id', async () => {
    const name = `RSP BBall ${ts}`;
    const res = await createTeam(coachToken, {
      name,
      organization_id: orgId,
      club_type: 'sport',
      sport: 'Basketball',
    });
    expect(res.status).toBe(201);
    const team = await teamByName(name);
    expect(team.program_id).toBeTruthy();
    const prog = await prisma.sportProgram.findUnique({ where: { id: team.program_id } });
    expect(prog.sport).toBe('basketball');
    expect(prog.organization_id).toBe(orgId);
  });

  it('reuses the same program for a second team in the same sport', async () => {
    const name = `RSP BBall JV ${ts}`;
    const res = await createTeam(coachToken, {
      name,
      organization_id: orgId,
      club_type: 'sport',
      sport: 'Basketball',
      level: 'jv',
    });
    expect(res.status).toBe(201);
    const count = await prisma.sportProgram.count({
      where: { organization_id: orgId, sport: 'basketball' },
    });
    expect(count).toBe(1); // both basketball teams share one program
  });

  it("groups a custom/unrecognized sport under the org's 'other' program (never null)", async () => {
    const name = `RSP Custom ${ts}`;
    const res = await createTeam(coachToken, {
      name,
      organization_id: orgId,
      club_type: 'sport',
      sport: 'Underwater Basket Weaving',
    });
    expect(res.status).toBe(201);
    const team = await teamByName(name);
    expect(team.program_id).toBeTruthy();
    const prog = await prisma.sportProgram.findUnique({ where: { id: team.program_id } });
    expect(prog.sport).toBe('other');
  });

  it('leaves an extracurricular club ungrouped (exempt from the rule)', async () => {
    const name = `RSP Club ${ts}`;
    const res = await createTeam(coachToken, {
      name,
      organization_id: orgId,
      club_type: 'extracurricular',
      extracurricular_category: 'Chess',
    });
    expect(res.status).toBe(201);
    const team = await teamByName(name);
    expect(team.program_id).toBeFalsy();
  });
});
