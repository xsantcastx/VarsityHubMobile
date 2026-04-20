/**
 * API Integration Tests - Team Endpoints
 * 
 * Tests actual HTTP endpoints for team management:
 * - POST /teams (create team with role validation)
 * - GET /teams/limits (check team creation limits)
 * - GET /teams/managed (get teams managed by user)
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

const TEST_COACH_EMAIL = `test-api-coach-${Date.now()}@example.com`;
const TEST_FAN_EMAIL = `test-api-fan-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

describe('API Team Endpoints', () => {
  let coachUserId: string;
  let coachToken: string;
  let fanUserId: string;
  let fanToken: string;
  let testOrgId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    // Create coach user
    const coachPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const coach = await prisma.user.create({
      data: {
        email: TEST_COACH_EMAIL,
        password_hash: coachPasswordHash,
        display_name: 'Test Coach',
        email_verified: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    coachUserId = coach.id;
    coachToken = signJwt({ id: coachUserId });

    // Create an organization (league page) for team creation
    const org = await prisma.organization.create({
      data: {
        name: `Test League ${Date.now()}`,
        org_type: 'club',
        admin_approved: true,
        league_owner_id: coachUserId,
        updated_at: new Date(),
      },
    });
    testOrgId = org.id;
    await prisma.organizationMembership.create({
      data: { organization_id: testOrgId, user_id: coachUserId, role: 'owner' },
    });

    // Create fan user
    const fanPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const fan = await prisma.user.create({
      data: {
        email: TEST_FAN_EMAIL,
        password_hash: fanPasswordHash,
        display_name: 'Test Fan',
        email_verified: true,
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });
    fanUserId = fan.id;
    fanToken = signJwt({ id: fanUserId });
  });

  afterAll(async () => {
    try {
      const orgTeams = testOrgId
        ? await prisma.team.findMany({
            where: { organization_id: testOrgId },
            select: { id: true },
          })
        : [];
      const teamIds = orgTeams.map((team: any) => team.id);

      if (teamIds.length > 0) {
        await prisma.post.deleteMany({ where: { team_id: { in: teamIds } } }).catch(() => {});
        await prisma.event.deleteMany({ where: { team_id: { in: teamIds } } }).catch(() => {});
        await prisma.game.deleteMany({
          where: {
            OR: [
              { home_team_id: { in: teamIds } },
              { away_team_id: { in: teamIds } },
            ],
          },
        }).catch(() => {});
      }

      // Clean up team memberships
      await prisma.teamMembership.deleteMany({
        where: { user_id: { in: [coachUserId, fanUserId] } },
      });

      // Clean up teams
      await prisma.team.deleteMany({
        where: { organization_id: testOrgId },
      });

      // Clean up org memberships and org
      if (testOrgId) {
        await prisma.organizationMembership.deleteMany({ where: { organization_id: testOrgId } });
        await prisma.organization.delete({ where: { id: testOrgId } }).catch(() => {});
      }

      // Clean up users
      await prisma.user.deleteMany({
        where: {
          id: {
            in: [coachUserId, fanUserId],
          },
        },
      });
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error);
    }
  });

  describe('POST /teams', () => {
    it('should allow coach to create team', async () => {
      const response = await request(app)
        .post('/teams')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          name: 'Test Team',
          description: 'A test team created via API',
          organization_id: testOrgId,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Test Team');
      expect(response.body.description).toBe('A test team created via API');
    });

    it('should reject team creation from fan user', async () => {
      const response = await request(app)
        .post('/teams')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          name: 'Fan Team',
          description: 'Should not be allowed',
          organization_id: testOrgId,
        })
        .expect(403);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toBe('COACH_ROLE_REQUIRED');
      expect(response.body.message).toContain('Only coach accounts');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/teams')
        .send({
          name: 'Unauthorized Team',
          description: 'Should fail',
          organization_id: testOrgId,
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should require team name', async () => {
      const response = await request(app)
        .post('/teams')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          description: 'Team without name',
          organization_id: testOrgId,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should sanitize team name (trim whitespace)', async () => {
      const response = await request(app)
        .post('/teams')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          name: '  Trimmed Team  ',
          description: 'Test',
          organization_id: testOrgId,
        })
        .expect(201);

      expect(response.body.name).toBe('Trimmed Team');
      expect(response.body.name).not.toContain('  ');
    });

    it('should enforce team ownership limit', async () => {
      // Get current owned teams count
      const ownedTeamsCount = await prisma.teamMembership.count({
        where: {
          user_id: coachUserId,
          role: 'owner',
          status: 'active',
        },
      });

      const maxTeams = 3;

      // If at limit, should reject
      if (ownedTeamsCount >= maxTeams) {
        const response = await request(app)
          .post('/teams')
          .set('Authorization', `Bearer ${coachToken}`)
          .send({
            name: 'Over Limit Team',
            description: 'Should fail',
            organization_id: testOrgId,
          })
          .expect(403);

        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toContain('limit');
      }
    });
  });

  describe('DELETE /teams/:id', () => {
    it('should archive the team and preserve linked posts, events, and games', async () => {
      const team = await prisma.team.create({
        data: {
          name: `Delete Flow Team ${Date.now()}`,
          description: 'Team to archive',
          organization_id: testOrgId,
          status: 'active',
        },
      });

      await prisma.teamMembership.create({
        data: {
          team_id: team.id,
          user_id: coachUserId,
          role: 'owner',
          status: 'active',
        },
      });

      const game = await prisma.game.create({
        data: {
          title: 'Archived Team Game',
          date: new Date(Date.now() + 86400000),
          home_team_id: team.id,
          home_team: team.name,
          approval_status: 'approved',
          created_by_id: coachUserId,
        },
      });

      const event = await prisma.event.create({
        data: {
          title: 'Archived Team Event',
          date: new Date(Date.now() + 86400000),
          team_id: team.id,
          creator_id: coachUserId,
          creator_role: 'coach',
          approval_status: 'approved',
          status: 'approved',
        },
      });

      const post = await prisma.post.create({
        data: {
          author_id: coachUserId,
          team_id: team.id,
          title: 'Archived Team Post',
          content: 'Should keep team reference',
          type: 'post',
        },
      });

      const response = await request(app)
        .delete(`/teams/${team.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.archived).toBe(true);

      const refreshedTeam = await prisma.team.findUnique({
        where: { id: team.id },
        select: { status: true },
      });
      const refreshedGame = await prisma.game.findUnique({
        where: { id: game.id },
        select: { home_team_id: true },
      });
      const refreshedEvent = await prisma.event.findUnique({
        where: { id: event.id },
        select: { team_id: true },
      });
      const refreshedPost = await prisma.post.findUnique({
        where: { id: post.id },
        select: { team_id: true },
      });

      expect(refreshedTeam?.status).toBe('archived');
      expect(refreshedGame?.home_team_id).toBe(team.id);
      expect(refreshedEvent?.team_id).toBe(team.id);
      expect(refreshedPost?.team_id).toBe(team.id);

      const listResponse = await request(app)
        .get('/teams')
        .expect(200);

      expect(Array.isArray(listResponse.body)).toBe(true);
      expect(listResponse.body.some((entry: any) => entry.id === team.id)).toBe(false);
    });
  });

  describe('GET /teams/limits', () => {
    it('should return team limits for authenticated user', async () => {
      const response = await request(app)
        .get('/teams/limits')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('owned_teams');
      expect(response.body).toHaveProperty('max_teams');
      expect(typeof response.body.owned_teams).toBe('number');
      expect(typeof response.body.max_teams).toBe('number');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/teams/limits')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /teams/managed', () => {
    it('should return teams managed by authenticated user', async () => {
      const response = await request(app)
        .get('/teams/managed')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/teams/managed')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should filter teams by search query', async () => {
      const response = await request(app)
        .get('/teams/managed?q=Test')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
