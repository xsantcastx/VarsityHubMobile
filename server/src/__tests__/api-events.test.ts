/**
 * API Integration Tests - Event Endpoints
 * 
 * Tests actual HTTP endpoints for event management:
 * - POST /events (create event with approval workflow)
 * - GET /events (list events)
 * - Coach auto-approval vs fan approval requirement
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../testApp.js';
import bcrypt from 'bcrypt';

let prisma: any;
let signJwt: any;

const TEST_COACH_EMAIL = `test-api-event-coach-${Date.now()}@example.com`;
const TEST_FAN_EMAIL = `test-api-event-fan-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

describe('API Event Endpoints', () => {
  let coachUserId: string;
  let coachToken: string;
  let fanUserId: string;
  let fanToken: string;
  let testOrgId: string;
  let testTeamId: string;
  let testTeamMembershipId: string;

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

    // Give the coach an org membership so isOrgAdmin() returns true for auto-approval
    const org = await prisma.organization.create({
      data: {
        name: `Test Event League ${Date.now()}`,
        org_type: 'club',
        updated_at: new Date(),
      },
    });
    testOrgId = org.id;
    await prisma.organizationMembership.create({
      data: { organization_id: testOrgId, user_id: coachUserId, role: 'owner', status: 'active' },
    });
    const team = await prisma.team.create({
      data: {
        name: `Test Event Team ${Date.now()}`,
        organization_id: testOrgId,
      },
    });
    testTeamId = team.id;
    const membership = await prisma.teamMembership.create({
      data: {
        team_id: testTeamId,
        user_id: coachUserId,
        role: 'owner',
        status: 'active',
      },
    });
    testTeamMembershipId = membership.id;

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
      // Clean up events
      await prisma.event.deleteMany({
        where: {
          creator_id: {
            in: [coachUserId, fanUserId],
          },
        },
      });

      // Clean up org memberships and org
      if (testTeamMembershipId) {
        await prisma.teamMembership.delete({ where: { id: testTeamMembershipId } }).catch(() => {});
      }
      if (testTeamId) {
        await prisma.team.delete({ where: { id: testTeamId } }).catch(() => {});
      }
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

  describe('POST /events', () => {
    it('should auto-approve events created by coaches', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          title: 'Coach Event',
          date: futureDate.toISOString(),
          location: 'Test Stadium',
          team_id: testTeamId,
          event_type: 'game',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('approved');
      expect(response.body.approval_status).toBe('approved');
      expect(response.body.creator_id).toBe(coachUserId);
    });

    it('should require approval for events created by fans', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${fanToken}`)
        .send({
          title: 'Fan Event',
          date: futureDate.toISOString(),
          location: 'Test Location',
          event_type: 'fundraiser',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.status).toBe('draft');
      expect(response.body.approval_status).toBe('pending');
      expect(response.body.creator_id).toBe(fanUserId);
    });

    it('should require authentication', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/events')
        .send({
          title: 'Unauthorized Event',
          date: futureDate.toISOString(),
          location: 'Test',
        })
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should require event title', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          date: futureDate.toISOString(),
          location: 'Test',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should require event date', async () => {
      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          title: 'Event Without Date',
          location: 'Test',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should sanitize event title (trim whitespace)', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          title: '  Trimmed Event  ',
          date: futureDate.toISOString(),
          location: 'Test',
        })
        .expect(201);

      expect(response.body.title).toBe('Trimmed Event');
      expect(response.body.title).not.toContain('  ');
    });

    it('should sanitize event location (trim whitespace)', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const response = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${coachToken}`)
        .send({
          title: 'Test Event',
          date: futureDate.toISOString(),
          location: '  Trimmed Location  ',
        })
        .expect(201);

      expect(response.body.location).toBe('Trimmed Location');
      expect(response.body.location).not.toContain('  ');
    });
  });

  describe('GET /events', () => {
    it('should return list of approved events', async () => {
      const response = await request(app)
        .get('/events')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter events by status', async () => {
      const response = await request(app)
        .get('/events?status=approved')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should filter events by approval_status', async () => {
      const response = await request(app)
        .get('/events?approval_status=pending')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should search events by query', async () => {
      const response = await request(app)
        .get('/events?q=Test')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should limit number of results', async () => {
      const response = await request(app)
        .get('/events?limit=10')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeLessThanOrEqual(10);
    });

    it('does not expose creator object on the public event list payload', async () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.event.create({
        data: {
          title: `Public Event List Contract ${Date.now()}`,
          date: futureDate,
          location: 'Test Stadium',
          status: 'approved',
          approval_status: 'approved',
          creator_id: coachUserId,
          creator_role: 'coach',
        },
      });

      const response = await request(app)
        .get('/events')
        .expect(200);

      const created = response.body.find((item: any) => item.creator_id === coachUserId);
      expect(created).toBeTruthy();
      expect(created).not.toHaveProperty('creator');
    });
  });

  // ── Org-admin fallback + broader-cancel-semantics regression tests.
  //
  // Closes the third original boundary bug: /events/:id/cancel used to require
  // role='owner' on the team AND had no org-admin fallback. Now uses
  // canManageAnyTeam() which accepts owner/manager/coach/assistant_coach plus
  // org-admin fallback. These tests pin the broader semantics so a future
  // tightening can't silently regress them.
  describe('Event cancel — boundary regression', () => {
    const futureDate = () => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d;
    };

    it('allows an org owner to cancel an event linked to a team in their league without direct team membership', async () => {
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      // Event creator is a separate team coach; the org-owner user we test
      // with (coachToken) has NO team membership on this team. The
      // pre-existing test setup does give coachToken a team owner membership
      // on `testTeamId` (line 73-80), so we build a NEW team without touching
      // that membership.
      const orgOnlyAdmin = coachToken; // coachUserId is already org OWNER of testOrgId

      const separateTeam = await prisma.team.create({
        data: {
          name: `Cancel-test-team-${Date.now()}`,
          organization_id: testOrgId,
        },
      });
      const separateCreator = await prisma.user.create({
        data: {
          email: `test-event-creator-${Date.now()}@example.com`,
          password_hash: passwordHash,
          display_name: 'Event Creator',
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
      await prisma.teamMembership.create({
        data: {
          team_id: separateTeam.id,
          user_id: separateCreator.id,
          role: 'coach',
          status: 'active',
        },
      });

      const event = await prisma.event.create({
        data: {
          title: 'Org-admin cancel target',
          date: futureDate(),
          status: 'approved',
          approval_status: 'approved',
          creator_id: separateCreator.id,
          team_id: separateTeam.id,
        } as any,
      });

      const res = await request(app)
        .patch(`/events/${event.id}/cancel`)
        .set('Authorization', `Bearer ${orgOnlyAdmin}`)
        .send({});

      expect(res.status).toBe(200);
      const refreshed = await prisma.event.findUnique({ where: { id: event.id } });
      expect(refreshed?.status).toBe('cancelled');

      // Cleanup
      await prisma.event.deleteMany({ where: { id: event.id } }).catch(() => {});
      await prisma.teamMembership.deleteMany({ where: { team_id: separateTeam.id } }).catch(() => {});
      await prisma.team.delete({ where: { id: separateTeam.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: separateCreator.id } }).catch(() => {});
    });

    it('allows a team coach (not just owner) to cancel an event they did not create', async () => {
      // The pre-fix behavior rejected anyone whose team membership role was
      // not 'owner'. This test proves a coach on the same team can cancel.
      const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
      const coachMember = await prisma.user.create({
        data: {
          email: `test-cancel-coach-${Date.now()}@example.com`,
          password_hash: passwordHash,
          display_name: 'Team Coach Member',
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
      await prisma.teamMembership.create({
        data: {
          team_id: testTeamId,
          user_id: coachMember.id,
          role: 'coach',
          status: 'active',
        },
      });
      const coachMemberToken = signJwt({ id: coachMember.id });

      // Event created by a THIRD party (not the coach we're testing). The
      // event is on testTeamId, so the coach has staff membership but isn't
      // the creator.
      const anotherCreator = await prisma.user.create({
        data: {
          email: `test-cancel-creator-${Date.now() + 1}@example.com`,
          password_hash: passwordHash,
          display_name: 'Another Creator',
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
      await prisma.teamMembership.create({
        data: {
          team_id: testTeamId,
          user_id: anotherCreator.id,
          role: 'assistant_coach',
          status: 'active',
        },
      });

      const event = await prisma.event.create({
        data: {
          title: 'Coach cancel target',
          date: futureDate(),
          status: 'approved',
          approval_status: 'approved',
          creator_id: anotherCreator.id,
          team_id: testTeamId,
        } as any,
      });

      const res = await request(app)
        .patch(`/events/${event.id}/cancel`)
        .set('Authorization', `Bearer ${coachMemberToken}`)
        .send({});

      expect(res.status).toBe(200);
      const refreshed = await prisma.event.findUnique({ where: { id: event.id } });
      expect(refreshed?.status).toBe('cancelled');

      // Cleanup
      await prisma.event.deleteMany({ where: { id: event.id } }).catch(() => {});
      await prisma.teamMembership
        .deleteMany({ where: { user_id: { in: [coachMember.id, anotherCreator.id] } } })
        .catch(() => {});
      await prisma.user
        .deleteMany({ where: { id: { in: [coachMember.id, anotherCreator.id] } } })
        .catch(() => {});
    });
  });
});
