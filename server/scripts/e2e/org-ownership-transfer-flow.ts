/**
 * END-TO-END drive of accept-based org ownership transfer against the REAL lib
 * (organizationOwnershipTransfer.ts + accountDeletion guard) and a REAL local
 * Postgres. Proves the whole owner rule: a transfer is only PENDING until the
 * recipient accepts, the initiator stays blocked from account deletion while it
 * is pending, and the block releases once ownership actually moves.
 *
 * Seed → assert every state → revert. Safe to re-run (local DB only).
 *   cd server && npx tsx scripts/e2e/org-ownership-transfer-flow.ts
 */
import { prisma } from '../../src/lib/prisma.js';
import {
  initiateOwnershipTransfer,
  acceptOwnershipTransfer,
  respondCancelOrDecline,
  getPendingTransfer,
} from '../../src/lib/organizationOwnershipTransfer.js';
import { isOrgOwner } from '../../src/lib/teamAuthorization.js';
import { assertCanSelfDeleteUser } from '../../src/lib/accountDeletion.js';

const RUN = Date.now().toString(36);
const ids: { users: string[]; orgs: string[] } = { users: [], orgs: [] };
const rows: { name: string; pass: boolean; detail: string }[] = [];
function check(name: string, pass: boolean, detail = '') {
  rows.push({ name, pass, detail });
  console.log(`  ${pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ' — ' + detail : ''}`);
}
async function user(tag: string) {
  const u = await prisma.user.create({ data: { email: `oxfer-${tag}-${RUN}@test.local` }, select: { id: true } });
  ids.users.push(u.id);
  return u.id;
}
async function selfDeleteBlocked(userId: string, code: string) {
  try { await assertCanSelfDeleteUser(userId); return false; } catch (e: any) { return e?.code === code; }
}
async function selfDeleteAllowed(userId: string) {
  try { await assertCanSelfDeleteUser(userId); return true; } catch { return false; }
}

async function freshOrg(ownerId: string, recipientId: string) {
  const org = await prisma.organization.create({
    data: { name: `OXFER Org ${RUN}-${Math.round(Math.random() * 1e9)}`, league_owner_id: ownerId },
    select: { id: true },
  });
  ids.orgs.push(org.id);
  await prisma.organizationMembership.createMany({
    data: [
      { organization_id: org.id, user_id: ownerId, role: 'owner', status: 'active' },
      { organization_id: org.id, user_id: recipientId, role: 'manager', status: 'active' },
    ],
  });
  return org.id;
}

async function main() {
  console.log(`\n\x1b[1mOrg ownership transfer E2E\x1b[0m (run ${RUN}) — local DB, real lib + guard\n`);

  const owner = await user('owner');
  const recipient = await user('recip');
  const outsider = await user('out');

  // ── Pending state: nothing moves, initiator still blocked from deletion ──
  const org1 = await freshOrg(owner, recipient);
  const init = await initiateOwnershipTransfer(org1, owner, recipient);
  check('initiate returns a pending id', 'id' in init);
  check('after initiate: recipient is NOT owner', !(await isOrgOwner(recipient, org1)));
  check('after initiate: initiator still IS owner', await isOrgOwner(owner, org1));
  check('after initiate: pending row targets recipient', (await getPendingTransfer(org1))?.to_user_id === recipient);
  check(
    'while pending: initiator STILL blocked from account deletion (SOLE_ORG_OWNER)',
    await selfDeleteBlocked(owner, 'SOLE_ORG_OWNER'),
    'the whole point — a pending offer does not release the guard'
  );

  // ── Accept: ownership moves, guard releases for the (now ex-)owner ───────
  const acc = await acceptOwnershipTransfer(org1, recipient);
  check('accept succeeds', 'ok' in acc);
  check('after accept: recipient IS owner', await isOrgOwner(recipient, org1));
  check('after accept: former owner LOST ownership', !(await isOrgOwner(owner, org1)));
  check('after accept: pending cleared', (await getPendingTransfer(org1)) === null);
  check('after accept: NEW owner cannot self-delete (guard followed)', await selfDeleteBlocked(recipient, 'SOLE_ORG_OWNER'));
  check(
    'after accept: former owner CAN self-delete (no longer sole owner of anything)',
    await selfDeleteAllowed(owner),
    'guard released once ownership actually moved'
  );

  // ── Non-recipient cannot accept ─────────────────────────────────────────
  const org2 = await freshOrg(owner, recipient);
  await initiateOwnershipTransfer(org2, owner, recipient);
  const bad = await acceptOwnershipTransfer(org2, outsider);
  check('non-recipient cannot accept', 'error' in bad);
  check('after failed accept: owner unchanged', await isOrgOwner(owner, org2));

  // ── Decline + cancel ────────────────────────────────────────────────────
  const declined = await respondCancelOrDecline(org2, recipient, 'decline');
  check('recipient can decline', 'ok' in declined);
  check('after decline: no pending', (await getPendingTransfer(org2)) === null);
  await initiateOwnershipTransfer(org2, owner, recipient);
  const cancelled = await respondCancelOrDecline(org2, owner, 'cancel');
  check('initiator can cancel', 'ok' in cancelled);
  check('after cancel: no pending', (await getPendingTransfer(org2)) === null);

  // ── Supersede ───────────────────────────────────────────────────────────
  const member2 = await user('m2');
  const org3 = await freshOrg(owner, recipient);
  await prisma.organizationMembership.create({ data: { organization_id: org3, user_id: member2, role: 'manager', status: 'active' } });
  await initiateOwnershipTransfer(org3, owner, recipient);
  await initiateOwnershipTransfer(org3, owner, member2);
  check('second initiate supersedes the first', (await getPendingTransfer(org3))?.to_user_id === member2);
  const stale = await acceptOwnershipTransfer(org3, recipient);
  check('stale (superseded) recipient cannot accept', 'error' in stale);

  // ── Recipient left before accepting ─────────────────────────────────────
  const org4 = await freshOrg(owner, recipient);
  await initiateOwnershipTransfer(org4, owner, recipient);
  await prisma.organizationMembership.updateMany({ where: { organization_id: org4, user_id: recipient }, data: { status: 'archived' } });
  const leftAccept = await acceptOwnershipTransfer(org4, recipient);
  check('recipient who left before accepting is rejected (NOT_A_MEMBER)', 'error' in leftAccept && (leftAccept as any).code === 'NOT_A_MEMBER');
  check('after that: owner unchanged', await isOrgOwner(owner, org4));

  const failed = rows.filter(r => !r.pass);
  console.log(`\n\x1b[1m${rows.length - failed.length}/${rows.length} passed\x1b[0m` + (failed.length ? ` — \x1b[31m${failed.length} FAILED\x1b[0m` : ' — all green'));
  return failed.length;
}

async function cleanup() {
  await prisma.organizationOwnershipTransfer.deleteMany({ where: { organization_id: { in: ids.orgs } } });
  await prisma.organizationMembership.deleteMany({ where: { organization_id: { in: ids.orgs } } });
  await prisma.organization.deleteMany({ where: { id: { in: ids.orgs } } });
  await prisma.user.deleteMany({ where: { id: { in: ids.users } } });
}

main()
  .then(async failed => { await cleanup(); console.log('\x1b[2m[cleanup] reverted\x1b[0m'); await prisma.$disconnect(); process.exit(failed ? 1 : 0); })
  .catch(async e => { console.error('E2E ERROR:', e); await cleanup().catch(() => {}); await prisma.$disconnect(); process.exit(2); });
