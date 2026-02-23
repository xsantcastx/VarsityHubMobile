import { test, expect } from '@playwright/test';

/**
 * Posts API Integration Tests
 * 
 * Tests the posts endpoints for creating, reading, and managing posts.
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';

// Helper to create authenticated user
async function createTestUser(request: any) {
  const testEmail = `posts-test-${Date.now()}@varsityhub-test.app`;
  const testPassword = 'TestPassword123!';

  const response = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email: testEmail,
      password: testPassword,
      display_name: 'Posts Test User',
    },
  });

  expect(response.ok()).toBeTruthy();
  const { access_token, user } = await response.json();
  
  return { access_token, user, email: testEmail, password: testPassword };
}

test.describe('Posts API', () => {
  let accessToken: string;
  let userId: string;

  test.beforeEach(async ({ request }) => {
    const userData = await createTestUser(request);
    accessToken = userData.access_token;
    userId = userData.user.id;
  });

  test('GET /posts should return posts list', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/posts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('POST /posts should create a new post with content', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/posts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        content: 'This is a test post from the API test suite',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.content).toContain('test post');
    expect(body.user_id).toBe(userId);
  });

  test('POST /posts should create a post with media URL', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/posts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        media_url: 'https://example.com/test-image.jpg',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.media_url).toBe('https://example.com/test-image.jpg');
  });

  test('POST /posts should require either content or media_url', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/posts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        // Neither content nor media_url
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid payload');
    expect(body.issues).toBeDefined();
    expect(Array.isArray(body.issues)).toBeTruthy();
  });

  test('POST /posts should validate content length', async ({ request }) => {
    const longContent = 'a'.repeat(4001); // Exceeds 4000 char limit

    const response = await request.post(`${API_BASE_URL}/posts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        content: longContent,
      },
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid payload');
    expect(body.issues).toBeDefined();
  });

  test('POST /posts should require authentication', async ({ request }) => {
    const response = await request.post(`${API_BASE_URL}/posts`, {
      data: {
        content: 'Test post without auth',
      },
    });

    expect(response.status()).toBe(401);
  });

  test('POST /posts should require verified email', async ({ request }) => {
    // Create unverified user
    const testEmail = `unverified-${Date.now()}@varsityhub-test.app`;
    const registerResponse = await request.post(`${API_BASE_URL}/auth/register`, {
      data: {
        email: testEmail,
        password: 'TestPassword123!',
      },
    });
    
    const { access_token } = await registerResponse.json();

    // Try to create post (should fail - needs verification)
    const response = await request.post(`${API_BASE_URL}/posts`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      data: {
        content: 'Test post from unverified user',
      },
    });

    // Should be 403 (forbidden) or 401 (unauthorized)
    expect([401, 403]).toContain(response.status());
  });

  test('GET /posts/:id should return specific post', async ({ request }) => {
    // First create a post
    const createResponse = await request.post(`${API_BASE_URL}/posts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        content: 'Post to retrieve',
      },
    });

    const post = await createResponse.json();
    const postId = post.id;

    // Then retrieve it
    const getResponse = await request.get(`${API_BASE_URL}/posts/${postId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(getResponse.ok()).toBeTruthy();
    const retrievedPost = await getResponse.json();
    expect(retrievedPost.id).toBe(postId);
    expect(retrievedPost.content).toContain('Post to retrieve');
  });

  test('POST /posts/:id/upvote should upvote a post', async ({ request }) => {
    // Create a post
    const createResponse = await request.post(`${API_BASE_URL}/posts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        content: 'Post to upvote',
      },
    });

    const post = await createResponse.json();
    const postId = post.id;

    // Upvote it
    const upvoteResponse = await request.post(`${API_BASE_URL}/posts/${postId}/upvote`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(upvoteResponse.ok()).toBeTruthy();
  });

  test('POST /posts/:id/comments should add a comment', async ({ request }) => {
    // Create a post
    const createResponse = await request.post(`${API_BASE_URL}/posts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        content: 'Post to comment on',
      },
    });

    const post = await createResponse.json();
    const postId = post.id;

    // Add comment
    const commentResponse = await request.post(`${API_BASE_URL}/posts/${postId}/comments`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      data: {
        content: 'This is a test comment',
      },
    });

    expect(commentResponse.ok()).toBeTruthy();
    const comment = await commentResponse.json();
    expect(comment.content).toContain('test comment');
  });
});
