import { test, expect } from '@playwright/test';

/**
 * API Health Check Smoke Tests
 *
 * These tests verify that the backend API is healthy and all
 * critical integrations are configured correctly.
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';

// Detailed health (integrations, env, templates) lives behind
// HEALTH_CHECK_SECRET so the public endpoint never leaks template IDs or
// service-name fingerprinting. The detail suite runs only when the env
// var is set; otherwise we just smoke-test the public bare response.
const HEALTH_SECRET = process.env.HEALTH_CHECK_SECRET || '';

test.describe('API Health Checks', () => {
  test('Public health endpoint returns OK + timestamp', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  test.describe('Detailed health (requires HEALTH_CHECK_SECRET)', () => {
    test.beforeAll(() => {
      expect(HEALTH_SECRET).toBeTruthy();
    });

    const headers = { 'x-health-check-secret': HEALTH_SECRET };

    test('reports database connection', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`, { headers });
      const body = await response.json();

      expect(body.integrations).toBeDefined();
      expect(body.integrations.database).toBe(true);
    });

    test('reports JWT configuration', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`, { headers });
      const body = await response.json();

      expect(body.integrations.jwt).toBe(true);
    });

    test('reports email service status', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`, { headers });
      const body = await response.json();

      expect(body.integrations.sendgrid).toBeDefined();
      if (!body.integrations.sendgrid) {
        expect(body.warnings).toEqual(
          expect.arrayContaining([expect.stringContaining('SendGrid')])
        );
      }
    });

    test('includes environment info', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`, { headers });
      const body = await response.json();

      expect(body.environment).toBeDefined();
      expect(['development', 'production', 'test']).toContain(body.environment);
    });
  });
});
