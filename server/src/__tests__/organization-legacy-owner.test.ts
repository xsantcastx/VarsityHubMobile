/**
 * Legacy-owner authorization (2026-07-09).
 *
 * Orgs created before owner MEMBERSHIP rows existed record ownership only on
 * Organization.league_owner_id (no OrganizationMembership row). The July-4
 * "Manage Org legacy owners" fix backfilled only the review-summaries LIST, so
 * those owners still 403'd on every owner action (edit/invite/approve/transfer)
 * because isOrganizationOwner read membership rows only.
 *
 * isOrganizationOwner now falls back to the league_owner_id pointer. This pins
 * that a legacy owner is recognized, and a non-owner still is not.
 */
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';

let prisma: any;
let isOrganizationOwner: any;

const ts = Date.now();

describe('legacy org owner (league_owner_id, no membership row)', () => {
  let legacyOwnerId = '';
  let strangerId = '';
  let memberId = '';
  let legacyOrgId = '';

  const mkUser = async (label: string) => {
    const passwordHash = await bcrypt.hash('TestPassword123!', 10);
    return prisma.user.create({
      data: {
        email: `legacy-owner-${label}-${ts}@example.com`,
        password_hash: passwordHash,
        display_name: `Legacy ${label}`,
        email_verified: true,
        role: 'coach',
        onboarding_completed: true,
        approval_status: 'APPROVED',
        preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
      },
    });
  };

  beforeAll(async () => {
    ({ prisma } = await import('../lib/prisma.js'));
    ({ isOrganizationOwner } = await import('../lib/organizationAuthorization.js'));

    const owner = await mkUser('owner');
    legacyOwnerId = owner.id;
    const stranger = await mkUser('stranger');
    strangerId = stranger.id;
    const member = await mkUser('member');
    memberId = member.id;

    // A LEGACY org: league_owner_id points at the owner, but NO OrganizationMembership
    // owner row exists (the exact pre-membership-era shape).
    const org = await prisma.organization.create({
      data: {
        name: `Legacy Owner Org ${ts}`,
        org_type: 'club',
        admin_approved: true,
        updated_at: new Date(),
        league_owner_id: owner.id,
      },
    });
    legacyOrgId = org.id;

    // A plain member row (a non-owner) to prove the fallback doesn't over-grant.
    await prisma.organizationMembership.create({
      data: { organization_id: org.id, user_id: member.id, role: 'member', status: 'active' },
    });
  });

  afterAll(async () => {
    await prisma.organizationMembership
      .deleteMany({ where: { organization_id: legacyOrgId } })
      .catch(() => {});
    await prisma.organization.deleteMany({ where: { id: legacyOrgId } }).catch(() => {});
    await prisma.user
      .deleteMany({ where: { id: { in: [legacyOwnerId, strangerId, memberId].filter(Boolean) } } })
      .catch(() => {});
  });

  it('recognizes a league_owner_id owner with no membership row', async () => {
    expect(await isOrganizationOwner(legacyOwnerId, legacyOrgId)).toBe(true);
  });

  it('does not grant ownership to a non-member stranger', async () => {
    expect(await isOrganizationOwner(strangerId, legacyOrgId)).toBe(false);
  });

  it('does not grant ownership to a plain member', async () => {
    expect(await isOrganizationOwner(memberId, legacyOrgId)).toBe(false);
  });

  it('returns false for null inputs', async () => {
    expect(await isOrganizationOwner(null, legacyOrgId)).toBe(false);
    expect(await isOrganizationOwner(legacyOwnerId, null)).toBe(false);
  });
});
