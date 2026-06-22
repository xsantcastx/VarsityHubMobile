#!/usr/bin/env npx tsx
import 'dotenv/config';

/**
 * GHOST TEST — Fan ↔ Team screen authorization & PII boundaries
 *
 * Question under test: do only the CORRECT users reach the CORRECT team
 * screens/data? Exercises the REAL HTTP endpoints the team screens call.
 *
 * Actors:
 *   owner       — coach who owns the org + team (staff)
 *   memberFan   — fan who is an ACTIVE member of the team (NOT staff)
 *   outsiderFan — fan with no relationship to the team
 *
 * Coverage:
 *   A. Public team page (`/teams/:id/screen-summary`)
 *      - outsider + member can view, but can_manage=false and member emails
 *        are REDACTED (PII only for staff)
 *   B. Staff-only admin screen (`/teams/:id/admin-summary`)
 *      - outsider + member → 403; owner → 200 WITH member emails
 *   C. Mutations gated to staff
 *      - edit team, invite, change member role, remove other member → 403 for fans
 *      - approve someone else's join request → 403 for a non-staff fan
 *   D. Private team visibility
 *      - private team → outsider 404 (hidden); active member still 200
 *
 * Usage:
 *   PORT=4000 npx tsx src/index.ts        # in one terminal
 *   npx tsx scripts/ghost-test-fan-team-access.ts
 */
import crypto from 'node:crypto';
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
  return { status: res.status, data };
}

const createdUserIds = new Set<string>();
const createdOrgIds = new Set<string>();

async function register(tag: string) {
  const email = `ghostacl_${tag}_${RUN}@test.varsityhub.app`;
  const r = await http('POST', '/auth/register', {
    email,
    password: 'TestPass123!',
    display_name: `Ghost ${tag}`,
    role: 'fan',
  });
  const id = r.data?.user?.id;
  if (id) createdUserIds.add(id);
  return { email, id, token: r.data?.access_token };
}

async function seedUser(id: string, opts: { coach?: boolean; orgId?: string } = {}) {
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
      ...(opts.orgId ? { organization_id: opts.orgId } : {}),
    },
  });
}

function memberHasEmail(members: any[]): boolean {
  return Array.isArray(members) && members.some((m) => m?.user && 'email' in m.user);
}

async function main() {
  console.log(`\n🔐 Ghost test — fan ↔ team screen authorization  (run ${RUN})  → ${BASE}`);

  // ── Setup actors + a team ─────────────────────────────────────────────────
  section('SETUP — owner, member fan, outsider fan, one team');
  const owner = await register('owner');
  await seedUser(owner.id!, { coach: true });
  const orgRes = await http(
    'POST',
    '/organizations',
    {
      name: `Ghost ACL Org ${RUN}`,
      description: 'acl test',
      sport: 'basketball',
      org_type: 'club',
      location: 'New Haven, CT',
      zip_code: '06510',
      supporting_document_url: 'https://example.com/doc.pdf',
    },
    owner.token
  );
  const orgId = orgRes.data?.id;
  if (orgId) createdOrgIds.add(orgId);
  await seedUser(owner.id!, { coach: true, orgId });
  const teamRes = await http(
    'POST',
    '/teams',
    {
      name: `Ghost ACL Team ${RUN}`,
      description: 't',
      organization_id: orgId,
      season_start: '2026-03-01',
      season_end: '2026-06-30',
    },
    owner.token
  );
  const teamId = teamRes.data?.id;
  check('owner created team', !!teamId, `status ${teamRes.status}`);
  if (!teamId) throw new Error('cannot continue without a team');

  const memberFan = await register('memberfan');
  await seedUser(memberFan.id!);
  const outsiderFan = await register('outsiderfan');
  await seedUser(outsiderFan.id!);

  // memberFan joins → owner approves → active member (not staff)
  const jr = await http('POST', '/team-memberships/join-requests', { team_id: teamId, message: 'join' }, memberFan.token);
  const jrId = jr.data?.join_request?.id;
  const appr = await http('POST', `/team-memberships/join-requests/${jrId}/approve`, {}, owner.token);
  check('member fan is now an active team member', appr.status === 200, `status ${appr.status}`);

  // ════════════════════════════════════════════════════════════════════════
  section('A. PUBLIC TEAM PAGE (screen-summary) — viewable, PII redacted');
  // ════════════════════════════════════════════════════════════════════════
  const outsiderView = await http('GET', `/teams/${teamId}/screen-summary`, undefined, outsiderFan.token);
  check('outsider fan CAN view public team page (200)', outsiderView.status === 200, `status ${outsiderView.status}`);
  check('outsider view: can_manage === false', outsiderView.data?.permissions?.can_manage === false, `${outsiderView.data?.permissions?.can_manage}`);
  check('outsider view: member emails REDACTED (no PII)', !memberHasEmail(outsiderView.data?.members), 'no email field');

  const memberView = await http('GET', `/teams/${teamId}/screen-summary`, undefined, memberFan.token);
  check('member fan CAN view team page (200)', memberView.status === 200, `status ${memberView.status}`);
  check('member view: can_manage === false (member ≠ staff)', memberView.data?.permissions?.can_manage === false, `${memberView.data?.permissions?.can_manage}`);
  check('member view: member emails REDACTED (no PII)', !memberHasEmail(memberView.data?.members), 'no email field');

  // ════════════════════════════════════════════════════════════════════════
  section('B. STAFF ADMIN SCREEN (admin-summary) — staff only, emails exposed');
  // ════════════════════════════════════════════════════════════════════════
  const outsiderAdmin = await http('GET', `/teams/${teamId}/admin-summary`, undefined, outsiderFan.token);
  check('outsider fan BLOCKED from admin-summary (403)', outsiderAdmin.status === 403, `status ${outsiderAdmin.status}`);

  const memberAdmin = await http('GET', `/teams/${teamId}/admin-summary`, undefined, memberFan.token);
  check('member fan BLOCKED from admin-summary (403)', memberAdmin.status === 403, `status ${memberAdmin.status}`);

  const ownerAdmin = await http('GET', `/teams/${teamId}/admin-summary`, undefined, owner.token);
  check('owner CAN view admin-summary (200)', ownerAdmin.status === 200, `status ${ownerAdmin.status}`);
  check('owner admin-summary: can_manage === true', ownerAdmin.data?.permissions?.can_manage === true, `${ownerAdmin.data?.permissions?.can_manage}`);
  check('owner admin-summary EXPOSES member emails (staff PII)', memberHasEmail(ownerAdmin.data?.members), 'email field present');

  // ════════════════════════════════════════════════════════════════════════
  section('C. STAFF-ONLY MUTATIONS — fans blocked');
  // ════════════════════════════════════════════════════════════════════════
  const memberEdit = await http('PUT', `/teams/${teamId}`, { name: `Hacked ${RUN}` }, memberFan.token);
  check('member fan CANNOT edit team (403)', memberEdit.status === 403, `status ${memberEdit.status}`);

  const outsiderEdit = await http('PUT', `/teams/${teamId}`, { name: `Hacked ${RUN}` }, outsiderFan.token);
  check('outsider fan CANNOT edit team (403)', outsiderEdit.status === 403, `status ${outsiderEdit.status}`);

  const memberInvite = await http('POST', '/team-invites', { team_id: teamId, email: 'x@y.com', role: 'member' }, memberFan.token);
  check('member fan CANNOT invite to team (403)', memberInvite.status === 403, `status ${memberInvite.status}`);

  // membership ids for role/remove attempts
  const ownerMembership = await prisma.teamMembership.findFirst({ where: { team_id: teamId, user_id: owner.id! }, select: { id: true } });
  const memberMembership = await prisma.teamMembership.findFirst({ where: { team_id: teamId, user_id: memberFan.id! }, select: { id: true } });

  const memberPromoteSelf = await http('PATCH', `/team-memberships/${memberMembership?.id}`, { role: 'manager' }, memberFan.token);
  check('member fan CANNOT promote self to manager (403)', memberPromoteSelf.status === 403, `status ${memberPromoteSelf.status}`);

  const memberRemoveOwner = await http('DELETE', `/team-memberships/${ownerMembership?.id}`, undefined, memberFan.token);
  check('member fan CANNOT remove the owner (403)', memberRemoveOwner.status === 403, `status ${memberRemoveOwner.status}`);

  // outsider tries to approve a fresh pending join request
  const thirdFan = await register('thirdfan');
  await seedUser(thirdFan.id!);
  const jr3 = await http('POST', '/team-memberships/join-requests', { team_id: teamId, message: 'me' }, thirdFan.token);
  const jr3Id = jr3.data?.join_request?.id;
  const outsiderApprove = await http('POST', `/team-memberships/join-requests/${jr3Id}/approve`, {}, outsiderFan.token);
  check('non-staff fan CANNOT approve a join request (403)', outsiderApprove.status === 403, `status ${outsiderApprove.status}`);

  // ════════════════════════════════════════════════════════════════════════
  section('D. PRIVATE TEAM — hidden from non-members');
  // ════════════════════════════════════════════════════════════════════════
  await prisma.team.update({ where: { id: teamId }, data: { is_private: true } });

  const outsiderPrivate = await http('GET', `/teams/${teamId}/screen-summary`, undefined, outsiderFan.token);
  check('private team HIDDEN from outsider fan (404)', outsiderPrivate.status === 404, `status ${outsiderPrivate.status}`);

  const memberPrivate = await http('GET', `/teams/${teamId}/screen-summary`, undefined, memberFan.token);
  check('private team still visible to active member (200)', memberPrivate.status === 200, `status ${memberPrivate.status}`);
}

async function cleanup() {
  section('CLEANUP');
  try {
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
      await prisma.teamJoinRequest.deleteMany({ where: { user_id: uid } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: uid } }).catch(() => {});
    }
    console.log('  🧹 cleaned up ghost users / org / team');
  } catch (e) {
    console.log('  ⚠️  cleanup issue:', (e as any)?.message || e);
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
