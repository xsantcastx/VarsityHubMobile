/**
 * PRODUCTION EMAIL DIAGNOSTIC
 *
 * Tests against production Railway server to verify email delivery.
 * Run this AFTER deploying the latest code.
 */

const PROD_BASE = 'https://api-production-8ac3.up.railway.app';

async function api(method: string, path: string, body?: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  console.log(`→ ${method} ${PROD_BASE}${path}`);
  const res = await fetch(PROD_BASE + path, opts);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  console.log(`← ${res.status} ${typeof data === 'string' ? data.substring(0, 200) : JSON.stringify(data).substring(0, 200)}`);
  return { status: res.status, data };
}

async function main() {
  console.log('🔍 PRODUCTION EMAIL DIAGNOSTIC');
  console.log('================================\n');

  // 1. Check production health
  console.log('1. Production server health:');
  const health = await api('GET', '/health');
  console.log(`   Status: ${health.data?.status}\n`);

  // 2. Try to login as admin
  console.log('2. Login as admin:');
  const login = await api('POST', '/auth/login', {
    email: 'sanchezemil203@gmail.com',
    password: 'YOUR_PRODUCTION_PASSWORD', // Replace with actual
  });

  if (login.status !== 200) {
    console.log('   ❌ Cannot login — replace password in script or test manually');
    console.log('\n   Manual test: Open the Approve League email link in your browser.');
    console.log('   You should see an HTML page with "Approve this league?" and a green button.');
    console.log('   Click the button. You should see "League Approved" confirmation.');
    console.log('   Then check:');
    console.log('     - SendGrid Activity dashboard for emails sent in last hour');
    console.log('     - The coach who created the league should see ORG_APPROVED notification');
    console.log('     - The coach\'s approval_status should be APPROVED in the database');
    return;
  }

  const adminToken = login.data.access_token;
  console.log('   ✅ Logged in\n');

  // 3. Check admin dashboard
  console.log('3. Admin dashboard:');
  const dash = await api('GET', '/admin/dashboard', undefined, adminToken);
  if (dash.status === 200) {
    const d = dash.data;
    console.log(`   Users: ${d.totalUsers}, Teams: ${d.totalTeams}, Ads: ${d.totalAds}, Pending Ads: ${d.pendingAds}\n`);
  }

  // 4. Check for pending organizations
  console.log('4. Checking for organizations needing approval...');
  // We can't directly query pending orgs without an admin endpoint, so check via dashboard
  console.log('   (Check admin dashboard in the app for pending leagues)\n');

  // 5. Test notifications endpoint
  console.log('5. Notifications endpoint:');
  const notifs = await api('GET', '/notifications?limit=5', undefined, adminToken);
  console.log(`   Status: ${notifs.status}, Count: ${Array.isArray(notifs.data?.items) ? notifs.data.items.length : 'N/A'}\n`);

  console.log('================================');
  console.log('DIAGNOSTIC COMPLETE\n');
  console.log('If the admin login fails, test manually:');
  console.log('1. Open the "Approve League" email link directly in your browser');
  console.log('2. You should see a confirmation page with a green "Approve League" button');
  console.log('3. Click it — you should see "League Approved" HTML page');
  console.log('4. Check SendGrid Activity Feed (sendgrid.com → Activity)');
  console.log('5. The league owner should get an approval email + push notification');
  console.log('\nIf you see "League Approved" but the coach never gets notified:');
  console.log('→ Check Railway logs for "[orgs] League approved email FAILED" errors');
  console.log('→ Check if the coach email is a real inbox (not test@test.local)');
  console.log('→ Check spam folder');
}

main().catch(console.error);
