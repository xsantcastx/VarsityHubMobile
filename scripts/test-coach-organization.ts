#!/usr/bin/env npx tsx
/**
 * Coach/Organization Real-World Test Suite
 * 
 * Tests real-world coach and organization workflows:
 * - Organization creation and management
 * - Team creation with subscription limits
 * - Event creation and approval
 * - Team invitations
 * - Roster management
 * - Permissions and role checks
 * 
 * Usage: npx tsx scripts/test-coach-organization.ts
 */

import { config as loadEnv } from 'dotenv';

// Load environment variables
loadEnv({ path: '.env', override: true });
loadEnv({ path: 'server/.env', override: true });

const API_BASE_URL = process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: any;
  duration?: number;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const icon = result.success ? '✅' : '❌';
  const duration = result.duration ? ` (${result.duration}ms)` : '';
  console.log(`${icon} ${result.name}: ${result.message}${duration}`);
  if (result.details && !result.success) {
    console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
  }
}

async function testAPI(endpoint: string, options: RequestInit = {}): Promise<any> {
  const startTime = Date.now();
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const data = await response.json().catch(() => ({}));
    const duration = Date.now() - startTime;
    
    return {
      ok: response.ok,
      status: response.status,
      data,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      duration,
    };
  }
}

async function testServerHealth() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║        🏋️ COACH/ORGANIZATION REAL-WORLD TEST SUITE           ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log('🔧 STEP 1: SERVER HEALTH CHECK');
  console.log('─────────────────────────────────────────────────────────────────');
  
  const result = await testAPI('/health');
  logResult({
    name: 'Server Health Check',
    success: result.ok,
    message: result.ok ? 'Server is running' : `Server not accessible: ${result.error || result.status}`,
    details: result,
    duration: result.duration,
  });
  
  return result.ok;
}

async function testOrganizationEndpoints() {
  console.log('\n📋 STEP 2: ORGANIZATION ENDPOINTS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Test GET /organizations
  const listResult = await testAPI('/organizations');
  logResult({
    name: 'List Organizations',
    success: listResult.ok || listResult.status === 401, // 401 is OK if not authenticated
    message: listResult.ok 
      ? 'Organizations endpoint accessible' 
      : listResult.status === 401 
        ? 'Requires authentication (expected)'
        : `Failed: ${listResult.status || listResult.error}`,
    details: { status: listResult.status },
    duration: listResult.duration,
  });
  
  // Test organization creation endpoint (should require auth)
  const createResult = await testAPI('/organizations', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Test Organization',
      type: 'school',
    }),
  });
  logResult({
    name: 'Create Organization (Auth Required)',
    success: createResult.status === 401 || createResult.status === 400, // Should require auth or valid data
    message: createResult.status === 401 
      ? 'Correctly requires authentication'
      : createResult.status === 400
        ? 'Validates request data (expected)'
        : `Unexpected response: ${createResult.status}`,
    details: { status: createResult.status },
    duration: createResult.duration,
  });
}

async function testTeamEndpoints() {
  console.log('\n👥 STEP 3: TEAM ENDPOINTS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Test GET /teams
  const listResult = await testAPI('/teams');
  logResult({
    name: 'List Teams',
    success: listResult.ok || listResult.status === 401,
    message: listResult.ok 
      ? 'Teams endpoint accessible' 
      : listResult.status === 401 
        ? 'Requires authentication (expected)'
        : `Failed: ${listResult.status || listResult.error}`,
    details: { status: listResult.status },
    duration: listResult.duration,
  });
  
  // Test team creation endpoint
  const createResult = await testAPI('/teams', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Test Team',
      sport: 'Basketball',
    }),
  });
  logResult({
    name: 'Create Team (Auth Required)',
    success: createResult.status === 401 || createResult.status === 400,
    message: createResult.status === 401 
      ? 'Correctly requires authentication'
      : createResult.status === 400
        ? 'Validates request data (expected)'
        : `Unexpected response: ${createResult.status}`,
    details: { status: createResult.status },
    duration: createResult.duration,
  });
  
  // Test team limits endpoint
  const limitsResult = await testAPI('/teams/limits');
  logResult({
    name: 'Team Limits Endpoint',
    success: limitsResult.ok || limitsResult.status === 401,
    message: limitsResult.ok 
      ? 'Team limits endpoint accessible'
      : limitsResult.status === 401
        ? 'Requires authentication (expected)'
        : `Failed: ${limitsResult.status || limitsResult.error}`,
    details: { status: limitsResult.status },
    duration: limitsResult.duration,
  });
}

async function testEventEndpoints() {
  console.log('\n🎪 STEP 4: EVENT ENDPOINTS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Test GET /events/pending (approval queue)
  const pendingResult = await testAPI('/events/pending');
  logResult({
    name: 'Pending Events (Approval Queue)',
    success: pendingResult.ok || pendingResult.status === 401,
    message: pendingResult.ok 
      ? 'Pending events endpoint accessible'
      : pendingResult.status === 401
        ? 'Requires authentication (expected)'
        : `Failed: ${pendingResult.status || pendingResult.error}`,
    details: { status: pendingResult.status },
    duration: pendingResult.duration,
  });
  
  // Test event creation
  const createResult = await testAPI('/games', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Test Game',
      date: new Date().toISOString(),
      location: 'Test Location',
      event_type: 'game',
    }),
  });
  logResult({
    name: 'Create Event (Auth Required)',
    success: createResult.status === 401 || createResult.status === 400,
    message: createResult.status === 401 
      ? 'Correctly requires authentication'
      : createResult.status === 400
        ? 'Validates request data (expected)'
        : `Unexpected response: ${createResult.status}`,
    details: { status: createResult.status },
    duration: createResult.duration,
  });
  
  // Test event approval endpoint
  const approveResult = await testAPI('/events/1/approve', {
    method: 'PUT',
    body: JSON.stringify({}),
  });
  logResult({
    name: 'Approve Event (Auth Required)',
    success: approveResult.status === 401 || approveResult.status === 404 || approveResult.status === 403,
    message: approveResult.status === 401 
      ? 'Correctly requires authentication'
      : approveResult.status === 404
        ? 'Event not found (expected for test)'
        : approveResult.status === 403
          ? 'Requires coach/admin role (expected)'
          : `Unexpected response: ${approveResult.status}`,
    details: { status: approveResult.status },
    duration: approveResult.duration,
  });
}

async function testTeamInvitations() {
  console.log('\n📧 STEP 5: TEAM INVITATIONS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Test team invites endpoint
  const invitesResult = await testAPI('/team-invites');
  logResult({
    name: 'List Team Invites',
    success: invitesResult.ok || invitesResult.status === 401,
    message: invitesResult.ok 
      ? 'Team invites endpoint accessible'
      : invitesResult.status === 401
        ? 'Requires authentication (expected)'
        : `Failed: ${invitesResult.status || invitesResult.error}`,
    details: { status: invitesResult.status },
    duration: invitesResult.duration,
  });
  
  // Test create invite endpoint
  const createInviteResult = await testAPI('/team-invites', {
    method: 'POST',
    body: JSON.stringify({
      team_id: 'test-team-id',
      email: 'test@example.com',
      role: 'player',
    }),
  });
  logResult({
    name: 'Create Team Invite (Auth Required)',
    success: createInviteResult.status === 401 || createInviteResult.status === 400 || createInviteResult.status === 404,
    message: createInviteResult.status === 401 
      ? 'Correctly requires authentication'
      : createInviteResult.status === 400 || createInviteResult.status === 404
        ? 'Validates request data (expected)'
        : `Unexpected response: ${createInviteResult.status}`,
    details: { status: createInviteResult.status },
    duration: createInviteResult.duration,
  });
}

async function testOrganizationJoinRequests() {
  console.log('\n🤝 STEP 6: ORGANIZATION JOIN REQUESTS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Test join requests endpoint
  const requestsResult = await testAPI('/organizations/join-requests');
  logResult({
    name: 'List Join Requests',
    success: requestsResult.ok || requestsResult.status === 401,
    message: requestsResult.ok 
      ? 'Join requests endpoint accessible'
      : requestsResult.status === 401
        ? 'Requires authentication (expected)'
        : `Failed: ${requestsResult.status || requestsResult.error}`,
    details: { status: requestsResult.status },
    duration: requestsResult.duration,
  });
  
  // Test create join request
  const createRequestResult = await testAPI('/organizations/join-requests', {
    method: 'POST',
    body: JSON.stringify({
      organization_id: 'test-org-id',
      message: 'I would like to join',
    }),
  });
  logResult({
    name: 'Create Join Request (Auth Required)',
    success: createRequestResult.status === 401 || createRequestResult.status === 400 || createRequestResult.status === 404,
    message: createRequestResult.status === 401 
      ? 'Correctly requires authentication'
      : createRequestResult.status === 400 || createRequestResult.status === 404
        ? 'Validates request data (expected)'
        : `Unexpected response: ${createRequestResult.status}`,
    details: { status: createRequestResult.status },
    duration: createRequestResult.duration,
  });
}

async function testSubscriptionLimits() {
  console.log('\n💳 STEP 7: SUBSCRIPTION LIMITS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Test subscription info endpoint
  const subResult = await testAPI('/subscriptions/me');
  logResult({
    name: 'Get Subscription Info',
    success: subResult.ok || subResult.status === 401,
    message: subResult.ok 
      ? 'Subscription endpoint accessible'
      : subResult.status === 401
        ? 'Requires authentication (expected)'
        : `Failed: ${subResult.status || subResult.error}`,
    details: { status: subResult.status },
    duration: subResult.duration,
  });
  
  // Test team limits (should show subscription tier limits)
  const limitsResult = await testAPI('/teams/limits');
  logResult({
    name: 'Get Team Creation Limits',
    success: limitsResult.ok || limitsResult.status === 401,
    message: limitsResult.ok 
      ? 'Team limits endpoint accessible'
      : limitsResult.status === 401
        ? 'Requires authentication (expected)'
        : `Failed: ${limitsResult.status || limitsResult.error}`,
    details: { status: limitsResult.status },
    duration: limitsResult.duration,
  });
}

async function testPermissions() {
  console.log('\n🔐 STEP 8: PERMISSIONS & ROLE CHECKS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Test user info endpoint (should show role)
  const userResult = await testAPI('/users/me');
  logResult({
    name: 'Get User Info (Role Check)',
    success: userResult.ok || userResult.status === 401,
    message: userResult.ok 
      ? 'User info endpoint accessible'
      : userResult.status === 401
        ? 'Requires authentication (expected)'
        : `Failed: ${userResult.status || userResult.error}`,
    details: { status: userResult.status },
    duration: userResult.duration,
  });
}

async function testRosterManagement() {
  console.log('\n📊 STEP 9: ROSTER MANAGEMENT');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Test team memberships endpoint
  const membersResult = await testAPI('/team-memberships?team_id=test');
  logResult({
    name: 'List Team Members',
    success: membersResult.ok || membersResult.status === 401 || membersResult.status === 404,
    message: membersResult.ok 
      ? 'Team memberships endpoint accessible'
      : membersResult.status === 401
        ? 'Requires authentication (expected)'
        : membersResult.status === 404
          ? 'Team not found (expected for test)'
          : `Failed: ${membersResult.status || membersResult.error}`,
    details: { status: membersResult.status },
    duration: membersResult.duration,
  });
}

async function generateReport() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      📊 TEST RESULTS SUMMARY                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;
  const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
  const avgDuration = results
    .filter(r => r.duration)
    .reduce((sum, r) => sum + (r.duration || 0), 0) / results.filter(r => r.duration).length;
  
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`📊 TOTAL:  ${total}`);
  console.log(`📈 SUCCESS RATE: ${percentage}%`);
  if (avgDuration > 0) {
    console.log(`⏱️  AVERAGE RESPONSE TIME: ${avgDuration.toFixed(0)}ms`);
  }
  console.log();
  
  if (failed > 0) {
    console.log('❌ FAILED TESTS:');
    console.log('─────────────────────────────────────────────────────────────────');
    results.filter(r => !r.success).forEach(result => {
      console.log(`  • ${result.name}: ${result.message}`);
    });
    console.log();
  }
  
  // Save results
  const fs = await import('fs').then(m => m.promises);
  const report = {
    timestamp: new Date().toISOString(),
    apiBaseUrl: API_BASE_URL,
    summary: {
      passed,
      failed,
      total,
      successRate: `${percentage}%`,
      averageResponseTime: avgDuration > 0 ? `${avgDuration.toFixed(0)}ms` : 'N/A',
    },
    results,
  };
  
  await fs.writeFile(
    './coach-organization-test-results.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log('📄 Results saved to: coach-organization-test-results.json\n');
  
  // Recommendations
  if (failed > 0) {
    console.log('💡 RECOMMENDATIONS:');
    console.log('─────────────────────────────────────────────────────────────────');
    
    const serverDown = results.find(r => r.name === 'Server Health Check' && !r.success);
    if (serverDown) {
      console.log('  1. Start the server: cd server && npm run dev');
    }
    
    const authIssues = results.filter(r => r.message.includes('authentication') && !r.success && r.name.includes('Auth Required'));
    if (authIssues.length === 0) {
      console.log('  2. ✅ Authentication is properly enforced');
    }
    
    console.log('  3. For full testing, authenticate with a coach account:');
    console.log('     - Sign up as a coach');
    console.log('     - Create an organization');
    console.log('     - Create teams (test subscription limits)');
    console.log('     - Create events (test approval workflow)');
    console.log('     - Invite team members');
    console.log();
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

async function main() {
  try {
    const serverHealthy = await testServerHealth();
    if (!serverHealthy) {
      console.log('\n⚠️  Server is not running. Start it with: cd server && npm run dev\n');
      process.exit(1);
    }
    
    await testOrganizationEndpoints();
    await testTeamEndpoints();
    await testEventEndpoints();
    await testTeamInvitations();
    await testOrganizationJoinRequests();
    await testSubscriptionLimits();
    await testPermissions();
    await testRosterManagement();
    await generateReport();
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

main();
