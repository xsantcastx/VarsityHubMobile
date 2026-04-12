import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;

const RUN_ID = Date.now();
const TEST_PASSWORD = 'TestPassword123!';
const APPROVED_COACH_EMAIL = `games-approved-coach-${RUN_ID}@example.com`;
const PENDING_COACH_EMAIL = `games-pending-coach-${RUN_ID}@example.com`;

describe('API Game Endpoints', () => {
  let approvedCoachId: string;
  let approvedCoachToken: string;
  let pendingCoachId: string;
  let pendingCoachToken: string;
  let activeTeamId: string;
  let inactiveTeamId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

    const approvedCoach = await prisma.user.create({
      data: {
        email: APPROVED_COACH_EMAIL,
        password_hash: passwordHash,
        display_name: 'Approved Game Coach',
        email_verified: true,
        preferences: {
          role: 'coach',
          approval_status: 'APPROVED',
        },
      },
    });
    approvedCoachId = approvedCoach.id;
    approvedCoachToken = signJwt({ id: approvedCoachId });

    const pendingCoach = await prisma.user.create({
      data: {
        email: PENDING_COACH_EMAIL,
        password_hash: passwordHash,
        display_name: 'Pending Game Coach',
        email_verified: true,
        preferences: {
          role: 'coach',
          approval_status: 'PENDING',
        },
      },
    });
    pendingCoachId = pendingCoach.id;
    pendingCoachToken = signJwt({ id: pendingCoachId });

    const [activeTeam, inactiveTeam] = await Promise.all([
      prisma.team.create({
        data: {
          name: `Game Active Team ${RUN_ID}`,
          description: 'Active membership fixture',
        },
      }),
      prisma.team.create({
        data: {
          name: `Game Inactive Team ${RUN_ID}`,
          description: 'Inactive membership fixture',
        },
      }),
    ]);

    activeTeamId = activeTeam.id;
    inactiveTeamId = inactiveTeam.id;

    await prisma.teamMembership.createMany({
      data: [
        {
          team_id: activeTeamId,
          user_id: approvedCoachId,
          role: 'owner',
          status: 'active',
        },
        {
          team_id: inactiveTeamId,
          user_id: approvedCoachId,
          role: 'owner',
          status: 'archived',
        },
        {
          team_id: activeTeamId,
          user_id: pendingCoachId,
          role: 'owner',
          status: 'active',
        },
      ],
    });
  });

  afterAll(async () => {
    try {
      await prisma.event.deleteMany({
        where: {
          OR: [
            { creator_id: { in: [approvedCoachId, pendingCoachId] } },
            { game: { created_by_id: { in: [approvedCoachId, pendingCoachId] } } },
          ],
        },
      });
      await prisma.game.deleteMany({
        where: { created_by_id: { in: [approvedCoachId, pendingCoachId] } },
      });
      await prisma.teamMembership.deleteMany({
        where: {
          user_id: { in: [approvedCoachId, pendingCoachId] },
          team_id: { in: [activeTeamId, inactiveTeamId] },
        },
      });
      await prisma.team.deleteMany({
        where: { id: { in: [activeTeamId, inactiveTeamId] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [approvedCoachId, pendingCoachId] } },
      });
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error);
    }
  });

  it('allows approved coaches with an active managed home team to create games', async () => {
    const response = await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${approvedCoachToken}`)
      .send({
        title: 'Approved Coach Game',
        home_team_id: activeTeamId,
        date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        location: 'Home Stadium',
      })
      .expect(201);

    expect(response.body.id).toBeTruthy();
    expect(response.body.approval_status).toBe('approved');
    expect(response.body.created_by_id).toBe(approvedCoachId);
    expect(response.body.home_team_id).toBe(activeTeamId);
  });

  it('rejects pending coaches even if they manage the home team', async () => {
    const response = await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${pendingCoachToken}`)
      .send({
        title: 'Pending Coach Game',
        home_team_id: activeTeamId,
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Pending Stadium',
      })
      .expect(403);

    expect(response.body.error).toBe('COACH_APPROVAL_REQUIRED');
  });

  it('rejects approved coaches whose team membership is not active', async () => {
    const response = await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${approvedCoachToken}`)
      .send({
        title: 'Archived Membership Game',
        home_team_id: inactiveTeamId,
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Archived Stadium',
      })
      .expect(403);

    expect(response.body.error).toBe('TEAM_MANAGEMENT_REQUIRED');
  });

  it('requires a home team for non-admin game creation', async () => {
    const response = await request(app)
      .post('/games')
      .set('Authorization', `Bearer ${approvedCoachToken}`)
      .send({
        title: 'No Home Team Game',
        date: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Unknown Stadium',
      })
      .expect(400);

    expect(response.body.error).toBe('HOME_TEAM_REQUIRED');
  });
});
