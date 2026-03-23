/**
 * Coach Approval Workflow Tests
 *
 * Verifies that coaches and league owners cannot access coach tools until approved:
 * - League owners: PENDING until super admin approves the league
 * - Coaches joining an org: PENDING until league owner approves
 * - requireOnboarded blocks PENDING coaches from team/event/post creation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { app } from '../testApp.js';

let prisma: any;
let signJwt: any;
let dbReady = false;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';
const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkipDbTests = isCi || process.env.SKIP_SERVER_DB_TESTS === '1' || !process.env.DATABASE_URL;
const describeDb = shouldSkipDbTests ? describe.skip : describe;
const itDb = (name: string, fn: () => Promise<void>) => it(name, async () => {
  if (!dbReady) return;
  await fn();
});

describeDb('Coach Approval Workflow', () => {
  let pendingCoachId: string;
  let pendingCoachToken: string;
  let approvedCoachId: string;
  let approvedCoachToken: string;
  let leagueOwnerId: string;
  let leagueOwnerToken: string;
  let orgId: string;
  let orgIdFromCreate = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    try {
      await prisma.$queryRawUnsafe('SELECT 1');
      dbReady = true;
    } catch {
      dbReady = false;
      return;
    }

    // Pending coach (role=coach, approval_status=PENDING)
    const pendingHash = await bcrypt.hash(PASSWORD, 10);
    const pendingCoach = await prisma.user.create({
      data: {
        email: `pending-coach-${ts}@example.com`,
        password_hash: pendingHash,
        display_name: 'Pending Coach',
        email_verified: true,
        preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
        approval_status: 'PENDING',
      },
    });
    pendingCoachId = pendingCoach.id;
    pendingCoachToken = signJwt({ id: pendingCoachId });

    // Approved coach (for league owner approval flow)
    const approvedHash = await bcrypt.hash(PASSWORD, 10);
    const approvedCoach = await prisma.user.create({
      data: {
        email: `approved-coach-${ts}@example.com`,
        password_hash: approvedHash,
        display_name: 'Approved Coach',
        email_verified: true,
        preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
        approval_status: 'APPROVED',
      },
    });
    approvedCoachId = approvedCoach.id;
    approvedCoachToken = signJwt({ id: approvedCoachId });

    // League owner (approved, for testing coach approval by league owner)
    const ownerHash = await bcrypt.hash(PASSWORD, 10);
    const leagueOwner = await prisma.user.create({
      data: {
        email: `league-owner-${ts}@example.com`,
        password_hash: ownerHash,
        display_name: 'League Owner',
        email_verified: true,
        preferences: { role: 'coach', plan: 'veteran', onboarding_completed: true },
        approval_status: 'APPROVED',
      },
    });
    leagueOwnerId = leagueOwner.id;
    leagueOwnerToken = signJwt({ id: leagueOwnerId });

    // Create org for league owner (so they can approve coaches)
    const org = await prisma.organization.create({
      data: {
        name: `Approval Test League ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: leagueOwnerId,
      },
    });
    orgId = org.id;
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: leagueOwnerId, role: 'owner', status: 'active' },
    });

    // Create org for approved coach (so they can create teams)
    const approvedOrg = await prisma.organization.create({
      data: {
        name: `Approved Coach League ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: approvedCoachId,
      },
    });
    await prisma.organizationMembership.create({
      data: { organization_id: approvedOrg.id, user_id: approvedCoachId, role: 'owner', status: 'active' },
    });
  });

  afterAll(async () => {
    if (!prisma || !dbReady) return;
    try {
      const ids = [pendingCoachId, approvedCoachId, leagueOwnerId];
      const orgIds = [orgId, orgIdFromCreate];
      const approvedOrg = await prisma.organization.findFirst({
        where: { league_owner_id: approvedCoachId },
      });
      if (approvedOrg) orgIds.push(approvedOrg.id);
      await prisma.organizationJoinRequest.deleteMany({ where: { user_id: { in: ids } } });
      await prisma.organizationMembership.deleteMany({
        where: { user_id: { in: ids } },
      });
      await prisma.team.deleteMany({
        where: { organization_id: { in: orgIds.filter(Boolean) } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: orgIds.filter(Boolean) } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    } catch (e) {
      console.warn('Cleanup error:', e);
    }
  });

  describe('requireOnboarded blocks PENDING coaches', () => {
    itDb('PENDING coach gets 403 on POST /teams/create', async () => {
      const res = await request(app)
        .post('/teams/create')
        .set('Authorization', `Bearer ${pendingCoachToken}`)
        .send({ name: 'Blocked Team', organization_id: orgId });
      expect(res.status).toBe(403);
      expect(res.body?.code).toBe('APPROVAL_REQUIRED');
      expect(res.body?.error).toMatch(/pending approval/i);
    });

    itDb('PENDING coach gets 403 on POST /events', async () => {
      const res = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${pendingCoachToken}`)
        .send({
          title: 'Blocked Event',
          description: 'Test',
          start_time: new Date(Date.now() + 86400000).toISOString(),
          end_time: new Date(Date.now() + 86400000 + 3600000).toISOString(),
        });
      expect(res.status).toBe(403);
      expect(res.body?.code).toBe('APPROVAL_REQUIRED');
    });

    itDb('APPROVED coach can create team', async () => {
      const approvedOrg = await prisma.organization.findFirst({
        where: { league_owner_id: approvedCoachId },
      });
      expect(approvedOrg).toBeTruthy();
      const res = await request(app)
        .post('/teams/create')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ name: 'Allowed Team', organization_id: approvedOrg!.id });
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      if (res.body?.id) {
        await prisma.team.delete({ where: { id: res.body.id } }).catch(() => {});
      }
    });
  });

  describe('POST /organizations sets creator to PENDING', () => {
    itDb('creator is PENDING after POST /organizations', async () => {
      const creatorHash = await bcrypt.hash(PASSWORD, 10);
      const creator = await prisma.user.create({
        data: {
          email: `org-creator-${ts}@example.com`,
          password_hash: creatorHash,
          display_name: 'Org Creator',
          email_verified: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'APPROVED',
        },
      });
      const token = signJwt({ id: creator.id });

      const res = await request(app)
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Simple Create League ${ts}`,
          sport: 'basketball',
          org_type: 'club',
        });

      expect(res.status).toBe(201);
      const createdOrgId = res.body?.id;
      expect(createdOrgId).toBeTruthy();

      const userAfter = await prisma.user.findUnique({
        where: { id: creator.id },
        select: { approval_status: true },
      });
      expect(userAfter?.approval_status).toBe('PENDING');

      await prisma.organizationMembership.deleteMany({ where: { organization_id: createdOrgId } });
      await prisma.organization.delete({ where: { id: createdOrgId } });
      await prisma.user.delete({ where: { id: creator.id } });
    });
  });

  describe('POST /organizations/create sets creator to PENDING', () => {
    itDb('creator is PENDING after POST /organizations/create', async () => {
      const creatorHash = await bcrypt.hash(PASSWORD, 10);
      const creator = await prisma.user.create({
        data: {
          email: `onboarding-creator-${ts}@example.com`,
          password_hash: creatorHash,
          display_name: 'Onboarding Creator',
          email_verified: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'APPROVED',
        },
      });
      const token = signJwt({ id: creator.id });

      const res = await request(app)
        .post('/organizations/create')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Onboarding Create League ${ts}`,
          sport: 'basketball',
          org_type: 'club',
        });

      expect(res.status).toBe(201);
      orgIdFromCreate = res.body?.id;
      expect(orgIdFromCreate).toBeTruthy();

      const userAfter = await prisma.user.findUnique({
        where: { id: creator.id },
        select: { approval_status: true },
      });
      expect(userAfter?.approval_status).toBe('PENDING');

      await prisma.organizationMembership.deleteMany({ where: { organization_id: orgIdFromCreate } });
      await prisma.organization.delete({ where: { id: orgIdFromCreate } });
      await prisma.user.delete({ where: { id: creator.id } });
      orgIdFromCreate = '';
    });
  });

  describe('League approval sets league owner to APPROVED', () => {
    itDb('super admin approval (token) sets league owner to APPROVED', async () => {
      const ownerHash = await bcrypt.hash(PASSWORD, 10);
      const owner = await prisma.user.create({
        data: {
          email: `pending-owner-${ts}@example.com`,
          password_hash: ownerHash,
          display_name: 'Pending Owner',
          email_verified: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'PENDING',
        },
      });
      const org = await prisma.organization.create({
        data: {
          name: `Token Approve League ${ts}`,
          org_type: 'club',
          admin_approved: false,
          updated_at: new Date(),
          league_owner_id: owner.id,
        },
      });
      await prisma.organizationMembership.create({
        data: { organization_id: org.id, user_id: owner.id, role: 'owner' },
      });

      const token = signJwt({ orgId: org.id, action: 'approve_league' }, '7d');
      const res = await request(app)
        .post(`/organizations/${org.id}/approve?token=${token}`)
        .send();

      expect(res.status).toBe(200);

      const userAfter = await prisma.user.findUnique({
        where: { id: owner.id },
        select: { approval_status: true },
      });
      expect(userAfter?.approval_status).toBe('APPROVED');

      await prisma.organizationMembership.deleteMany({ where: { organization_id: org.id } });
      await prisma.organization.delete({ where: { id: org.id } });
      await prisma.user.delete({ where: { id: owner.id } });
    });
  });

  describe('Coach join request sets coach to PENDING', () => {
    itDb('coach requesting to join gets PENDING', async () => {
      const coachHash = await bcrypt.hash(PASSWORD, 10);
      const coach = await prisma.user.create({
        data: {
          email: `join-request-coach-${ts}@example.com`,
          password_hash: coachHash,
          display_name: 'Join Request Coach',
          email_verified: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'APPROVED',
        },
      });
      const token = signJwt({ id: coach.id });

      const res = await request(app)
        .post('/organizations/join-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({ organization_id: orgId, message: 'I want to join' });

      expect(res.status).toBe(201);

      const userAfter = await prisma.user.findUnique({
        where: { id: coach.id },
        select: { approval_status: true },
      });
      expect(userAfter?.approval_status).toBe('PENDING');

      const joinReq = await prisma.organizationJoinRequest.findFirst({
        where: { user_id: coach.id, organization_id: orgId },
      });
      expect(joinReq).toBeTruthy();

      await prisma.organizationJoinRequest.deleteMany({
        where: { user_id: coach.id, organization_id: orgId },
      });
      await prisma.user.delete({ where: { id: coach.id } });
    });
  });

  describe('League owner approval sets coach to APPROVED', () => {
    itDb('league owner approving coach sets coach to APPROVED', async () => {
      const coachHash = await bcrypt.hash(PASSWORD, 10);
      const coach = await prisma.user.create({
        data: {
          email: `to-approve-coach-${ts}@example.com`,
          password_hash: coachHash,
          display_name: 'To Approve Coach',
          email_verified: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'PENDING',
        },
      });

      await prisma.organizationJoinRequest.create({
        data: {
          organization_id: orgId,
          user_id: coach.id,
          status: 'pending',
        },
      });

      const res = await request(app)
        .post(`/organizations/${orgId}/coaches/${coach.id}/approve`)
        .set('Authorization', `Bearer ${leagueOwnerToken}`)
        .send({});

      expect(res.status).toBe(200);

      const userAfter = await prisma.user.findUnique({
        where: { id: coach.id },
        select: { approval_status: true, paid_by_owner: true },
      });
      expect(userAfter?.approval_status).toBe('APPROVED');
      expect(userAfter?.paid_by_owner).toBe(true);

      await prisma.organizationJoinRequest.deleteMany({
        where: { user_id: coach.id, organization_id: orgId },
      });
      await prisma.organizationMembership.deleteMany({
        where: { user_id: coach.id, organization_id: orgId },
      });
      await prisma.user.delete({ where: { id: coach.id } });
    });
  });
});
