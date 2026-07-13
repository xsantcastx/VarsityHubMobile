import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import { app } from '../teamGateTestApp.js';
import { prisma } from '../lib/prisma.js';
import { signJwt } from '../lib/jwt.js';

const ts = Date.now();
const PASSWORD = 'TestPassword123!';
const FORTY_EIGHT_HOURS_MS = 48 * 60 * 60 * 1000;
const REQUIRED_COACH_AGREEMENT_VERSION = Number(process.env.REQUIRED_COACH_AGREEMENT_VERSION ?? 1);
let emailSeq = 0;

function uniqueEmail(prefix: string) {
  emailSeq += 1;
  return `${prefix}-${ts}-${emailSeq}@example.com`;
}

const isCi = `${process.env.CI ?? ''}`.toLowerCase() === 'true';
const shouldSkip = isCi || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = shouldSkip ? describe.skip : describe;

type CreateUserOptions = {
  email: string;
  displayName: string;
  approvalStatus?: 'APPROVED' | 'PENDING' | 'REJECTED';
  paidByOwner?: boolean;
  rejectedAt?: Date | null;
  rejectionReason?: string | null;
  dateOfBirth?: Date | null;
  preferences: Record<string, unknown>;
};

type CreateOrgOptions = {
  ownerId: string;
  name: string;
  adminApproved: boolean;
};

describeDb('requireOnboarded coach gate matrix', () => {
  const cleanup = {
    users: [] as string[],
    orgs: [] as string[],
    teams: [] as string[],
  };

  beforeAll(async () => {
    // Clear interrupted local fixture rows from prior reruns. This suite uses
    // the shared dev DB rather than an isolated ephemeral test database.
    const lingeringUsers = await prisma.user.findMany({
      where: {
        OR: [{ email: { startsWith: 'coach-gate-' } }, { username: { startsWith: 'cg' } }],
      },
      select: { id: true },
    });
    const lingeringUserIds = lingeringUsers.map(user => user.id);

    const lingeringOrgs = await prisma.organization.findMany({
      where: { name: { startsWith: 'Coach Gate ' } },
      select: { id: true },
    });
    const lingeringOrgIds = lingeringOrgs.map(org => org.id);

    if (lingeringUserIds.length || lingeringOrgIds.length) {
      if (lingeringOrgIds.length && lingeringUserIds.length) {
        await prisma.teamInvite
          .deleteMany({
            where: {
              OR: [
                { team: { organization_id: { in: lingeringOrgIds } } },
                { invited_by_user_id: { in: lingeringUserIds } },
              ],
            },
          })
          .catch(() => {});
        await prisma.teamMembership
          .deleteMany({
            where: {
              OR: [
                { user_id: { in: lingeringUserIds } },
                { team: { organization_id: { in: lingeringOrgIds } } },
              ],
            },
          })
          .catch(() => {});
        await prisma.organizationJoinRequest
          .deleteMany({
            where: {
              OR: [
                { user_id: { in: lingeringUserIds } },
                { organization_id: { in: lingeringOrgIds } },
              ],
            },
          })
          .catch(() => {});
        await prisma.organizationMembership
          .deleteMany({
            where: {
              OR: [
                { user_id: { in: lingeringUserIds } },
                { organization_id: { in: lingeringOrgIds } },
              ],
            },
          })
          .catch(() => {});
      } else if (lingeringOrgIds.length) {
        await prisma.teamInvite
          .deleteMany({
            where: { team: { organization_id: { in: lingeringOrgIds } } },
          })
          .catch(() => {});
        await prisma.teamMembership
          .deleteMany({
            where: { team: { organization_id: { in: lingeringOrgIds } } },
          })
          .catch(() => {});
        await prisma.organizationJoinRequest
          .deleteMany({
            where: { organization_id: { in: lingeringOrgIds } },
          })
          .catch(() => {});
        await prisma.organizationMembership
          .deleteMany({
            where: { organization_id: { in: lingeringOrgIds } },
          })
          .catch(() => {});
      } else if (lingeringUserIds.length) {
        await prisma.teamInvite
          .deleteMany({
            where: { invited_by_user_id: { in: lingeringUserIds } },
          })
          .catch(() => {});
        await prisma.teamMembership
          .deleteMany({
            where: { user_id: { in: lingeringUserIds } },
          })
          .catch(() => {});
        await prisma.organizationJoinRequest
          .deleteMany({
            where: { user_id: { in: lingeringUserIds } },
          })
          .catch(() => {});
        await prisma.organizationMembership
          .deleteMany({
            where: { user_id: { in: lingeringUserIds } },
          })
          .catch(() => {});
      }

      if (lingeringOrgIds.length) {
        await prisma.team
          .deleteMany({
            where: { organization_id: { in: lingeringOrgIds } },
          })
          .catch(() => {});
        await prisma.organization
          .deleteMany({
            where: { id: { in: lingeringOrgIds } },
          })
          .catch(() => {});
      }

      if (lingeringUserIds.length) {
        await prisma.user
          .deleteMany({
            where: { id: { in: lingeringUserIds } },
          })
          .catch(() => {});
      }
    }
  });

  afterAll(async () => {
    if (!prisma) return;

    if (cleanup.teams.length) {
      await prisma.teamInvite
        .deleteMany({
          where: { team_id: { in: cleanup.teams } },
        })
        .catch(() => {});
      await prisma.teamMembership
        .deleteMany({
          where: { team_id: { in: cleanup.teams } },
        })
        .catch(() => {});
      await prisma.team
        .deleteMany({
          where: { id: { in: cleanup.teams } },
        })
        .catch(() => {});
    }

    if (cleanup.orgs.length) {
      await prisma.organizationJoinRequest
        .deleteMany({
          where: { organization_id: { in: cleanup.orgs } },
        })
        .catch(() => {});
      await prisma.organizationMembership
        .deleteMany({
          where: { organization_id: { in: cleanup.orgs } },
        })
        .catch(() => {});
      await prisma.organization
        .deleteMany({
          where: { id: { in: cleanup.orgs } },
        })
        .catch(() => {});
    }

    if (cleanup.users.length) {
      await prisma.user
        .deleteMany({
          where: { id: { in: cleanup.users } },
        })
        .catch(() => {});
    }
  });

  async function createUser(options: CreateUserOptions) {
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    // Mirror role + onboarding_completed from preferences to the canonical
    // columns. The runtime canonical readers prefer the column over the
    // JSON, and the column defaults to (fan, false), so a fixture that
    // only sets `preferences.role: 'coach'` is read as a fan with
    // incomplete onboarding — exactly the drift the v1.0.3 atomic-write
    // pass was added to prevent in production code.
    const prefsRole = options.preferences?.role;
    const role = prefsRole === 'coach' || prefsRole === 'fan' ? prefsRole : undefined;
    const onboardingCompleted = options.preferences?.onboarding_completed === true;
    const coachAgreementAcceptedAtValue = options.preferences?.coach_agreement_accepted_at;
    const coachAgreementAcceptedAt = coachAgreementAcceptedAtValue
      ? new Date(String(coachAgreementAcceptedAtValue))
      : null;
    const coachAgreementVersionValue = options.preferences?.coach_agreement_version;
    const coachAgreementVersion = coachAgreementAcceptedAt
      ? Number(coachAgreementVersionValue ?? REQUIRED_COACH_AGREEMENT_VERSION)
      : null;
    const user = await prisma.user.create({
      data: {
        email: options.email,
        password_hash: passwordHash,
        display_name: options.displayName,
        username: `cg${ts}${emailSeq}`.slice(0, 20),
        email_verified: true,
        approval_status: options.approvalStatus ?? 'APPROVED',
        paid_by_owner: options.paidByOwner ?? false,
        rejected_at: options.rejectedAt ?? null,
        rejection_reason: options.rejectionReason ?? null,
        date_of_birth: options.dateOfBirth ?? new Date('1990-01-01'),
        ...(role ? { role } : {}),
        onboarding_completed: onboardingCompleted,
        coach_agreement_accepted_at: coachAgreementAcceptedAt,
        coach_agreement_version: coachAgreementVersion,
        preferences: options.preferences,
      },
    });

    cleanup.users.push(user.id);
    return {
      user,
      token: signJwt({ id: user.id }),
    };
  }

  async function createOrganization(options: CreateOrgOptions) {
    const org = await prisma.organization.create({
      data: {
        name: options.name,
        org_type: 'club',
        admin_approved: options.adminApproved,
        league_owner_id: options.ownerId,
        updated_at: new Date(),
      },
    });
    cleanup.orgs.push(org.id);

    await prisma.organizationMembership.create({
      data: {
        organization_id: org.id,
        user_id: options.ownerId,
        role: 'owner',
        status: 'active',
      },
    });

    return org;
  }

  async function addOrgMembership(orgId: string, userId: string, role = 'coach') {
    await prisma.organizationMembership.create({
      data: {
        organization_id: orgId,
        user_id: userId,
        role,
        status: 'active',
      },
    });
  }

  async function createTeamViaApi(token: string, organizationId: string, name: string) {
    const res = await request(app)
      .post('/teams/create')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        organization_id: organizationId,
        club_type: 'sport',
      });

    const teamId = res.body?.team?.id ?? res.body?.id;
    if (res.status === 201 && teamId) cleanup.teams.push(teamId);
    return res;
  }

  it('allows approved coach with Veteran plan + payment_pending once approval is granted', async () => {
    const { user: owner } = await createUser({
      email: uniqueEmail('coach-gate-owner-payment'),
      displayName: 'Coach Gate Owner Payment',
      preferences: {
        role: 'coach',
        plan: 'rookie',
        onboarding_completed: true,
        coach_agreement_accepted_at: new Date().toISOString(),
      },
    });
    const org = await createOrganization({
      ownerId: owner.id,
      name: `Coach Gate Payment Org ${ts}`,
      adminApproved: true,
    });

    const member = await createUser({
      email: uniqueEmail('coach-gate-payment'),
      displayName: 'Coach Gate Payment',
      preferences: {
        role: 'coach',
        plan: 'veteran',
        onboarding_completed: true,
        organization_id: org.id,
        coach_agreement_accepted_at: new Date().toISOString(),
        payment_pending: true,
      },
    });
    await addOrgMembership(org.id, member.user.id);

    const res = await createTeamViaApi(member.token, org.id, `Payment Allowed Team ${ts}`);

    expect(res.status).toBe(201);
    expect(res.body?.team?.id ?? res.body?.id).toBeTruthy();
  });

  it('allows approved coach whose org.admin_approved = false once approval is granted', async () => {
    const { user: owner } = await createUser({
      email: uniqueEmail('coach-gate-owner-org'),
      displayName: 'Coach Gate Owner Org',
      preferences: {
        role: 'coach',
        plan: 'rookie',
        onboarding_completed: true,
        coach_agreement_accepted_at: new Date().toISOString(),
      },
    });
    const org = await createOrganization({
      ownerId: owner.id,
      name: `Coach Gate Pending Org ${ts}`,
      adminApproved: false,
    });

    const member = await createUser({
      email: uniqueEmail('coach-gate-org'),
      displayName: 'Coach Gate Org',
      preferences: {
        role: 'coach',
        plan: 'rookie',
        onboarding_completed: true,
        organization_id: org.id,
        coach_agreement_accepted_at: new Date().toISOString(),
      },
    });
    await addOrgMembership(org.id, member.user.id);

    const res = await createTeamViaApi(member.token, org.id, `Org Approval Allowed Team ${ts}`);

    expect(res.status).toBe(201);
    expect(res.body?.team?.id ?? res.body?.id).toBeTruthy();
  });

  it('blocks rejected applicant within 48h REJECTION_COOLDOWN on POST /auth/upgrade-to-coach', async () => {
    const rejectedAt = new Date(Date.now() - 60 * 60 * 1000);
    const applicant = await createUser({
      email: uniqueEmail('coach-gate-upgrade-cooldown'),
      displayName: 'Coach Gate Upgrade Cooldown',
      approvalStatus: 'REJECTED',
      rejectedAt,
      rejectionReason: 'Missing verification',
      preferences: {
        role: 'fan',
        onboarding_completed: true,
      },
    });

    const res = await request(app)
      .post('/auth/upgrade-to-coach')
      .set('Authorization', `Bearer ${applicant.token}`)
      .send({ plan: 'rookie' });

    expect(res.status).toBe(429);
    expect(res.body?.code).toBe('REJECTION_COOLDOWN');
    expect(Number(res.body?.retry_after_ms)).toBeGreaterThan(0);
    expect(res.body?.reason).toBe('Missing verification');
  });

  it('blocks rejected coach within 48h REJECTION_COOLDOWN on POST /auth/coach/reapply', async () => {
    const rejectedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const rejectedCoach = await createUser({
      email: uniqueEmail('coach-gate-reapply-cooldown'),
      displayName: 'Coach Gate Reapply Cooldown',
      approvalStatus: 'REJECTED',
      rejectedAt,
      rejectionReason: 'Org documents incomplete',
      preferences: {
        role: 'coach',
        plan: 'rookie',
        onboarding_completed: true,
      },
    });

    const res = await request(app)
      .post('/auth/coach/reapply')
      .set('Authorization', `Bearer ${rejectedCoach.token}`)
      .send({});

    expect(res.status).toBe(429);
    expect(res.body?.code).toBe('REJECTION_COOLDOWN');
    expect(Number(res.body?.retry_after_ms)).toBeGreaterThan(0);
    expect(res.body?.reason).toBe('Org documents incomplete');
  });

  it('allows coach past 48h REJECTION_COOLDOWN to reapply', async () => {
    const { user: owner } = await createUser({
      email: uniqueEmail('coach-gate-reapply-owner'),
      displayName: 'Coach Gate Reapply Owner',
      preferences: {
        role: 'coach',
        plan: 'rookie',
        onboarding_completed: true,
        coach_agreement_accepted_at: new Date().toISOString(),
      },
    });
    const org = await createOrganization({
      ownerId: owner.id,
      name: `Coach Gate Reapply Org ${ts}`,
      adminApproved: true,
    });

    const rejectedAt = new Date(Date.now() - FORTY_EIGHT_HOURS_MS - 60 * 1000);
    const rejectedCoach = await createUser({
      email: uniqueEmail('coach-gate-reapply-ok'),
      displayName: 'Coach Gate Reapply Ok',
      approvalStatus: 'REJECTED',
      rejectedAt,
      rejectionReason: 'Outdated docs',
      preferences: {
        role: 'coach',
        plan: 'rookie',
        onboarding_completed: true,
        organization_id: org.id,
        join_request_pending: true,
      },
    });
    await prisma.user.update({
      where: { id: rejectedCoach.user.id },
      data: { organization_id: org.id },
    });

    const res = await request(app)
      .post('/auth/coach/reapply')
      .set('Authorization', `Bearer ${rejectedCoach.token}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body?.ok).toBe(true);

    const refreshed = await prisma.user.findUnique({
      where: { id: rejectedCoach.user.id },
      select: {
        approval_status: true,
        organization_id: true,
        rejected_at: true,
        rejection_reason: true,
        preferences: true,
      },
    });
    const prefs = (refreshed?.preferences as Record<string, unknown> | null) || {};

    expect(refreshed?.approval_status).toBe('PENDING');
    expect(refreshed?.organization_id).toBeNull();
    expect(refreshed?.rejected_at).toBeNull();
    expect(refreshed?.rejection_reason).toBeNull();
    expect(prefs.onboarding_completed).toBe(false);
    expect(prefs.join_request_pending).toBe(false);
    expect(prefs.role).toBe('coach');
    expect(prefs.organization_id).toBeUndefined();

    const meRes = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${rejectedCoach.token}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body?.organization_id ?? null).toBeNull();
    expect(meRes.body?.account_state).toBe('coach_application_required');
  });

  it('allows approved coach with paid_by_owner=true on paid tier without checkout', async () => {
    const owner = await createUser({
      email: uniqueEmail('coach-gate-owner-bypass'),
      displayName: 'Coach Gate Owner Bypass',
      preferences: {
        role: 'coach',
        plan: 'rookie',
        onboarding_completed: true,
        coach_agreement_accepted_at: new Date().toISOString(),
      },
    });
    const org = await createOrganization({
      ownerId: owner.user.id,
      name: `Coach Gate Owner Paid Org ${ts}`,
      adminApproved: true,
    });

    const member = await createUser({
      email: uniqueEmail('coach-gate-paid-by-owner'),
      displayName: 'Coach Gate Paid By Owner',
      paidByOwner: true,
      preferences: {
        role: 'coach',
        plan: 'veteran',
        pending_plan: 'veteran',
        onboarding_completed: true,
        organization_id: org.id,
        coach_agreement_accepted_at: new Date().toISOString(),
        payment_pending: true,
      },
    });
    await addOrgMembership(org.id, member.user.id);

    const res = await createTeamViaApi(member.token, org.id, `Paid By Owner Team ${ts}`);

    expect(res.status).toBe(201);
    expect(res.body?.id || res.body?.team?.id).toBeTruthy();
  });
});
