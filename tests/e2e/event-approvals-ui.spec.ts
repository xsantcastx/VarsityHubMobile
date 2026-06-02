import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { PrismaClient } from '../../server/node_modules/@prisma/client/index.js';

const API_URL = (
  process.env.API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://127.0.0.1:4000'
).replace('://localhost', '://127.0.0.1');

const prisma = new PrismaClient();

const PASSWORD = 'ApprovalUiTest123!';
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type ManagerSession = {
  accessToken: string;
  refreshToken: string;
  userId: string;
};

const createdIds = {
  userIds: [] as string[],
  orgIds: [] as string[],
  teamIds: [] as string[],
  eventIds: [] as string[],
  gameIds: [] as string[],
};

function uniqueEmail(label: string) {
  return `${label}-${RUN_ID}@varsityhub-test.app`;
}

function uniqueUsername(label: string) {
  return `${label}${RUN_ID.replace(/[^a-z0-9]/gi, '')}`.slice(0, 20).toLowerCase();
}

async function registerVerifiedManager(request: APIRequestContext): Promise<ManagerSession> {
  const email = uniqueEmail('approval-manager');
  const response = await request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password: PASSWORD,
      display_name: 'Approval UI Manager',
      role: 'fan',
    },
  });

  expect(response.status()).toBe(201);
  const body = await response.json();
  const accessToken = String(body.access_token || '');
  const refreshToken = String(body.refresh_token || '');
  const userId = String(body.user?.id || '');
  const verificationCode = String(body.dev_verification_code || '');

  expect(accessToken).toBeTruthy();
  expect(refreshToken).toBeTruthy();
  expect(userId).toBeTruthy();
  expect(verificationCode).toBeTruthy();
  createdIds.userIds.push(userId);

  const verifyResponse = await request.post(`${API_URL}/auth/verify/confirm`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { code: verificationCode },
  });
  expect([200, 204, 429]).toContain(verifyResponse.status());

  return { accessToken, refreshToken, userId };
}

async function seedCoachSession(page: Page, session: ManagerSession) {
  await page.addInitScript(
    ({ accessToken, refreshToken, userId }) => {
      window.sessionStorage.setItem('auth_token_key', accessToken);
      window.sessionStorage.setItem('refresh_token_key', refreshToken);
      window.localStorage.setItem('@onboarding_completed_once', 'true');
      window.localStorage.setItem('@onboarding_completed_user_id', userId);
      window.localStorage.setItem('@last_onboarding_user_id', userId);
    },
    {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      userId: session.userId,
    }
  );
}

async function cleanupFixtures() {
  await prisma.event.deleteMany({
    where: { id: { in: createdIds.eventIds } },
  });
  await prisma.game.deleteMany({
    where: { id: { in: createdIds.gameIds } },
  });
  await prisma.team.deleteMany({
    where: { id: { in: createdIds.teamIds } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: createdIds.orgIds } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user_id: { in: createdIds.userIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: createdIds.userIds } },
  });
}

test.describe('Event approvals UI', () => {
  test.describe.configure({ mode: 'serial' });

  const fixture = {
    manager: null as ManagerSession | null,
    pendingEventId: '',
    pendingGameId: '',
    pendingEventTitle: `Approval UI Event ${RUN_ID}`,
    pendingGameTitle: `Approval UI Game ${RUN_ID}`,
    rejectReason: `Rejected in UI E2E ${RUN_ID}`,
  };

  test.beforeAll(async ({ request }) => {
    fixture.manager = await registerVerifiedManager(request);

    const submitter = await prisma.user.create({
      data: {
        email: uniqueEmail('approval-submitter'),
        display_name: 'Approval UI Submitter',
        username: uniqueUsername('uisubmitter'),
        email_verified: true,
        role: 'fan',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });
    createdIds.userIds.push(submitter.id);

    const organization = await prisma.organization.create({
      data: {
        name: `Approval UI Org ${RUN_ID}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    createdIds.orgIds.push(organization.id);

    const team = await prisma.team.create({
      data: {
        name: `Approval UI Team ${RUN_ID}`,
        organization_id: organization.id,
        sport: 'basketball',
      },
    });
    createdIds.teamIds.push(team.id);

    await prisma.organizationMembership.create({
      data: {
        organization_id: organization.id,
        user_id: fixture.manager.userId,
        role: 'manager',
        status: 'active',
      },
    });

    await prisma.user.update({
      where: { id: fixture.manager.userId },
      data: {
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        organization_id: organization.id,
        approval_status: 'APPROVED',
        username: uniqueUsername('uimanager'),
        preferences: {
          role: 'coach',
          onboarding_completed: true,
          organization_id: organization.id,
          plan: 'rookie',
          coach_agreement_accepted_at: new Date().toISOString(),
          coach_agreement_version: 1,
        },
      },
    });

    const pendingEvent = await prisma.event.create({
      data: {
        title: fixture.pendingEventTitle,
        date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        location: 'Approval UI Gym',
        description: 'Pending UI approval event',
        team_id: team.id,
        creator_id: submitter.id,
        creator_role: 'fan',
        status: 'draft',
        approval_status: 'pending',
        event_type: 'watch_party',
      } as any,
    });
    fixture.pendingEventId = pendingEvent.id;
    createdIds.eventIds.push(pendingEvent.id);

    const pendingGame = await (prisma.game.create as any)({
      data: {
        title: fixture.pendingGameTitle,
        date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        location: 'Approval UI Arena',
        home_team_id: team.id,
        created_by_id: submitter.id,
        approval_status: 'pending',
      },
    });
    fixture.pendingGameId = pendingGame.id;
    createdIds.gameIds.push(pendingGame.id);

    const linkedGameEvent = await prisma.event.create({
      data: {
        title: `${fixture.pendingGameTitle} Event`,
        date: pendingGame.date,
        location: pendingGame.location,
        team_id: team.id,
        game_id: pendingGame.id,
        creator_id: submitter.id,
        creator_role: 'fan',
        status: 'approved',
        approval_status: 'approved',
        approved_at: new Date(),
        event_type: 'game',
      } as any,
    });
    createdIds.eventIds.push(linkedGameEvent.id);
  });

  test.afterAll(async () => {
    await cleanupFixtures();
    await prisma.$disconnect();
  });

  test('manager can approve an event and reject a game from the approval screen', async ({
    page,
  }) => {
    if (!fixture.manager) {
      throw new Error('Manager fixture was not created');
    }

    page.on('dialog', dialog => {
      void dialog.accept().catch(() => {});
    });

    await seedCoachSession(page, fixture.manager);
    await page.goto('/event-approvals');

    await expect(page.getByText('Pitched Events')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(fixture.pendingEventTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(fixture.pendingGameTitle, { exact: true })).toBeVisible();

    await page.getByText('Approve', { exact: true }).first().click();

    await expect(page.getByText(fixture.pendingEventTitle, { exact: true })).toHaveCount(0, {
      timeout: 15000,
    });
    await expect
      .poll(async () => {
        return prisma.event.findUnique({
          where: { id: fixture.pendingEventId },
          select: { approval_status: true, status: true, approved_at: true },
        });
      })
      .toMatchObject({
        approval_status: 'approved',
        status: 'approved',
      });

    await page.getByText('Reject', { exact: true }).click();
    await expect(page.getByText('Reject Event')).toBeVisible();
    await page.getByPlaceholder('Reason (optional)...').fill(fixture.rejectReason);
    await page.getByText('Reject', { exact: true }).nth(1).click();

    await expect(page.getByText(fixture.pendingGameTitle, { exact: true })).toHaveCount(0, {
      timeout: 15000,
    });
    await expect
      .poll(async () => {
        const [game, linkedEvent] = await Promise.all([
          prisma.game.findUnique({
            where: { id: fixture.pendingGameId },
            select: { approval_status: true, approved_by_id: true },
          }),
          prisma.event.findFirst({
            where: { game_id: fixture.pendingGameId },
            select: { approval_status: true, status: true, rejected_reason: true },
          }),
        ]);

        return { game, linkedEvent };
      })
      .toMatchObject({
        game: {
          approval_status: 'rejected',
          approved_by_id: null,
        },
        linkedEvent: {
          approval_status: 'rejected',
          status: 'rejected',
          rejected_reason: fixture.rejectReason,
        },
      });
  });
});
