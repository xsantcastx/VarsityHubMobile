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
import { app as fullApp } from '../app.js';

let prisma: any;
let signJwt: any;
let getOrganizationJoinRequestState: any;
let getOrganizationJoinRequestStateForUser: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describe('Coach Approval Workflow', () => {
  let pendingCoachId: string;
  let pendingCoachToken: string;
  let rejectedCoachId: string;
  let rejectedCoachToken: string;
  let approvedCoachId: string;
  let approvedCoachToken: string;
  let leagueOwnerId: string;
  let leagueOwnerToken: string;
  let orgId: string;
  let orgIdFromCreate = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ signJwt } = await import('../lib/jwt.js'));
    ({ getOrganizationJoinRequestState, getOrganizationJoinRequestStateForUser } = await import(
      '../lib/organizationWorkflowState.js'
    ));

    // Pending coach (role=coach, approval_status=PENDING)
    const pendingHash = await bcrypt.hash(PASSWORD, 10);
    const pendingCoach = await prisma.user.create({
      data: {
        email: `pending-coach-${ts}@example.com`,
        password_hash: pendingHash,
        display_name: 'Pending Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
        approval_status: 'PENDING',
      },
    });
    pendingCoachId = pendingCoach.id;
    pendingCoachToken = signJwt({ id: pendingCoachId });

    const rejectedHash = await bcrypt.hash(PASSWORD, 10);
    const rejectedCoach = await prisma.user.create({
      data: {
        email: `rejected-coach-${ts}@example.com`,
        password_hash: rejectedHash,
        display_name: 'Rejected Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: false,
        preferences: {
          role: 'coach',
          plan: 'rookie',
          onboarding_completed: false,
          proceeding_as_fan: true,
        },
        approval_status: 'REJECTED',
        proceeding_as_fan: true,
        rejected_at: new Date(Date.now() - 60 * 60 * 1000),
        rejection_reason: 'Needs more information',
      },
    });
    rejectedCoachId = rejectedCoach.id;
    rejectedCoachToken = signJwt({ id: rejectedCoachId });

    // Approved coach (for league owner approval flow)
    const approvedHash = await bcrypt.hash(PASSWORD, 10);
    const approvedCoach = await prisma.user.create({
      data: {
        email: `approved-coach-${ts}@example.com`,
        password_hash: approvedHash,
        display_name: 'Approved Coach',
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true, coach_agreement_accepted_at: new Date().toISOString() },
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
        role: 'coach',
        onboarding_completed: true,
        preferences: { role: 'coach', plan: 'veteran', onboarding_completed: true, coach_agreement_accepted_at: new Date().toISOString() },
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
        supporting_document_url: 'https://example.com/doc.pdf',
      },
      select: { id: true },
    });
    orgId = org.id;
    await prisma.organizationMembership.create({
      data: { organization_id: orgId, user_id: leagueOwnerId, role: 'owner', status: 'active' },
      select: { id: true },
    });

    // Create org for approved coach (so they can create teams)
    const approvedOrg = await prisma.organization.create({
      data: {
        name: `Approved Coach League ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: approvedCoachId,
        supporting_document_url: 'https://example.com/doc.pdf',
      },
      select: { id: true },
    });
    await prisma.organizationMembership.create({
      data: { organization_id: approvedOrg.id, user_id: approvedCoachId, role: 'owner', status: 'active' },
      select: { id: true },
    });
  });

  afterAll(async () => {
    try {
      const ids = [pendingCoachId, rejectedCoachId, approvedCoachId, leagueOwnerId];
      const orgIds = [orgId, orgIdFromCreate];
      const approvedOrg = await prisma.organization.findFirst({
        where: { league_owner_id: approvedCoachId },
        select: { id: true },
      });
      if (approvedOrg) orgIds.push(approvedOrg.id);
      await prisma.coachApplication.deleteMany({ where: { user_id: { in: ids } } });
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
    it('PENDING coach gets 403 on POST /teams/create', async () => {
      const res = await request(app)
        .post('/teams/create')
        .set('Authorization', `Bearer ${pendingCoachToken}`)
        .send({ name: 'Blocked Team', organization_id: orgId });
      expect(res.status).toBe(403);
      expect(res.body?.code).toBe('APPROVAL_REQUIRED');
      expect(res.body?.error).toMatch(/pending approval/i);
    });

    it('PENDING coach gets 403 on POST /events', async () => {
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

    it('PENDING coach proceeding as fan can create a post without pretending onboarding is complete', async () => {
      await prisma.user.update({
        where: { id: pendingCoachId },
        data: {
          onboarding_completed: false,
          proceeding_as_fan: true,
          preferences: {
            role: 'coach',
            plan: 'rookie',
            onboarding_completed: false,
            proceeding_as_fan: true,
          },
        },
      });

      const postRes = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${pendingCoachToken}`)
        .send({ content: `Pending fan-mode post ${ts}` });

      expect(postRes.status).toBe(201);
      expect(postRes.body?.id).toBeTruthy();

      const meRes = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${pendingCoachToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body?.account_state).toBe('coach_pending_approval');
      expect(meRes.body?.preferences?.onboarding_completed).toBe(false);
      expect(meRes.body?.proceeding_as_fan).toBe(true);
      expect(meRes.body?.next_step).toBe('/(tabs)');

      if (postRes.body?.id) {
        await prisma.post.delete({ where: { id: postRes.body.id } }).catch(() => {});
      }
    });

    it('PENDING coach proceeding as fan can create a fan event', async () => {
      const res = await request(app)
        .post('/events')
        .set('Authorization', `Bearer ${pendingCoachToken}`)
        .send({
          title: 'Pending Fan Event',
          date: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
          location: 'Test Gym',
          description: 'Pending coach using fan mode',
        });

      expect(res.status).toBe(201);
      expect(res.body?.id).toBeTruthy();
      expect(String(res.body?.message || '')).toMatch(/submitted|created/i);

      if (res.body?.id) {
        await prisma.event.delete({ where: { id: res.body.id } }).catch(() => {});
      }
    });

    it('PENDING coach proceeding as fan can comment, vote, and manage their own post', async () => {
      const competitiveGame = await prisma.game.create({
        data: {
          title: `Competitive discussion ${ts}`,
          date: new Date(Date.now() + 24 * 60 * 60 * 1000),
          location: 'Test Arena',
          event_type: 'game',
          approval_status: 'approved',
          created_by_id: approvedCoachId,
        },
      });
      const discussionPost = await prisma.post.create({
        data: {
          author_id: approvedCoachId,
          content: `Discussion post ${ts}`,
          type: 'post',
          game_id: competitiveGame.id,
        },
      });
      const poll = await prisma.poll.create({
        data: {
          post_id: discussionPost.id,
          options: {
            create: [
              { text: 'Option A' },
              { text: 'Option B' },
            ],
          },
        },
        include: {
          options: true,
        },
      });

      const ownPostRes = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${pendingCoachToken}`)
        .send({ content: `Pending fan-mode editable post ${ts}` });

      expect(ownPostRes.status).toBe(201);
      expect(ownPostRes.body?.id).toBeTruthy();

      const commentRes = await request(app)
        .post(`/posts/${discussionPost.id}/comments`)
        .set('Authorization', `Bearer ${pendingCoachToken}`)
        .send({ content: 'Pending coach fan-mode comment' });

      expect(commentRes.status).toBe(201);
      expect(commentRes.body?.id).toBeTruthy();

      const voteRes = await request(app)
        .post(`/posts/${discussionPost.id}/poll/vote`)
        .set('Authorization', `Bearer ${pendingCoachToken}`)
        .send({ option_id: poll.options[0].id });

      expect(voteRes.status).toBe(200);
      expect(voteRes.body?.userVote).toBe(poll.options[0].id);

      const patchRes = await request(app)
        .patch(`/posts/${ownPostRes.body.id}`)
        .set('Authorization', `Bearer ${pendingCoachToken}`)
        .send({ content: `Pending fan-mode edited post ${ts}` });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body?.content).toBe(`Pending fan-mode edited post ${ts}`);

      const deleteRes = await request(app)
        .delete(`/posts/${ownPostRes.body.id}`)
        .set('Authorization', `Bearer ${pendingCoachToken}`);

      expect(deleteRes.status).toBe(200);
      expect(String(deleteRes.body?.message || '')).toMatch(/deleted successfully/i);

      await prisma.post.delete({ where: { id: discussionPost.id } }).catch(() => {});
      await prisma.game.delete({ where: { id: competitiveGame.id } }).catch(() => {});
    });

    it('PENDING coach proceeding as fan is still blocked from coach-only team creation', async () => {
      const res = await request(app)
        .post('/teams/create')
        .set('Authorization', `Bearer ${pendingCoachToken}`)
        .send({ name: 'Still Blocked Team', organization_id: orgId });

      expect(res.status).toBe(403);
      expect(res.body?.code).toBe('APPROVAL_REQUIRED');
    });

    it('REJECTED coach proceeding as fan can create a post but remains blocked from coach tools', async () => {
      const discussionPost = await prisma.post.create({
        data: {
          author_id: approvedCoachId,
          content: `Rejected discussion post ${ts}`,
          type: 'post',
        },
      });

      const postRes = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${rejectedCoachToken}`)
        .send({ content: `Rejected fan-mode post ${ts}` });

      expect(postRes.status).toBe(201);
      expect(postRes.body?.id).toBeTruthy();

      const commentRes = await request(app)
        .post(`/posts/${discussionPost.id}/comments`)
        .set('Authorization', `Bearer ${rejectedCoachToken}`)
        .send({ content: 'Rejected coach fan-mode comment' });

      expect(commentRes.status).toBe(201);
      expect(commentRes.body?.id).toBeTruthy();

      const teamRes = await request(app)
        .post('/teams/create')
        .set('Authorization', `Bearer ${rejectedCoachToken}`)
        .send({ name: 'Rejected Blocked Team', organization_id: orgId });

      expect(teamRes.status).toBe(403);
      expect(teamRes.body?.code).toBe('APPROVAL_REJECTED');

      if (postRes.body?.id) {
        await prisma.post.delete({ where: { id: postRes.body.id } }).catch(() => {});
      }
      await prisma.post.delete({ where: { id: discussionPost.id } }).catch(() => {});
    });

    it('APPROVED coach can create team', async () => {
      const approvedOrg = await prisma.organization.findFirst({
        where: { league_owner_id: approvedCoachId },
        select: { id: true },
      });
      expect(approvedOrg).toBeTruthy();
      const res = await request(app)
        .post('/teams/create')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ name: 'Allowed Team', organization_id: approvedOrg!.id });
      expect(res.status).toBe(201);
      expect(res.body?.team).toHaveProperty('id');
      if (res.body?.team?.id) {
        await prisma.team.delete({ where: { id: res.body.team.id } }).catch(() => {});
      }
    });
  });

  describe('Coach agreement gate', () => {
    it('APPROVED coach without coach_agreement_accepted_at gets COACH_AGREEMENT_REQUIRED on team creation', async () => {
      // Clear the agreement so this test can verify the gate
      await prisma.user.update({
        where: { id: approvedCoachId },
        data: {
          role: 'coach',
          onboarding_completed: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
        },
      });

      const approvedOrg = await prisma.organization.findFirst({
        where: { league_owner_id: approvedCoachId },
        select: { id: true },
      });
      expect(approvedOrg).toBeTruthy();

      await prisma.user.update({
        where: { id: approvedCoachId },
        data: {
          preferences: {
            role: 'coach',
            plan: 'rookie',
            onboarding_completed: true,
          },
        },
      });

      const res = await request(app)
        .post('/teams/create')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ name: 'Agreement Blocked Team', organization_id: approvedOrg!.id });

      expect(res.status).toBe(403);
      expect(res.body?.code).toBe('COACH_AGREEMENT_REQUIRED');
      expect(String(res.body?.error || '')).toMatch(/coach agreement/i);
    });

    it('APPROVED coach with coach_agreement_accepted_at can create team', async () => {
      const approvedOrg = await prisma.organization.findFirst({
        where: { league_owner_id: approvedCoachId },
        select: { id: true },
      });
      expect(approvedOrg).toBeTruthy();

      await prisma.user.update({
        where: { id: approvedCoachId },
        data: {
          preferences: {
            role: 'coach',
            plan: 'rookie',
            onboarding_completed: true,
            coach_agreement_accepted_at: new Date().toISOString(),
          },
        },
      });

      const res = await request(app)
        .post('/teams/create')
        .set('Authorization', `Bearer ${approvedCoachToken}`)
        .send({ name: 'Agreement Accepted Team', organization_id: approvedOrg!.id });

      expect(res.status).toBe(201);
      expect(res.body?.team).toHaveProperty('id');

      if (res.body?.team?.id) {
        await prisma.team.delete({ where: { id: res.body.team.id } }).catch(() => {});
      }
    });
  });

  describe('POST /organizations approval transition', () => {
    it('legacy creator is PENDING after POST /organizations', async () => {
      const creatorHash = await bcrypt.hash(PASSWORD, 10);
      const creator = await prisma.user.create({
        data: {
          email: `org-creator-${ts}@example.com`,
          password_hash: creatorHash,
          display_name: 'Org Creator',
          email_verified: true,
          date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
          role: 'coach',
          onboarding_completed: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true, coach_agreement_accepted_at: new Date().toISOString() },
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
          supporting_document_url: 'https://example.com/doc.pdf',
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
      await prisma.organization.deleteMany({ where: { id: createdOrgId } });
      await prisma.user.deleteMany({ where: { id: creator.id } });
    });

    it('approved coach application creator stays APPROVED after POST /organizations', async () => {
      const creatorHash = await bcrypt.hash(PASSWORD, 10);
      const creator = await prisma.user.create({
        data: {
          email: `org-approved-app-${ts}@example.com`,
          password_hash: creatorHash,
          display_name: 'Approved App Org Creator',
          email_verified: true,
          date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
          role: 'coach',
          onboarding_completed: true,
          preferences: {
            role: 'coach',
            plan: 'rookie',
            onboarding_completed: true,
            coach_agreement_accepted_at: new Date().toISOString(),
          },
          approval_status: 'APPROVED',
        },
      });
      const token = signJwt({ id: creator.id });

      await prisma.coachApplication.create({
        data: {
          user_id: creator.id,
          status: 'approved',
          organization_name: `Approved App League ${ts}`,
          org_type: 'club',
          supporting_document_url: 'https://example.com/doc.pdf',
          reviewed_at: new Date(),
        },
      });

      const res = await request(app)
        .post('/organizations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Approved App Simple Create ${ts}`,
          sport: 'basketball',
          org_type: 'club',
          supporting_document_url: 'https://example.com/doc.pdf',
        });

      expect(res.status).toBe(201);
      const createdOrgId = res.body?.id;
      expect(createdOrgId).toBeTruthy();

      const userAfter = await prisma.user.findUnique({
        where: { id: creator.id },
        select: { approval_status: true, organization_id: true, preferences: true },
      });
      expect(userAfter?.approval_status).toBe('APPROVED');
      expect(userAfter?.organization_id).toBe(createdOrgId);
      expect((userAfter?.preferences as any)?.organization_id).toBe(createdOrgId);

      const orgAfter = await prisma.organization.findUnique({
        where: { id: createdOrgId },
        select: { admin_approved: true, approved_at: true },
      });
      expect(orgAfter?.admin_approved).toBe(true);
      expect(orgAfter?.approved_at).toBeTruthy();

      await prisma.organizationMembership.deleteMany({ where: { organization_id: createdOrgId } });
      await prisma.organization.deleteMany({ where: { id: createdOrgId } });
      await prisma.coachApplication.deleteMany({ where: { user_id: creator.id } });
      await prisma.user.deleteMany({ where: { id: creator.id } });
    });
  });

  describe('POST /organizations/create approval transition', () => {
    it('legacy creator is PENDING after POST /organizations/create', async () => {
      const creatorHash = await bcrypt.hash(PASSWORD, 10);
      const creator = await prisma.user.create({
        data: {
          email: `onboarding-creator-${ts}@example.com`,
          password_hash: creatorHash,
          display_name: 'Onboarding Creator',
          email_verified: true,
          date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
          role: 'coach',
          onboarding_completed: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true, coach_agreement_accepted_at: new Date().toISOString() },
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
          supporting_document_url: 'https://example.com/doc.pdf',
        });

      expect(res.status).toBe(201);
      orgIdFromCreate = res.body?.id;
      expect(orgIdFromCreate).toBeTruthy();

      const userAfter = await prisma.user.findUnique({
        where: { id: creator.id },
        select: { approval_status: true, preferences: true, organization_id: true },
      });
      expect(userAfter?.approval_status).toBe('PENDING');
      expect(userAfter?.organization_id).toBe(orgIdFromCreate);
      expect((userAfter?.preferences as any)?.organization_id).toBe(orgIdFromCreate);
      expect((userAfter?.preferences as any)?.organization_name).toContain('Onboarding Create League');
      expect((userAfter?.preferences as any)?.join_request_pending).toBe(false);

      await prisma.organizationMembership.deleteMany({ where: { organization_id: orgIdFromCreate } });
      await prisma.organization.deleteMany({ where: { id: orgIdFromCreate } });
      await prisma.user.deleteMany({ where: { id: creator.id } });
      orgIdFromCreate = '';
    });

    it('approved coach application creator stays APPROVED after POST /organizations/create', async () => {
      const creatorHash = await bcrypt.hash(PASSWORD, 10);
      const creator = await prisma.user.create({
        data: {
          email: `onboarding-approved-app-${ts}@example.com`,
          password_hash: creatorHash,
          display_name: 'Approved App Onboarding Creator',
          email_verified: true,
          date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
          role: 'coach',
          onboarding_completed: true,
          preferences: {
            role: 'coach',
            plan: 'rookie',
            onboarding_completed: true,
            coach_agreement_accepted_at: new Date().toISOString(),
          },
          approval_status: 'APPROVED',
        },
      });
      const token = signJwt({ id: creator.id });

      await prisma.coachApplication.create({
        data: {
          user_id: creator.id,
          status: 'approved',
          organization_name: `Approved App Onboarding League ${ts}`,
          org_type: 'club',
          supporting_document_url: 'https://example.com/doc.pdf',
          reviewed_at: new Date(),
        },
      });

      const res = await request(app)
        .post('/organizations/create')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: `Approved App Onboarding Create ${ts}`,
          sport: 'basketball',
          org_type: 'club',
          supporting_document_url: 'https://example.com/doc.pdf',
        });

      expect(res.status).toBe(201);
      const createdOrgId = res.body?.id;
      expect(createdOrgId).toBeTruthy();

      const userAfter = await prisma.user.findUnique({
        where: { id: creator.id },
        select: { approval_status: true, preferences: true, organization_id: true },
      });
      expect(userAfter?.approval_status).toBe('APPROVED');
      expect(userAfter?.organization_id).toBe(createdOrgId);
      expect((userAfter?.preferences as any)?.organization_id).toBe(createdOrgId);
      expect((userAfter?.preferences as any)?.organization_name).toContain(
        'Approved App Onboarding Create'
      );
      expect((userAfter?.preferences as any)?.join_request_pending).toBe(false);

      const orgAfter = await prisma.organization.findUnique({
        where: { id: createdOrgId },
        select: { admin_approved: true, approved_at: true },
      });
      expect(orgAfter?.admin_approved).toBe(true);
      expect(orgAfter?.approved_at).toBeTruthy();

      await prisma.organizationMembership.deleteMany({ where: { organization_id: createdOrgId } });
      await prisma.organization.deleteMany({ where: { id: createdOrgId } });
      await prisma.coachApplication.deleteMany({ where: { user_id: creator.id } });
      await prisma.user.deleteMany({ where: { id: creator.id } });
    });
  });

  describe('League approval sets league owner to APPROVED', () => {
    it('allows the email approval token to approve the league without an admin session', async () => {
      const ownerHash = await bcrypt.hash(PASSWORD, 10);
      const owner = await prisma.user.create({
        data: {
          email: `pending-owner-${ts}@example.com`,
          password_hash: ownerHash,
          display_name: 'Pending Owner',
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
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
        select: { id: true },
      });
      await prisma.organizationMembership.create({
        data: { organization_id: org.id, user_id: owner.id, role: 'owner' },
        select: { id: true },
      });

      const token = signJwt({ orgId: org.id, action: 'approve_league' }, '48h');

      try {
        const tokenOnlyRes = await request(app)
          .post(`/organizations/${org.id}/approve?token=${token}`)
          .send();

        expect(tokenOnlyRes.status).toBe(200);
        expect(tokenOnlyRes.text).toMatch(/League Approved/i);

        const userAfter = await prisma.user.findUnique({
          where: { id: owner.id },
          select: { approval_status: true },
        });
        expect(userAfter?.approval_status).toBe('APPROVED');
      } finally {
        await prisma.organizationMembership.deleteMany({ where: { organization_id: org.id } });
        await prisma.organization.deleteMany({ where: { id: org.id } });
        await prisma.user.deleteMany({ where: { id: owner.id } });
      }
    });
  });

  describe('Coach email-token reviewer attribution', () => {
    it('leaves reviewed_by null when a token-only approval has no authenticated actor', async () => {
      const coachHash = await bcrypt.hash(PASSWORD, 10);
      const coach = await prisma.user.create({
        data: {
          email: `token-only-coach-${ts}@example.com`,
          password_hash: coachHash,
          display_name: 'Token Only Coach',
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'PENDING',
        },
      });

      const application = await prisma.coachApplication.create({
        data: {
          user_id: coach.id,
          status: 'submitted',
          organization_name: `Token Only League ${ts}`,
          org_type: 'club',
          supporting_document_url: 'https://example.com/doc.pdf',
        },
      });

      const reviewToken = signJwt({ coachId: coach.id, action: 'approve_coach' }, '48h');

      try {
        const res = await request(fullApp)
          .post(`/admin/coaches/${coach.id}/approve?token=${reviewToken}`)
          .send();

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/Coach Approved/i);

        const applicationAfter = await prisma.coachApplication.findUnique({
          where: { id: application.id },
          select: { status: true, reviewed_by: true },
        });
        expect(applicationAfter?.status).toBe('approved');
        expect(applicationAfter?.reviewed_by).toBeNull();
      } finally {
        await prisma.adminActivityLog.deleteMany({ where: { target_id: coach.id } }).catch(() => {});
        await prisma.coachApplication.deleteMany({ where: { user_id: coach.id } }).catch(() => {});
        await prisma.user.delete({ where: { id: coach.id } }).catch(() => {});
      }
    });

    it('does not attribute token approval to a non-admin signed-in session', async () => {
      const coachHash = await bcrypt.hash(PASSWORD, 10);
      const actorHash = await bcrypt.hash(PASSWORD, 10);
      const coach = await prisma.user.create({
        data: {
          email: `token-actor-coach-${ts}@example.com`,
          password_hash: coachHash,
          display_name: 'Token Actor Coach',
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'PENDING',
        },
      });
      const actor = await prisma.user.create({
        data: {
          email: `token-actor-${ts}@example.com`,
          password_hash: actorHash,
          display_name: 'Token Actor',
          email_verified: true,
          role: 'fan',
          onboarding_completed: true,
          preferences: { role: 'fan', plan: 'rookie', onboarding_completed: true },
          approval_status: 'APPROVED',
        },
      });

      const application = await prisma.coachApplication.create({
        data: {
          user_id: coach.id,
          status: 'submitted',
          organization_name: `Token Actor League ${ts}`,
          org_type: 'club',
          supporting_document_url: 'https://example.com/doc.pdf',
        },
      });

      const reviewToken = signJwt({ coachId: coach.id, action: 'approve_coach' }, '48h');
      const sessionToken = signJwt({ id: actor.id });

      try {
        const res = await request(fullApp)
          .post(`/admin/coaches/${coach.id}/approve?token=${reviewToken}`)
          .set('Authorization', `Bearer ${sessionToken}`)
          .send();

        expect(res.status).toBe(200);
        expect(res.text).toMatch(/Coach Approved/i);

        const applicationAfter = await prisma.coachApplication.findUnique({
          where: { id: application.id },
          select: { status: true, reviewed_by: true },
        });
        expect(applicationAfter?.status).toBe('approved');
        expect(applicationAfter?.reviewed_by).toBeNull();

        const auditLog = await prisma.adminActivityLog.findFirst({
          where: { target_id: coach.id, action: 'APPROVE_COACH' },
          orderBy: { timestamp: 'desc' },
          select: { admin_id: true, admin_email: true },
        });
        expect(auditLog?.admin_id).toBe('email-token');
        expect(auditLog?.admin_email).toBe('email-token');
      } finally {
        await prisma.adminActivityLog.deleteMany({
          where: { OR: [{ target_id: coach.id }, { admin_id: actor.id }] },
        }).catch(() => {});
        await prisma.coachApplication.deleteMany({ where: { user_id: coach.id } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: { in: [coach.id, actor.id] } } }).catch(() => {});
      }
    });
  });

  describe('Admin dashboard coach review (no email token)', () => {
    it('approves a pending coach when a signed-in admin POSTs without ?token=', async () => {
      const coachHash = await bcrypt.hash(PASSWORD, 10);
      const adminHash = await bcrypt.hash(PASSWORD, 10);
      const coach = await prisma.user.create({
        data: {
          email: `dashboard-coach-${ts}@example.com`,
          password_hash: coachHash,
          display_name: 'Dashboard Coach',
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'PENDING',
        },
      });
      const admin = await prisma.user.create({
        data: {
          email: `dashboard-admin-${ts}@example.com`,
          password_hash: adminHash,
          display_name: 'Dashboard Admin',
          email_verified: true,
          role: 'fan',
          onboarding_completed: true,
          preferences: { role: 'fan', plan: 'rookie', onboarding_completed: true },
          approval_status: 'APPROVED',
        },
      });
      const application = await prisma.coachApplication.create({
        data: {
          user_id: coach.id,
          status: 'submitted',
          organization_name: `Dashboard League ${ts}`,
          org_type: 'club',
          supporting_document_url: 'https://example.com/doc.pdf',
        },
      });

      const savedAdminEmails = process.env.ADMIN_EMAILS || '';
      process.env.ADMIN_EMAILS = [admin.email, savedAdminEmails].filter(Boolean).join(',');
      const sessionToken = signJwt({ id: admin.id });

      try {
        const res = await request(fullApp)
          .post(`/admin/coaches/${coach.id}/approve`)
          .set('Authorization', `Bearer ${sessionToken}`)
          .send({ note: 'looks good' });

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body?.ok).toBe(true);

        const applicationAfter = await prisma.coachApplication.findUnique({
          where: { id: application.id },
          select: { status: true, reviewed_by: true },
        });
        expect(applicationAfter?.status).toBe('approved');
        expect(applicationAfter?.reviewed_by).toBe(admin.id);
      } finally {
        process.env.ADMIN_EMAILS = savedAdminEmails;
        await prisma.adminActivityLog.deleteMany({
          where: { OR: [{ target_id: coach.id }, { admin_id: admin.id }] },
        }).catch(() => {});
        await prisma.coachApplication.deleteMany({ where: { user_id: coach.id } }).catch(() => {});
        await prisma.user.deleteMany({ where: { id: { in: [coach.id, admin.id] } } }).catch(() => {});
      }
    });

    it('returns JSON 401 when a non-admin POSTs without ?token=', async () => {
      const fanHash = await bcrypt.hash(PASSWORD, 10);
      const fan = await prisma.user.create({
        data: {
          email: `dashboard-fan-${ts}@example.com`,
          password_hash: fanHash,
          display_name: 'Dashboard Fan',
          email_verified: true,
          role: 'fan',
          onboarding_completed: true,
          preferences: { role: 'fan', plan: 'rookie', onboarding_completed: true },
          approval_status: 'APPROVED',
        },
      });
      const sessionToken = signJwt({ id: fan.id });

      try {
        const res = await request(fullApp)
          .post(`/admin/coaches/${approvedCoachId}/approve`)
          .set('Authorization', `Bearer ${sessionToken}`)
          .send({});

        expect(res.status).toBe(401);
        expect(res.headers['content-type']).toMatch(/application\/json/);
      } finally {
        await prisma.user.delete({ where: { id: fan.id } }).catch(() => {});
      }
    });
  });

  describe('Coach join request sets coach to PENDING', () => {
    it('coach requesting to join gets PENDING', async () => {
      const coachHash = await bcrypt.hash(PASSWORD, 10);
      const coach = await prisma.user.create({
        data: {
          email: `join-request-coach-${ts}@example.com`,
          password_hash: coachHash,
          display_name: 'Join Request Coach',
          email_verified: true,
          date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
          role: 'coach',
          onboarding_completed: true,
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
        select: { approval_status: true, preferences: true, paid_by_owner: true },
      });
      expect(userAfter?.approval_status).toBe('PENDING');
      expect((userAfter?.preferences as any)?.organization_id).toBe(orgId);
      expect((userAfter?.preferences as any)?.organization_name).toContain('Approval Test League');
      expect((userAfter?.preferences as any)?.join_request_pending).toBe(true);
      expect(userAfter?.paid_by_owner).toBe(false);

      const joinReq = await getOrganizationJoinRequestStateForUser(orgId, coach.id);
      expect(joinReq).toBeTruthy();

      await prisma.organizationJoinRequest.deleteMany({
        where: { user_id: coach.id, organization_id: orgId },
      });
      await prisma.user.delete({ where: { id: coach.id } });
    });

    it('fan accounts cannot submit coach join requests', async () => {
      const fanHash = await bcrypt.hash(PASSWORD, 10);
      const fan = await prisma.user.create({
        data: {
          email: `fan-join-request-${ts}@example.com`,
          password_hash: fanHash,
          display_name: 'Fan Applicant',
          email_verified: true,
          date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
          role: 'fan',
          onboarding_completed: true,
          preferences: { role: 'fan', onboarding_completed: true },
          approval_status: 'APPROVED',
        },
      });
      const token = signJwt({ id: fan.id });

      const res = await request(app)
        .post('/organizations/join-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({ organization_id: orgId, message: 'Let me in as a coach' });

      expect(res.status).toBe(403);
      expect(String(res.body?.error || '')).toMatch(/coach account/i);

      const joinReq = await getOrganizationJoinRequestStateForUser(orgId, fan.id);
      expect(joinReq).toBeNull();

      await prisma.user.delete({ where: { id: fan.id } });
    });

    it('blocks rejected coaches within 48h cooldown from creating a new join request', async () => {
      const coachHash = await bcrypt.hash(PASSWORD, 10);
      const rejectedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const coach = await prisma.user.create({
        data: {
          email: `join-request-cooldown-${ts}@example.com`,
          password_hash: coachHash,
          display_name: 'Join Request Cooldown Coach',
          email_verified: true,
          date_of_birth: new Date('1990-01-01T00:00:00.000Z'),
          role: 'coach',
          onboarding_completed: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'REJECTED',
          rejected_at: rejectedAt,
          rejection_reason: 'Try again later',
        },
      });
      const token = signJwt({ id: coach.id });

      const res = await request(app)
        .post('/organizations/join-requests')
        .set('Authorization', `Bearer ${token}`)
        .send({ organization_id: orgId, message: 'I want to join right now' });

      expect(res.status).toBe(429);
      expect(res.body?.code).toBe('REJECTION_COOLDOWN');
      expect(Number(res.body?.retry_after_ms)).toBeGreaterThan(0);

      const joinReq = await getOrganizationJoinRequestStateForUser(orgId, coach.id);
      expect(joinReq).toBeNull();

      await prisma.user.delete({ where: { id: coach.id } });
    });
  });

  describe('Existing-org coach admission is owner-only', () => {
    let managerId: string;
    let managerToken: string;

    beforeAll(async () => {
      const hash = await bcrypt.hash(PASSWORD, 10);
      const manager = await prisma.user.create({
        data: {
          email: `org-manager-${ts}@example.com`,
          password_hash: hash,
          display_name: 'Org Manager',
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true, coach_agreement_accepted_at: new Date().toISOString() },
          approval_status: 'APPROVED',
        },
      });
      managerId = manager.id;
      managerToken = signJwt({ id: managerId });
      await prisma.organizationMembership.create({
        data: { organization_id: orgId, user_id: managerId, role: 'manager', status: 'active' },
        select: { id: true },
      });
    });

    afterAll(async () => {
      await prisma.organizationMembership.deleteMany({ where: { user_id: managerId } }).catch(() => {});
      await prisma.user.delete({ where: { id: managerId } }).catch(() => {});
    });

    it('manager cannot GET /organizations/:id/pending-coaches', async () => {
      const hash = await bcrypt.hash(PASSWORD, 10);
      const coach = await prisma.user.create({
        data: {
          email: `pending-list-${ts}-${Math.random()}@example.com`,
          password_hash: hash,
          display_name: 'Pending Coach',
          email_verified: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'PENDING',
        },
      });
      await prisma.organizationJoinRequest.create({
        data: { organization_id: orgId, user_id: coach.id, status: 'pending' },
        select: { id: true },
      });

      const res = await request(app)
        .get(`/organizations/${orgId}/pending-coaches`)
        .set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(403);
      expect(String(res.body?.error || '')).toMatch(/league owner/i);

      await prisma.organizationJoinRequest.deleteMany({ where: { user_id: coach.id } });
      await prisma.user.delete({ where: { id: coach.id } });
    });

    it('manager cannot POST /organizations/:id/coaches/:userId/approve', async () => {
      const hash = await bcrypt.hash(PASSWORD, 10);
      const coach = await prisma.user.create({
        data: {
          email: `manager-approve-${ts}-${Math.random()}@example.com`,
          password_hash: hash,
          display_name: 'Manager Approves',
          email_verified: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'PENDING',
        },
      });
      await prisma.organizationJoinRequest.create({
        data: { organization_id: orgId, user_id: coach.id, status: 'pending' },
        select: { id: true },
      });

      const res = await request(app)
        .post(`/organizations/${orgId}/coaches/${coach.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});

      expect(res.status).toBe(403);
      const userAfter = await prisma.user.findUnique({
        where: { id: coach.id },
        select: { approval_status: true },
      });
      expect(userAfter?.approval_status).toBe('PENDING');

      await prisma.organizationJoinRequest.deleteMany({ where: { user_id: coach.id } });
      await prisma.organizationMembership.deleteMany({ where: { user_id: coach.id } });
      await prisma.user.delete({ where: { id: coach.id } });
    });

    it('manager cannot POST /organizations/:id/coaches/:userId/reject', async () => {
      const hash = await bcrypt.hash(PASSWORD, 10);
      const coach = await prisma.user.create({
        data: {
          email: `manager-reject-${ts}-${Math.random()}@example.com`,
          password_hash: hash,
          display_name: 'Manager Rejects',
          email_verified: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'PENDING',
        },
      });
      await prisma.organizationJoinRequest.create({
        data: { organization_id: orgId, user_id: coach.id, status: 'pending' },
        select: { id: true },
      });

      const res = await request(app)
        .post(`/organizations/${orgId}/coaches/${coach.id}/reject`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Not a fit' });

      expect(res.status).toBe(403);
      const reqAfter = await getOrganizationJoinRequestStateForUser(orgId, coach.id);
      expect(reqAfter?.status).toBe('pending');
 
      await prisma.organizationJoinRequest.deleteMany({ where: { user_id: coach.id } });
      await prisma.user.delete({ where: { id: coach.id } });
    });

    it('manager cannot use join-request review endpoints', async () => {
      const hash = await bcrypt.hash(PASSWORD, 10);
      const coach = await prisma.user.create({
        data: {
          email: `manager-join-request-${ts}-${Math.random()}@example.com`,
          password_hash: hash,
          display_name: 'Manager Join Request',
          email_verified: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
          approval_status: 'PENDING',
        },
      });
      const joinRequest = await prisma.organizationJoinRequest.create({
        data: { organization_id: orgId, user_id: coach.id, status: 'pending' },
        select: { id: true },
      });

      const listRes = await request(app)
        .get(`/organizations/${orgId}/join-requests`)
        .set('Authorization', `Bearer ${managerToken}`);
      expect(listRes.status).toBe(403);

      const approveRes = await request(app)
        .post(`/organizations/join-requests/${joinRequest.id}/approve`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({});
      expect(approveRes.status).toBe(403);

      const denyRes = await request(app)
        .post(`/organizations/join-requests/${joinRequest.id}/deny`)
        .set('Authorization', `Bearer ${managerToken}`)
        .send({ reason: 'Not owner' });
      expect(denyRes.status).toBe(403);

      await prisma.organizationJoinRequest.deleteMany({ where: { user_id: coach.id } });
      await prisma.user.delete({ where: { id: coach.id } });
    });

    it('non-admin org member cannot view or approve pending coaches', async () => {
      const hash = await bcrypt.hash(PASSWORD, 10);
      const member = await prisma.user.create({
        data: {
          email: `non-admin-member-${ts}-${Math.random()}@example.com`,
          password_hash: hash,
          display_name: 'Plain Member',
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
          preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true, coach_agreement_accepted_at: new Date().toISOString() },
          approval_status: 'APPROVED',
        },
      });
      const memberToken = signJwt({ id: member.id });
      await prisma.organizationMembership.create({
        data: { organization_id: orgId, user_id: member.id, role: 'coach', status: 'active' },
        select: { id: true },
      });

      const listRes = await request(app)
        .get(`/organizations/${orgId}/pending-coaches`)
        .set('Authorization', `Bearer ${memberToken}`);
      expect(listRes.status).toBe(403);

      const approveRes = await request(app)
        .post(`/organizations/${orgId}/coaches/${member.id}/approve`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({});
      expect(approveRes.status).toBe(403);

      await prisma.organizationMembership.deleteMany({ where: { user_id: member.id } });
      await prisma.user.delete({ where: { id: member.id } });
    });
  });

  describe('League owner approval sets coach to APPROVED', () => {
    it('league owner approving coach sets coach to APPROVED', async () => {
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
        select: { id: true },
      });

      const res = await request(app)
        .post(`/organizations/${orgId}/coaches/${coach.id}/approve`)
        .set('Authorization', `Bearer ${leagueOwnerToken}`)
        .send({});

      expect(res.status).toBe(200);

      const userAfter = await prisma.user.findUnique({
        where: { id: coach.id },
        select: { approval_status: true, paid_by_owner: true, preferences: true },
      });
      expect(userAfter?.approval_status).toBe('APPROVED');
      expect(userAfter?.paid_by_owner).toBe(true);
      expect((userAfter?.preferences as any)?.role).toBe('coach');
      expect((userAfter?.preferences as any)?.organization_id).toBe(orgId);
      expect((userAfter?.preferences as any)?.join_request_pending).toBe(false);
      expect((userAfter?.preferences as any)?.proceeding_as_fan).toBe(false);
      expect((userAfter?.preferences as any)?.payment_pending).toBeUndefined();
      expect((userAfter?.preferences as any)?.pending_plan).toBeUndefined();

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
