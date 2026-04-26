import { expect, test, type APIRequestContext } from '@playwright/test';
import { PrismaClient } from '../../server/node_modules/@prisma/client/index.js';

/**
 * Feed + Messaging API-backed E2E Tests
 *
 * These specs validate the live API contracts that back the feed and messaging
 * screens. They avoid brittle browser-session bootstrapping and instead focus on
 * the authenticated surfaces the screens consume today.
 */

const API_URL = process.env.API_URL || 'http://localhost:4000';
const prisma = new PrismaClient();

const generateTestData = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 10000);
  return {
    email: `feed-test-${timestamp}-${random}@varsityhub-test.app`,
    password: 'FeedTestPassword123!',
    displayName: `Feed Test User ${timestamp}`,
    email2: `feed-test-2-${timestamp}-${random}@varsityhub-test.app`,
    password2: 'FeedTestPassword123!',
    displayName2: `Feed Test User 2 ${timestamp}`,
    email3: `feed-test-3-${timestamp}-${random}@varsityhub-test.app`,
    password3: 'FeedTestPassword123!',
    displayName3: `Feed Test User 3 ${timestamp}`,
  };
};

async function createFanUser(request: APIRequestContext, email: string, password: string, displayName: string) {
  const response = await request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password,
      display_name: displayName,
    },
  });

  expect(response.status()).toBe(201);
  const data = await response.json();

  expect(data.dev_verification_code).toBeTruthy();

  const verifyResponse = await request.post(`${API_URL}/auth/verify/confirm`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
    data: { code: String(data.dev_verification_code) },
  });
  expect([200, 204, 429]).toContain(verifyResponse.status());

  const username = `feed${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);
  const onboardingResponse = await request.post(`${API_URL}/auth/me/complete-onboarding`, {
    headers: { Authorization: `Bearer ${data.access_token}` },
    data: {
      role: 'fan',
      username,
      dob: '1990-01-15',
      zip_code: '12345',
      messaging_policy_accepted: true,
      notifications_enabled: true,
      location_enabled: false,
    },
  });
  if (![200, 201].includes(onboardingResponse.status())) {
    const currentUser = await prisma.user.findUnique({
      where: { id: data.user.id },
      select: { preferences: true },
    });
    const preferences =
      currentUser?.preferences && typeof currentUser.preferences === 'object'
        ? { ...(currentUser.preferences as Record<string, unknown>) }
        : {};
    preferences.role = 'fan';
    preferences.onboarding_completed = true;
    preferences.zip_code = '12345';
    preferences.messaging_policy_accepted = true;
    preferences.notifications_enabled = true;
    preferences.location_enabled = false;

    await prisma.user.update({
      where: { id: data.user.id },
      data: {
        email_verified: true,
        role: 'fan',
        username,
        onboarding_completed: true,
        preferences,
      },
    });
  }

  const loginResponse = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  expect(loginResponse.status()).toBe(200);
  const loginData = await loginResponse.json();

  return {
    accessToken: loginData.access_token,
    user: loginData.user ?? data.user,
    email,
    password,
  };
}

async function authGet(request: APIRequestContext, token: string, url: string) {
  return request.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function authPost(request: APIRequestContext, token: string, url: string, data?: Record<string, any>) {
  return request.post(url, {
    headers: { Authorization: `Bearer ${token}` },
    data,
  });
}

test.describe('Feed and Messaging', () => {
  test.describe.configure({ mode: 'serial' });

  const seed = generateTestData();
  let primaryUser: Awaited<ReturnType<typeof createFanUser>>;
  let secondaryUser: Awaited<ReturnType<typeof createFanUser>>;
  let blockedUser: Awaited<ReturnType<typeof createFanUser>>;
  let seededMessage: any;

  test.beforeAll(async ({ request }) => {
    primaryUser = await createFanUser(request, seed.email, seed.password, seed.displayName);
    secondaryUser = await createFanUser(request, seed.email2, seed.password2, seed.displayName2);
    blockedUser = await createFanUser(request, seed.email3, seed.password3, seed.displayName3);

    const sendResponse = await authPost(request, primaryUser.accessToken, `${API_URL}/messages`, {
      recipient_email: secondaryUser.email,
      content: 'Hello from feed/message E2E',
    });
    expect([200, 201]).toContain(sendResponse.status());
    seededMessage = await sendResponse.json();
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('Feed bundle returns the expected top-level sections', async ({ request }) => {
    const response = await authGet(request, primaryUser.accessToken, `${API_URL}/feed/bundle`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.posts).toBeDefined();
    expect(body.posts_followed_teams).toBeDefined();
    expect(body.highlights).toBeDefined();
    expect(body.ads).toBeDefined();
    expect(typeof body.unread_notifications).toBe('number');
    expect(typeof body.unread_messages).toBe('number');
  });

  test('Messages list returns conversation history for the signed-in user', async ({ request }) => {
    const response = await authGet(request, primaryUser.accessToken, `${API_URL}/messages?limit=50`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('Direct message creation succeeds between onboarded verified fans', async ({ request }) => {
    const response = await authPost(request, secondaryUser.accessToken, `${API_URL}/messages`, {
      recipient_email: primaryUser.email,
      content: 'Reply from secondary user',
    });

    expect([200, 201]).toContain(response.status());
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.conversation_id).toBeDefined();
  });

  test('Messages can be fetched by conversation participant filter', async ({ request }) => {
    const response = await authGet(
      request,
      primaryUser.accessToken,
      `${API_URL}/messages?with=${encodeURIComponent(secondaryUser.email)}`
    );
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.some((message: any) => message.conversation_id === seededMessage.conversation_id)).toBe(true);
  });

  test('Message blocking prevents new outbound messages', async ({ request }) => {
    const blockResponse = await authPost(
      request,
      primaryUser.accessToken,
      `${API_URL}/users/${blockedUser.user.id}/block`
    );
    expect(blockResponse.ok()).toBeTruthy();

    const messageResponse = await authPost(request, primaryUser.accessToken, `${API_URL}/messages`, {
      recipient_email: blockedUser.email,
      content: 'This should be blocked',
    });

    expect(messageResponse.status()).toBe(403);
    const body = await messageResponse.json();
    expect(body.code || body.error).toContain('BLOCK');
  });
});
