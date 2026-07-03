/**
 * Reproduces the ad submit-for-approval flow to prove whether the admin
 * notification email code path is actually reached. Local SendGrid creds are
 * placeholders, so a REAL send won't go out — but if the code path runs, the
 * server logs an `[email]` line (success or "not configured"). Watch /tmp/vh-server.log.
 */
import { prisma } from '../src/lib/prisma.js';

const BASE = process.env.BASE_URL || 'http://localhost:4000';

async function http(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text };
}

async function main() {
  const email = `e2e_ad_${Date.now()}@test.varsityhub.app`;
  let userId = '';
  let adId = '';
  try {
    const reg = await http('POST', '/auth/register', { email, password: 'TestPass123!', display_name: 'E2E Ad User', role: 'fan' });
    userId = JSON.parse(reg.text)?.user?.id;
    const token = JSON.parse(reg.text)?.access_token;
    await prisma.user.update({ where: { id: userId }, data: { email_verified: true, onboarding_completed: true } });
    console.log(`\n▶ user ${userId} (NOT the demo account → bypassApproval should be false)`);

    // Seed a draft ad directly (ad creation isn't under test; the submit→email is).
    const ad = await (prisma.ad.create as any)({
      data: {
        user_id: userId,
        business_name: 'E2E Test Biz',
        contact_name: 'Test Contact',
        contact_email: 'advertiser@test.com',
        status: 'draft',
        payment_status: 'pending_approval',
      },
      select: { id: true, status: true },
    });
    adId = ad.id;
    console.log(`▶ seeded draft ad ${adId} (${ad.status})`);

    // Hit the REAL submit-for-approval endpoint (the one that emails admins).
    const submit = await http('POST', `/ads/${adId}/submit-for-approval`, {}, token);
    console.log('▶ POST /ads/:id/submit-for-approval →', submit.status, submit.text.slice(0, 120));

    const after = await (prisma.ad.findUnique as any)({ where: { id: adId }, select: { status: true, payment_status: true } });
    console.log('▶ ad status after submit:', after);

    // Give the fire-and-forget email a beat to log.
    await new Promise(r => setTimeout(r, 1500));
    console.log('\n▶ Now grep /tmp/vh-server.log for [email] lines — if present, the send code RAN.');
  } finally {
    if (adId) await (prisma.ad.deleteMany as any)({ where: { id: adId } }).catch(() => {});
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => {});
    console.log('🧹 cleaned up');
    await prisma.$disconnect();
    process.exit(0);
  }
}
main().catch(e => { console.error('ERR:', e); process.exit(1); });
