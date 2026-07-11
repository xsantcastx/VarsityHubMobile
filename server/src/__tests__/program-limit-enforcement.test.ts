/**
 * Program-Limit Enforcement (Phase 4 billing re-unit)
 *
 * Rookie's free tier is gated on distinct billable SPORT PROGRAMS, not raw
 * team count. A team that joins a program which already has an active team
 * introduces no new billable unit (free level-team add-on within an
 * existing sport). A team that starts a brand-new program is billable.
 *
 * Modeled on the team-count harness in role-tier-enforcement.test.ts (same
 * app bootstrap + auth-token helper); only the seeded programs and the
 * asserted response code differ.
 */
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import { createTestUser } from './helpers/createTestUser.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const ROOKIE_EMAIL = `test-program-rookie-${ts}@example.com`;
const PASSWORD = 'TestPassword123!';

let rookieId: string, rookieToken: string;
let rookieOrgId: string;
const seededProgramIds: string[] = [];
const seededTeamIds: string[] = [];
const createdTeamIds: string[] = [];

async function createOrgForUser(userId: string, orgName: string): Promise<string> {
  const org = await prisma.organization.create({
    data: {
      name: orgName,
      description: 'Test org',
      org_type: 'club',
      admin_approved: true,
      approved_at: new Date(),
      league_owner_id: userId,
      updated_at: new Date(),
    },
  });
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: userId, role: 'owner' },
  });
  return org.id;
}

// Seeds a SportProgram with one active team owned by `userId` — bypasses the
// route entirely so seeding doesn't burn the 5/day team-creation rate limit.
async function seedActiveProgram(orgId: string, userId: string, sportSlug: string) {
  const program = await prisma.sportProgram.create({
    data: { organization_id: orgId, sport: sportSlug },
  });
  const team = await prisma.team.create({
    data: {
      name: `${sportSlug} Varsity ${ts}`,
      organization_id: orgId,
      program_id: program.id,
      sport: sportSlug,
      status: 'active',
    },
  });
  await prisma.teamMembership.create({
    data: { team_id: team.id, user_id: userId, role: 'owner', status: 'active' },
  });
  seededProgramIds.push(program.id);
  seededTeamIds.push(team.id);
  return { programId: program.id as string, teamId: team.id as string };
}

async function createTeamViaApi(
  token: string,
  teamName: string,
  organizationId: string,
  programId?: string
) {
  return request(app)
    .post('/teams/create')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: teamName,
      description: `${teamName} description`,
      organization_id: organizationId,
      club_type: 'sport',
      ...(programId ? { program_id: programId } : {}),
    });
}

beforeAll(async () => {
  ({ prisma } = await import('../lib/prisma.js'));
  ({ signJwt } = await import('../lib/jwt.js'));

  ({ id: rookieId, token: rookieToken } = await createTestUser({
    prisma,
    signJwt,
    password: PASSWORD,
    email: ROOKIE_EMAIL,
    displayName: 'Program Rookie Coach',
    role: 'coach',
    plan: 'rookie',
  }));

  rookieOrgId = await createOrgForUser(rookieId, `Program Rookie League ${ts}`);

  // Seed 5 distinct active sport programs — the rookie free limit.
  const sports = ['basketball', 'soccer', 'baseball', 'football', 'volleyball'];
  for (const sport of sports) {
    await seedActiveProgram(rookieOrgId, rookieId, sport);
  }
});

afterAll(async () => {
  try {
    const allTeamIds = [...seededTeamIds, ...createdTeamIds].filter(Boolean);
    if (allTeamIds.length) {
      await prisma.teamMembership.deleteMany({ where: { team_id: { in: allTeamIds } } });
      await prisma.team.deleteMany({ where: { id: { in: allTeamIds } } });
    }
    if (seededProgramIds.length) {
      await prisma.sportProgram.deleteMany({ where: { id: { in: seededProgramIds } } });
    }
    if (rookieOrgId) {
      await prisma.organizationMembership.deleteMany({
        where: { organization_id: rookieOrgId },
      });
      await prisma.organization.delete({ where: { id: rookieOrgId } });
    }
    if (rookieId) {
      await prisma.user.deleteMany({ where: { id: rookieId } });
    }
  } catch (e) {
    console.warn('Cleanup error (non-critical):', e);
  }
});

describe('Rookie program-limit enforcement (Phase 4)', () => {
  it('blocks a rookie with 5 active-sport programs from starting a 6th sport', async () => {
    const res = await createTeamViaApi(rookieToken, `Rookie Tennis ${ts}`, rookieOrgId);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PROGRAM_LIMIT_EXCEEDED');
    expect(res.body.limit).toBe(5);
    expect(res.body.current).toBe(5);
    if (res.body.team?.id) createdTeamIds.push(res.body.team.id);
  });

  it('allows a rookie at the 5-program limit to add a level team to an EXISTING program (free)', async () => {
    const existingProgramId = seededProgramIds[0]!;
    const res = await createTeamViaApi(
      rookieToken,
      `Rookie Basketball JV ${ts}`,
      rookieOrgId,
      existingProgramId
    );
    expect(res.status).toBe(201);
    expect(res.body.team.program_id).toBe(existingProgramId);
    createdTeamIds.push(res.body.team.id);
  });

  it('allows a rookie at the limit to add a level team to an EXISTING sport WITHOUT program_id (gate mirrors the tx sport→program resolution)', async () => {
    // No program_id passed — only the sport. The create transaction groups this
    // into the org's existing (org, 'basketball') program, so it must NOT be
    // mis-gated as a new billable program. Regression guard for the false-block.
    const res = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${rookieToken}`)
      .send({
        name: `Rookie Basketball Freshman ${ts}`,
        description: 'level team resolved by sport, no program_id',
        organization_id: rookieOrgId,
        club_type: 'sport',
        sport: 'basketball',
      });
    expect(res.status).toBe(201);
    // server grouped it into the pre-existing basketball program (seeded first)
    expect(res.body.team.program_id).toBe(seededProgramIds[0]);
    createdTeamIds.push(res.body.team.id);
  });
});
