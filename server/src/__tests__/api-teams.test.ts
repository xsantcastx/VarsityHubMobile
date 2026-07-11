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
import { getTeamState } from '../lib/teamState.js';

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
  let ownerManagedCoachId: string;
  let ownerManagedCoachToken: string;
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
      select: { id: true },
    });
    testOrgId = org.id;
    await prisma.organizationMembership.create({
      data: { organization_id: testOrgId, user_id: coachUserId, role: 'owner' },
      select: { id: true },
    });

    // Create fan user
    const fanPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const fan = await prisma.user.create({
      data: {
        email: TEST_FAN_EMAIL,
        password_hash: fanPasswordHash,
        display_name: 'Test Fan',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });
    fanUserId = fan.id;
    fanToken = signJwt({ id: fanUserId });

    const ownerManagedPasswordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const ownerManagedCoach = await prisma.user.create({
      data: {
        email: `test-owner-managed-coach-${Date.now()}@example.com`,
        password_hash: ownerManagedPasswordHash,
        display_name: 'Owner Managed Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        paid_by_owner: true,
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: true,
          organization_id: testOrgId,
          coach_agreement_accepted_at: new Date().toISOString(),
        },
      },
    });
    ownerManagedCoachId = ownerManagedCoach.id;
    ownerManagedCoachToken = signJwt({ id: ownerManagedCoachId });
    await prisma.organizationMembership.create({
      data: {
        organization_id: testOrgId,
        user_id: ownerManagedCoachId,
        role: 'manager',
        status: 'active',
      },
      select: { id: true },
    });
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
        await prisma.game
          .deleteMany({
            where: {
              OR: [{ home_team_id: { in: teamIds } }, { away_team_id: { in: teamIds } }],
            },
          })
          .catch(() => {});
      }

      // Clean up team memberships
      await prisma.teamMembership.deleteMany({
        where: { user_id: { in: [coachUserId, fanUserId, ownerManagedCoachId] } },
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
            in: [coachUserId, fanUserId, ownerManagedCoachId],
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

      const maxTeams = 4;

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
        select: { id: true, name: true },
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

      const refreshedTeam = await getTeamState(team.id, prisma);
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

      const listResponse = await request(app).get('/teams').expect(200);

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

    it('uses the organization source of truth for paid_by_owner coaches', async () => {
      // Phase 4 billing unit: distinct ACTIVE billable sport programs, not
      // raw team rows — archived teams (e.g. the DELETE flow's team above)
      // don't count. None of the teams created in this file carry a
      // program_id, so each active one is its own ungrouped billable unit.
      const orgActiveTeamCount = await prisma.team.count({
        where: { organization_id: testOrgId, status: 'active' },
      });
      const personalOwnerCount = await prisma.teamMembership.count({
        where: {
          user_id: ownerManagedCoachId,
          role: 'owner',
          status: 'active',
        },
      });

      const response = await request(app)
        .get('/teams/limits')
        .set('Authorization', `Bearer ${ownerManagedCoachToken}`)
        .expect(200);

      expect(personalOwnerCount).toBe(0);
      expect(response.body.owned_programs).toBe(orgActiveTeamCount);
      expect(response.body.owned_teams).toBe(orgActiveTeamCount);
      expect(response.body.max_programs).toBe(5);
      expect(response.body.max_teams).toBe(5);
    });

    it('should require authentication', async () => {
      const response = await request(app).get('/teams/limits').expect(401);

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
      const response = await request(app).get('/teams/managed').expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should filter teams by search query', async () => {
      const response = await request(app)
        .get('/teams/managed?q=Test')
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('returns the canonical managed team contract', async () => {
      const team = await prisma.team.create({
        data: {
          name: `Managed Contract Team ${Date.now()}`,
          description: 'Managed team contract fixture',
          organization_id: testOrgId,
          sport: 'Basketball',
          city: 'Atlanta',
          state: 'GA',
          league: 'Peach League',
          venue_address: '123 Arena Way',
          venue_lat: 33.749,
          venue_lng: -84.388,
          venue_place_id: 'managed-place-id',
        },
        select: { id: true },
      });
      await prisma.teamMembership.create({
        data: { team_id: team.id, user_id: coachUserId, role: 'owner', status: 'active' },
      });

      const response = await request(app)
        .get(`/teams/managed?q=${encodeURIComponent('Managed Contract Team')}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      const row = response.body.find((entry: any) => entry.id === team.id);
      expect(row).toBeTruthy();
      expect(row.organization_id).toBe(testOrgId);
      expect(row.organization?.id).toBe(testOrgId);
      expect(row.city).toBe('Atlanta');
      expect(row.state).toBe('GA');
      expect(row.league).toBe('Peach League');
      expect(row.venue_address).toBe('123 Arena Way');
      expect(row.created_at).toBeTruthy();
      expect(row.members).toBeGreaterThanOrEqual(1);
      expect(row.my_role).toBe('owner');
      expect(row.viewer_role).toBe('owner');
    });

    it('supports pagination headers for managed teams without breaking the array contract', async () => {
      const paginationCoach = await prisma.user.create({
        data: {
          email: `pagination-coach-${Date.now()}@example.com`,
          password_hash: await bcrypt.hash(TEST_PASSWORD, 10),
          display_name: 'Pagination Coach',
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
          approval_status: 'APPROVED',
          plan: 'legend',
          coach_agreement_accepted_at: new Date(),
          preferences: {
            role: 'coach',
            plan: 'legend',
            onboarding_completed: true,
            coach_agreement_accepted_at: new Date().toISOString(),
          },
        },
        select: { id: true },
      });
      const paginationToken = signJwt({ id: paginationCoach.id });
      const paginationOrg = await prisma.organization.create({
        data: {
          name: `Managed Pagination League ${Date.now()}`,
          org_type: 'club',
          admin_approved: true,
          league_owner_id: paginationCoach.id,
          updated_at: new Date(),
        },
        select: { id: true },
      });
      await prisma.organizationMembership.create({
        data: {
          organization_id: paginationOrg.id,
          user_id: paginationCoach.id,
          role: 'owner',
          status: 'active',
        },
      });

      const createdTeams = [];
      for (const suffix of ['A', 'B', 'C']) {
        const team = await prisma.team.create({
          data: {
            name: `Managed Page Team ${suffix} ${Date.now()}`,
            description: 'Managed pagination fixture',
            organization_id: paginationOrg.id,
            sport: 'Basketball',
          },
          select: { id: true, name: true },
        });
        await prisma.teamMembership.create({
          data: { team_id: team.id, user_id: paginationCoach.id, role: 'owner', status: 'active' },
        });
        createdTeams.push(team);
      }

      const firstPage = await request(app)
        .get(`/teams/managed?q=${encodeURIComponent('Managed Page Team')}&limit=1`)
        .set('Authorization', `Bearer ${paginationToken}`)
        .expect(200);

      expect(Array.isArray(firstPage.body)).toBe(true);
      expect(firstPage.body).toHaveLength(1);
      expect(firstPage.headers['x-next-cursor']).toBeTruthy();
      expect(firstPage.headers['x-has-more']).toBe('1');

      const secondPage = await request(app)
        .get(
          `/teams/managed?q=${encodeURIComponent('Managed Page Team')}&limit=1&cursor=${encodeURIComponent(firstPage.headers['x-next-cursor'])}`
        )
        .set('Authorization', `Bearer ${paginationToken}`)
        .expect(200);

      expect(Array.isArray(secondPage.body)).toBe(true);
      expect(secondPage.body).toHaveLength(1);
      expect(secondPage.body[0]?.id).not.toBe(firstPage.body[0]?.id);

      await prisma.teamMembership.deleteMany({
        where: { team_id: { in: createdTeams.map((team: any) => team.id) } },
      });
      await prisma.team.deleteMany({
        where: { id: { in: createdTeams.map((team: any) => team.id) } },
      });
      await prisma.organizationMembership.deleteMany({
        where: { organization_id: paginationOrg.id },
      });
      await prisma.organization.delete({ where: { id: paginationOrg.id } });
      await prisma.user.delete({ where: { id: paginationCoach.id } });
    });
  });

  describe('GET /teams contracts', () => {
    it('returns the canonical team list contract', async () => {
      const team = await prisma.team.create({
        data: {
          name: `List Contract Team ${Date.now()}`,
          description: 'List contract fixture',
          organization_id: testOrgId,
          sport: 'Soccer',
          city: 'Austin',
          state: 'TX',
          league: 'Lone Star',
          venue_address: '500 Match Rd',
          venue_lat: 30.2672,
          venue_lng: -97.7431,
          venue_place_id: 'list-place-id',
          is_private: false,
        },
        select: { id: true },
      });
      await prisma.teamMembership.create({
        data: { team_id: team.id, user_id: coachUserId, role: 'owner', status: 'active' },
      });

      const response = await request(app)
        .get(`/teams?q=${encodeURIComponent('List Contract Team')}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      const row = response.body.find((entry: any) => entry.id === team.id);
      expect(row).toBeTruthy();
      expect(row.organization_id).toBe(testOrgId);
      expect(row.organization?.id).toBe(testOrgId);
      expect(row.sport).toBe('Soccer');
      expect(row.city).toBe('Austin');
      expect(row.state).toBe('TX');
      expect(row.league).toBe('Lone Star');
      expect(row.venue_place_id).toBe('list-place-id');
      expect(row.members).toBeGreaterThanOrEqual(1);
      expect(row.followers_count).toBe(0);
      expect(row.viewer_role).toBe('owner');
      expect(row.my_role).toBe('owner');
      expect(row.created_at).toBeTruthy();
    });

    it('returns the canonical team detail contract', async () => {
      const team = await prisma.team.create({
        data: {
          name: `Detail Contract Team ${Date.now()}`,
          description: 'Detail contract fixture',
          organization_id: testOrgId,
          sport: 'Baseball',
          season_start: new Date('2026-02-01T00:00:00.000Z'),
          season_end: new Date('2026-05-31T00:00:00.000Z'),
          city: 'Nashville',
          state: 'TN',
          league: 'Music City',
          venue_address: '1 Stadium Dr',
          venue_lat: 36.1627,
          venue_lng: -86.7816,
          venue_place_id: 'detail-place-id',
        },
        select: { id: true },
      });
      await prisma.teamMembership.create({
        data: { team_id: team.id, user_id: coachUserId, role: 'owner', status: 'active' },
      });
      await prisma.teamFollow.create({
        data: { team_id: team.id, user_id: fanUserId },
      });

      const response = await request(app)
        .get(`/teams/${team.id}`)
        .set('Authorization', `Bearer ${fanToken}`)
        .expect(200);

      expect(response.body.id).toBe(team.id);
      expect(response.body.organization_id).toBe(testOrgId);
      expect(response.body.organization?.id).toBe(testOrgId);
      expect(response.body.sport).toBe('Baseball');
      expect(response.body.city).toBe('Nashville');
      expect(response.body.state).toBe('TN');
      expect(response.body.league).toBe('Music City');
      expect(response.body.venue_address).toBe('1 Stadium Dr');
      expect(response.body.venue_place_id).toBe('detail-place-id');
      expect(response.body.followers_count).toBe(1);
      expect(response.body.members).toBeGreaterThanOrEqual(1);
      expect(response.body.viewer_role).toBeNull();
      expect(response.body.my_role).toBeNull();
      expect(response.body.is_following).toBe(true);
      expect(response.body.created_at).toBeTruthy();
      expect(response.body.season_start).toBe('2026-02-01T00:00:00.000Z');
      expect(response.body.season_end).toBe('2026-05-31T00:00:00.000Z');
    });
  });

  describe('GET /teams/:id/admin-summary', () => {
    it('returns the scoped admin summary for org admins without team membership', async () => {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const teamOwner = await prisma.user.create({
        data: {
          email: `team-admin-summary-owner-${Date.now()}@example.com`,
          password_hash: passwordHash,
          display_name: 'Summary Team Owner',
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

      const player = await prisma.user.create({
        data: {
          email: `team-admin-summary-player-${Date.now()}@example.com`,
          password_hash: passwordHash,
          display_name: 'Summary Player',
          email_verified: true,
          preferences: {
            role: 'fan',
            onboarding_completed: true,
          },
        },
      });

      const team = await prisma.team.create({
        data: {
          name: `Admin Summary Team ${Date.now()}`,
          description: 'Scoped team admin summary fixture',
          organization_id: testOrgId,
          sport: 'Volleyball',
          season: 'Spring',
        },
      });

      await prisma.teamMembership.createMany({
        data: [
          { team_id: team.id, user_id: teamOwner.id, role: 'owner', status: 'active' },
          { team_id: team.id, user_id: player.id, role: 'player', status: 'active' },
        ],
      });

      await prisma.game.create({
        data: {
          title: 'Scoped Team Game',
          date: new Date(Date.now() + 86_400_000),
          location: 'Main Gym',
          home_team_id: team.id,
          home_team: team.name,
          approval_status: 'approved',
          created_by_id: coachUserId,
        },
      });

      const response = await request(app)
        .get(`/teams/${team.id}/admin-summary`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(response.body.team?.id).toBe(team.id);
      expect(response.body.team?.organization_id).toBe(testOrgId);
      expect(response.body.team?.organization?.id).toBe(testOrgId);
      expect(response.body.permissions?.can_manage).toBe(true);
      expect(response.body.permissions?.membership_role).toBeNull();
      expect(response.body.permissions?.via_org_admin).toBe(true);
      expect(response.body.counts?.members).toBe(2);
      expect(response.body.counts?.staff).toBe(1);
      expect(response.body.counts?.upcoming_games).toBe(1);
      expect(Array.isArray(response.body.members)).toBe(true);
      expect(response.body.members).toHaveLength(2);
      expect(response.body.members).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            user: expect.objectContaining({
              email: player.email,
            }),
          }),
        ])
      );
      expect(Array.isArray(response.body.upcoming_games)).toBe(true);
      expect(response.body.upcoming_games).toHaveLength(1);
      expect(response.body.upcoming_games[0]?.home_team).toBe(team.name);

      await prisma.game.deleteMany({ where: { home_team_id: team.id } }).catch(() => {});
      await prisma.teamMembership.deleteMany({ where: { team_id: team.id } }).catch(() => {});
      await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
      await prisma.user
        .deleteMany({ where: { id: { in: [teamOwner.id, player.id] } } })
        .catch(() => {});
    });

    it('allows org admins without team membership to revoke pending team invites', async () => {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const teamOwner = await prisma.user.create({
        data: {
          email: `team-cancel-owner-${Date.now()}@example.com`,
          password_hash: passwordHash,
          display_name: 'Cancel Team Owner',
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

      const team = await prisma.team.create({
        data: {
          name: `Cancel Invite Team ${Date.now()}`,
          description: 'Scoped cancel invite fixture',
          organization_id: testOrgId,
          sport: 'Basketball',
          season: 'Winter',
        },
      });

      await prisma.teamMembership.create({
        data: { team_id: team.id, user_id: teamOwner.id, role: 'owner', status: 'active' },
      });

      const invite = await prisma.teamInvite.create({
        data: {
          team_id: team.id,
          email: `team-cancel-${Date.now()}@example.com`,
          role: 'manager',
          status: 'pending',
        },
      });

      const response = await request(app)
        .post(`/teams/${team.id}/invites/${invite.id}/cancel`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(response.body.ok).toBe(true);
      expect(response.body.invite?.id).toBe(invite.id);
      expect(response.body.invite?.status).toBe('revoked');

      const updated = await prisma.teamInvite.findUnique({
        where: { id: invite.id },
        select: { status: true },
      });
      expect(updated?.status).toBe('revoked');

      await prisma.teamMembership.deleteMany({ where: { team_id: team.id } }).catch(() => {});
      await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: teamOwner.id } }).catch(() => {});
    });
  });

  describe('GET /teams/:id/screen-summary', () => {
    it('returns a public screen summary with roster and approved games while exposing scoped manage permissions for org admins', async () => {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const teamOwner = await prisma.user.create({
        data: {
          email: `team-screen-summary-owner-${Date.now()}@example.com`,
          password_hash: passwordHash,
          display_name: 'Screen Summary Team Owner',
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

      const player = await prisma.user.create({
        data: {
          email: `team-screen-summary-player-${Date.now()}@example.com`,
          password_hash: passwordHash,
          display_name: 'Screen Summary Player',
          email_verified: true,
          preferences: {
            role: 'fan',
            onboarding_completed: true,
            jersey_number: '12',
          },
        },
      });

      const team = await prisma.team.create({
        data: {
          name: `Screen Summary Team ${Date.now()}`,
          description: 'Scoped public team summary fixture',
          organization_id: testOrgId,
          sport: 'Soccer',
          season: 'Spring',
          status: 'active',
        },
      });

      await prisma.teamMembership.createMany({
        data: [
          { team_id: team.id, user_id: teamOwner.id, role: 'owner', status: 'active' },
          { team_id: team.id, user_id: player.id, role: 'player', status: 'active' },
        ],
      });

      await prisma.game.createMany({
        data: [
          {
            title: 'Screen Summary Past Game',
            date: new Date(Date.now() - 86_400_000),
            location: 'North Field',
            home_team_id: team.id,
            home_team: team.name,
            away_team: 'Visitors',
            approval_status: 'approved',
            created_by_id: coachUserId,
          },
          {
            title: 'Pending Game Should Hide',
            date: new Date(Date.now() + 172_800_000),
            location: 'North Field',
            home_team_id: team.id,
            home_team: team.name,
            away_team: 'Pending Opponent',
            approval_status: 'pending',
            created_by_id: coachUserId,
          },
        ],
      });

      const publicResponse = await request(app).get(`/teams/${team.id}/screen-summary`).expect(200);

      expect(publicResponse.body.team?.id).toBe(team.id);
      expect(publicResponse.body.permissions?.can_manage).toBe(false);
      expect(publicResponse.body.permissions?.membership_role).toBeNull();
      expect(publicResponse.body.counts?.members).toBe(2);
      expect(publicResponse.body.counts?.games).toBe(1);
      expect(Array.isArray(publicResponse.body.members)).toBe(true);
      expect(publicResponse.body.members).toHaveLength(2);
      expect(publicResponse.body.members[1]?.user?.display_name).toBe('Screen Summary Player');
      expect(Array.isArray(publicResponse.body.games)).toBe(true);
      expect(publicResponse.body.games).toHaveLength(1);
      expect(publicResponse.body.games[0]?.title).toBe('Screen Summary Past Game');

      const orgAdminResponse = await request(app)
        .get(`/teams/${team.id}/screen-summary`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(orgAdminResponse.body.permissions?.can_manage).toBe(true);
      expect(orgAdminResponse.body.permissions?.via_org_admin).toBe(true);

      await prisma.game.deleteMany({ where: { home_team_id: team.id } }).catch(() => {});
      await prisma.teamMembership.deleteMany({ where: { team_id: team.id } }).catch(() => {});
      await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
      await prisma.user
        .deleteMany({ where: { id: { in: [teamOwner.id, player.id] } } })
        .catch(() => {});
    });
  });

  describe('Team privacy', () => {
    it('hides private teams from public list and detail while allowing followers and org admins', async () => {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const privateOwner = await prisma.user.create({
        data: {
          email: `test-private-owner-${Date.now()}@example.com`,
          password_hash: passwordHash,
          display_name: 'Private Team Owner',
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

      const team = await prisma.team.create({
        data: {
          name: `Private Team ${Date.now()}`,
          description: 'Hidden from strangers',
          organization_id: testOrgId,
          status: 'active',
          is_private: true,
        },
        select: { id: true },
      });
      await prisma.teamMembership.create({
        data: {
          team_id: team.id,
          user_id: privateOwner.id,
          role: 'owner',
          status: 'active',
        },
      });

      const publicList = await request(app).get('/teams').expect(200);
      expect(publicList.body.some((entry: any) => entry.id === team.id)).toBe(false);

      await request(app).get(`/teams/${team.id}`).expect(404);

      await prisma.teamFollow.create({
        data: { user_id: fanUserId, team_id: team.id },
      });

      const followerList = await request(app)
        .get('/teams')
        .set('Authorization', `Bearer ${fanToken}`)
        .expect(200);
      expect(followerList.body.some((entry: any) => entry.id === team.id)).toBe(true);

      const followerDetail = await request(app)
        .get(`/teams/${team.id}`)
        .set('Authorization', `Bearer ${fanToken}`)
        .expect(200);
      expect(followerDetail.body.id).toBe(team.id);
      expect(followerDetail.body.is_private).toBe(true);

      const orgAdminDetail = await request(app)
        .get(`/teams/${team.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);
      expect(orgAdminDetail.body.id).toBe(team.id);
      expect(orgAdminDetail.body.is_private).toBe(true);

      await prisma.teamFollow.deleteMany({ where: { team_id: team.id } }).catch(() => {});
      await prisma.teamMembership.deleteMany({ where: { team_id: team.id } }).catch(() => {});
      await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: privateOwner.id } }).catch(() => {});
    });
  });

  // ── Org-admin fallback regression tests (boundary closed in the canManageTeam
  // extraction pass). Proves that a league owner/manager with no direct team
  // membership can still archive teams and transfer ownership inside their
  // own league. Same shape as the team-chat regression test at
  // api-group-chats.test.ts:213.
  describe('Org-admin fallback — team lifecycle', () => {
    it('allows an org owner to archive a team inside their league without team membership', async () => {
      // Fresh team inside the already-provisioned org, owned by a different
      // user so the coach we're testing isn't also a team member.
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const separateOwner = await prisma.user.create({
        data: {
          email: `test-team-owner-${Date.now()}@example.com`,
          password_hash: passwordHash,
          display_name: 'Team-Only Owner',
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

      const team = await prisma.team.create({
        data: {
          name: `Org-admin-delete-${Date.now()}`,
          sport: 'soccer',
          organization_id: testOrgId,
          status: 'active',
        },
        select: { id: true },
      });
      await prisma.teamMembership.create({
        data: { team_id: team.id, user_id: separateOwner.id, role: 'owner', status: 'active' },
      });

      // coachToken user is the org OWNER (seeded in beforeAll) but NOT a team
      // member of this team. Before the fix they got 403; now 200.
      const res = await request(app)
        .delete(`/teams/${team.id}`)
        .set('Authorization', `Bearer ${coachToken}`);

      expect(res.status).toBe(200);

      const archived = await getTeamState(team.id, prisma);
      expect(archived?.status).not.toBe('active');

      // Cleanup
      await prisma.teamMembership.deleteMany({ where: { team_id: team.id } }).catch(() => {});
      await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: separateOwner.id } }).catch(() => {});
    });

    it('GET /teams/:id exposes can_manage_team for org admins without direct team membership', async () => {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const separateOwner = await prisma.user.create({
        data: {
          email: `test-team-view-${Date.now()}@example.com`,
          password_hash: passwordHash,
          display_name: 'Team Detail Owner',
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

      const team = await prisma.team.create({
        data: {
          name: `Org-admin-view-${Date.now()}`,
          sport: 'soccer',
          organization_id: testOrgId,
          status: 'active',
        },
        select: { id: true },
      });
      await prisma.teamMembership.create({
        data: { team_id: team.id, user_id: separateOwner.id, role: 'owner', status: 'active' },
      });

      const res = await request(app)
        .get(`/teams/${team.id}`)
        .set('Authorization', `Bearer ${coachToken}`)
        .expect(200);

      expect(res.body.my_role).toBeNull();
      expect(res.body.is_org_admin).toBe(true);
      expect(res.body.can_manage_team).toBe(true);

      await prisma.teamMembership.deleteMany({ where: { team_id: team.id } }).catch(() => {});
      await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: separateOwner.id } }).catch(() => {});
    });

    it('allows an org owner to transfer ownership of a team inside their league', async () => {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const [currentOwner, newOwner] = await Promise.all([
        prisma.user.create({
          data: {
            email: `test-current-owner-${Date.now()}@example.com`,
            password_hash: passwordHash,
            display_name: 'Current Owner',
            email_verified: true,
            approval_status: 'APPROVED',
            preferences: {
              role: 'coach',
              plan: 'rookie',
              onboarding_completed: true,
              coach_agreement_accepted_at: new Date().toISOString(),
            },
          },
        }),
        prisma.user.create({
          data: {
            email: `test-new-owner-${Date.now() + 1}@example.com`,
            password_hash: passwordHash,
            display_name: 'New Owner',
            email_verified: true,
            approval_status: 'APPROVED',
            preferences: {
              role: 'coach',
              plan: 'rookie',
              onboarding_completed: true,
              coach_agreement_accepted_at: new Date().toISOString(),
            },
          },
        }),
      ]);

      const team = await prisma.team.create({
        data: {
          name: `Org-admin-transfer-${Date.now()}`,
          sport: 'soccer',
          organization_id: testOrgId,
          status: 'active',
        },
        select: { id: true },
      });
      await prisma.teamMembership.createMany({
        data: [
          { team_id: team.id, user_id: currentOwner.id, role: 'owner', status: 'active' },
          { team_id: team.id, user_id: newOwner.id, role: 'coach', status: 'active' },
        ],
      });

      // coachToken user is the org OWNER but NOT a team member. Before the
      // fix, only the direct team owner could transfer; now the league admin
      // can too.
      const res = await request(app)
        .post(`/teams/${team.id}/transfer-ownership`)
        .set('Authorization', `Bearer ${coachToken}`)
        .send({ new_owner_id: newOwner.id });

      expect(res.status).toBe(200);

      const newOwnerMembership = await prisma.teamMembership.findUnique({
        where: { team_id_user_id: { team_id: team.id, user_id: newOwner.id } },
      });
      expect(newOwnerMembership?.role).toBe('owner');

      // Cleanup
      await prisma.teamMembership.deleteMany({ where: { team_id: team.id } }).catch(() => {});
      await prisma.team.delete({ where: { id: team.id } }).catch(() => {});
      await prisma.user
        .deleteMany({ where: { id: { in: [currentOwner.id, newOwner.id] } } })
        .catch(() => {});
    });
  });
});

describe('GET /teams — exclude_demo_leagues opt-in flag', () => {
  const ts = Date.now();
  let orgId: string;
  let realTeamId: string;
  let demoTeamId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    const org = await prisma.organization.create({
      data: {
        name: `Demo Flag Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        status: 'active',
        updated_at: new Date(),
      },
      select: { id: true },
    });
    orgId = org.id;

    const realTeam = await prisma.team.create({
      data: {
        name: `Demo Flag Real Team ${ts}`,
        organization_id: orgId,
        status: 'active',
      },
      select: { id: true },
    });
    realTeamId = realTeam.id;

    const demoTeam = await prisma.team.create({
      data: {
        name: `Demo Flag Fifa Team ${ts}`,
        organization_id: orgId,
        status: 'active',
        league: 'International Cup 2026',
      },
      select: { id: true },
    });
    demoTeamId = demoTeam.id;
  });

  afterAll(async () => {
    await prisma.team
      .deleteMany({ where: { id: { in: [realTeamId, demoTeamId] } } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  });

  it('includes the FIFA demo team by default', async () => {
    const res = await request(app)
      .get(`/teams?q=${encodeURIComponent(`Demo Flag`)}`)
      .expect(200);
    const ids = res.body.map((t: any) => t.id);
    expect(ids).toContain(realTeamId);
    expect(ids).toContain(demoTeamId);
  });

  it('excludes the FIFA demo team when exclude_demo_leagues=1 is passed', async () => {
    const res = await request(app)
      .get(`/teams?q=${encodeURIComponent(`Demo Flag`)}&exclude_demo_leagues=1`)
      .expect(200);
    const ids = res.body.map((t: any) => t.id);
    expect(ids).toContain(realTeamId);
    expect(ids).not.toContain(demoTeamId);
  });
});
