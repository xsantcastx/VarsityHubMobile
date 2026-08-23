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
      },
    });
    programId = program.id;

    const varsityTeam = await prisma.team.create({
      data: {
        name: `Program Summary Varsity ${ts}`,
        organization_id: orgId,
        program_id: programId,
        level: 'varsity',
        gender: 'girls',
      },
    });
    varsityTeamId = varsityTeam.id;

    const jvTeam = await prisma.team.create({
      data: {
        name: `Program Summary JV ${ts}`,
        organization_id: orgId,
        program_id: programId,
        level: 'jv',
        gender: 'girls',
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
        gender: 'girls',
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

  it('returns the program and its levels in canonical order; a direct level-team follow does not count as following the program', async () => {
    const res = await request(app)
      .get(`/programs/${programId}/screen-summary`)
      .set('Authorization', `Bearer ${followerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.program.sport).toBe('basketball');
    expect(res.body.program.gender).toBeUndefined();
    // The private freshman team is hidden from `follower` (they don't follow it).
    expect(res.body.levels.map((l: any) => l.level)).toEqual(['varsity', 'jv']);
    expect(res.body.levels[0].team.id).toBe(varsityTeamId);
    // gender now lives on the team (program is keyed by sport only).
    expect(res.body.levels[0].team.gender).toBe('girls');
    // INTENT semantics (flipped from the old union-over-TeamFollow model):
    // `follower` only has a direct TeamFollow row on the JV team — no
    // ProgramFollow row — so they do NOT count as following the program, and
    // no ProgramFollow rows exist anywhere in the suite yet.
    expect(res.body.program.followers_count).toBe(0);
    expect(res.body.program.is_following).toBe(false);
    expect(res.body.counts.teams).toBe(2);
  });

  it('is guest-browsable: no auth token returns the public program with its visible levels (private teams excluded)', async () => {
    // program-page is a GUEST_BROWSE_ROUTE_SEGMENT and the documented canonical
    // PUBLIC surface for a sport program — mirroring GET /teams/:id/screen-summary,
    // which is also guest-accessible. A guest (or a viewer whose token lapsed)
    // must see the program, not a hard 401 "Unauthorized" wall.
    const res = await request(app).get(`/programs/${programId}/screen-summary`);
    expect(res.status).toBe(200);
    expect(res.body.program.id).toBe(programId);
    // Public varsity + jv visible in canonical order; private freshman excluded.
    expect(res.body.levels.map((l: any) => l.level)).toEqual(['varsity', 'jv']);
    expect(res.body.counts.teams).toBe(2);
    // A guest follows nothing.
    expect(res.body.program.is_following).toBe(false);
  });

  it('followers_count is the ProgramFollow count, not a union over level-team followers', async () => {
    // Dedicated fresh users so this test is self-contained and order-independent.
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    const mk = async (label: string) => {
      const u = await prisma.user.create({
        data: {
          email: `program-summary-intent-${label}-${ts}@example.com`,
          password_hash: passwordHash,
          display_name: `Program Summary Intent ${label}`,
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
    const userA = await mk('a'); // follows the PROGRAM (writes a ProgramFollow row)
    const userB = await mk('b'); // follows only a level team directly (no ledger row)

    await request(app)
      .post(`/programs/${programId}/follow`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);
    await prisma.teamFollow.create({ data: { user_id: userB.id, team_id: jvTeamId } });

    const resA = await request(app)
      .get(`/programs/${programId}/screen-summary`)
      .set('Authorization', `Bearer ${userA.token}`);
    expect(resA.status).toBe(200);
    // Only userA has a ProgramFollow row — userB's direct TeamFollow does not
    // contribute to the count under intent semantics.
    expect(resA.body.program.followers_count).toBe(1);
    expect(resA.body.program.is_following).toBe(true);

    const resB = await request(app)
      .get(`/programs/${programId}/screen-summary`)
      .set('Authorization', `Bearer ${userB.token}`);
    expect(resB.status).toBe(200);
    expect(resB.body.program.followers_count).toBe(1);
    expect(resB.body.program.is_following).toBe(false);

    // Cleanup: fully undo so later tests in this suite see a clean slate.
    await request(app)
      .delete(`/programs/${programId}/follow`)
      .set('Authorization', `Bearer ${userA.token}`)
      .expect(200);
    await prisma.teamFollow.deleteMany({ where: { user_id: userB.id } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  });

  it('a viewer who follows no level team is not following the program', async () => {
    const res = await request(app)
      .get(`/programs/${programId}/screen-summary`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(res.body.program.is_following).toBe(false);
    // No ProgramFollow rows exist at this point in the suite.
    expect(res.body.program.followers_count).toBe(0);
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

  it('following a program follows every current PUBLIC level team, idempotently; skips a private team the viewer has no direct access to', async () => {
    // The private freshman team is `status: 'active'` too (privacy and status
    // are independent), so the program has 3 active level teams, but the
    // follow fan-out excludes the private one for strangerId, who has no
    // direct access (no membership, no org owner/manager role) — following
    // a program must not silently unlock a private level team's roster.
    const publicTeamIds = [varsityTeamId, jvTeamId];
    const first = await request(app)
      .post(`/programs/${programId}/follow`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(first.status).toBe(200);
    expect(first.body.followed_team_ids.sort()).toEqual(publicTeamIds.sort());
    expect(first.body.followed_team_ids).not.toContain(privateTeamId);

    // second call must not throw on the unique (user_id, team_id) constraint
    await request(app)
      .post(`/programs/${programId}/follow`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(200);

    const rows = await prisma.teamFollow.count({
      where: { user_id: strangerId, team_id: { in: publicTeamIds } },
    });
    expect(rows).toBe(2);

    const privateRow = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: strangerId, team_id: privateTeamId } },
    });
    expect(privateRow).toBeNull();
  });

  it("following a program does not unlock a private level team's screen-summary for a viewer with no direct access", async () => {
    // Regression proof for the fan-out privacy gate above: strangerId is
    // still following the program from the previous test (no unfollow has
    // run yet), but GET /teams/:id/screen-summary for the private team must
    // still 404 them — the program-follow fan-out must not have created a
    // TeamFollow row that isTeamHiddenFromViewer would treat as access.
    const res = await request(app)
      .get(`/teams/${privateTeamId}/screen-summary`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(res.status).toBe(404);
  });

  it('unfollowing a program removes every level-team follow', async () => {
    const allTeamIds = [varsityTeamId, jvTeamId, privateTeamId];
    await request(app)
      .delete(`/programs/${programId}/follow`)
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(200);
    const rows = await prisma.teamFollow.count({
      where: { user_id: strangerId, team_id: { in: allTeamIds } },
    });
    expect(rows).toBe(0);
  });

  it('404s follow on an unknown program', async () => {
    // 'does-not-exist' would 400 under registerIdValidation's CUID/UUID format
    // check before the route body ever runs — use a well-formed-but-nonexistent
    // CUID so this actually exercises the route's own 404 branch.
    await request(app)
      .post('/programs/cknownexistcknownexistckno/follow')
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(404);
  });

  it('404s unfollow on an unknown program', async () => {
    await request(app)
      .delete('/programs/cknownexistcknownexistckno/follow')
      .set('Authorization', `Bearer ${strangerToken}`)
      .expect(404);
  });

  it('follow writes a ProgramFollow row and stamps the fanned-out TeamFollow rows; excludes the private team the user has no direct access to; idempotent on repeat', async () => {
    const allTeamIds = [varsityTeamId, jvTeamId, privateTeamId];

    // Use a DEDICATED fresh user with a guaranteed-clean follow slate. The
    // stamped-row assertion below requires that NO pre-existing (null-stamped)
    // direct follow exists — createMany({ skipDuplicates }) correctly leaves
    // such a row's via_program_id null, which would fail the `toBe(programId)`
    // check. Reusing a user another test already touched makes this
    // order-dependent, so mint one here.
    const stampUser = await prisma.user.create({
      data: {
        email: `program-summary-stampuser-${ts}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: 'Program Summary StampUser',
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
    const stampUserId = stampUser.id;
    const stampUserToken = signJwt({ id: stampUserId });

    const first = await request(app)
      .post(`/programs/${programId}/follow`)
      .set('Authorization', `Bearer ${stampUserToken}`);
    expect(first.status).toBe(200);

    const ledgerRow = await prisma.programFollow.findUnique({
      where: { user_id_program_id: { user_id: stampUserId, program_id: programId } },
    });
    expect(ledgerRow).not.toBeNull();

    const stampedRows = await prisma.teamFollow.findMany({
      where: { user_id: stampUserId, team_id: { in: allTeamIds } },
    });
    // Only the 2 PUBLIC level teams are stamped — stampUser has no direct
    // access (no membership, no org owner/manager role) to the private
    // freshman team, so the fan-out must not silently grant them a follow
    // row on it (that would defeat is_private the same way an unguarded
    // POST /teams/:id/follow would).
    expect(stampedRows.length).toBe(2);
    for (const row of stampedRows) {
      expect(row.via_program_id).toBe(programId);
    }
    const privateRow = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: stampUserId, team_id: privateTeamId } },
    });
    expect(privateRow).toBeNull();

    // Repeat call must not throw on the ProgramFollow composite PK or the
    // TeamFollow composite PK, and row counts must stay stable.
    await request(app)
      .post(`/programs/${programId}/follow`)
      .set('Authorization', `Bearer ${stampUserToken}`)
      .expect(200);

    const ledgerCount = await prisma.programFollow.count({
      where: { user_id: stampUserId, program_id: programId },
    });
    expect(ledgerCount).toBe(1);
    const stampedCount = await prisma.teamFollow.count({
      where: { user_id: stampUserId, team_id: { in: allTeamIds } },
    });
    expect(stampedCount).toBe(2);

    // Cleanup: remove this test's own rows and the dedicated user.
    await prisma.programFollow.deleteMany({ where: { user_id: stampUserId } });
    await prisma.teamFollow.deleteMany({ where: { user_id: stampUserId } });
    await prisma.user.deleteMany({ where: { id: stampUserId } });
  });

  it('unfollow is lossless: a pre-existing direct level-team follow survives program unfollow', async () => {
    // Reuse `strangerId`, who has no follow rows at this point in the suite.
    // Seed a DIRECT follow of the JV team (via_program_id null) BEFORE the
    // program follow — this simulates a year-old direct follower.
    await prisma.teamFollow.create({ data: { user_id: strangerId, team_id: jvTeamId } });

    const followRes = await request(app)
      .post(`/programs/${programId}/follow`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(followRes.status).toBe(200);

    // The pre-existing JV row must still be null-stamped: createMany with
    // skipDuplicates does not touch existing rows, so the direct follow is
    // untouched by the fan-out (this is the mechanism that makes unfollow
    // lossless below, not a bug to "fix").
    const jvRowAfterFollow = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: strangerId, team_id: jvTeamId } },
    });
    expect(jvRowAfterFollow?.via_program_id).toBeNull();

    const varsityRowAfterFollow = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: strangerId, team_id: varsityTeamId } },
    });
    expect(varsityRowAfterFollow?.via_program_id).toBe(programId);

    const unfollowRes = await request(app)
      .delete(`/programs/${programId}/follow`)
      .set('Authorization', `Bearer ${strangerToken}`);
    expect(unfollowRes.status).toBe(200);

    // ProgramFollow ledger row gone.
    const ledgerRow = await prisma.programFollow.findUnique({
      where: { user_id_program_id: { user_id: strangerId, program_id: programId } },
    });
    expect(ledgerRow).toBeNull();

    // The stamped varsity + private-team rows are gone.
    const varsityRowAfter = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: strangerId, team_id: varsityTeamId } },
    });
    expect(varsityRowAfter).toBeNull();
    const privateRowAfter = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: strangerId, team_id: privateTeamId } },
    });
    expect(privateRowAfter).toBeNull();

    // The null-stamped JV row SURVIVES the program unfollow.
    const jvRowAfter = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: strangerId, team_id: jvTeamId } },
    });
    expect(jvRowAfter).not.toBeNull();
    expect(jvRowAfter?.via_program_id).toBeNull();

    // Cleanup.
    await prisma.teamFollow.deleteMany({ where: { user_id: strangerId, team_id: jvTeamId } });
  });
});
