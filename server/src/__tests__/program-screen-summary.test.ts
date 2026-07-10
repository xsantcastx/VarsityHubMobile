import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../app.js';

let prisma: any;
let signJwt: any;
const ts = Date.now();

describe('GET /programs/:id/screen-summary', () => {
  let ownerId = '',
    followerId = '',
    follower2Id = '',
    strangerId = '';
  let ownerToken = '',
    followerToken = '',
    follower2Token = '',
    strangerToken = '';
  let orgId = '';
  let programId = '';
  let varsityTeamId = '';
  let jvTeamId = '';
  let privateTeamId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const mkUser = async (label: string) => {
      const u = await prisma.user.create({
        data: {
          email: `program-summary-${label}-${ts}@example.com`,
          password_hash: passwordHash,
          display_name: `Program Summary ${label}`,
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
      return { id: u.id, token: signJwt({ id: u.id }) };
    };
    const owner = await mkUser('owner');
    ownerId = owner.id;
    ownerToken = owner.token;
    const follower = await mkUser('follower');
    followerId = follower.id;
    followerToken = follower.token;
    const follower2 = await mkUser('follower2');
    follower2Id = follower2.id;
    follower2Token = follower2.token;
    const stranger = await mkUser('stranger');
    strangerId = stranger.id;
    strangerToken = stranger.token;

    const org = await prisma.organization.create({
      data: {
        name: `Program Summary Org ${ts}`,
        org_type: 'school',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: ownerId,
      },
    });
    orgId = org.id;
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: ownerId, role: 'owner', status: 'active' },
    });

    const program = await prisma.sportProgram.create({
      data: {
        organization_id: orgId,
        sport: 'basketball',
        gender: 'girls',
      },
    });
    programId = program.id;

    const varsityTeam = await prisma.team.create({
      data: {
        name: `Program Summary Varsity ${ts}`,
        organization_id: orgId,
        program_id: programId,
        level: 'varsity',
      },
    });
    varsityTeamId = varsityTeam.id;

    const jvTeam = await prisma.team.create({
      data: {
        name: `Program Summary JV ${ts}`,
        organization_id: orgId,
        program_id: programId,
        level: 'jv',
      },
    });
    jvTeamId = jvTeam.id;

    // A private freshman-level team in the same program. Hidden from viewers
    // who don't follow / aren't members of it.
    const privateTeam = await prisma.team.create({
      data: {
        name: `Program Summary Private Freshman ${ts}`,
        organization_id: orgId,
        program_id: programId,
        level: 'freshman',
      },
    });
    privateTeamId = privateTeam.id;
    await prisma.team.update({ where: { id: privateTeamId }, data: { is_private: true } });

    // Follow graph:
    //   follower  → jv
    //   follower2 → varsity, jv, freshman(private)
    // Distinct union of followers across ALL level teams = {follower, follower2} = 2,
    // even though follower2 alone contributes 3 follow rows.
    await prisma.teamFollow.createMany({
      data: [
        { user_id: followerId, team_id: jvTeamId },
        { user_id: follower2Id, team_id: varsityTeamId },
        { user_id: follower2Id, team_id: jvTeamId },
        { user_id: follower2Id, team_id: privateTeamId },
      ],
    });
  });

  afterAll(async () => {
    await prisma.teamFollow
      .deleteMany({ where: { team_id: { in: [varsityTeamId, jvTeamId, privateTeamId] } } })
      .catch(() => {});
    await prisma.team.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.sportProgram.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organizationMembership
      .deleteMany({ where: { organization_id: orgId } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user
      .deleteMany({ where: { id: { in: [ownerId, followerId, follower2Id, strangerId] } } })
      .catch(() => {});
  });

  it('returns the program, its levels in canonical order, and a distinct follower count', async () => {
    const res = await request(app)
      .get(`/programs/${programId}/screen-summary`)
      .set('Authorization', `Bearer ${followerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.program.sport).toBe('basketball');
    expect(res.body.program.gender).toBe('girls');
    // The private freshman team is hidden from `follower` (they don't follow it).
    expect(res.body.levels.map((l: any) => l.level)).toEqual(['varsity', 'jv']);
    expect(res.body.levels[0].team.id).toBe(varsityTeamId);
    // Union of distinct followers across all level teams = {follower, follower2} = 2.
    expect(res.body.program.followers_count).toBe(2);
    expect(res.body.program.is_following).toBe(true);
    expect(res.body.counts.teams).toBe(2);
  });

  it('counts distinct follower users, not follow rows (union semantics)', async () => {
    // follower2 follows THREE level teams but must count once. A plain row
    // count would report 4 (1 for follower + 3 for follower2); groupBy(user_id)
    // reports 2.
    const res = await request(app)
      .get(`/programs/${programId}/screen-summary`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.program.followers_count).toBe(2);
  });

  it('a viewer who follows no level team is not following the program', async () => {
    const res = await request(app)
      .get(`/programs/${programId}/screen-summary`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(res.body.program.is_following).toBe(false);
    expect(res.body.program.followers_count).toBe(2);
  });

  it('excludes a private level team from a stranger, includes it for a follower of it', async () => {
    // Stranger: private freshman team must NOT appear.
    const strangerRes = await request(app)
      .get(`/programs/${programId}/screen-summary`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(strangerRes.status).toBe(200);
    expect(strangerRes.body.levels.map((l: any) => l.level)).not.toContain('freshman');
    expect(strangerRes.body.levels.map((l: any) => l.team.id)).not.toContain(privateTeamId);
    expect(strangerRes.body.counts.teams).toBe(2);

    // follower2 follows the private freshman team → it IS included for them.
    const followerRes = await request(app)
      .get(`/programs/${programId}/screen-summary`)
      .set('Authorization', `Bearer ${follower2Token}`);
    expect(followerRes.status).toBe(200);
    expect(followerRes.body.levels.map((l: any) => l.level)).toEqual(['varsity', 'jv', 'freshman']);
    expect(followerRes.body.levels.map((l: any) => l.team.id)).toContain(privateTeamId);
    expect(followerRes.body.counts.teams).toBe(3);
  });

  it('404s an unknown program', async () => {
    await request(app)
      .get('/programs/cknownexistcknownexistckno/screen-summary')
      .set('Authorization', `Bearer ${followerToken}`)
      .expect(404);
  });
});
