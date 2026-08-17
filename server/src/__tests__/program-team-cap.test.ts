/**
 * Regression: a SportProgram with more than 25 active level teams must not be
 * silently truncated. Two sibling paths in routes/programs.ts capped the
 * program's active teams at 25:
 *   - GET /:id/screen-summary (picker + counts) — dropped the 26th+ team and
 *     logged the [program-screen-summary] truncation warning (Sentry
 *     VARSITYHUB-3Q).
 *   - POST /:id/follow — fanned out TeamFollow rows to only the first 25, so a
 *     follower silently missed content from the rest.
 * Both must cover every active team of a realistically-sized program.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../app.js';

let prisma: any;
let signJwt: any;
const ts = Date.now();
const TEAM_COUNT = 26; // one over the historical cap of 25

describe('Program with >25 active teams', () => {
  let orgId = '';
  let programId = '';
  let followerId = '';
  let followerToken = '';
  let teamIds: string[] = [];

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const org = await prisma.organization.create({
      data: {
        name: `Program Cap Org ${ts}`,
        org_type: 'school',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    orgId = org.id;

    const program = await prisma.sportProgram.create({
      data: { organization_id: orgId, sport: 'basketball' },
    });
    programId = program.id;

    // 26 active, public level teams — one past the old cap of 25.
    await prisma.team.createMany({
      data: Array.from({ length: TEAM_COUNT }, (_, i) => ({
        name: `Program Cap Team ${i} ${ts}`,
        organization_id: orgId,
        program_id: programId,
      })),
    });
    teamIds = (
      await prisma.team.findMany({ where: { program_id: programId }, select: { id: true } })
    ).map((t: any) => t.id);

    const follower = await prisma.user.create({
      data: {
        email: `program-cap-follower-${ts}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Program Cap Follower',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    followerId = follower.id;
    followerToken = signJwt({ id: followerId });
  });

  afterAll(async () => {
    await prisma.teamFollow.deleteMany({ where: { team_id: { in: teamIds } } }).catch(() => {});
    await prisma.programFollow.deleteMany({ where: { program_id: programId } }).catch(() => {});
    await prisma.team.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.sportProgram.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: followerId } }).catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });

  it('screen-summary returns every active team, not just the first 25', async () => {
    const res = await request(app).get(`/programs/${programId}/screen-summary`);
    expect(res.status).toBe(200);
    expect(res.body.counts.teams).toBe(TEAM_COUNT);
    expect(res.body.levels.length).toBe(TEAM_COUNT);
  }, 30000);

  it('following the program fans out to every active team, not just the first 25', async () => {
    const res = await request(app)
      .post(`/programs/${programId}/follow`)
      .set('Authorization', `Bearer ${followerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.followed_team_ids.length).toBe(TEAM_COUNT);
  }, 30000);
});
