/**
 * Shared test fixtures and mocks
 * Reduces duplication across Jest tests for common flows: auth, config, endpoints
 * Import and use in __tests__/*.test.ts files
 */

import { Request, Response } from 'express';

/**
 * Mock user for auth testing
 */
export const mockUser = {
  id: 'user_test_123',
  email: 'test@example.com',
  display_name: 'Test User',
  username: 'testuser',
  avatar_url: null,
  preferences: {
    role: 'coach',
    plan: 'veteran',
  },
};

/**
 * Mock authenticated request
 */
export function createMockAuthRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    user: mockUser,
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as Partial<Request>;
}

/**
 * Mock response with tracking
 */
export function createMockResponse(): { res: Partial<Response>; calls: any[] } {
  const calls: any[] = [];

  return {
    calls,
    res: {
      status: (code: number) => {
        calls.push({ method: 'status', args: [code] });
        return {
          json: (data: any) => {
            calls.push({ method: 'json', args: [data] });
          },
          send: (data: any) => {
            calls.push({ method: 'send', args: [data] });
          },
        };
      },
      json: (data: any) => {
        calls.push({ method: 'json', args: [data] });
      },
      send: (data: any) => {
        calls.push({ method: 'send', args: [data] });
      },
    } as Partial<Response>,
  };
}

/**
 * Mock Stripe price IDs for testing
 */
export const mockStripePrices = {
  veteran: 'price_test_veteran',
  legend: 'price_test_legend',
  adWeekday: 'price_test_ad_weekday',
  adWeekend: 'price_test_ad_weekend',
};

/**
 * Mock config for testing
 */
export const mockConfig = {
  stripe: {
    secretKey: 'sk_test_mock',
    publishableKey: 'pk_test_mock',
    webhookSecret: 'whsec_test_mock',
    prices: mockStripePrices,
    isConfigured: () => true,
  },
  app: {
    baseUrl: 'http://localhost:3000',
    scheme: 'varsityhubmobile',
    nodeEnv: 'test',
    isDevelopment: () => false,
    isProduction: () => false,
  },
};

/**
 * Mock organization for testing
 */
export const mockOrganization = {
  id: 'org_test_123',
  name: 'Test High School',
  description: 'A test organization',
  sport: 'Football',
  org_type: 'school',
  status: 'active',
  created_at: new Date('2025-01-01'),
  zip_code: '12345',
  location: 'Test City, Test State',
  place_id: 'ChIJ_test_place_id',
};

/**
 * Mock team for testing
 */
export const mockTeam = {
  id: 'team_test_123',
  name: 'Varsity Football',
  organization_id: mockOrganization.id,
  sport: 'Football',
  status: 'active',
  created_at: new Date('2025-01-01'),
};

/**
 * Mock game for testing
 */
export const mockGame = {
  id: 'game_test_123',
  team_id: mockTeam.id,
  opponent: 'Rival High School',
  game_datetime: new Date('2025-02-15T14:00:00'),
  location: 'Home Stadium',
  status: 'scheduled',
  created_at: new Date('2025-01-01'),
};

/**
 * Mock post for testing
 */
export const mockPost = {
  id: 'post_test_123',
  creator_id: mockUser.id,
  game_id: mockGame.id,
  content: 'Great game today!',
  visibility: 'public',
  status: 'published',
  created_at: new Date('2025-02-15T15:00:00'),
};

/**
 * Mock subscription for testing
 */
export const mockSubscription = {
  id: 'sub_test_123',
  user_id: mockUser.id,
  stripe_subscription_id: 'sub_stripe_test',
  plan: 'veteran',
  status: 'active',
  current_period_start: new Date('2025-01-01'),
  current_period_end: new Date('2025-02-01'),
  created_at: new Date('2025-01-01'),
};

/**
 * Utility: Create a mock request with query parameters
 */
export function createMockQueryRequest(query: Record<string, string>) {
  return createMockAuthRequest({ query });
}

/**
 * Utility: Create a mock request with body
 */
export function createMockBodyRequest(body: any) {
  return createMockAuthRequest({ body });
}

/**
 * Utility: Create a mock request with params
 */
export function createMockParamsRequest(params: Record<string, string>) {
  return createMockAuthRequest({ params });
}

/**
 * Utility: Assert response status
 */
export function assertResponseStatus(calls: any[], expectedStatus: number): void {
  const statusCall = calls.find(c => c.method === 'status');
  if (!statusCall) {
    throw new Error('No status() call found in response');
  }
  if (statusCall.args[0] !== expectedStatus) {
    throw new Error(
      `Expected status ${expectedStatus}, but got ${statusCall.args[0]}`
    );
  }
}

/**
 * Utility: Get response JSON data
 */
export function getResponseData(calls: any[]): any {
  const jsonCall = calls.find(c => c.method === 'json');
  return jsonCall ? jsonCall.args[0] : null;
}
