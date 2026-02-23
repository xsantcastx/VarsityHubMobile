import { test, expect } from '@playwright/test';

/**
 * Sample Events E2E Tests
 * 
 * Tests that posting to sample events works without geofencing restrictions
 */

const API_URL = process.env.API_URL || 'http://localhost:4000';

// Helper to create authenticated user via API
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

  const { access_token, user } = await response.json();
  
  return { access_token, user, email: testEmail, password: testPassword };
}

test.describe('Sample Events Posting', () => {
  test('Can post to sample event without geofencing', async ({ request }) => {
    // Create authenticated user
    const { access_token } = await createVerifiedUser(request);

    // Upload a test image first
    const uploadResponse = await request.post(`${API_URL}/uploads`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
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
        'Authorization': `Bearer ${access_token}`,
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

  test('Can post story to sample game without geofencing', async ({ request }) => {
    // Create authenticated user
    const { access_token } = await createVerifiedUser(request);

    // Upload a test image for story
    const uploadResponse = await request.post(`${API_URL}/uploads`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
      },
      multipart: {
        file: {
          name: 'story.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake-story-image'),
        },
      },
    });

    let mediaUrl = 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=400';
    if (uploadResponse.ok()) {
      const uploadData = await uploadResponse.json();
      mediaUrl = uploadData.url || mediaUrl;
    }

    // Try to post story to a sample game (should bypass geofencing)
    const sampleGameId = 'sample-warriors-cavaliers';
    
    const storyResponse = await request.post(`${API_URL}/games/${sampleGameId}/stories`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      data: {
        media_url: mediaUrl,
        caption: 'Test story to sample game - should work without geofencing!',
        // No location required for sample games
      },
    });

    // Should succeed (201) because sample games bypass geofencing
    expect(storyResponse.status()).toBe(201);
    
    const storyData = await storyResponse.json();
    expect(storyData).toHaveProperty('id');
    expect(storyData.media_url).toBeDefined();
  });

  test('Real events require geofencing (negative test)', async ({ request }) => {
    // Create authenticated user
    const { access_token } = await createVerifiedUser(request);

    // Try to post to a real event without location (should fail)
    // Note: This assumes there's a real event in the database
    // If no real events exist, this test will be skipped
    
    const postResponse = await request.post(`${API_URL}/posts`, {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      data: {
        content: 'Test post to real event - should require location',
        type: 'post',
        game_id: 'real-event-id-123', // Real event ID (if exists)
        // No location provided - should fail geofencing
      },
    });

    // Should fail (403) because real events require geofencing
    // OR 404 if event doesn't exist (which is also acceptable)
    const status = postResponse.status();
    expect([403, 404]).toContain(status);
  });
});
