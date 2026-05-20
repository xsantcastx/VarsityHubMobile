/**
 * Game Approval Flow Regression Tests
 *
 * Verifies:
 * - PUT /games/:id/approve transitions approval_status correctly
 * - Linked events get their status + approval_status synced
 * - Rejection persists the reason on linked events
 * - Non-coaches/non-admins are blocked
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../testApp.js';

const __skipDbIntegrationSuites =
  String(process.env.CI ?? '').toLowerCase() === 'true' || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = __skipDbIntegrationSuites ? describe.skip : describe;



let prisma: any;
let signJwt: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describeDb('Game Approval Flow', () => {
  let coachId: string;
  let coachToken: string;
  let orgManagerId: string;
  let orgManagerToken: string;
  let fanId: string;
  let fanToken: string;
  let orgId: string;
  let teamId: string;

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);

    // Create org
    const org = await prisma.organization.create({
      data: {
        name: `Game Approval Test League ${ts}`,
        org_type: 'league',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    orgId = org.id;

    // Create team under the org
    const team = await prisma.team.create({
      data: {
        name: `Test Team ${ts}`,
        organization_id: orgId,
      },
    });
    teamId = team.id;

    // Coach user (approved, onboarded, member of the team)
    const coach = await prisma.user.create({
      data: {
        email: `game-approve-coach-${ts}@example.com`,
        password_hash: hash,
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
    coachId = coach.id;
    coachToken = signJwt({ id: coachId });

    await prisma.teamMembership.create({
      data: { team_id: teamId, user_id: coachId, role: 'coach', status: 'active' },
    });

    const orgManager = await prisma.user.create({
      data: {
        email: `game-approve-org-manager-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Org Manager',
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
    orgManagerId = orgManager.id;
    orgManagerToken = signJwt({ id: orgManagerId });

    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: orgManagerId, role: 'manager', status: 'active' },
    });

    // Fan user (approved, onboarded, no team membership)
    const fan = await prisma.user.create({
      data: {
        email: `game-approve-fan-${ts}@example.com`,
        password_hash: hash,
        display_name: 'Test Fan',
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          plan: 'rookie',
          onboarding_completed: true,
        },
      },
    });
    fanId = fan.id;
    fanToken = signJwt({ id: fanId });
  });

  /**
   * Helper: create a pending game with a linked event
   */
  async function createPendingGame(title: string) {
    const game = await (prisma.game.create as any)({
      data: {
        title,
        date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        home_team_id: teamId,
        approval_status: 'pending',
        created_by_id: fanId,
      },
    });
    const event = await prisma.event.create({
      data: {
        title,
        date: game.date,
        game_id: game.id,
        team_id: teamId,
        status: 'draft',
        approval_status: 'pending',
        creator_id: fanId,
        creator_role: 'fan',
      } as any,
    });
    return { game, event };
  }

  afterAll(async () => {
    try {
      await prisma.notification.deleteMany({
        where: { user_id: { in: [coachId, orgManagerId, fanId].filter(Boolean) } },
      }).catch(() => {});
      await prisma.event.deleteMany({
        where: { creator_id: { in: [fanId].filter(Boolean) } },
      }).catch(() => {});
      await prisma.game.deleteMany({
        where: { OR: [{ created_by_id: fanId }, { home_team_id: teamId }] },
      }).catch(() => {});
      await prisma.teamMembership.deleteMany({
        where: { team_id: teamId },
      }).catch(() => {});
      await prisma.team.deleteMany({
        where: { id: teamId },
      }).catch(() => {});
      await prisma.organizationMembership.deleteMany({
        where: { organization_id: orgId },
      }).catch(() => {});
      await prisma.organization.deleteMany({
        where: { id: orgId },
      }).catch(() => {});
      await prisma.user.deleteMany({
        where: { id: { in: [coachId, orgManagerId, fanId].filter(Boolean) } },
      }).catch(() => {});
    } catch (e) {
      console.warn('Cleanup error (non-critical):', e);
    }
  });

  it('should approve a game and sync linked event status', async () => {
    const { game, event } = await createPendingGame(`Approve Test ${ts}`);

    const res = await request(app)
      .put(`/games/${game.id}/approve`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ approval_status: 'approved' })
      .expect(200);

    expect(res.body.approval_status).toBe('approved');
    expect(res.body.approved_by_id).toBe(coachId);
    expect(res.body.approved_at).toBeTruthy();

    // Verify the linked event was also updated
    const updatedEvent = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updatedEvent.approval_status).toBe('approved');
    expect(updatedEvent.status).toBe('approved');
    expect(updatedEvent.approved_at).toBeTruthy();
  });

  it('should reject a game, sync event status, and persist rejection reason', async () => {
    const { game, event } = await createPendingGame(`Reject Test ${ts}`);
    const reason = 'Conflicting schedule';

    const res = await request(app)
      .put(`/games/${game.id}/approve`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ approval_status: 'rejected', reason })
      .expect(200);

    expect(res.body.approval_status).toBe('rejected');
    expect(res.body.approved_by_id).toBeNull();

    // Verify the linked event was also updated with rejection reason
    const updatedEvent = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updatedEvent.approval_status).toBe('rejected');
    expect(updatedEvent.status).toBe('rejected');
    expect(updatedEvent.rejected_reason).toBe(reason);
  });

  it('should reject non-coaches/non-admins from approving', async () => {
    const { game } = await createPendingGame(`Unauthorized Test ${ts}`);

    await request(app)
      .put(`/games/${game.id}/approve`)
      .set('Authorization', `Bearer ${fanToken}`)
      .send({ approval_status: 'approved' })
      .expect(403);
  });

  it('should allow an org manager to approve a game for a team in their organization', async () => {
    const { game, event } = await createPendingGame(`Org Manager Approve Test ${ts}`);

    const res = await request(app)
      .put(`/games/${game.id}/approve`)
      .set('Authorization', `Bearer ${orgManagerToken}`)
      .send({ approval_status: 'approved' })
      .expect(200);

    expect(res.body.approval_status).toBe('approved');
    expect(res.body.approved_by_id).toBe(orgManagerId);

    const updatedEvent = await prisma.event.findUnique({ where: { id: event.id } });
    expect(updatedEvent?.approval_status).toBe('approved');
    expect(updatedEvent?.status).toBe('approved');
  });

  it('should return 400 for invalid approval_status', async () => {
    const { game } = await createPendingGame(`Invalid Status Test ${ts}`);

    await request(app)
      .put(`/games/${game.id}/approve`)
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ approval_status: 'maybe' })
      .expect(400);
  });

  it('should return 404 for non-existent game', async () => {
    await request(app)
      .put('/games/c123456789012345678901234/approve')
      .set('Authorization', `Bearer ${coachToken}`)
      .send({ approval_status: 'approved' })
      .expect(404);
  });
});
