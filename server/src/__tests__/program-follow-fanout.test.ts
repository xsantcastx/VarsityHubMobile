import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../app.js';
import { fanOutProgramFollowersToTeam } from '../lib/programFollowFanout.js';

let prisma: any;
let signJwt: any;
const ts = Date.now();

describe('fanOutProgramFollowersToTeam — team-ADD fan-out', () => {
  let ownerId = '';
  let ownerToken = '';
  let progFollowerAId = '';
  let progFollowerBId = '';
  let progFollowerCId = '';
  let directOnlyId = ''; // control: follows varsity directly, NOT the program
  let orgId = '';
  let programId = '';
  let varsityTeamId = '';
  let jvTeamId = '';

  const mkUser = async (label: string) => {
    const u = await prisma.user.create({
      data: {
        email: `program-fanout-${label}-${ts}@example.com`,
        password_hash: await bcrypt.hash('TestPassword123!', 10),
        display_name: `Program Fanout ${label}`,
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

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const owner = await mkUser('owner');
    ownerId = owner.id;
    ownerToken = owner.token;
    progFollowerAId = (await mkUser('proga')).id;
    progFollowerBId = (await mkUser('progb')).id;
    progFollowerCId = (await mkUser('progc')).id;
    directOnlyId = (await mkUser('direct')).id;

    const org = await prisma.organization.create({
      data: {
        name: `Program Fanout Org ${ts}`,
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
      data: { organization_id: orgId, sport: 'basketball', gender: 'girls' },
    });
    programId = program.id;

    const varsityTeam = await prisma.team.create({
      data: {
        name: `Program Fanout Varsity ${ts}`,
        organization_id: orgId,
        program_id: programId,
        level: 'varsity',
        status: 'active',
      },
    });
    varsityTeamId = varsityTeam.id;

    // Three users follow the PROGRAM (intent ledger rows). Seed the ledger
    // directly — we're testing the team-ADD fan-out, not the follow endpoint.
    await prisma.programFollow.createMany({
      data: [
        { user_id: progFollowerAId, program_id: programId },
        { user_id: progFollowerBId, program_id: programId },
        { user_id: progFollowerCId, program_id: programId },
      ],
    });

    // Control: a user who follows the varsity level team DIRECTLY (no
    // ProgramFollow row). The fan-out must NOT reach them — it keys on the
    // ProgramFollow ledger, not the old union-over-level-teams heuristic.
    await prisma.teamFollow.create({
      data: { user_id: directOnlyId, team_id: varsityTeamId },
    });
  });

  afterAll(async () => {
    const userIds = [ownerId, progFollowerAId, progFollowerBId, progFollowerCId, directOnlyId];
    await prisma.teamFollow
      .deleteMany({ where: { team_id: { in: [varsityTeamId, jvTeamId].filter(Boolean) } } })
      .catch(() => {});
    await prisma.teamFollow.deleteMany({ where: { user_id: { in: userIds } } }).catch(() => {});
    await prisma.programFollow.deleteMany({ where: { program_id: programId } }).catch(() => {});
    await prisma.team.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.sportProgram.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
    await prisma.organizationMembership
      .deleteMany({ where: { organization_id: orgId } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
  });

  it('fans the program followers out to a newly added level team, stamped via_program_id; excludes the direct-only control user', async () => {
    // A JV team is added to the program AFTER the three users followed it.
    const jvTeam = await prisma.team.create({
      data: {
        name: `Program Fanout JV ${ts}`,
        organization_id: orgId,
        program_id: programId,
        level: 'jv',
        status: 'active',
      },
    });
    jvTeamId = jvTeam.id;

    const result = await fanOutProgramFollowersToTeam(prisma, programId, jvTeamId);
    expect(result.truncated).toBe(false);
    expect(result.created).toBe(3);

    // All three program followers now have a stamped TeamFollow for the JV team.
    for (const uid of [progFollowerAId, progFollowerBId, progFollowerCId]) {
      const row = await prisma.teamFollow.findUnique({
        where: { user_id_team_id: { user_id: uid, team_id: jvTeamId } },
      });
      expect(row).not.toBeNull();
      expect(row.via_program_id).toBe(programId);
    }

    // The direct-only control user (no ProgramFollow row) does NOT get pulled
    // into the JV team — proves the fan-out keys on the ProgramFollow ledger.
    const controlRow = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: directOnlyId, team_id: jvTeamId } },
    });
    expect(controlRow).toBeNull();
  });

  it('is idempotent — a second fan-out creates no duplicate rows', async () => {
    const second = await fanOutProgramFollowersToTeam(prisma, programId, jvTeamId);
    expect(second.created).toBe(0);
    expect(second.truncated).toBe(false);

    const rows = await prisma.teamFollow.count({
      where: { team_id: jvTeamId, via_program_id: programId },
    });
    expect(rows).toBe(3);
  });

  it('PUT /teams/:id setting program_id triggers the fan-out to a program follower', async () => {
    // A team that starts with NO program_id, owned by the org owner.
    const looseTeam = await prisma.team.create({
      data: {
        name: `Program Fanout Loose ${ts}`,
        organization_id: orgId,
        status: 'active',
      },
    });
    await prisma.teamMembership.create({
      data: { team_id: looseTeam.id, user_id: ownerId, role: 'owner', status: 'active' },
    });

    // Sanity: the program follower has no follow row for this team yet.
    const before = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: progFollowerAId, team_id: looseTeam.id } },
    });
    expect(before).toBeNull();

    const res = await request(app)
      .put(`/teams/${looseTeam.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ program_id: programId });
    expect(res.status).toBe(200);
    expect(res.body.program_id).toBe(programId);

    // The program follower now has a stamped TeamFollow for the newly-linked team.
    const after = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: progFollowerAId, team_id: looseTeam.id } },
    });
    expect(after).not.toBeNull();
    expect(after.via_program_id).toBe(programId);
  });

  it('program-then-direct is lossless: a direct follow promotes the stamped row, which then survives a program unfollow', async () => {
    // Fresh user so this is order-independent.
    const promoteUser = await mkUser('promote');

    // 1) Follow the PROGRAM → writes the ledger row + fans out a stamped
    //    TeamFollow (via_program_id=P) for every current active level team.
    await request(app)
      .post(`/programs/${programId}/follow`)
      .set('Authorization', `Bearer ${promoteUser.token}`)
      .expect(200);

    const stampedVarsity = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: promoteUser.id, team_id: varsityTeamId } },
    });
    expect(stampedVarsity?.via_program_id).toBe(programId);

    // 2) Now follow the varsity team DIRECTLY. The endpoint must PROMOTE the
    //    stamped row — clearing via_program_id — recording genuine direct intent.
    await request(app)
      .post(`/teams/${varsityTeamId}/follow`)
      .set('Authorization', `Bearer ${promoteUser.token}`)
      .expect(201);

    const promotedVarsity = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: promoteUser.id, team_id: varsityTeamId } },
    });
    expect(promotedVarsity).not.toBeNull();
    expect(promotedVarsity.via_program_id).toBeNull();

    // A still-stamped sibling (jv) is untouched — proves only the directly
    // followed team was promoted.
    const stillStampedJv = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: promoteUser.id, team_id: jvTeamId } },
    });
    expect(stillStampedJv?.via_program_id).toBe(programId);

    // 3) Unfollow the PROGRAM. It deletes only this-program-stamped rows, so
    //    the promoted (now-unstamped) varsity follow SURVIVES while the
    //    still-stamped jv follow is removed — the inverse-lossless guarantee.
    await request(app)
      .delete(`/programs/${programId}/follow`)
      .set('Authorization', `Bearer ${promoteUser.token}`)
      .expect(200);

    const varsityAfterUnfollow = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: promoteUser.id, team_id: varsityTeamId } },
    });
    expect(varsityAfterUnfollow).not.toBeNull();
    expect(varsityAfterUnfollow.via_program_id).toBeNull();

    const jvAfterUnfollow = await prisma.teamFollow.findUnique({
      where: { user_id_team_id: { user_id: promoteUser.id, team_id: jvTeamId } },
    });
    expect(jvAfterUnfollow).toBeNull();

    // Cleanup this test's own rows + user.
    await prisma.teamFollow.deleteMany({ where: { user_id: promoteUser.id } });
    await prisma.programFollow.deleteMany({ where: { user_id: promoteUser.id } });
    await prisma.user.deleteMany({ where: { id: promoteUser.id } });
  });
});
