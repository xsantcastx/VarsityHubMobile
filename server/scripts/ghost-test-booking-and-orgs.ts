#!/usr/bin/env npx tsx
import 'dotenv/config';

/**
 * GHOST TEST — Ad Booking (end-to-end) + Org/Team "every iteration"
 *
 * Runs against a LIVE local server (http://localhost:4000) + the real Postgres
 * DB. Exercises the REAL HTTP endpoints + Prisma transactions — not mocks.
 *
 * Coverage (the gaps not already covered by the dedicated approval traces):
 *   A. Org-type iterations ......... club / school / league (league → approval-pending)
 *   B. Plan-tier team limits ....... rookie cap (3), legend unlimited, veteran-no-sub gate
 *   C. Extracurricular gating ...... rookie blocked, legend allowed (club_type)
 *   D. Membership join requests .... approve + reject + IDOR self-approve guard
 *   E. AD BOOKING END-TO-END ....... create → submit → admin approve → 100%-off promo
 *                                    → /payments/checkout → adReservation rows created
 *      + guardrails: RESERVATIONS_VIA_CHECKOUT_ONLY, 56-day booking horizon
 *
 * Charge-free by design: the 100%-off booking promo drives the REAL checkout
 * endpoint and creates REAL paid/active reservations without touching a card.
 *
 * Prereqs that aren't themselves under test (email verify, DOB, onboarding,
 * coach approval) are seeded directly via Prisma — they each have their own
 * dedicated trace script.
 *
 * Usage:
 *   PORT=4000 npx tsx src/index.ts          # in one terminal
 *   npx tsx scripts/ghost-test-booking-and-orgs.ts
 */
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../src/lib/prisma.js';

const BASE = (process.env.BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const RUN = Date.now().toString(36);

let pass = 0;
let fail = 0;
const failures: string[] = [];
function section(label: string) {
  console.log('\n' + '═'.repeat(64) + `\n  ${label}\n` + '═'.repeat(64));
}
function check(label: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass++;
    console.log(`  ✅ ${label}${detail !== undefined ? ` — ${detail}` : ''}`);
  } else {
    fail++;
    failures.push(label);
    console.log(`  ❌ ${label}${detail !== undefined ? ` — ${detail}` : ''}`);
  }
}

async function http(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-idempotency-key': crypto.randomUUID(),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data, text };
}

// ── cleanup tracking ────────────────────────────────────────────────────────
const createdUserIds = new Set<string>();
const createdOrgIds = new Set<string>();
const createdAdIds = new Set<string>();
const createdPromoCodes = new Set<string>();

async function register(emailTag: string) {
  // Always register as a fan; coach role + approval are elevated via seedUser
  // (registering directly as coach follows a different, non-token response path).
  const email = `ghost_${emailTag}_${RUN}@test.varsityhub.app`;
  const r = await http('POST', '/auth/register', {
    email,
    password: 'TestPass123!',
    display_name: `Ghost ${emailTag}`,
    role: 'fan',
  });
  const id = r.data?.user?.id;
  const token = r.data?.access_token;
  if (id) createdUserIds.add(id);
  if (!id) console.log(`     ⚠️ register(${emailTag}) returned no id — status ${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
  return { email, id, token, status: r.status };
}

/** Seed the prerequisites (verify/onboard/role/approval/plan/org) directly. */
async function seedUser(
  id: string,
  opts: { plan?: 'rookie' | 'veteran' | 'legend'; orgId?: string; coach?: boolean } = {}
) {
  await prisma.user.update({
    where: { id },
    data: {
      email_verified: true,
      onboarding_completed: true,
      date_of_birth: new Date('1990-01-01'),
      dob_set_at: new Date(),
      ...(opts.coach
        ? {
            role: 'coach',
            approval_status: 'APPROVED',
            coach_agreement_accepted_at: new Date(),
            coach_agreement_version: 1,
          }
        : {}),
      ...(opts.plan ? { plan: opts.plan } : {}),
      ...(opts.orgId ? { organization_id: opts.orgId } : {}),
    },
  });
}

async function ensureAdmin() {
  const email = 'admin@varsityhub.app';
  const password_hash = await bcrypt.hash('AdminPass123!', 10);
  const user = await prisma.user.upsert({
    where: { email },
    update: { email_verified: true, onboarding_completed: true, password_hash },
    create: {
      email,
      password_hash,
      display_name: 'Ghost Admin',
      username: `ghostadmin_${RUN}`,
      email_verified: true,
      onboarding_completed: true,
      role: 'fan',
    },
    select: { id: true },
  });
  const login = await http('POST', '/auth/login', { email, password: 'AdminPass123!' });
  return { id: user.id, token: login.data?.access_token, status: login.status };
}

async function createOrg(token: string, name: string, orgType: string) {
  const r = await http(
    'POST',
    '/organizations',
    {
      name,
      description: `Ghost ${orgType} org`,
      sport: 'basketball',
      org_type: orgType,
      location: 'New Haven, CT',
      zip_code: '06510',
      supporting_document_url: 'https://example.com/ghost-supporting-doc.pdf',
    },
    token
  );
  if (r.data?.id) createdOrgIds.add(r.data.id);
  return r;
}

async function createTeam(token: string, orgId: string, name: string, extra: Record<string, unknown> = {}) {
  // club_type/extracurricular_category are only accepted by POST /teams/create
  // (the primary POST /teams schema strips them → always 'sport'). Route
  // extracurricular requests to the club-capable endpoint.
  const isClub = extra.club_type === 'extracurricular';
  return http(
    'POST',
    isClub ? '/teams/create' : '/teams',
    {
      name,
      description: 't',
      organization_id: orgId,
      season_start: '2026-03-01',
      season_end: '2026-06-30',
      ...extra,
    },
    token
  );
}

async function main() {
  console.log(`\n🎯 Ghost test — booking + org/team iterations  (run ${RUN})  → ${BASE}`);

  // ── Admin ───────────────────────────────────────────────────────────────
  section('SETUP — platform admin');
  const admin = await ensureAdmin();
  check('admin login returns token', !!admin.token, `status ${admin.status}`);
  if (!admin.token) throw new Error('cannot continue without admin token');

  // ════════════════════════════════════════════════════════════════════════
  section('A. ORG-TYPE ITERATIONS — club / school / league');
  // A coach may only own ONE active organization, so each org type uses a
  // fresh coach owner.
  // ════════════════════════════════════════════════════════════════════════
  const clubCoach = await register('clubcoach');
  await seedUser(clubCoach.id!, { coach: true });
  const club = await createOrg(clubCoach.token!, `Ghost Alpha ${RUN} Club`, 'club');
  check('create club org (200/201)', club.status === 200 || club.status === 201, `status ${club.status} ${JSON.stringify(club.data).slice(0, 100)}`);
  check("club org_type persisted as 'club'", club.data?.org_type === 'club', club.data?.org_type);

  const schoolCoach = await register('schoolcoach');
  await seedUser(schoolCoach.id!, { coach: true });
  const school = await createOrg(schoolCoach.token!, `Ghost Bravo ${RUN} School`, 'school');
  check('create school org (200/201)', school.status === 200 || school.status === 201, `status ${school.status} ${JSON.stringify(school.data).slice(0, 100)}`);
  check("school org_type persisted as 'school'", school.data?.org_type === 'school', school.data?.org_type);

  const leagueCoach = await register('leaguecoach');
  await seedUser(leagueCoach.id!, { coach: true });
  const league = await createOrg(leagueCoach.token!, `Ghost Charlie ${RUN} League`, 'league');
  check('create league org (200/201)', league.status === 200 || league.status === 201, `status ${league.status} ${JSON.stringify(league.data).slice(0, 100)}`);
  if (league.data?.id) {
    const leagueRow = await prisma.organization.findUnique({
      where: { id: league.data.id },
      select: { admin_approved: true, org_type: true },
    });
    check("league org_type persisted as 'league'", leagueRow?.org_type === 'league', leagueRow?.org_type);
    check(
      'league starts NOT admin-approved (approval pending)',
      leagueRow?.admin_approved !== true,
      `admin_approved=${leagueRow?.admin_approved}`
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  section('B. PLAN-TIER TEAM LIMITS');
  // ════════════════════════════════════════════════════════════════════════

  // ── Rookie: cap at 3 teams (coach owns their own club org) ────────────────
  const rookie = await register('rookie');
  await seedUser(rookie.id!, { coach: true });
  const rookieOrgRes = await createOrg(rookie.token!, `Ghost Rookie Org ${RUN}`, 'club');
  const rookieOrg = rookieOrgRes.data?.id;
  await seedUser(rookie.id!, { coach: true, plan: 'rookie', orgId: rookieOrg });

  const rLimits = await http('GET', '/teams/limits', undefined, rookie.token);
  check('rookie /teams/limits max_teams === 3', rLimits.data?.max_teams === 3, JSON.stringify(rLimits.data));

  let rookieCreated = 0;
  for (let i = 1; i <= 3; i++) {
    const t = await createTeam(rookie.token!, rookieOrg, `Rookie Team ${i} ${RUN}`);
    if (t.status === 200 || t.status === 201) rookieCreated++;
    else console.log(`     (team ${i} → ${t.status} ${JSON.stringify(t.data).slice(0, 120)})`);
  }
  check('rookie can create exactly 3 teams', rookieCreated === 3, `created ${rookieCreated}`);

  const t4 = await createTeam(rookie.token!, rookieOrg, `Rookie Team 4 ${RUN}`);
  check(
    'rookie 4th team BLOCKED (TEAM_LIMIT_EXCEEDED)',
    t4.status >= 400 && (t4.data?.code === 'TEAM_LIMIT_EXCEEDED' || /limit/i.test(JSON.stringify(t4.data))),
    `status ${t4.status} code ${t4.data?.code}`
  );

  // ── Rookie extracurricular club BLOCKED ───────────────────────────────────
  const rExtra = await createTeam(rookie.token!, rookieOrg, `Rookie Chess Club ${RUN}`, {
    club_type: 'extracurricular',
    extracurricular_category: 'Chess',
  });
  check(
    'rookie extracurricular club BLOCKED (Legend required)',
    rExtra.status >= 400 && /legend|extracurricular/i.test(JSON.stringify(rExtra.data)),
    `status ${rExtra.status} ${JSON.stringify(rExtra.data).slice(0, 140)}`
  );

  // ── Legend: unlimited teams + extracurricular allowed (own org) ───────────
  const legend = await register('legend');
  await seedUser(legend.id!, { coach: true });
  const legendOrgRes = await createOrg(legend.token!, `Ghost Legend Org ${RUN}`, 'club');
  const legendOrg = legendOrgRes.data?.id;
  await seedUser(legend.id!, { coach: true, plan: 'legend', orgId: legendOrg });

  const lLimits = await http('GET', '/teams/limits', undefined, legend.token);
  check(
    'legend /teams/limits is unlimited (can_create_more)',
    lLimits.data?.can_create_more === true,
    JSON.stringify(lLimits.data)
  );

  // 4 teams = one past the rookie cap of 3 (stays within the 5/24h create limit)
  let legendCreated = 0;
  for (let i = 1; i <= 4; i++) {
    const t = await createTeam(legend.token!, legendOrg, `Legend Team ${i} ${RUN}`);
    if (t.status === 200 || t.status === 201) legendCreated++;
    else console.log(`     (legend team ${i} → ${t.status} ${JSON.stringify(t.data).slice(0, 120)})`);
  }
  check('legend can create 4 teams (past rookie cap of 3)', legendCreated === 4, `created ${legendCreated}`);

  const lExtra = await createTeam(legend.token!, legendOrg, `Legend Theater Club ${RUN}`, {
    club_type: 'extracurricular',
    extracurricular_category: 'Theater',
  });
  check('legend extracurricular club ALLOWED', lExtra.status === 200 || lExtra.status === 201, `status ${lExtra.status}`);

  // ── Veteran without subscription: per-team billing gate ───────────────────
  const vet = await register('veteran');
  await seedUser(vet.id!, { coach: true, plan: 'veteran' });
  const vLimits = await http('GET', '/teams/limits', undefined, vet.token);
  check(
    'veteran w/o active subscription requires upgrade (can_create_more=false)',
    vLimits.data?.can_create_more === false && vLimits.data?.upgrade_required === true,
    JSON.stringify(vLimits.data)
  );

  // ════════════════════════════════════════════════════════════════════════
  section('C. TEAM MEMBERSHIP — join request approve / reject / IDOR guard');
  // ════════════════════════════════════════════════════════════════════════
  // Use one of the rookie coach's teams as the join target.
  const targetTeam = await prisma.team.findFirst({
    where: { name: { startsWith: `Rookie Team 1 ${RUN}` } },
    select: { id: true },
  });
  if (targetTeam) {
    const joiner = await register('joiner');
    await seedUser(joiner.id!);

    const jr = await http('POST', '/team-memberships/join-requests', { team_id: targetTeam.id, message: 'let me in' }, joiner.token);
    check('fan can submit a join request', jr.status === 200 || jr.status === 201, `status ${jr.status}`);
    const joinReqId = jr.data?.join_request?.id;
    check('join request returns an id', !!joinReqId, JSON.stringify(jr.data).slice(0, 120));

    // IDOR: the requester must not approve their own pending request.
    const selfApprove = await http('POST', `/team-memberships/join-requests/${joinReqId}/approve`, {}, joiner.token);
    check('IDOR guard — requester cannot approve own join request', selfApprove.status === 403, `status ${selfApprove.status}`);

    const approve = await http('POST', `/team-memberships/join-requests/${joinReqId}/approve`, {}, rookie.token);
    check('team owner approves join request (200)', approve.status === 200, `status ${approve.status}`);

    // Second request → reject path
    const joiner2 = await register('joiner2');
    await seedUser(joiner2.id!);
    const jr2 = await http('POST', '/team-memberships/join-requests', { team_id: targetTeam.id, message: 'me too' }, joiner2.token);
    const joinReqId2 = jr2.data?.join_request?.id;
    const reject = await http('POST', `/team-memberships/join-requests/${joinReqId2}/reject`, { reason: 'roster full' }, rookie.token);
    check('team owner rejects join request (200)', reject.status === 200, `status ${reject.status}`);
  } else {
    check('join-request target team found', false, 'no rookie team to target');
  }

  // ════════════════════════════════════════════════════════════════════════
  section('D. AD BOOKING — END TO END (create → submit → approve → pay → reserve)');
  // ════════════════════════════════════════════════════════════════════════
  const advertiser = await register('advertiser');
  await seedUser(advertiser.id!);

  // 1. Create draft ad
  const zip = '06511';
  const adRes = await http(
    'POST',
    '/ads',
    {
      contact_name: 'Ghost Advertiser',
      contact_email: 'ads@test.varsityhub.app',
      business_name: `Ghost Biz ${RUN}`,
      target_zip_code: zip,
      target_url: 'https://example.com',
      description: 'Ghost booking test ad',
    },
    advertiser.token
  );
  const adId = adRes.data?.id;
  if (adId) createdAdIds.add(adId);
  check('advertiser creates draft ad', !!adId && (adRes.status === 200 || adRes.status === 201), `status ${adRes.status}`);

  // 2. Guardrail — direct reservation creation is forbidden
  const directRes = await http('POST', '/ads/reservations', { ad_id: adId, dates: ['2026-07-01'] }, advertiser.token);
  check(
    'GUARDRAIL: POST /ads/reservations blocked (RESERVATIONS_VIA_CHECKOUT_ONLY)',
    directRes.status === 403 && directRes.data?.error === 'RESERVATIONS_VIA_CHECKOUT_ONLY',
    `status ${directRes.status}`
  );

  // 3. Submit for approval
  const submit = await http('POST', `/ads/${adId}/submit-for-approval`, {}, advertiser.token);
  check('ad submitted for approval', submit.status === 200, `status ${submit.status} → ${submit.data?.status}`);

  // 4. Admin approves via the real admin-auth dashboard route
  const approve = await http('POST', `/ads/${adId}/approve`, { note: 'ghost approve' }, admin.token);
  check('admin approves ad (200)', approve.status === 200, `status ${approve.status}`);
  const adAfterApprove = await prisma.ad.findUnique({ where: { id: adId }, select: { status: true } });
  check("ad status === 'approved' after admin approve", adAfterApprove?.status === 'approved', adAfterApprove?.status);

  // 5. GUARDRAIL — booking horizon: a date >56 days out must be rejected
  const farDate = new Date(Date.now() + 70 * 86400_000).toISOString().slice(0, 10);
  const farCheckout = await http('POST', '/payments/checkout', { ad_id: adId, dates: [farDate] }, advertiser.token);
  check(
    'GUARDRAIL: booking >56 days rejected',
    farCheckout.status >= 400 && /56 days/i.test(JSON.stringify(farCheckout.data)),
    `status ${farCheckout.status}`
  );

  // 6. Create a 100%-off booking promo (charge-free real checkout)
  const promoCode = `GHOSTFREE${RUN}`.toUpperCase();
  await prisma.promoCode.create({
    data: {
      code: promoCode,
      type: 'PERCENT_OFF',
      percent_off: 100,
      enabled: true,
      applies_to_service: 'booking',
      per_user_limit: 5,
      note: 'ghost test free booking',
    },
  });
  createdPromoCodes.add(promoCode);

  // 7. Checkout with the 100%-off promo → reservations created with no charge
  const goodDate1 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  const goodDate2 = new Date(Date.now() + 8 * 86400_000).toISOString().slice(0, 10);
  const checkout = await http(
    'POST',
    '/payments/checkout',
    { ad_id: adId, dates: [goodDate1, goodDate2], promo_code: promoCode },
    advertiser.token
  );
  check(
    'checkout with 100%-off promo succeeds (no charge)',
    checkout.status === 200,
    `status ${checkout.status} → ${JSON.stringify(checkout.data).slice(0, 140)}`
  );

  // 8. Verify the booking actually landed in the DB
  const reservations = await prisma.adReservation.findMany({ where: { ad_id: adId }, select: { date: true } });
  check('2 ad reservations created in DB', reservations.length === 2, `count ${reservations.length}`);
  const bookedAd = await prisma.ad.findUnique({ where: { id: adId }, select: { payment_status: true, status: true } });
  check(
    "booked ad is payment_status='paid' + status='active'",
    bookedAd?.payment_status === 'paid' && bookedAd?.status === 'active',
    `${bookedAd?.payment_status}/${bookedAd?.status}`
  );

  // 9. Financial audit trail row for the comped booking
  const audit = await prisma.transactionLog
    .findFirst({ where: { user_id: advertiser.id!, transaction_type: 'AD_PURCHASE' }, orderBy: { created_at: 'desc' } })
    .catch(() => null);
  check('AD_PURCHASE transaction logged for free promo', !!audit, audit ? 'logged' : 'missing');
}

async function cleanup() {
  section('CLEANUP');
  try {
    for (const code of createdPromoCodes) {
      await prisma.promoRedemption.deleteMany({ where: { promo: { code } } }).catch(() => {});
      await prisma.promoCode.deleteMany({ where: { code } }).catch(() => {});
    }
    for (const adId of createdAdIds) {
      await prisma.adReservation.deleteMany({ where: { ad_id: adId } }).catch(() => {});
      await prisma.ad.deleteMany({ where: { id: adId } }).catch(() => {});
    }
    // Teams + memberships + join requests are FK-bound to users/orgs; remove by owner.
    for (const uid of createdUserIds) {
      await prisma.transactionLog.deleteMany({ where: { user_id: uid } }).catch(() => {});
      await prisma.adminActivityLog.deleteMany({ where: { target_id: uid } }).catch(() => {});
    }
    for (const orgId of createdOrgIds) {
      const teams = await prisma.team.findMany({ where: { organization_id: orgId }, select: { id: true } }).catch(() => []);
      const teamIds = teams.map((t) => t.id);
      if (teamIds.length) {
        await prisma.teamJoinRequest.deleteMany({ where: { team_id: { in: teamIds } } }).catch(() => {});
        await prisma.teamMembership.deleteMany({ where: { team_id: { in: teamIds } } }).catch(() => {});
        await prisma.team.deleteMany({ where: { id: { in: teamIds } } }).catch(() => {});
      }
      await prisma.organizationMembership.deleteMany({ where: { organization_id: orgId } }).catch(() => {});
      await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => {});
    }
    for (const uid of createdUserIds) {
      await prisma.teamMembership.deleteMany({ where: { user_id: uid } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: uid } }).catch(() => {});
    }
    console.log('  🧹 cleaned up ghost users / orgs / teams / ads / promo');
  } catch (e) {
    console.log('  ⚠️  cleanup encountered an issue:', (e as any)?.message || e);
  }
}

main()
  .catch((err) => {
    fail++;
    failures.push(`UNCAUGHT: ${err?.message || err}`);
    console.error('\n💥 TRACE ERROR:', err);
  })
  .finally(async () => {
    await cleanup();
    console.log('\n' + '═'.repeat(64));
    console.log(`  RESULT: ${pass} passed, ${fail} failed`);
    if (failures.length) console.log('  FAILED:\n   - ' + failures.join('\n   - '));
    console.log('═'.repeat(64));
    await prisma.$disconnect();
    process.exit(fail > 0 ? 1 : 0);
  });
