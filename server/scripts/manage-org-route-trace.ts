/**
 * Traces the Discover "Manage Org" quick action end-to-end:
 * tap → GET /organizations/mine/review-summaries → router.push('/organization', { id })
 * → GET /organizations/:id.
 *
 * Covers both ownership shapes:
 *  1. owner WITH an OrganizationMembership row (modern orgs)
 *  2. owner via league_owner_id ONLY (legacy orgs, no membership row)
 */
import { prisma } from '../src/lib/prisma.js';

const BASE = 'http://localhost:4000';
let pass = 0,
  fail = 0;
const ok = (l: string, c: boolean, d?: unknown) => {
  console.log(`   ${c ? '✅' : '❌'} ${l}${d !== undefined ? ` — ${JSON.stringify(d)}` : ''}`);
  c ? pass++ : fail++;
};

async function mkUser(tag: string) {
  const email = `mo_${tag}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.app`;
  const reg = await (
    await fetch(`${BASE}/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'TestPass123!',
        display_name: `MO ${tag}`,
        role: 'fan',
      }),
    })
  ).json();
  await prisma.user.update({
    where: { id: reg.user.id },
    data: {
      email_verified: true,
      date_of_birth: new Date('1990-01-01'),
      dob_set_at: new Date(),
    },
  });
  return { id: reg.user.id as string, token: reg.access_token as string };
}

async function getJson(path: string, token: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON */
  }
  return { status: res.status, body };
}

async function main() {
  const cleanup: Array<() => Promise<unknown>> = [];
  try {
    // ── Case 1: owner with membership row (modern shape) ──
    console.log('\n▶ Case 1: owner WITH membership row');
    const u1 = await mkUser('modern');
    const org1 = await prisma.organization.create({
      data: {
        name: `MO Modern Org ${Date.now()}`,
        league_owner_id: u1.id,
        admin_approved: true,
        approved_at: new Date(),
      },
      select: { id: true },
    });
    await prisma.organizationMembership.create({
      data: { organization_id: org1.id, user_id: u1.id, role: 'owner', status: 'active' },
    });
    cleanup.push(async () => {
      await prisma.organizationMembership.deleteMany({ where: { organization_id: org1.id } });
      await prisma.organization.delete({ where: { id: org1.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: u1.id } }).catch(() => {});
    });

    let r = await getJson('/organizations/mine/review-summaries', u1.token);
    ok('review-summaries → 200', r.status === 200, r.status);
    const found1 =
      Array.isArray(r.body) && r.body.some((s: any) => s?.organization?.id === org1.id);
    ok('summary includes the owned org', found1, Array.isArray(r.body) ? r.body.length : r.body);

    r = await getJson(`/organizations/${org1.id}`, u1.token);
    ok('GET /organizations/:id → 200 (org page loads)', r.status === 200, r.status);

    // ── Case 2: owner via league_owner_id only (legacy shape) ──
    console.log('\n▶ Case 2: owner via league_owner_id ONLY (no membership row)');
    const u2 = await mkUser('legacy');
    const org2 = await prisma.organization.create({
      data: {
        name: `MO Legacy Org ${Date.now()}`,
        league_owner_id: u2.id,
        admin_approved: true,
        approved_at: new Date(),
      },
      select: { id: true },
    });
    cleanup.push(async () => {
      await prisma.organizationMembership.deleteMany({ where: { organization_id: org2.id } });
      await prisma.organization.delete({ where: { id: org2.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: u2.id } }).catch(() => {});
    });

    r = await getJson('/organizations/mine/review-summaries', u2.token);
    ok('review-summaries → 200', r.status === 200, r.status);
    const found2 =
      Array.isArray(r.body) && r.body.some((s: any) => s?.organization?.id === org2.id);
    ok(
      'summary includes league_owner_id org (Manage Org would navigate)',
      found2,
      Array.isArray(r.body) ? r.body.length : r.body
    );

    r = await getJson(`/organizations/${org2.id}`, u2.token);
    ok('GET /organizations/:id → 200 (org page loads)', r.status === 200, r.status);
  } finally {
    for (const fn of cleanup.reverse()) await fn().catch(() => {});
    await prisma.$disconnect();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail > 0 ? 1 : 0);
}

void main();
