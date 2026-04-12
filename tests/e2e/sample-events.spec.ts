import { test, expect } from '@playwright/test';

/**
 * Sample Events E2E Tests
 * 
 * Tests that posting to sample events works without geofencing restrictions
 */

const API_URL = process.env.API_URL || 'http://localhost:4000';

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

// Helper to create authenticated, verified user via API
async function createVerifiedUser(request: any) {
  const testEmail = `sample-events-e2e-${Date.now()}@varsityhub-test.app`;
  const testPassword = 'E2ETestPassword123!';

  const response = await request.post(`${API_URL}/auth/register`, {
    data: {
      email: testEmail,
      password: testPassword,
      display_name: 'E2E Sample Events User',
    },
  });

  expect(response.status()).toBe(201);
  const { access_token, user, dev_verification_code } = await response.json();

  if (dev_verification_code) {
    const verifyResponse = await request.post(`${API_URL}/auth/verify/confirm`, {
      headers: authHeaders(access_token),
      data: {
        code: String(dev_verification_code),
      },
    });

    expect(verifyResponse.ok()).toBeTruthy();
  }
  
  return { access_token, user, email: testEmail, password: testPassword };
}

test.describe('Sample Events Posting', () => {
  test('Can post to sample event without geofencing', async ({ request }) => {
    // Create authenticated user
    const { access_token } = await createVerifiedUser(request);

    // Upload a test image first
    const uploadResponse = await request.post(`${API_URL}/uploads`, {
      headers: authHeaders(access_token),
      multipart: {
        file: {
          name: 'test.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake-image-data'),
        },
      },
    });

    let mediaUrl = 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400';
    if (uploadResponse.ok()) {
      const uploadData = await uploadResponse.json();
      mediaUrl = uploadData.url || mediaUrl;
    }

    // Try to post to a sample event (should bypass geofencing)
    const sampleGameId = 'sample-warriors-cavaliers';
    
    const postResponse = await request.post(`${API_URL}/posts`, {
      headers: {
        ...authHeaders(access_token),
        'Content-Type': 'application/json',
      },
      data: {
        content: 'Test post to sample event - should work without geofencing!',
        media_url: mediaUrl,
        type: 'post',
        game_id: sampleGameId, // Sample event ID
        // No location required for sample events
      },
    });

    // Should succeed (201) because sample events bypass geofencing
    expect(postResponse.status()).toBe(201);
    
    const postData = await postResponse.json();
    expect(postData).toHaveProperty('id');
    expect(postData.content).toContain('sample event');
  });

  test('Rejects stories on sample games with a descriptive 400', async ({ request }) => {
    // Sample games are onboarding placeholders with synthetic IDs; they are
    // not real Game rows. Posting a Story previously produced an opaque 500
    // from a foreign-key violation. The handler now rejects the request with
    // a `SAMPLE_GAME_STORY_UNSUPPORTED` error so clients can show a useful
    // message instead of a failed upload.
    const { access_token } = await createVerifiedUser(request);

    const sampleGameId = 'sample-warriors-cavaliers';
    const storyResponse = await request.post(`${API_URL}/games/${sampleGameId}/stories`, {
      headers: {
        ...authHeaders(access_token),
        'Content-Type': 'application/json',
      },
      data: {
        media_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400',
        caption: 'Should be rejected — this is a sample game',
      },
    });

    expect(storyResponse.status()).toBe(400);
    const body = await storyResponse.json();
    expect(body).toMatchObject({
      error: 'SAMPLE_GAME_STORY_UNSUPPORTED',
      code: 'SAMPLE_GAME_STORY_UNSUPPORTED',
    });
  });

  test('Non-sample unknown game ids fail fast instead of hanging', async ({ request }) => {
    const { access_token } = await createVerifiedUser(request);

    const postResponse = await request.post(`${API_URL}/posts`, {
      headers: {
        ...authHeaders(access_token),
        'Content-Type': 'application/json',
      },
      data: {
        content: 'Test post to unknown game id',
        type: 'post',
        game_id: 'real-event-id-123',
      },
    });

    expect(postResponse.status()).toBe(404);
    const body = await postResponse.json();
    expect(body.error).toBe('Game not found');
  });
});
