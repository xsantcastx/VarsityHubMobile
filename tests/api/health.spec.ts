import { test, expect } from '@playwright/test';

/**
 * API Health Check Smoke Tests
 * 
 * These tests verify that the backend API is healthy and all
 * critical integrations are configured correctly.
 */

const API_BASE_URL = process.env.API_URL || 'http://localhost:4000';

test.describe('API Health Checks', () => {
  test('Health endpoint should return OK status', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  test('Health endpoint should report database connection', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    const body = await response.json();
    
    expect(body.integrations).toBeDefined();
    expect(body.integrations.database).toBe(true);
  });

  test('Health endpoint should report JWT configuration', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    const body = await response.json();
    
    expect(body.integrations.jwt).toBe(true);
  });

  test('Health endpoint should report email service status', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    const body = await response.json();
    
    // Email service should be configured (SendGrid)
    expect(body.integrations.sendgrid).toBeDefined();
    
    // If not configured, should have warning
    if (!body.integrations.sendgrid) {
      expect(body.warnings).toContain(expect.stringContaining('SendGrid'));
    }
  });

  test('Health endpoint should include environment info', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/health`);
    const body = await response.json();
    
    expect(body.environment).toBeDefined();
    expect(['development', 'production', 'test']).toContain(body.environment);
  });
});
