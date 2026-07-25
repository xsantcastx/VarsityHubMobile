/**
 * Veteran quantity reconciliation job — orchestration.
 *
 * Seeds real metered veterans and drives the job with an injected Stripe stub,
 * proving it: lowers an over-billed veteran's item quantity to the actual
 * billable count, leaves an aligned one untouched, never raises, flags a
 * free-tier owner instead of zeroing, and skips owner-covered / IAP-flat
 * (no subscription_id) veterans.
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { runVeteranQuantityReconciliation } from '../lib/veteranQuantityReconciliation.js';
import { SERVER_ROOKIE_PROGRAM_LIMIT } from '../lib/planDefinitions.js';

let prisma: any;

const ts = Date.now();
const suffix = String(ts).slice(-8);
const orgIds: string[] = [];
const userIds: string[] = [];

async function makeVeteran(
  tag: string,
  opts: { subscriptionId?: string | null; paidByOwner?: boolean } = {}
) {
  const prefs: any = { role: 'coach', plan: 'veteran', onboarding_completed: true };
  if (opts.subscriptionId) prefs.subscription_id = opts.subscriptionId;
  const user = await prisma.user.create({
    data: {
      email: `vqrj-${tag}-${ts}@example.com`,
      username: `vqrj${tag}${suffix}`,
      password_hash: 'x',
      display_name: `VQRJ ${tag}`,
      email_verified: true,
      role: 'coach',
      onboarding_completed: true,
      approval_status: 'APPROVED',
      plan: 'veteran',
      paid_by_owner: opts.paidByOwner === true,
      preferences: prefs,
    },
  });
  userIds.push(user.id);
  return user;
}

/** Org owned by `ownerId` with `programCount` active sport programs. */
async function makeOrgWithPrograms(ownerId: string, tag: string, programCount: number) {
  const org = await prisma.organization.create({
    data: {
      name: `VQRJ Org ${tag} ${ts}`,
      league_owner_id: ownerId,
      admin_approved: true,
      approved_at: new Date(),
      supporting_document_url: 'https://example.com/doc.pdf',
      updated_at: new Date(),
    },
  });
  orgIds.push(org.id);
  await prisma.organizationMembership.create({
    data: { organization_id: org.id, user_id: ownerId, role: 'owner', status: 'active' },
  });
  const sports = [
    'basketball',
    'soccer',
    'baseball',
    'football',
    'volleyball',
    'wrestling',
    'lacrosse',
    'tennis',
  ];
  for (let i = 0; i < programCount; i++) {
    const program = await prisma.sportProgram.create({
      data: { organization_id: org.id, sport: sports[i] },
    });
    await prisma.team.create({
      data: {
        name: `VQRJ ${tag} T${i} ${suffix}`,
        organization_id: org.id,
        program_id: program.id,
        sport: sports[i],
        status: 'active',
      },
    });
  }
  return org;
}

/** Stripe stub: one subscription per id, each with a single item + quantity. */
function makeStripeStub(
  subs: Record<string, { status: string; itemId: string; quantity: number }>
) {
  return {
    subscriptions: {
      retrieve: jest.fn(async (id: string) => {
        const s = subs[id];
        if (!s) throw new Error(`no such subscription ${id}`);
        return { status: s.status, items: { data: [{ id: s.itemId, quantity: s.quantity }] } };
      }),
    },
    subscriptionItems: {
      update: jest.fn(async (_itemId: string, _params: { quantity: number }) => ({})),
    },
  };
}

describe('runVeteranQuantityReconciliation', () => {
  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
  });

  afterAll(async () => {
    const teams = await prisma.team.findMany({
      where: { organization_id: { in: orgIds } },
      select: { id: true },
    });
    const teamIds = teams.map((t: any) => t.id);
    await prisma.team.deleteMany({ where: { id: { in: teamIds } } });
    await prisma.sportProgram.deleteMany({ where: { organization_id: { in: orgIds } } });
    await prisma.organizationMembership.deleteMany({ where: { organization_id: { in: orgIds } } });
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  });

  it('lowers an over-billed veteran to the actual billable quantity', async () => {
    const owner = await makeVeteran('lower', { subscriptionId: `sub_lower_${suffix}` });
    await makeOrgWithPrograms(owner.id, 'lower', SERVER_ROOKIE_PROGRAM_LIMIT + 1); // billable 1
    const stripe = makeStripeStub({
      [`sub_lower_${suffix}`]: { status: 'active', itemId: `si_lower_${suffix}`, quantity: 3 },
    });

    const result = await runVeteranQuantityReconciliation({
      db: prisma,
      stripe: stripe as any,
      onlyUserIds: [owner.id],
    });

    expect(stripe.subscriptionItems.update).toHaveBeenCalledWith(`si_lower_${suffix}`, {
      quantity: 1,
    });
    expect(result.lowered).toBe(1);
  });

  it('leaves an aligned veteran untouched', async () => {
    const owner = await makeVeteran('aligned', { subscriptionId: `sub_aligned_${suffix}` });
    await makeOrgWithPrograms(owner.id, 'aligned', SERVER_ROOKIE_PROGRAM_LIMIT + 2); // billable 2
    const stripe = makeStripeStub({
      [`sub_aligned_${suffix}`]: { status: 'active', itemId: `si_aligned_${suffix}`, quantity: 2 },
    });

    const result = await runVeteranQuantityReconciliation({
      db: prisma,
      stripe: stripe as any,
      onlyUserIds: [owner.id],
    });

    expect(stripe.subscriptionItems.update).not.toHaveBeenCalled();
    expect(result.lowered).toBe(0);
  });

  it('flags a free-tier veteran for downgrade without writing quantity', async () => {
    const owner = await makeVeteran('flag', { subscriptionId: `sub_flag_${suffix}` });
    await makeOrgWithPrograms(owner.id, 'flag', SERVER_ROOKIE_PROGRAM_LIMIT); // billable 0
    const stripe = makeStripeStub({
      [`sub_flag_${suffix}`]: { status: 'active', itemId: `si_flag_${suffix}`, quantity: 2 },
    });

    const result = await runVeteranQuantityReconciliation({
      db: prisma,
      stripe: stripe as any,
      onlyUserIds: [owner.id],
    });

    expect(stripe.subscriptionItems.update).not.toHaveBeenCalled();
    expect(result.flagged).toBe(1);
  });

  it('skips owner-covered (paid_by_owner) and IAP-flat (no subscription_id) veterans', async () => {
    const covered = await makeVeteran('covered', {
      subscriptionId: `sub_should_not_read_${suffix}`,
      paidByOwner: true,
    });
    const iap = await makeVeteran('iap', { subscriptionId: null });
    await makeOrgWithPrograms(covered.id, 'covered', SERVER_ROOKIE_PROGRAM_LIMIT + 2);
    await makeOrgWithPrograms(iap.id, 'iap', SERVER_ROOKIE_PROGRAM_LIMIT + 2);
    const stripe = makeStripeStub({}); // any retrieve would throw

    const result = await runVeteranQuantityReconciliation({
      db: prisma,
      stripe: stripe as any,
      onlyUserIds: [covered.id, iap.id],
    });

    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(stripe.subscriptionItems.update).not.toHaveBeenCalled();
    expect(result.lowered).toBe(0);
    expect(result.flagged).toBe(0);
  });
});
