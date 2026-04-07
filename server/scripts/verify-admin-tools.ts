/**
 * ADMIN AUDIT — Test every admin tool against running server
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const BASE = 'http://localhost:4000';
const prisma = new PrismaClient();
const ts = Date.now();
const PASSWORD = 'TestPass123';
const ADMIN_EMAIL = 'sanchezemil203@gmail.com';

let adminToken = '';
let adminId = '';
let coachToken = '';
let coachId = '';
let orgId = '';
let teamId = '';
const cleanup: string[] = [];

let passed = 0;
let failed = 0;

function divider(label: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${label}`);
  console.log('═'.repeat(60));
}

function check(label: string, condition: boolean, details?: string) {
  if (condition) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}${details ? ` — ${details}` : ''}`); }
}

async function api(method: string, path: string, body?: any, tok?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (tok) headers['Authorization'] = `Bearer ${tok}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          ADMIN TOOLS — COMPLETE AUDIT                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const hashedPw = await bcrypt.hash(PASSWORD, 10);

  // ── Setup admin + coach + org ──
  const admin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL, password_hash: hashedPw,
      display_name: 'Admin', username: `admin_${ts}`.slice(0, 20),
      email_verified: true, approval_status: 'APPROVED',
      preferences: { role: 'coach', onboarding_completed: true, plan: 'legend', is_admin: true },
    },
  });
  adminId = admin.id; cleanup.push(adminId);
  const aLogin = await api('POST', '/auth/login', { email: ADMIN_EMAIL, password: PASSWORD });
  adminToken = aLogin.data?.access_token;

  const coach = await prisma.user.create({
    data: {
      email: `coach_${ts}@test.local`, password_hash: hashedPw,
      display_name: 'Test Coach', username: `coach_${ts}`.slice(0, 20),
      email_verified: true, approval_status: 'APPROVED',
      preferences: { role: 'coach', onboarding_completed: true, plan: 'rookie' },
    },
  });
  coachId = coach.id; cleanup.push(coachId);
  const cLogin = await api('POST', '/auth/login', { email: `coach_${ts}@test.local`, password: PASSWORD });
  coachToken = cLogin.data?.access_token;

  const org = await prisma.organization.create({
    data: { name: 'Admin Audit League', league_owner_id: adminId, admin_approved: true },
  });
  orgId = org.id;
  await prisma.organizationMembership.create({
    data: { organization_id: orgId, user_id: adminId, role: 'owner', status: 'active' },
  });
  const team = await prisma.team.create({
    data: { name: 'Admin Audit Team', organization_id: orgId, sport: 'basketball' },
  });
  teamId = team.id;
  await prisma.teamMembership.create({
    data: { team_id: teamId, user_id: adminId, role: 'owner', status: 'active' },
  });

  // ══════════════════════════════════════════
  // 1. ADMIN DASHBOARD
  // ══════════════════════════════════════════
  divider('1. ADMIN DASHBOARD — GET /admin/dashboard');
  const dash = await api('GET', '/admin/dashboard', undefined, adminToken);
  check('Dashboard returns 200', dash.status === 200);
  // Dashboard fields may vary — just check it returns an object with data
  const dashKeys = dash.data ? Object.keys(dash.data) : [];
  check('Dashboard has data fields', dashKeys.length > 0);
  if (dash.status === 200) {
    console.log(`  📊 Fields: ${dashKeys.join(', ')}`);
  }

  // Non-admin blocked
  const dashNonAdmin = await api('GET', '/admin/dashboard', undefined, coachToken);
  check('Non-admin blocked from dashboard', dashNonAdmin.status === 403);

  // ══════════════════════════════════════════
  // 2. ADMIN METRICS
  // ══════════════════════════════════════════
  divider('2. ADMIN METRICS — GET /admin/metrics');
  const metrics = await api('GET', '/admin/metrics?range=7d', undefined, adminToken);
  check('Metrics returns 200', metrics.status === 200);

  // ══════════════════════════════════════════
  // 3. ADMIN REPORTS
  // ══════════════════════════════════════════
  divider('3. ADMIN REPORTS — GET /admin/reports');
  const reports = await api('GET', '/admin/reports', undefined, adminToken);
  check('Reports returns 200', reports.status === 200);
  const reportStats = await api('GET', '/admin/reports/stats', undefined, adminToken);
  check('Report stats returns 200', reportStats.status === 200);

  // ══════════════════════════════════════════
  // 4. ADMIN TRANSACTIONS
  // ══════════════════════════════════════════
  divider('4. ADMIN TRANSACTIONS — GET /admin/transactions');
  const txns = await api('GET', '/admin/transactions', undefined, adminToken);
  check('Transactions returns 200', txns.status === 200);
  const txnSummary = await api('GET', '/admin/transactions/summary', undefined, adminToken);
  check('Transaction summary returns 200', txnSummary.status === 200);

  // ══════════════════════════════════════════
  // 5. ADMIN ACTIVITY LOG
  // ══════════════════════════════════════════
  divider('5. ADMIN ACTIVITY LOG — GET /admin/activity-log');
  const actLog = await api('GET', '/admin/activity-log', undefined, adminToken);
  check('Activity log returns 200', actLog.status === 200);

  // ══════════════════════════════════════════
  // 6. USER MANAGEMENT (warn, suspend, ban)
  // ══════════════════════════════════════════
  divider('6. USER MANAGEMENT — warn/suspend/ban');

  // Create a test target user
  const target = await prisma.user.create({
    data: {
      email: `target_${ts}@test.local`, password_hash: hashedPw,
      display_name: 'Target', username: `target_${ts}`.slice(0, 20),
      email_verified: true, approval_status: 'APPROVED',
      preferences: { role: 'fan', onboarding_completed: true, plan: 'rookie' },
    },
  });
  cleanup.push(target.id);
  const targetLogin = await api('POST', '/auth/login', { email: `target_${ts}@test.local`, password: PASSWORD });
  const targetToken = targetLogin.data?.access_token;

  // Warn
  const warn = await api('POST', `/admin/users/${target.id}/warn`, { severity: 'warning', reason: 'Test warning' }, adminToken);
  check('Warn user returns 200', warn.status === 200);

  // Suspend (7 days)
  const suspend = await api('POST', `/admin/users/${target.id}/suspend`, { days: 7, reason: 'Test suspension' }, adminToken);
  check('Suspend user returns 200', suspend.status === 200);

  // Verify suspended user is blocked
  const targetMe = await api('GET', '/auth/me', undefined, targetToken);
  check('Suspended user blocked from /me', targetMe.status === 401 || targetMe.data?.id === undefined);

  // Un-suspend by clearing ban
  await prisma.user.update({ where: { id: target.id }, data: { banned: false, banned_until: null } });

  // Ban
  const ban = await api('POST', `/admin/users/${target.id}/ban`, { reason: 'Test ban' }, adminToken);
  check('Ban user returns 200', ban.status === 200);

  // Verify banned user is blocked
  const targetMe2 = await api('GET', '/auth/me', undefined, targetToken);
  check('Banned user blocked from /me', targetMe2.status === 401 || targetMe2.data?.id === undefined);

  // Un-ban for cleanup
  await prisma.user.update({ where: { id: target.id }, data: { banned: false } });

  // ══════════════════════════════════════════
  // 7. LEAGUE APPROVAL (email link simulation)
  // ══════════════════════════════════════════
  divider('7. LEAGUE APPROVAL — POST /organizations/:id/approve');

  // Create unapproved org
  const pendingOrg = await prisma.organization.create({
    data: { name: 'Pending Approval League', league_owner_id: coachId, admin_approved: false },
  });
  await prisma.organizationMembership.create({
    data: { organization_id: pendingOrg.id, user_id: coachId, role: 'owner', status: 'active' },
  });
  await prisma.user.update({ where: { id: coachId }, data: { approval_status: 'PENDING' } });

  // Admin approves
  const approveOrg = await api('POST', `/organizations/${pendingOrg.id}/approve`, {}, adminToken);
  check('League approval returns 200', approveOrg.status === 200);

  const orgAfter = await prisma.organization.findUnique({ where: { id: pendingOrg.id }, select: { admin_approved: true } });
  check('Org admin_approved is true', orgAfter?.admin_approved === true);

  const coachAfter = await prisma.user.findUnique({ where: { id: coachId }, select: { approval_status: true } });
  check('Coach approval_status is APPROVED', coachAfter?.approval_status === 'APPROVED');

  // Check notification
  const notif = await prisma.notification.findFirst({
    where: { user_id: coachId, type: 'ORG_APPROVED' },
  });
  check('ORG_APPROVED notification created', !!notif);

  // ══════════════════════════════════════════
  // 8. LEAGUE REJECTION
  // ══════════════════════════════════════════
  divider('8. LEAGUE REJECTION — POST /organizations/:id/reject');

  const pendingOrg2 = await prisma.organization.create({
    data: { name: 'Will Be Rejected League', league_owner_id: coachId, admin_approved: false },
  });
  await prisma.organizationMembership.create({
    data: { organization_id: pendingOrg2.id, user_id: coachId, role: 'owner', status: 'active' },
  });
  await prisma.user.update({ where: { id: coachId }, data: { approval_status: 'PENDING' } });

  const rejectOrg = await api('POST', `/organizations/${pendingOrg2.id}/reject`, { reason: 'Invalid documentation' }, adminToken);
  check('League rejection returns 200', rejectOrg.status === 200);

  const coachAfterReject = await prisma.user.findUnique({ where: { id: coachId }, select: { approval_status: true } });
  check('Coach set to REJECTED after league rejection', coachAfterReject?.approval_status === 'REJECTED');

  // Reset coach for further tests
  await prisma.user.update({ where: { id: coachId }, data: { approval_status: 'APPROVED' } });

  // ══════════════════════════════════════════
  // 9. COACH APPROVAL (from league owner)
  // ══════════════════════════════════════════
  divider('9. COACH APPROVAL — from league owner');

  const pendingCoach = await prisma.user.create({
    data: {
      email: `pendingcoach_${ts}@test.local`, password_hash: hashedPw,
      display_name: 'Pending Coach', username: `pcoach_${ts}`.slice(0, 20),
      email_verified: true, approval_status: 'PENDING',
      preferences: { role: 'coach', onboarding_completed: true, plan: 'rookie' },
    },
  });
  cleanup.push(pendingCoach.id);

  await prisma.organizationJoinRequest.create({
    data: { organization_id: orgId, user_id: pendingCoach.id, status: 'pending' },
  });

  // Admin (org owner) approves
  const approveCoach = await api('POST', `/organizations/${orgId}/coaches/${pendingCoach.id}/approve`, { team_id: teamId }, adminToken);
  check('Coach approval returns 200', approveCoach.status === 200);

  const pcAfter = await prisma.user.findUnique({ where: { id: pendingCoach.id }, select: { approval_status: true, paid_by_owner: true } });
  check('Coach is APPROVED', pcAfter?.approval_status === 'APPROVED');
  check('Coach paid_by_owner is true', pcAfter?.paid_by_owner === true);

  // ══════════════════════════════════════════
  // 10. AD MANAGEMENT
  // ══════════════════════════════════════════
  divider('10. AD MANAGEMENT — review ads');

  // Create a test ad
  const ad = await prisma.ad.create({
    data: {
      user: { connect: { id: coachId } },
      business_name: 'Test Biz',
      description: 'Test ad description',
      status: 'pending',
    },
  });

  // Admin reviews (approve)
  const reviewAd = await api('POST', `/ads/${ad.id}/review`, { action: 'approve', note: 'Looks good' }, adminToken);
  check('Ad approve returns 200', reviewAd.status === 200);

  const adAfter = await prisma.ad.findUnique({ where: { id: ad.id }, select: { status: true, admin_note: true } });
  check('Ad status is approved', adAfter?.status === 'approved');
  check('Admin note saved', adAfter?.admin_note === 'Looks good');

  // Check ad notification
  const adNotif = await prisma.notification.findFirst({
    where: { user_id: coachId, type: 'AD_APPROVED' },
  });
  check('AD_APPROVED notification created', !!adNotif);

  // Create another ad to reject
  const ad2 = await prisma.ad.create({
    data: {
      user: { connect: { id: coachId } },
      business_name: 'Bad Biz',
      description: 'Bad ad description',
      status: 'pending',
    },
  });

  const rejectAd = await api('POST', `/ads/${ad2.id}/review`, { action: 'reject', note: 'Inappropriate content' }, adminToken);
  check('Ad reject returns 200', rejectAd.status === 200);

  const ad2After = await prisma.ad.findUnique({ where: { id: ad2.id }, select: { status: true, admin_note: true } });
  check('Ad status reset to draft (for resubmission)', ad2After?.status === 'draft');
  check('Rejection note saved', ad2After?.admin_note === 'Inappropriate content');

  // ══════════════════════════════════════════
  // 11. EVENT APPROVAL
  // ══════════════════════════════════════════
  divider('11. EVENT APPROVAL');

  const event = await prisma.event.create({
    data: {
      title: 'Test Event',
      date: new Date(Date.now() + 86400000),
      location: 'Test Venue',
      creator_id: coachId,
      status: 'draft',
      approval_status: 'pending',
    },
  });

  const approveEvent = await api('PUT', `/events/${event.id}/approve`, {}, adminToken);
  check('Event approve returns 200', approveEvent.status === 200);

  const eventNotif = await prisma.notification.findFirst({
    where: { user_id: coachId, type: 'EVENT_APPROVED' },
  });
  check('EVENT_APPROVED notification created', !!eventNotif);

  // ══════════════════════════════════════════
  // 12. ADMIN AUTH SECURITY
  // ══════════════════════════════════════════
  divider('12. ADMIN AUTH — non-admin blocked everywhere');

  const endpoints = [
    ['GET', '/admin/dashboard'],
    ['GET', '/admin/metrics'],
    ['GET', '/admin/reports'],
    ['GET', '/admin/transactions'],
    ['GET', '/admin/activity-log'],
    ['POST', `/admin/users/${target.id}/warn`],
    ['POST', `/admin/users/${target.id}/suspend`],
    ['POST', `/admin/users/${target.id}/ban`],
  ];

  let allBlocked = true;
  for (const [method, path] of endpoints) {
    const r = await api(method, path, method === 'POST' ? { reason: 'test' } : undefined, coachToken);
    if (r.status !== 403) { allBlocked = false; console.log(`  ❌ ${method} ${path} returned ${r.status} (expected 403)`); }
  }
  check('All admin endpoints return 403 for non-admin', allBlocked);

  // No auth at all
  const noAuth = await api('GET', '/admin/dashboard');
  check('No auth returns 401', noAuth.status === 401);

  // ── Cleanup ──
  divider('CLEANUP');
  await prisma.notification.deleteMany({ where: { user_id: { in: cleanup } } }).catch(() => {});
  await prisma.notification.deleteMany({ where: { user_id: coachId } }).catch(() => {});
  await prisma.event.deleteMany({ where: { id: event.id } }).catch(() => {});
  await prisma.ad.deleteMany({ where: { id: { in: [ad.id, ad2.id] } } }).catch(() => {});
  await prisma.organizationJoinRequest.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
  await prisma.teamMembership.deleteMany({ where: { team_id: teamId } }).catch(() => {});
  await prisma.team.deleteMany({ where: { id: teamId } }).catch(() => {});
  await prisma.organizationMembership.deleteMany({ where: { organization_id: { in: [orgId, pendingOrg.id, pendingOrg2.id] } } }).catch(() => {});
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, pendingOrg.id, pendingOrg2.id] } } }).catch(() => {});
  await prisma.refreshToken.deleteMany({ where: { user_id: { in: cleanup } } }).catch(() => {});
  await prisma.user.deleteMany({ where: { id: { in: cleanup } } }).catch(() => {});
  console.log('🗑️  Cleaned up');

  // ── SCORECARD ──
  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║              ADMIN TOOLS SCORECARD                      ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Passed: ${String(passed).padEnd(3)} / ${String(passed + failed).padEnd(3)}                                   ║`);
  console.log(`║  ❌ Failed: ${String(failed).padEnd(3)}                                          ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  if (failed === 0) {
    console.log('║  🏆 ALL ADMIN TOOLS WORKING                             ║');
  } else {
    console.log('║  ⚠️  ISSUES FOUND — Review failures above               ║');
  }
  console.log('╚══════════════════════════════════════════════════════════╝');
}

main()
  .catch(err => { console.error('💥 Script error:', err); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
