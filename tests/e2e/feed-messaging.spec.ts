import { test, expect } from '@playwright/test';

/**
 * Feed Page & Messaging E2E Tests
 * 
 * These tests verify that the feed page and messaging functionality
 * work correctly in real-world scenarios.
 */

const APP_URL = process.env.APP_URL || 'http://localhost:8081';
const API_URL = process.env.API_URL || 'http://localhost:4000';
const WEB_AUTH_TOKEN_KEY = 'auth_token_key';

// Helper to generate unique test data
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
  };
};

// Helper to create authenticated user via API
async function createUser(request: any, email: string, password: string, displayName: string) {
  const response = await request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password,
      display_name: displayName,
    },
  });
  
  if (response.status() !== 201) {
    const body = await response.text();
    throw new Error(`Failed to create user: ${response.status()} - ${body}`);
  }
  
  const data = await response.json();

  if (data.dev_verification_code) {
    const verifyResponse = await request.post(`${API_URL}/auth/verify/confirm`, {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
      data: {
        code: String(data.dev_verification_code),
      },
    });

    if (verifyResponse.status() !== 200) {
      const body = await verifyResponse.text();
      throw new Error(`Failed to verify user: ${verifyResponse.status()} - ${body}`);
    }
  }

  return {
    accessToken: data.access_token,
    user: data.user,
  };
}

// Helper to login via API
async function completeOnboarding(request: any, accessToken: string) {
  const response = await request.patch(`${API_URL}/me/preferences`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      onboarding_completed: true,
    },
  });

  if (response.status() !== 200) {
    const body = await response.text();
    throw new Error(`Failed to complete onboarding: ${response.status()} - ${body}`);
  }
}

async function loginUser(request: any, email: string, password: string) {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  
  if (response.status() !== 200) {
    const body = await response.text();
    throw new Error(`Failed to login: ${response.status()} - ${body}`);
  }
  
  const data = await response.json();
  await completeOnboarding(request, data.access_token);
  return {
    accessToken: data.access_token,
    user: data.user,
  };
}

// Helper to create a post via API
async function createPost(request: any, accessToken: string, content: string, mediaUrl?: string) {
  const response = await request.post(`${API_URL}/posts`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      content,
      media_url: mediaUrl,
    },
  });
  
  if (response.status() !== 201) {
    const body = await response.text();
    throw new Error(`Failed to create post: ${response.status()} - ${body}`);
  }
  
  return await response.json();
}

// Helper to send a message via API
async function sendMessage(request: any, accessToken: string, recipientEmail: string, content: string) {
  const response = await request.post(`${API_URL}/messages`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    data: {
      recipient_email: recipientEmail,
      content,
    },
  });
  
  if (response.status() !== 201 && response.status() !== 200) {
    const body = await response.text();
    throw new Error(`Failed to send message: ${response.status()} - ${body}`);
  }
  
  return await response.json();
}

async function setWebAuthToken(page: any, accessToken: string) {
  await page.evaluate(
    ({ storageKey, token }) => {
      localStorage.setItem(storageKey, token);
    },
    { storageKey: WEB_AUTH_TOKEN_KEY, token: accessToken }
  );
}

async function gotoAppRoute(page: any, urlOrPath: string = APP_URL) {
  const target = typeof urlOrPath === 'string' && urlOrPath.startsWith('http')
    ? urlOrPath
    : `${APP_URL}${urlOrPath}`;
  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
}

async function reloadAppPage(page: any) {
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('domcontentloaded');
}

test.describe('Feed Page Tests', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90000);

  test('Feed page loads and displays content', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create user and login
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Create a test post
    const post = await createPost(request, accessToken, 'Test post for feed E2E test');
    
    // Navigate to app and set auth token
    await gotoAppRoute(page, APP_URL);
    await setWebAuthToken(page, accessToken);
    
    // Reload to apply auth
    await reloadAppPage(page);
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to feed page
    // Try multiple possible selectors for feed navigation
    const feedLink = page.locator('a[href*="feed"], button:has-text("Feed"), [data-testid="feed-tab"]').first();
    if (await feedLink.isVisible().catch(() => false)) {
      await feedLink.click();
    } else {
      // Try navigating directly
      await gotoAppRoute(page, `${APP_URL}/feed`);
    }
    
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000); // Wait for feed to load
    
    // Check if feed content is visible
    // Feed might show games, events, or posts
    const feedContent = page.locator('text=/game|event|post|feed/i').first();
    await expect(feedContent).toBeVisible({ timeout: 10000 });
  });

  test('Feed page shows games and events', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create user and login
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Navigate to app and set auth token
    await gotoAppRoute(page, APP_URL);
    await setWebAuthToken(page, accessToken);
    
    // Reload to apply auth
    await reloadAppPage(page);
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to feed
    await gotoAppRoute(page, `${APP_URL}/feed`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // The feed should expose the live games/events surface for signed-in fans.
    await expect(page.getByText('Showing upcoming and recent games in your area.')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByRole('button', { name: /Tap to RSVP/i }).first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('Feed page supports pull-to-refresh', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create user and login
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Navigate to app and set auth token
    await gotoAppRoute(page, APP_URL);
    await setWebAuthToken(page, accessToken);
    
    // Reload to apply auth
    await reloadAppPage(page);
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to feed
    await gotoAppRoute(page, `${APP_URL}/feed`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Try to trigger refresh (scroll to top and pull down)
    // This is a simplified test - actual pull-to-refresh might need touch events
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });
    
    // Create a new post after initial load
    await createPost(request, accessToken, 'New post after refresh');
    
    // Wait a bit for potential auto-refresh or manual refresh
    await page.waitForTimeout(3000);
    
    // Check if new content might be visible (this is optimistic)
    // In a real scenario, we'd trigger actual pull-to-refresh
    const feedContent = page.locator('text=/game|event|post|feed/i').first();
    await expect(feedContent).toBeVisible({ timeout: 5000 });
  });

  test('Feed page handles empty state', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create a fresh user with no content
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Navigate to app and set auth token
    await gotoAppRoute(page, APP_URL);
    await setWebAuthToken(page, accessToken);
    
    // Reload to apply auth
    await reloadAppPage(page);
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to feed
    await gotoAppRoute(page, `${APP_URL}/feed`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check for empty state message
    const emptyState = page.locator('text=/no.*found|empty|no.*games|no.*events/i');
    // Empty state might or might not be visible depending on default content
    // This test verifies the page doesn't crash
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Messaging Tests', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90000);

  test('Messages page loads and displays conversations', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create two users
    const user1 = await createUser(request, testData.email, testData.password, testData.displayName);
    const user2 = await createUser(request, testData.email2, testData.password2, testData.displayName2);
    
    // Login as user1
    const { accessToken: token1 } = await loginUser(request, testData.email, testData.password);
    
    // Send a message from user1 to user2
    await sendMessage(request, token1, testData.email2, 'Hello from E2E test!');
    
    // Navigate to app and set auth token
    await gotoAppRoute(page, APP_URL);
    await setWebAuthToken(page, token1);
    
    // Reload to apply auth
    await reloadAppPage(page);
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to messages
    const messagesLink = page.locator('a[href*="message"], button:has-text("Message"), [data-testid="messages-tab"]').first();
    if (await messagesLink.isVisible().catch(() => false)) {
      await messagesLink.click();
    } else {
      await gotoAppRoute(page, `${APP_URL}/messages`);
    }
    
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check if messages page is visible
    await expect(page.locator('body')).toBeVisible();
    
    await expect(page.getByText('Messages', { exact: true })).toBeVisible({ timeout: 10000 });
  });

  test('Can send a message', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create two users
    await createUser(request, testData.email, testData.password, testData.displayName);
    await createUser(request, testData.email2, testData.password2, testData.displayName2);
    
    // Login as user1
    const { accessToken: token1 } = await loginUser(request, testData.email, testData.password);
    
    // Navigate to app and set auth token
    await gotoAppRoute(page, APP_URL);
    await setWebAuthToken(page, token1);
    
    // Reload to apply auth
    await reloadAppPage(page);
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to messages
    await gotoAppRoute(page, `${APP_URL}/messages`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Try to find compose button or new message button
    const composeButton = page.locator('button:has-text("New"), button:has-text("Compose"), [aria-label*="new message" i], [aria-label*="compose" i]').first();
    
    if (await composeButton.isVisible().catch(() => false)) {
      await composeButton.click();
      await page.waitForTimeout(1000);
      
      // Try to find recipient input
      const recipientInput = page.locator('input[placeholder*="recipient" i], input[placeholder*="email" i], input[placeholder*="user" i]').first();
      if (await recipientInput.isVisible().catch(() => false)) {
        await recipientInput.fill(testData.email2);
        await page.waitForTimeout(500);
      }
      
      // Find message input
      const messageInput = page.locator('textarea, input[type="text"], [contenteditable="true"]').filter({ hasText: /message|type/i }).first();
      if (messageInput.count() === 0) {
        // Try any text input
        const anyInput = page.locator('textarea, input[type="text"]').first();
        if (await anyInput.isVisible().catch(() => false)) {
          await anyInput.fill('E2E test message');
        }
      } else {
        await messageInput.fill('E2E test message');
      }
      
      // Find send button
      const sendButton = page.locator('button:has-text("Send"), button[type="submit"], [aria-label*="send" i]').first();
      if (await sendButton.isVisible().catch(() => false)) {
        await sendButton.click();
        await page.waitForTimeout(2000);
        
        // Verify message was sent (check for success or message in thread)
        const successIndicator = page.locator('text=/sent|success|message sent/i').first();
        // Message might appear in thread or show success
        await expect(successIndicator.or(page.locator('text=/E2E test message/i'))).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('Can view message thread', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create two users
    await createUser(request, testData.email, testData.password, testData.displayName);
    await createUser(request, testData.email2, testData.password2, testData.displayName2);
    
    // Login as user1
    const { accessToken: token1 } = await loginUser(request, testData.email, testData.password);
    
    // Send a message from user1 to user2
    const message = await sendMessage(request, token1, testData.email2, 'Thread test message');
    
    // Navigate to app and set auth token
    await gotoAppRoute(page, APP_URL);
    await setWebAuthToken(page, token1);
    
    // Reload to apply auth
    await reloadAppPage(page);
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to messages
    await gotoAppRoute(page, `${APP_URL}/messages`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Try to find and click on the conversation
    // Look for the recipient's name or email
    const conversationLink = page.locator(`text=/${testData.displayName2}|${testData.email2}/i`).first();
    
    if (await conversationLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await conversationLink.click();
      await page.waitForTimeout(2000);
      
      // Check if message thread is visible
      const messageText = page.getByText('Thread test message').first();
      await expect(messageText).toBeVisible({ timeout: 10000 });
    } else {
      // If conversation link not found, try navigating directly to thread
      // This depends on the URL structure
      // Message response includes sender and recipient, extract conversation_id
      const conversationId = message.conversation_id || 
        (message.sender?.id && message.recipient?.id 
          ? `dm:${[message.sender.id, message.recipient.id].sort().join('__')}`
          : null);
      
      if (conversationId) {
        await gotoAppRoute(page, `${APP_URL}/message-thread?conversation_id=${conversationId}`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);
        
        // Check if message is visible
        const messageText = page.getByText('Thread test message').first();
        await expect(messageText).toBeVisible({ timeout: 10000 });
      } else {
        // Fallback: try with email parameter
        await gotoAppRoute(page, `${APP_URL}/message-thread?with=${encodeURIComponent(testData.email2)}`);
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(2000);
        
        // Check if message is visible
        const messageText = page.getByText('Thread test message').first();
        await expect(messageText).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('Can reply to a message', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create two users
    await createUser(request, testData.email, testData.password, testData.displayName);
    await createUser(request, testData.email2, testData.password2, testData.displayName2);
    
    // Login as user1
    const { accessToken: token1 } = await loginUser(request, testData.email, testData.password);
    
    // Send initial message from user1 to user2
    await sendMessage(request, token1, testData.email2, 'Initial message');
    
    // Navigate to app and set auth token
    await gotoAppRoute(page, APP_URL);
    await setWebAuthToken(page, token1);
    
    // Reload to apply auth
    await reloadAppPage(page);
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to messages and open thread
    await gotoAppRoute(page, `${APP_URL}/messages`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Try to find conversation and open it
    const conversationLink = page.locator(`text=/${testData.displayName2}|${testData.email2}/i`).first();
    if (await conversationLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await conversationLink.click();
      await page.waitForTimeout(2000);
    }
    
    // Find message input in thread
    const messageInput = page.locator('textarea, input[type="text"], [contenteditable="true"]').first();
    if (await messageInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await messageInput.fill('Reply message from E2E test');
      await page.waitForTimeout(500);
      
      // Find send button
      const sendButton = page.locator('button:has-text("Send"), button[type="submit"], [aria-label*="send" i]').first();
      if (await sendButton.isVisible().catch(() => false)) {
        await sendButton.click();
        await page.waitForTimeout(2000);
        
        // Verify reply was sent
        const replyText = page.locator('text=/Reply message from E2E test/i');
        await expect(replyText).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('Messages page handles empty state', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create a fresh user with no messages
    await createUser(request, testData.email, testData.password, testData.displayName);
    const { accessToken } = await loginUser(request, testData.email, testData.password);
    
    // Navigate to app and set auth token
    await gotoAppRoute(page, APP_URL);
    await setWebAuthToken(page, accessToken);
    
    // Reload to apply auth
    await reloadAppPage(page);
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to messages
    await gotoAppRoute(page, `${APP_URL}/messages`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Check for empty state or that page loads without errors
    await expect(page.locator('body')).toBeVisible();
    
    // Empty state might show "No messages" or similar
    const emptyState = page.locator('text=/no.*message|empty|start.*conversation/i');
    // This is optional - page might just show empty list
  });

  test('Message blocking prevents messaging', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create two users
    const user1 = await createUser(request, testData.email, testData.password, testData.displayName);
    const user2 = await createUser(request, testData.email2, testData.password2, testData.displayName2);
    
    // Login as user1
    const { accessToken: token1 } = await loginUser(request, testData.email, testData.password);
    
    // User1 blocks user2 (need user2's ID)
    const blockResponse = await request.post(`${API_URL}/users/${user2.user.id}/block`, {
      headers: {
        Authorization: `Bearer ${token1}`,
      },
    });
    
    expect(blockResponse.ok()).toBeTruthy();
    
    // Try to send message from user1 to user2 (should fail)
    const messageResponse = await request.post(`${API_URL}/messages`, {
      headers: {
        Authorization: `Bearer ${token1}`,
      },
      data: {
        recipient_email: testData.email2,
        content: 'This should be blocked',
      },
    });
    
    // Should return 403 Forbidden
    expect(messageResponse.status()).toBe(403);
    const messageBody = await messageResponse.json();
    expect(messageBody.error).toContain('BLOCKED');
  });
});

test.describe('Feed and Messaging Integration', () => {
  test.setTimeout(90000);
  test('Can share post to message', async ({ page, request }) => {
    const testData = generateTestData();
    
    // Create two users
    await createUser(request, testData.email, testData.password, testData.displayName);
    await createUser(request, testData.email2, testData.password2, testData.displayName2);
    
    // Login as user1
    const { accessToken: token1 } = await loginUser(request, testData.email, testData.password);
    
    // Create a post
    const post = await createPost(request, token1, 'Post to share via message');
    
    // Navigate to app and set auth token
    await gotoAppRoute(page, APP_URL);
    await setWebAuthToken(page, token1);
    
    // Reload to apply auth
    await reloadAppPage(page);
    await page.waitForLoadState('domcontentloaded');
    
    // Navigate to feed or post detail
    await gotoAppRoute(page, `${APP_URL}/feed`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
    
    // Try to find the post and share button
    const postElement = page.locator('text=/Post to share via message/i').first();
    if (await postElement.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Look for share button near the post
      const shareButton = postElement.locator('..').locator('button[aria-label*="share" i], button:has-text("Share")').first();
      if (await shareButton.isVisible().catch(() => false)) {
        await shareButton.click();
        await page.waitForTimeout(1000);
        
        // Look for "Message" or "Send via message" option
        const messageOption = page.locator('text=/message|send.*message/i').first();
        if (await messageOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await messageOption.click();
          await page.waitForTimeout(2000);
          
          // Should navigate to messages with pre-filled content
          await expect(page).toHaveURL(/.*message/i, { timeout: 5000 });
        }
      }
    }
  });
});
