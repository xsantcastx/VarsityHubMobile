/**
 * VERIFY 4 — Confirm approval unlocks access in real time
 *
 * Simulates the polling behavior of pending-approval.tsx and league-pending-approval.tsx
 *
 * Steps:
 * 1. Create a PENDING coach with an unapproved org
 * 2. Start polling GET /auth/me every 2s (simulating frontend)
 * 3. Also poll GET /organizations/:id every 2s (league-pending-approval pattern)
 * 4. After 6 seconds, approve the coach via league owner endpoint
 * 5. Confirm the next poll detects approval_status: APPROVED
 * 6. Confirm the org poll detects admin_approved: true
 * 7. Confirm frontend navigation would trigger
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const BASE = 'http://localhost:4000';
const prisma = new PrismaClient();

const ts = Date.now();
const COACH_EMAIL = `pollcoach_${ts}@test.local`;
const OWNER_EMAIL = `pollowner_${ts}@test.local`;
const ADMIN_EMAIL = 'sanchezemil203@gmail.com';
const PASSWORD = 'TestPass123';

let coachToken = '';
let coachId = '';
let ownerToken = '';
let ownerId = '';
let adminToken = '';
let adminId = '';
let orgId = '';

function divider(label: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${label}`);
  console.log('='.repeat(60));
}

async function api(method: string, path: string, body?: any, token?: string, silent = false) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  if (!silent) console.log(`→ ${method} ${path}`);

  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!silent) console.log(`← ${res.status}`);
  return { status: res.status, data };
}

async function main() {
  console.log('🧪 VERIFY 4 — Polling Approval Detection (Real-Time)');
  console.log('  Simulates pending-approval.tsx and league-pending-approval.tsx polling');

  // ── Setup ──
  divider('SETUP');
  const hashedPw = await bcrypt.hash(PASSWORD, 10);

  // Admin user
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      password_hash: hashedPw,
      display_name: 'Admin',
      username: `admin_${ts}`.slice(0, 20),
      email_verified: true,
      approval_status: 'APPROVED',
      preferences: { role: 'coach', onboarding_completed: true, plan: 'legend', is_admin: true },
    },
  });
  adminId = admin.id;
  const adminLogin = await api('POST', '/auth/login', { email: ADMIN_EMAIL, password: PASSWORD }, undefined, true);
  adminToken = adminLogin.data.access_token;

  // Coach user (pending)
  const coach = await prisma.user.create({
    data: {
      email: COACH_EMAIL,
      password_hash: hashedPw,
      display_name: 'Poll Coach',
      username: `pollcoach_${ts}`.slice(0, 20),
      email_verified: true,
      approval_status: 'PENDING',
      preferences: { role: 'coach', onboarding_completed: true, plan: 'rookie', affiliation: 'school' },
    },
  });
  coachId = coach.id;
  const coachLogin = await api('POST', '/auth/login', { email: COACH_EMAIL, password: PASSWORD }, undefined, true);
  coachToken = coachLogin.data.access_token;

  // Org (unapproved)
  const org = await prisma.organization.create({
    data: {
      name: 'Polling Test League',
      league_owner_id: coachId,
      admin_approved: false,
    },
  });
  orgId = org.id;

  // Owner membership
  await prisma.organizationMembership.create({
    data: { organization_id: orgId, user_id: coachId, role: 'owner', status: 'active' },
  });

  console.log(`  Coach: ${coachId} (PENDING)`);
  console.log(`  Org: ${orgId} (admin_approved: false)`);
  console.log(`  Admin: ${adminId}`);

  // ── Polling simulation ──
  divider('POLLING SIMULATION');
  console.log('  Frontend pattern from pending-approval.tsx:');
  console.log('    polls GET /auth/me every 10s, checks me.approval_status');
  console.log('  Frontend pattern from league-pending-approval.tsx:');
  console.log('    polls GET /organizations/:id every 10s, checks org.admin_approved');
  console.log('');
  console.log('  Simulating with 2s intervals, approval at ~6s...\n');

  let pollCount = 0;
  let userApprovalDetected = false;
  let orgApprovalDetected = false;
  let approvalSent = false;

  const results: { tick: number; user_status: string; org_approved: boolean; event: string }[] = [];

  // Run 8 polls at 2s intervals
  for (let i = 0; i < 8; i++) {
    pollCount++;
    const elapsed = i * 2;

    // Poll /auth/me (pending-approval.tsx pattern)
    const meRes = await api('GET', '/auth/me', undefined, coachToken, true);
    const userStatus = meRes.data?.approval_status;

    // Poll /organizations/:id (league-pending-approval.tsx pattern)
    const orgRes = await api('GET', `/organizations/${orgId}`, undefined, coachToken, true);
    const orgApproved = orgRes.data?.admin_approved;

    let event = '';

    // Simulate approval at tick 3 (6 seconds)
    if (i === 3 && !approvalSent) {
      event = '>>> ADMIN APPROVES ORG <<<';
      console.log(`  [${elapsed}s] 🔔 ${event}`);

      // Admin approves the org (this atomically sets coach approval_status to APPROVED too)
      const approveRes = await api('POST', `/organizations/${orgId}/approve`, {}, adminToken, true);
      if (approveRes.status === 200) {
        console.log(`  [${elapsed}s]    Approval endpoint returned 200`);
      } else {
        console.log(`  [${elapsed}s]    ⚠️ Approval returned ${approveRes.status}: ${approveRes.data?.error}`);
      }
      approvalSent = true;

      // Re-poll immediately after approval (simulates next poll cycle)
      continue;
    }

    // Check if approval was detected
    if (userStatus === 'APPROVED' && !userApprovalDetected) {
      userApprovalDetected = true;
      event += ' [USER APPROVED DETECTED]';
    }
    if (orgApproved === true && !orgApprovalDetected) {
      orgApprovalDetected = true;
      event += ' [ORG APPROVED DETECTED]';
    }

    const icon = userStatus === 'PENDING' ? '⏳' : '✅';
    console.log(
      `  [${elapsed}s] Poll #${pollCount}: ` +
      `user.approval_status=${icon} ${userStatus}, ` +
      `org.admin_approved=${orgApproved ? '✅' : '❌'} ${orgApproved}` +
      (event ? `  ${event}` : '')
    );

    results.push({ tick: elapsed, user_status: userStatus, org_approved: orgApproved, event });

    // Simulated frontend logic from pending-approval.tsx:
    if (userStatus === 'APPROVED') {
      console.log(`\n  📱 pending-approval.tsx would now:`);
      console.log(`     1. setApproved(true)`);
      console.log(`     2. clearInterval(intervalRef.current)`);
      console.log(`     3. await User.completeOnboarding({...})`);
      console.log(`     4. await markOnboardingCompleteLocally()`);
      console.log(`     5. await checkAuth()`);
      console.log(`     6. registerPushToken().catch(() => {})`);
      console.log(`     7. setTimeout(() => router.replace('/(tabs)'), 2000)`);
    }

    if (orgApproved === true) {
      console.log(`\n  📱 league-pending-approval.tsx would now:`);
      console.log(`     1. setApproved(true)`);
      console.log(`     2. clearInterval(intervalRef.current)`);
      console.log(`     3. await User.completeOnboarding({...})`);
      console.log(`     4. await markOnboardingCompleteLocally()`);
      console.log(`     5. await checkAuth()`);
      console.log(`     6. registerPushToken().catch(() => {})`);
      console.log(`     7. setTimeout(() => router.replace('/(tabs)'), 2000)`);
    }

    if (userApprovalDetected && orgApprovalDetected) {
      console.log('\n  Both screens would navigate away. Stopping poll.');
      break;
    }

    // Wait 2s between polls
    if (i < 7) await new Promise(r => setTimeout(r, 2000));
  }

  // ── Verify notification was created ──
  divider('NOTIFICATION CHECK');
  const notifs = await prisma.notification.findMany({
    where: { user_id: coachId },
    select: { type: true, meta: true, created_at: true },
    orderBy: { created_at: 'desc' },
  });
  console.log(`  Notifications for coach: ${notifs.length}`);
  notifs.forEach(n => console.log('  ', JSON.stringify(n)));
  if (notifs.some(n => n.type === 'ORG_APPROVED')) {
    console.log('  ✅ ORG_APPROVED notification created');
  }

  // ── Cleanup ──
  divider('CLEANUP');
  await prisma.notification.deleteMany({ where: { user_id: coachId } }).catch(() => {});
  await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
  await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: [coachId, adminId] } } }).catch(() => {});
  console.log('🗑️  Cleaned up');

  // ── Summary ──
  divider('RESULTS');
  console.log('  Poll timeline:');
  results.forEach(r => {
    console.log(`    [${r.tick}s] user=${r.user_status} org=${r.org_approved}${r.event ? ` ${r.event}` : ''}`);
  });
  console.log('');
  if (userApprovalDetected && orgApprovalDetected) {
    console.log('  ✅ Both pending-approval.tsx and league-pending-approval.tsx');
    console.log('     would detect the approval and navigate to /(tabs)');
    console.log('     WITHOUT requiring an app restart.');
  } else {
    console.log('  ❌ Approval not detected in polling window');
  }
}

main()
  .catch(err => {
    console.error('💥 Script error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
