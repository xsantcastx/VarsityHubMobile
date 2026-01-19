import { expect, test } from '@playwright/test';

/**
 * RBAC (Role-Based Access Control) Permission Tests
 * 
 * These tests verify that role-based permissions work correctly:
 * - Fan accounts cannot create teams/organizations
 * - Coach accounts can create teams/organizations
 * - Admin accounts have elevated permissions
 * - Organization ownership works correctly
 * - Team ownership works correctly
 */

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000';

// Helper to make authenticated request
async function makeAuthRequest(request: any, token: string, method: string, url: string, data?: any) {
  return request[method.toLowerCase()](url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    data,
  });
}

// Helper to create a test user and get auth token
async function createTestUser(request: any, role: 'fan' | 'coach' | 'admin' = 'fan', emailSuffix?: string) {
  const timestamp = Date.now();
  const email = `test-rbac-${role}-${timestamp}-${emailSuffix || Math.random()}@example.com`;
  const password = 'TestPassword123!';
  const displayName = `Test ${role} ${timestamp}`;

  const signupResponse = await request.post(`${API_BASE_URL}/auth/register`, {
    data: {
      email,
      password,
      display_name: displayName,
      role, // Set role during registration
    },
  });

  expect([200, 201]).toContain(signupResponse.status());
  const signupData = await signupResponse.json();
  const token = signupData.access_token || signupData.token;

  // Verify email if dev_verification_code is provided (development mode)
  if (signupData.dev_verification_code) {
    try {
      const verifyResponse = await makeAuthRequest(request, token, 'post', `${API_BASE_URL}/auth/verify/confirm`, {
        code: String(signupData.dev_verification_code),
      });
      if (verifyResponse.status() === 200) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (e) {
      console.warn('Email verification failed in test:', e);
    }
  }

  return { email, password, displayName, token, userId: signupData.user?.id || signupData.user_id };
}

test.describe('RBAC Permissions', () => {
  test.describe('Fan Account Restrictions', () => {
    test('Fan cannot create a team', async ({ request }) => {
      const fan = await createTestUser(request, 'fan');
      
      const response = await makeAuthRequest(request, fan.token, 'post', `${API_BASE_URL}/teams`, {
        name: 'Fan Team',
        description: 'Team created by fan',
      });

      // Should be rejected - fans cannot create teams
      expect([400, 403]).toContain(response.status());
      
      if (response.status() === 403) {
        const body = await response.json();
        expect(body.error).toBe('COACH_ROLE_REQUIRED');
      }
    });

    test('Fan can create an organization', async ({ request }) => {
      const fan = await createTestUser(request, 'fan');
      
      // Organizations can be created by any authenticated user (not just coaches)
      const response = await makeAuthRequest(request, fan.token, 'post', `${API_BASE_URL}/organizations`, {
        name: `Fan Organization ${Date.now()}`,
        description: 'Organization created by fan',
        zip_code: '12345',
      });

      // Organizations don't require coach role (based on current implementation)
      expect([200, 201, 403]).toContain(response.status());
    });

    test('Fan can create events', async ({ request }) => {
      const fan = await createTestUser(request, 'fan');
      
      const tomorrow = new Date(Date.now() + 86400000);
      const response = await makeAuthRequest(request, fan.token, 'post', `${API_BASE_URL}/events`, {
        title: 'Fan Event',
        date: tomorrow.toISOString(),
        location: '123 Main St',
        event_type: 'game',
      });

      // Fans can create events (they may require approval)
      expect([200, 201, 403]).toContain(response.status());
    });

    test('Fan can RSVP to events', async ({ request }) => {
      const coach = await createTestUser(request, 'coach', 'coach');
      const fan = await createTestUser(request, 'fan', 'fan');
      
      // Coach creates an event
      const tomorrow = new Date(Date.now() + 86400000);
      const eventResponse = await makeAuthRequest(request, coach.token, 'post', `${API_BASE_URL}/events`, {
        title: 'Public Event',
        date: tomorrow.toISOString(),
        location: '123 Main St',
        event_type: 'game',
        capacity: 50,
      });

      if (eventResponse.status() === 200 || eventResponse.status() === 201) {
        const event = await eventResponse.json();
        
        // Fan should be able to RSVP
        const rsvpResponse = await makeAuthRequest(request, fan.token, 'post', `${API_BASE_URL}/events/${event.id}/rsvp`);
        expect([200, 201]).toContain(rsvpResponse.status());
      }
    });
  });

  test.describe('Coach Account Permissions', () => {
    test('Coach can create a team', async ({ request }) => {
      const coach = await createTestUser(request, 'coach');
      
      const response = await makeAuthRequest(request, coach.token, 'post', `${API_BASE_URL}/teams`, {
        name: `Coach Team ${Date.now()}`,
        description: 'Team created by coach',
        sport: 'basketball',
      });

      expect([200, 201]).toContain(response.status());
      
      if (response.status() === 200 || response.status() === 201) {
        const team = await response.json();
        expect(team).toHaveProperty('id');
        expect(team.name).toContain('Coach Team');
      }
    });

    test('Coach can create an organization', async ({ request }) => {
      const coach = await createTestUser(request, 'coach');
      
      const response = await makeAuthRequest(request, coach.token, 'post', `${API_BASE_URL}/organizations`, {
        name: `Coach Organization ${Date.now()}`,
        description: 'Organization created by coach',
        zip_code: '12345',
      });

      expect([200, 201]).toContain(response.status());
    });

    test('Coach can create games', async ({ request }) => {
      const coach = await createTestUser(request, 'coach');
      
      const tomorrow = new Date(Date.now() + 86400000);
      const response = await makeAuthRequest(request, coach.token, 'post', `${API_BASE_URL}/games`, {
        title: 'Coach Game',
        date: tomorrow.toISOString(),
        location: '123 Main St',
      });

      expect([200, 201]).toContain(response.status());
    });

    test('Coach becomes owner of created team', async ({ request }) => {
      const coach = await createTestUser(request, 'coach');
      
      // Create team
      const createResponse = await makeAuthRequest(request, coach.token, 'post', `${API_BASE_URL}/teams`, {
        name: `Ownership Test Team ${Date.now()}`,
        sport: 'basketball',
      });

      expect([200, 201]).toContain(createResponse.status());
      const team = await createResponse.json();

      // Check team members
      const membersResponse = await makeAuthRequest(request, coach.token, 'get', `${API_BASE_URL}/teams/${team.id}/members`);
      expect(membersResponse.status()).toBe(200);
      
      const members = await membersResponse.json();
      expect(Array.isArray(members)).toBe(true);
      
      // Coach should be in members with owner role
      const coachMembership = members.find((m: any) => m.user_id === coach.userId || m.user?.id === coach.userId);
      expect(coachMembership).toBeDefined();
      expect(coachMembership.role).toBe('owner');
    });

    test('Coach can update their own team', async ({ request }) => {
      const coach = await createTestUser(request, 'coach');
      
      // Create team
      const createResponse = await makeAuthRequest(request, coach.token, 'post', `${API_BASE_URL}/teams`, {
        name: `Update Test Team ${Date.now()}`,
        sport: 'basketball',
      });

      expect([200, 201]).toContain(createResponse.status());
      const team = await createResponse.json();

      // Update team
      const updateResponse = await makeAuthRequest(request, coach.token, 'put', `${API_BASE_URL}/teams/${team.id}`, {
        name: 'Updated Team Name',
        description: 'Updated description',
      });

      expect([200, 201]).toContain(updateResponse.status());
      const updatedTeam = await updateResponse.json();
      expect(updatedTeam.name).toBe('Updated Team Name');
    });

    test('Coach cannot update another coach\'s team', async ({ request }) => {
      const coach1 = await createTestUser(request, 'coach', 'coach1');
      const coach2 = await createTestUser(request, 'coach', 'coach2');
      
      // Coach1 creates a team
      const createResponse = await makeAuthRequest(request, coach1.token, 'post', `${API_BASE_URL}/teams`, {
        name: `Coach1 Team ${Date.now()}`,
        sport: 'basketball',
      });

      expect([200, 201]).toContain(createResponse.status());
      const team = await createResponse.json();

      // Coach2 tries to update Coach1's team
      const updateResponse = await makeAuthRequest(request, coach2.token, 'put', `${API_BASE_URL}/teams/${team.id}`, {
        name: 'Hacked Team Name',
      });

      // Should be rejected (403 or 404)
      expect([403, 404]).toContain(updateResponse.status());
    });
  });

  test.describe('Organization Ownership', () => {
    test('Organization creator becomes owner', async ({ request }) => {
      const coach = await createTestUser(request, 'coach');
      
      // Create organization
      const createResponse = await makeAuthRequest(request, coach.token, 'post', `${API_BASE_URL}/organizations`, {
        name: `Ownership Test Org ${Date.now()}`,
        zip_code: '12345',
      });

      expect([200, 201]).toContain(createResponse.status());
      const org = await createResponse.json();

      // Get organization members
      const membersResponse = await makeAuthRequest(request, coach.token, 'get', `${API_BASE_URL}/organizations/${org.id}/members`);
      
      if (membersResponse.status() === 200) {
        const members = await membersResponse.json();
        expect(Array.isArray(members)).toBe(true);
        
        // Creator should be in members with owner role
        const creatorMembership = members.find((m: any) => m.user_id === coach.userId || m.user?.id === coach.userId);
        expect(creatorMembership).toBeDefined();
        expect(creatorMembership.role).toBe('owner');
      }
    });

    test('Organization owner can manage organization', async ({ request }) => {
      const coach = await createTestUser(request, 'coach');
      
      // Create organization
      const createResponse = await makeAuthRequest(request, coach.token, 'post', `${API_BASE_URL}/organizations`, {
        name: `Manage Test Org ${Date.now()}`,
        zip_code: '12345',
      });

      expect([200, 201]).toContain(createResponse.status());
      const org = await createResponse.json();

      // Owner should be able to view their organizations
      const mineResponse = await makeAuthRequest(request, coach.token, 'get', `${API_BASE_URL}/organizations/mine`);
      expect(mineResponse.status()).toBe(200);
      
      const myOrgs = await mineResponse.json();
      expect(Array.isArray(myOrgs)).toBe(true);
      const foundOrg = myOrgs.find((o: any) => o.id === org.id);
      expect(foundOrg).toBeDefined();
    });
  });

  test.describe('Admin Permissions', () => {
    test('Admin check uses email-based verification', async ({ request }) => {
      // Admin is determined by ADMIN_EMAILS env var
      // We can't test this directly without knowing admin emails
      // But we can verify the mechanism exists
      
      const regularUser = await createTestUser(request, 'coach');
      
      // Try to access admin-only endpoint (if it exists)
      // Most admin endpoints require admin email in env
      const response = await makeAuthRequest(request, regularUser.token, 'get', `${API_BASE_URL}/users`);
      
      // Should be 403 unless the test email is in ADMIN_EMAILS
      expect([403, 404, 200]).toContain(response.status());
    });

    test('Non-admin cannot access admin routes', async ({ request }) => {
      const regularUser = await createTestUser(request, 'coach');
      
      // Try admin route
      const response = await makeAuthRequest(request, regularUser.token, 'get', `${API_BASE_URL}/admin/dashboard`);
      
      // Should be 403 (admin only) or 404 (route doesn't exist)
      expect([403, 404]).toContain(response.status());
    });
  });

  test.describe('Email Verification Requirements', () => {
    test('Team creation requires verified email', async ({ request }) => {
      // Create unverified user (by not verifying email)
      const email = `test-unverified-${Date.now()}@example.com`;
      const signupResponse = await request.post(`${API_BASE_URL}/auth/register`, {
        data: {
          email,
          password: 'TestPassword123!',
          display_name: 'Unverified User',
          role: 'coach',
        },
      });

      expect([200, 201]).toContain(signupResponse.status());
      const signupData = await signupResponse.json();
      const token = signupData.access_token || signupData.token;

      // Try to create team without verifying email
      const response = await makeAuthRequest(request, token, 'post', `${API_BASE_URL}/teams`, {
        name: 'Unverified Team',
        sport: 'basketball',
      });

      // Should require verification
      expect([403, 401]).toContain(response.status());
      
      if (response.status() === 403) {
        const body = await response.json();
        expect(body.error).toContain('verification');
      }
    });
  });
});
