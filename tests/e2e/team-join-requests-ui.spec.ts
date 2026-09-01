import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { PrismaClient } from '../../server/node_modules/@prisma/client/index.js';

const API_URL = (
  process.env.API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  'http://127.0.0.1:4000'
).replace('://localhost', '://127.0.0.1');

const prisma = new PrismaClient();

const PASSWORD = 'TeamJoinUiTest123!';
const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type Session = {
  accessToken: string;
  refreshToken: string;
  userId: string;
};

const createdIds = {
  userIds: [] as string[],
  orgIds: [] as string[],
  teamIds: [] as string[],
  joinRequestIds: [] as string[],
};

function uniqueEmail(label: string) {
  return `${label}-${RUN_ID}@varsityhub-test.app`;
}

async function registerVerifiedUser(
  request: APIRequestContext,
  displayName: string
): Promise<Session> {
  const response = await request.post(`${API_URL}/auth/register`, {
    data: {
      email: uniqueEmail(displayName.toLowerCase().replace(/\s+/g, '-')),
      password: PASSWORD,
      display_name: displayName,
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

async function seedSession(page: Page, session: Session) {
  await page.addInitScript(({ accessToken, refreshToken, userId }) => {
    window.sessionStorage.setItem('auth_token_key', accessToken);
    window.sessionStorage.setItem('refresh_token_key', refreshToken);
    window.localStorage.setItem('@onboarding_completed_once', 'true');
    window.localStorage.setItem('@onboarding_completed_user_id', userId);
    window.localStorage.setItem('@last_onboarding_user_id', userId);
  }, session);
}

async function cleanupFixtures() {
  await prisma.teamJoinRequest.deleteMany({
    where: { id: { in: createdIds.joinRequestIds } },
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

test.describe('Team join requests UI', () => {
  test.describe.configure({ mode: 'serial' });

  const fixture = {
    manager: null as Session | null,
    teamId: '',
    teamName: `UI Join Team ${RUN_ID}`,
    requesterName: `UI Requester ${RUN_ID}`,
    joinRequestId: '',
    requesterId: '',
  };

  test.beforeAll(async ({ request }) => {
    fixture.manager = await registerVerifiedUser(request, 'UI Team Manager');

    await prisma.user.update({
      where: { id: fixture.manager.userId },
      data: {
        onboarding_completed: true,
        preferences: {
          role: 'fan',
          onboarding_completed: true,
        },
      },
    });

    const requester = await prisma.user.create({
      data: {
        email: uniqueEmail('team-requester'),
        display_name: fixture.requesterName,
        username: `uirequester${RUN_ID.replace(/[^a-z0-9]/gi, '')}`.slice(0, 20).toLowerCase(),
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
    fixture.requesterId = requester.id;
    createdIds.userIds.push(requester.id);

    const organization = await prisma.organization.create({
      data: {
        name: `UI Join Org ${RUN_ID}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
      },
    });
    createdIds.orgIds.push(organization.id);

    const team = await prisma.team.create({
      data: {
        name: fixture.teamName,
        organization_id: organization.id,
        sport: 'basketball',
      },
    });
    fixture.teamId = team.id;
    createdIds.teamIds.push(team.id);

    await prisma.teamMembership.create({
      data: {
        team_id: team.id,
        user_id: fixture.manager.userId,
        role: 'owner',
        status: 'active',
      },
    });

    const joinRequest = await prisma.teamJoinRequest.create({
      data: {
        team_id: team.id,
        user_id: requester.id,
        status: 'pending',
        message: 'Would like to join the team',
      },
    });
    fixture.joinRequestId = joinRequest.id;
    createdIds.joinRequestIds.push(joinRequest.id);
  });

  test.afterAll(async () => {
    await cleanupFixtures();
    await prisma.$disconnect();
  });

  test('retired team join-request UI does not expose approval actions', async ({ page }) => {
    if (!fixture.manager) {
      throw new Error('Manager fixture was not created');
    }

    await seedSession(page, fixture.manager);
    await page.goto(
      `/team-join-requests?teamId=${encodeURIComponent(fixture.teamId)}&teamName=${encodeURIComponent(fixture.teamName)}`
    );

    await expect(page.getByText('This screen does not exist.')).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(fixture.requesterName, { exact: true })).toHaveCount(0);
    await expect(page.getByLabel(`Approve ${fixture.requesterName}`)).toHaveCount(0);

    await expect
      .poll(async () => {
        const joinRequest = await prisma.teamJoinRequest.findUnique({
          where: { id: fixture.joinRequestId },
          select: { status: true, reviewed_by: true },
        });

        return joinRequest;
      })
      .toMatchObject({
        status: 'pending',
        reviewed_by: null,
      });
  });
});
