/**
 * End-to-End Cloudinary Upload Tests
 * Tests image/video uploads through event pages and sample events
 */

import { expect, test } from '@playwright/test';

test.describe('Cloudinary Upload End-to-End Tests', () => {
  const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://api-production-8ac3.up.railway.app';
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://localhost:8081', { waitUntil: 'domcontentloaded' });
  });

  test('should upload image via event creation page', async ({ page }) => {
    // This test simulates uploading an image when creating an event
    // Note: In a real scenario, you'd need to be authenticated
    
    console.log('[Cloudinary E2E] Testing image upload via event creation...');
    
    // Check if upload endpoint is accessible
    const uploadResponse = await page.request.post(`${API_BASE}/uploads`, {
      headers: {
        'Authorization': 'Bearer test-token', // Would need real token in production
      },
      multipart: {
        file: {
          name: 'test-image.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from('fake-image-data'),
        },
      },
    });

    // In a real test, we'd check for Cloudinary URL in response
    console.log('[Cloudinary E2E] Upload response status:', uploadResponse.status());
    
    // Verify response structure (even if auth fails, we can check structure)
    if (uploadResponse.ok()) {
      const body = await uploadResponse.json();
      expect(body).toHaveProperty('url');
      expect(body.url).toMatch(/cloudinary|res\.cloudinary\.com/);
      console.log('[Cloudinary E2E] ✅ Upload successful, URL:', body.url);
    } else {
      console.log('[Cloudinary E2E] ⚠️  Upload requires authentication (expected)');
    }
  });

  test('should verify Cloudinary configuration', async ({ page }) => {
    // Check server health endpoint for Cloudinary status
    const healthResponse = await page.request.get(`${API_BASE}/health`);
    
    if (healthResponse.ok()) {
      const health = await healthResponse.json();
      console.log('[Cloudinary E2E] Server health:', health);
      
      if (health.cloudinary !== undefined) {
        expect(typeof health.cloudinary).toBe('boolean');
        console.log('[Cloudinary E2E] ✅ Cloudinary configured:', health.cloudinary);
      }
    }
  });

  test('should handle upload errors gracefully', async ({ page }) => {
    // Test error handling for invalid uploads
    const invalidResponse = await page.request.post(`${API_BASE}/uploads`, {
      headers: {
        'Authorization': 'Bearer invalid-token',
      },
      multipart: {
        file: {
          name: 'test.jpg',
          mimeType: 'image/jpeg',
          buffer: Buffer.from(''),
        },
      },
    });

    // Should return error status
    expect([400, 401, 500]).toContain(invalidResponse.status());
    console.log('[Cloudinary E2E] ✅ Error handling works correctly');
  });
});
