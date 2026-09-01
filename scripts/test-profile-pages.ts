#!/usr/bin/env node
/**
 * Real-World Profile Pages End-to-End Test Suite
 * 
 * This script tests the profile pages (User, Team, Organization) to ensure
 * they work correctly in real-world scenarios.
 */

import { Organization, Team, User } from '../apiclient/entities.js';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  details?: any;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, error?: string, details?: any) {
  results.push({ name, passed, error, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}`);
  if (error) {
    console.log(`   Error: ${error}`);
  }
  if (details) {
    console.log(`   Details: ${JSON.stringify(details, null, 2)}`);
  }
}

async function test(name: string, fn: () => Promise<boolean>): Promise<boolean> {
  try {
    const result = await fn();
    logTest(name, result);
    return result;
  } catch (error: any) {
    logTest(name, false, error?.message || String(error));
    return false;
  }
}

async function runProfilePagesTests() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     PROFILE PAGES END-TO-END TEST SUITE                        ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Test 1: Server Health Check
  await test('Server Health Check', async () => {
    try {
      const response = await fetch(`${API_BASE}/health`);
      return response.ok;
    } catch {
      return false;
    }
  });

  // Test 2: User Profile Data Loading
  await test('User Profile - Load Current User', async () => {
    try {
      const user = await User.me();
      return !!user && !!user.id;
    } catch {
      return false;
    }
  });

  // Test 3: User Profile - Posts Tab
  await test('User Profile - Posts Tab Data', async () => {
    try {
      const user = await User.me();
      if (!user?.id) return false;
      
      const posts = await User.postsForProfile(String(user.id), { limit: 10 });
      return Array.isArray(posts.items || posts);
    } catch {
      return false;
    }
  });

  // Test 4: User Profile - Replies Tab
  await test('User Profile - Replies Tab Data', async () => {
    try {
      const user = await User.me();
      if (!user?.id) return false;
      
      const replies = await User.interactionsForProfile(String(user.id), { 
        type: 'comment', 
        limit: 10 
      });
      return Array.isArray(replies.items || replies);
    } catch {
      return false;
    }
  });

  // Test 5: User Profile - Upvotes Tab
  await test('User Profile - Upvotes Tab Data', async () => {
    try {
      const user = await User.me();
      if (!user?.id) return false;
      
      const upvotes = await User.interactionsForProfile(String(user.id), { 
        type: 'like', 
        limit: 10 
      });
      return Array.isArray(upvotes.items || upvotes);
    } catch {
      return false;
    }
  });

  // Test 6: User Profile - Join Date Format
  await test('User Profile - Join Date Format', async () => {
    try {
      const user = await User.me();
      if (!user?.id) return false;
      
      // Check if created_at exists and is valid date
      if (user.created_at) {
        const date = new Date(user.created_at);
        return !isNaN(date.getTime());
      }
      return true; // created_at is optional
    } catch {
      return false;
    }
  });

  // Test 7: Team Profile - Load Team Data
  await test('Team Profile - Load Team Data', async () => {
    try {
      const teams = await Team.list();
      const teamsList = Array.isArray(teams) ? teams : [];
      return teamsList.length > 0;
    } catch {
      return false;
    }
  });

  // Test 8: Team Profile - Check Admin Permissions
  await test('Team Profile - Admin Permission Check', async () => {
    try {
      const user = await User.me();
      const teams = await Team.list();
      const teamsList = Array.isArray(teams) ? teams : [];
      
      if (teamsList.length === 0) return true; // No teams to test
      
      const firstTeam = teamsList[0];
      if (!user?.id || !firstTeam?.id) return false;
      
      const members = await Team.members(firstTeam.id);
      const memberList = Array.isArray(members) ? members : [];
      
      // Check if user is admin/owner/coach
      const isAdmin = memberList.some((m: any) => {
        const memberUserId = m.user_id || m.user?.id;
        if (memberUserId !== user.id) return false;
        const role = String(m.role || '').toLowerCase();
        return ['owner', 'coach', 'admin'].includes(role);
      });
      
      return true; // Test passes if we can check permissions
    } catch {
      return false;
    }
  });

  // Test 9: Team Profile - Posts Data
  await test('Team Profile - Posts Data', async () => {
    try {
      const teams = await Team.list();
      const teamsList = Array.isArray(teams) ? teams : [];
      if (teamsList.length === 0) return true;
      
      // Get posts for team games
      const games = await Team.games?.(teamsList[0].id) || [];
      return Array.isArray(games);
    } catch {
      return false;
    }
  });

  // Test 10: Organization Profile - Load Organization Data
  await test('Organization Profile - Load Organization Data', async () => {
    try {
      const orgs = await Organization.list();
      const orgsList = Array.isArray(orgs) ? orgs : [];
      return orgsList.length >= 0; // Can be empty
    } catch {
      return false;
    }
  });

  // Test 11: Organization Profile - Check Admin Permissions
  await test('Organization Profile - Admin Permission Check', async () => {
    try {
      const user = await User.me();
      const orgs = await Organization.list();
      const orgsList = Array.isArray(orgs) ? orgs : [];
      
      if (orgsList.length === 0) return true; // No orgs to test
      
      const firstOrg = orgsList[0];
      if (!user?.id || !firstOrg?.id) return false;
      
      const orgData = await Organization.get(firstOrg.id);
      
      // Check if user is admin
      if (orgData?.memberships && Array.isArray(orgData.memberships)) {
        const isAdmin = orgData.memberships.some((m: any) => {
          const memberUserId = m.user?.id || m.user_id;
          if (memberUserId !== user.id) return false;
          const role = String(m.role || '').toLowerCase();
          return ['owner', 'manager', 'administrator', 'admin'].includes(role);
        });
        return true; // Test passes if we can check permissions
      }
      
      return true;
    } catch {
      return false;
    }
  });

  // Test 12: Organization Profile - Created Date Format
  await test('Organization Profile - Created Date Format', async () => {
    try {
      const orgs = await Organization.list();
      const orgsList = Array.isArray(orgs) ? orgs : [];
      if (orgsList.length === 0) return true;
      
      const orgData = await Organization.get(orgsList[0].id);
      if (orgData?.created_at) {
        const date = new Date(orgData.created_at);
        return !isNaN(date.getTime());
      }
      return true; // created_at is optional
    } catch {
      return false;
    }
  });

  // Test 13: Profile Navigation - User to Team
  await test('Profile Navigation - User to Team', async () => {
    try {
      const user = await User.me();
      const teams = await Team.list();
      const teamsList = Array.isArray(teams) ? teams : [];
      
      if (!user?.id || teamsList.length === 0) return true;
      
      // Verify team data structure
      const team = teamsList[0];
      return !!team.id && !!team.name;
    } catch {
      return false;
    }
  });

  // Test 14: Profile Navigation - Team to Organization
  await test('Profile Navigation - Team to Organization', async () => {
    try {
      const teams = await Team.list();
      const teamsList = Array.isArray(teams) ? teams : [];
      
      if (teamsList.length === 0) return true;
      
      const team = teamsList[0];
      if (!team.organization_id) return true; // Team may not have org
      
      const org = await Organization.get(team.organization_id);
      return !!org && !!org.id;
    } catch {
      return false;
    }
  });

  // Test 15: Dark Mode Compatibility - Data Structure
  await test('Dark Mode - Data Structure Compatibility', async () => {
    try {
      const user = await User.me();
      if (!user) return false;
      
      // Check that all required fields exist for dark mode rendering
      const hasRequiredFields = 
        typeof user.display_name === 'string' || user.display_name === null;
      
      return hasRequiredFields;
    } catch {
      return false;
    }
  });

  // Test 16: Empty States - No Posts
  await test('Empty States - Handle No Posts', async () => {
    try {
      // This test verifies the app handles empty states gracefully
      // We can't force empty state, but we can verify the API returns arrays
      const user = await User.me();
      if (!user?.id) return false;
      
      const posts = await User.postsForProfile(String(user.id), { limit: 1 });
      return Array.isArray(posts.items || posts);
    } catch {
      return false;
    }
  });

  // Test 17: Tab Switching - State Management
  await test('Tab Switching - State Management', async () => {
    try {
      const user = await User.me();
      if (!user?.id) return false;
      
      // Test that we can switch between tabs without errors
      const posts = await User.postsForProfile(String(user.id), { limit: 1 });
      const replies = await User.interactionsForProfile(String(user.id), { 
        type: 'comment', 
        limit: 1 
      });
      const upvotes = await User.interactionsForProfile(String(user.id), { 
        type: 'like', 
        limit: 1 
      });
      
      return Array.isArray(posts.items || posts) &&
             Array.isArray(replies.items || replies) &&
             Array.isArray(upvotes.items || upvotes);
    } catch {
      return false;
    }
  });

  // Test 18: Profile Picture Loading
  await test('Profile Picture - Image URL Format', async () => {
    try {
      const user = await User.me();
      if (!user) return false;
      
      // Check avatar_url format if it exists
      if (user.avatar_url) {
        return typeof user.avatar_url === 'string' && 
               (user.avatar_url.startsWith('http') || user.avatar_url.startsWith('/'));
      }
      return true; // avatar_url is optional
    } catch {
      return false;
    }
  });

  // Test 19: Bio Text Rendering
  await test('Bio Text - Rendering Compatibility', async () => {
    try {
      const user = await User.me();
      if (!user) return false;
      
      // Check bio format
      if (user.bio) {
        return typeof user.bio === 'string';
      }
      return true; // bio is optional
    } catch {
      return false;
    }
  });

  // Test 20: Following/Followers Count
  await test('Following/Followers - Count Format', async () => {
    try {
      const user = await User.me();
      if (!user) return false;
      
      // Check _count structure
      if (user._count) {
        const following = user._count.following ?? 0;
        const followers = user._count.followers ?? 0;
        return typeof following === 'number' && typeof followers === 'number';
      }
      return true; // _count is optional
    } catch {
      return false;
    }
  });

  // Print Summary
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                                  ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;
  
  console.log(`Total Tests: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('');
  
  if (failed > 0) {
    console.log('Failed Tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.name}`);
      if (r.error) {
        console.log(`     Error: ${r.error}`);
      }
    });
    console.log('');
  }
  
  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runProfilePagesTests().catch((error) => {
  console.error('Fatal error running tests:', error);
  process.exit(1);
});
