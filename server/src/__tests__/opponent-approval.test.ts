/**
 * Opponent-approval workflow (2026-07-06, user-approved design): when a coach
 * links a REAL VarsityHub team as opponent that they do NOT manage, the game
 * only becomes publicly visible once that opponent team's staff confirms it.
 * Independent of `approval_status` (platform moderation gate).
 *
 * This suite exercises the real routes end-to-end: creation trigger,
 * decision endpoint authorization (including IDOR), the race guard, and the
 * public-visibility exclusion.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../app.js';

let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Opponent-approval workflow', () => {
  let homeCoachId = '';
  let homeCoachToken = '';
  let awayCoachId = '';
  let awayCoachToken = '';
  let homeTeamId = '';
  let awayTeamId = '';
  let orgId = '';

  const makeCoach = async (label: string) => {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: `opp-approval-${label}-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: `Opponent Approval ${label}`,
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
    return { id: user.id, token: signJwt({ id: user.id }) };
  };

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const home = await makeCoach('home');
    homeCoachId = home.id;
    homeCoachToken = home.token;
    const away = await makeCoach('away');
    awayCoachId = away.id;
    awayCoachToken = away.token;

    const org = await prisma.organization.create({
      data: {
        name: `Opponent Approval Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: homeCoachId,
      },
    });
    orgId = org.id;
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: homeCoachId, role: 'owner', status: 'active' },
    });

    const homeTeam = await prisma.team.create({
      data: { name: `Opponent Approval Home ${ts}`, organization_id: orgId },
    });
    homeTeamId = homeTeam.id;
    await prisma.teamMembership.create({
      data: { team_id: homeTeamId, user_id: homeCoachId, role: 'coach', status: 'active' },
    });

    const awayOrg = await prisma.organization.create({
      data: {
        name: `Opponent Approval Away Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: awayCoachId,
      },
    });
    const awayTeam = await prisma.team.create({
      data: { name: `Opponent Approval Away ${ts}`, organization_id: awayOrg.id },
    });
    awayTeamId = awayTeam.id;
    await prisma.organizationMembership.create({
      data: { organization_id: awayOrg.id, user_id: awayCoachId, role: 'owner', status: 'active' },
    });
    await prisma.teamMembership.create({
      data: { team_id: awayTeamId, user_id: awayCoachId, role: 'coach', status: 'active' },
    });
  });

  afterAll(async () => {
    const userIds = [homeCoachId, awayCoachId].filter(Boolean);
    try {
      await prisma.notification.deleteMany({ where: { user_id: { in: userIds } } }).catch(() => {});
      await prisma.event
        .deleteMany({
          where: { OR: [{ team_id: homeTeamId }, { team_id: awayTeamId }] },
        })
        .catch(() => {});
      await prisma.game
        .deleteMany({
          where: {
            OR: [
              { home_team_id: { in: [homeTeamId, awayTeamId].filter(Boolean) } },
              { away_team_id: { in: [homeTeamId, awayTeamId].filter(Boolean) } },
            ],
          },
        })
        .catch(() => {});
      await prisma.teamMembership
        .deleteMany({
          where: { team_id: { in: [homeTeamId, awayTeamId].filter(Boolean) } },
        })
        .catch(() => {});
      await prisma.team
        .deleteMany({ where: { id: { in: [homeTeamId, awayTeamId].filter(Boolean) } } })
        .catch(() => {});
      await prisma.organizationMembership
        .deleteMany({ where: { user_id: { in: userIds } } })
        .catch(() => {});
      await prisma.organization
        .deleteMany({ where: { league_owner_id: { in: userIds } } })
        .catch(() => {});
      await prisma.user.deleteMany({ where: { id: { in: userIds } } }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  it('creation: linking a real opponent team the creator does not manage sets pending consent', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${homeCoachToken}`)
      .send({
        title: `Opponent Consent Game ${ts}`,
        location: 'Test Field',
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
      });

    expect(res.status).toBe(201);
    expect(res.body.opponent_approval_status).toBe('pending');
    expect(res.body.opponent_approval_team_id).toBe(awayTeamId);
    // Moderation approval is independent — coach auto-approves on create.
    expect(res.body.approval_status).toBe('approved');
  });

  it('creation: a free-text opponent (no real team) never triggers opponent consent', async () => {
    const res = await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${homeCoachToken}`)
      .send({
        title: `Free Text Opponent Game ${ts}`,
        location: 'Test Field',
        home_team_id: homeTeamId,
        away_team_name: 'Some Local Rec Team',
      });

    expect(res.status).toBe(201);
    expect(res.body.opponent_approval_status).toBe('not_required');
    expect(res.body.opponent_approval_team_id).toBeNull();
  });

  describe('decision endpoint authorization', () => {
    let gameId = '';

    beforeAll(async () => {
      const res = await request(app)
        .post('/games')
        .set('Authorization', `Bearer ${homeCoachToken}`)
        .send({
          title: `Decision Auth Game ${ts}`,
          location: 'Test Field',
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
        });
      gameId = res.body.id;
    });

    it('blocks the proposing coach from deciding their own game request (IDOR)', async () => {
      const res = await request(app)
        .post(`/games/${gameId}/opponent-approval`)
        .set('Authorization', `Bearer ${homeCoachToken}`)
        .send({ decision: 'approve' });
      expect(res.status).toBe(403);
    });

    it('blocks a user who does not manage the opponent team', async () => {
      const outsider = await makeCoach('outsider');
      const res = await request(app)
        .post(`/games/${gameId}/opponent-approval`)
        .set('Authorization', `Bearer ${outsider.token}`)
        .send({ decision: 'approve' });
      expect(res.status).toBe(403);
      await prisma.user.deleteMany({ where: { id: outsider.id } }).catch(() => {});
    });

    it('allows the opponent team coach to approve', async () => {
      const res = await request(app)
        .post(`/games/${gameId}/opponent-approval`)
        .set('Authorization', `Bearer ${awayCoachToken}`)
        .send({ decision: 'approve' });
      expect(res.status).toBe(200);
      expect(res.body.opponent_approval_status).toBe('approved');
      expect(res.body.opponent_approved_by_id).toBe(awayCoachId);
    });

    it('race guard: a second decision on the same game is a 409, not a silent overwrite', async () => {
      const res = await request(app)
        .post(`/games/${gameId}/opponent-approval`)
        .set('Authorization', `Bearer ${awayCoachToken}`)
        .send({ decision: 'decline', reason: 'Changed my mind' });
      expect(res.status).toBe(409);
    });
  });

  describe('decline path', () => {
    let gameId = '';

    beforeAll(async () => {
      const res = await request(app)
        .post('/games')
        .set('Authorization', `Bearer ${homeCoachToken}`)
        .send({
          title: `Decline Path Game ${ts}`,
          location: 'Test Field',
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
        });
      gameId = res.body.id;
    });

    it('records the decline reason and stops it appearing in the opponent-pending list afterward', async () => {
      const decision = await request(app)
        .post(`/games/${gameId}/opponent-approval`)
        .set('Authorization', `Bearer ${awayCoachToken}`)
        .send({ decision: 'decline', reason: 'Schedule conflict' });
      expect(decision.status).toBe(200);
      expect(decision.body.opponent_approval_status).toBe('declined');
      expect(decision.body.opponent_declined_reason).toBe('Schedule conflict');

      const pending = await request(app)
        .get('/games/opponent-pending')
        .set('Authorization', `Bearer ${awayCoachToken}`);
      expect(pending.status).toBe(200);
      expect(pending.body.some((g: any) => g.id === gameId)).toBe(false);
    });

    it('excludes a declined-consent game from the public games list', async () => {
      const list = await request(app).get('/games').query({ limit: 100 });
      expect(list.status).toBe(200);
      const ids = (list.body.games || list.body).map((g: any) => g.id);
      expect(ids).not.toContain(gameId);
    });
  });

  describe('opponent-pending list', () => {
    it('surfaces a newly proposed game to the opponent coach and not to an unrelated coach', async () => {
      const created = await request(app)
        .post('/games')
        .set('Authorization', `Bearer ${homeCoachToken}`)
        .send({
          title: `Pending List Game ${ts}`,
          location: 'Test Field',
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
        });
      const gameId = created.body.id;

      const asOpponent = await request(app)
        .get('/games/opponent-pending')
        .set('Authorization', `Bearer ${awayCoachToken}`);
      expect(asOpponent.status).toBe(200);
      expect(asOpponent.body.some((g: any) => g.id === gameId)).toBe(true);

      const asProposer = await request(app)
        .get('/games/opponent-pending')
        .set('Authorization', `Bearer ${homeCoachToken}`);
      expect(asProposer.status).toBe(200);
      expect(asProposer.body.some((g: any) => g.id === gameId)).toBe(false);
    });
  });
});
