import { afterAll, beforeAll, beforeEach, describe, expect, it } from '@jest/globals';

// DB-backed unit tests for the accept-based ownership-transfer lib. Hits the
// real local Postgres (like team-transfer-authorization.test.ts) — no mocks.

let prisma: any;
let initiateOwnershipTransfer: any;
let acceptOwnershipTransfer: any;
let respondCancelOrDecline: any;
let getPendingTransfer: any;
let isOrgOwner: any;

const ts = Date.now();

describe('Accept-based ownership transfer lib', () => {
  let orgId = '';
  let ownerId = '';
  let memberId = '';
  let member2Id = '';
  let outsiderId = '';

  async function makeUser(tag: string) {
    const u = await prisma.user.create({
      data: { email: `own-xfer-${tag}-${ts}@example.com` },
      select: { id: true },
    });
    return u.id;
  }

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({
      initiateOwnershipTransfer,
      acceptOwnershipTransfer,
      respondCancelOrDecline,
      getPendingTransfer,
    } = await import('../lib/organizationOwnershipTransfer.js'));
    ({ isOrgOwner } = await import('../lib/teamAuthorization.js'));

    ownerId = await makeUser('owner');
    memberId = await makeUser('member');
    member2Id = await makeUser('member2');
    outsiderId = await makeUser('outsider');
  });

  beforeEach(async () => {
    // Fresh org each test so ownership/roles start clean.
    const org = await prisma.organization.create({
      data: { name: `OwnXfer Org ${ts}-${Math.round(Math.random() * 1e9)}`, league_owner_id: ownerId },
      select: { id: true },
    });
    orgId = org.id;
    await prisma.organizationMembership.createMany({
      data: [
        { organization_id: orgId, user_id: ownerId, role: 'owner', status: 'active' },
        { organization_id: orgId, user_id: memberId, role: 'manager', status: 'active' },
        { organization_id: orgId, user_id: member2Id, role: 'manager', status: 'active' },
      ],
    });
  });

  it('initiate creates a pending row; ownership does NOT move yet', async () => {
    const r = await initiateOwnershipTransfer(orgId, ownerId, memberId);
    expect('id' in r).toBe(true);
    expect(await isOrgOwner(memberId, orgId)).toBe(false);
    expect(await isOrgOwner(ownerId, orgId)).toBe(true);
    expect((await getPendingTransfer(orgId))?.to_user_id).toBe(memberId);
  });

  it('accept moves ownership atomically and clears pending', async () => {
    await initiateOwnershipTransfer(orgId, ownerId, memberId);
    const a = await acceptOwnershipTransfer(orgId, memberId);
    expect('ok' in a).toBe(true);
    expect(await isOrgOwner(memberId, orgId)).toBe(true);
    expect(await isOrgOwner(ownerId, orgId)).toBe(false);
    expect(await getPendingTransfer(orgId)).toBeNull();
  });

  it('non-recipient cannot accept', async () => {
    await initiateOwnershipTransfer(orgId, ownerId, memberId);
    const a = await acceptOwnershipTransfer(orgId, outsiderId);
    expect('error' in a).toBe(true);
    expect(await isOrgOwner(ownerId, orgId)).toBe(true);
  });

  it('initiate to a non-member is rejected (NOT_A_MEMBER)', async () => {
    const r = await initiateOwnershipTransfer(orgId, ownerId, outsiderId);
    expect('error' in r && r.code).toBe('NOT_A_MEMBER');
  });

  it('non-owner cannot initiate (NOT_OWNER)', async () => {
    const r = await initiateOwnershipTransfer(orgId, memberId, member2Id);
    expect('error' in r && r.code).toBe('NOT_OWNER');
  });

  it('cannot transfer to self (SELF_TRANSFER)', async () => {
    const r = await initiateOwnershipTransfer(orgId, ownerId, ownerId);
    expect('error' in r && r.code).toBe('SELF_TRANSFER');
  });

  it('a second initiate supersedes the first (one pending per org)', async () => {
    await initiateOwnershipTransfer(orgId, ownerId, memberId);
    await initiateOwnershipTransfer(orgId, ownerId, member2Id);
    expect((await getPendingTransfer(orgId))?.to_user_id).toBe(member2Id);
    const stale = await acceptOwnershipTransfer(orgId, memberId);
    expect('error' in stale).toBe(true);
  });

  it('recipient can decline; initiator can cancel', async () => {
    await initiateOwnershipTransfer(orgId, ownerId, memberId);
    const d = await respondCancelOrDecline(orgId, memberId, 'decline');
    expect('ok' in d).toBe(true);
    expect(await getPendingTransfer(orgId)).toBeNull();

    await initiateOwnershipTransfer(orgId, ownerId, memberId);
    const c = await respondCancelOrDecline(orgId, ownerId, 'cancel');
    expect('ok' in c).toBe(true);
    expect(await getPendingTransfer(orgId)).toBeNull();
  });

  it('recipient who left before accepting is rejected (NOT_A_MEMBER)', async () => {
    await initiateOwnershipTransfer(orgId, ownerId, memberId);
    await prisma.organizationMembership.updateMany({
      where: { organization_id: orgId, user_id: memberId },
      data: { status: 'archived' },
    });
    const a = await acceptOwnershipTransfer(orgId, memberId);
    expect('error' in a && a.code).toBe('NOT_A_MEMBER');
    expect(await isOrgOwner(ownerId, orgId)).toBe(true);
  });

  afterAll(async () => {
    const orgs = await prisma.organization.findMany({
      where: { name: { startsWith: `OwnXfer Org ${ts}` } },
      select: { id: true },
      take: 100,
    });
    const orgIds = orgs.map((o: any) => o.id);
    await prisma.organizationOwnershipTransfer.deleteMany({ where: { organization_id: { in: orgIds } } });
    await prisma.organizationMembership.deleteMany({ where: { organization_id: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, memberId, member2Id, outsiderId].filter(Boolean) } },
    });
    await prisma.$disconnect();
  });
});
