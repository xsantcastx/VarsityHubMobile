import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';

const __skipDbIntegrationSuites =
  String(process.env.CI ?? '').toLowerCase() === 'true' || process.env.SKIP_SERVER_DB_TESTS === '1';
const describeDb = __skipDbIntegrationSuites ? describe.skip : describe;



let prisma: any;

const ts = Date.now();
const PASSWORD = 'TestPassword123!';

describeDb('event review notifications', () => {
  let orgId = '';
  let teamId = '';
  let teamCoachId = '';
  let orgManagerId = '';

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));

    const hash = await bcrypt.hash(PASSWORD, 10);

    const [teamCoach, orgManager] = await Promise.all([
      prisma.user.create({
        data: {
          email: `event-team-coach-${ts}@example.com`,
          password_hash: hash,
          display_name: 'Team Coach',
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
          approval_status: 'APPROVED',
          preferences: { role: 'coach', onboarding_completed: true },
        },
      }),
      prisma.user.create({
        data: {
          email: `event-org-manager-${ts}@example.com`,
          password_hash: hash,
          display_name: 'Org Manager',
          email_verified: true,
          role: 'coach',
          onboarding_completed: true,
          approval_status: 'APPROVED',
          preferences: { role: 'coach', onboarding_completed: true },
        },
      }),
    ]);
    teamCoachId = teamCoach.id;
    orgManagerId = orgManager.id;

    const org = await prisma.organization.create({
      data: {
        name: `Event Review League ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    orgId = org.id;

    const team = await prisma.team.create({
      data: {
        name: `Event Review Team ${ts}`,
        organization_id: org.id,
      },
    });
    teamId = team.id;

    await Promise.all([
      prisma.teamMembership.create({
        data: {
          team_id: team.id,
          user_id: teamCoach.id,
          role: 'coach',
          status: 'active',
        },
      }),
      prisma.organizationMembership.create({
        data: {
          organization_id: org.id,
          user_id: orgManager.id,
          role: 'manager',
          status: 'active',
        },
      }),
    ]);
  });

  afterAll(async () => {
    await prisma.teamMembership.deleteMany({
      where: { user_id: { in: [teamCoachId, orgManagerId] } },
    }).catch(() => {});
    await prisma.organizationMembership.deleteMany({
      where: { user_id: { in: [teamCoachId, orgManagerId] } },
    }).catch(() => {});
    await prisma.team.deleteMany({
      where: { id: teamId || undefined },
    }).catch(() => {});
    await prisma.organization.deleteMany({
      where: { id: orgId || undefined },
    }).catch(() => {});
    await prisma.user.deleteMany({
      where: { id: { in: [teamCoachId, orgManagerId] } },
    }).catch(() => {});
  });

  it('returns team staff and org admins for a team-scoped pending review', async () => {
    const { getPendingEventReviewRecipients } = await import('../lib/eventReviewNotifications.js');
    const recipients = await getPendingEventReviewRecipients(prisma, { teamId });

    expect(recipients.map((r: any) => r.email).sort()).toEqual([
      `event-org-manager-${ts}@example.com`,
      `event-team-coach-${ts}@example.com`,
    ]);
    expect(new Set(recipients.map((r: any) => r.source))).toEqual(new Set(['team', 'org']));
  });

  it('falls back to admin notification emails for unscoped pending reviews', async () => {
    const original = process.env.ADMIN_NOTIFICATION_EMAILS;
    process.env.ADMIN_NOTIFICATION_EMAILS = `event-admin-${ts}@example.com`;

    const { getPendingEventReviewRecipients } = await import('../lib/eventReviewNotifications.js');
    const recipients = await getPendingEventReviewRecipients(prisma, { teamId: null });

    expect(recipients).toEqual([
      {
        userId: null,
        email: `event-admin-${ts}@example.com`,
        displayName: 'Admin',
        source: 'admin_fallback',
      },
    ]);

    process.env.ADMIN_NOTIFICATION_EMAILS = original;
  });
});
