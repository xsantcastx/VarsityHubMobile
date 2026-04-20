/**
 * serializeTeam contract tests.
 *
 * Pure unit test — no DB, no HTTP. Pins the team wire shape so a future
 * refactor can't silently drop a baseline field or reintroduce the
 * list-vs-detail drift that prompted this helper.
 */
import { describe, expect, it } from '@jest/globals';
import {
  serializeTeam,
  SERIALIZE_TEAM_BASELINE_FIELDS,
} from '../lib/serializeTeam.js';

const MINIMAL_ROW = {
  id: 'team_123',
  name: 'Test Team',
  description: 'A team',
  status: 'active',
  sport: 'Soccer',
  club_type: 'sport',
  extracurricular_category: null,
  season: 'Fall',
  season_start: new Date('2026-08-01T00:00:00Z'),
  season_end: new Date('2026-12-15T00:00:00Z'),
  logo_url: 'https://cdn.example/logo.png',
  avatar_url: null,
  primary_color: '#1B3A6B',
  is_private: false,
  city: 'Austin',
  state: 'TX',
  league: 'State League',
  venue_place_id: 'ChIJ...',
  venue_lat: 30.2672,
  venue_lng: -97.7431,
  venue_address: '123 Field Rd, Austin, TX',
  organization_id: 'org_abc',
  created_at: new Date('2026-01-01T00:00:00Z'),
};

describe('serializeTeam', () => {
  it('includes every baseline field on a bare row', () => {
    const out = serializeTeam(MINIMAL_ROW) as Record<string, unknown>;
    for (const field of SERIALIZE_TEAM_BASELINE_FIELDS) {
      expect(out).toHaveProperty(field);
    }
  });

  it('omits count/organization/viewer blocks when opts are unset', () => {
    const out = serializeTeam(MINIMAL_ROW) as Record<string, unknown>;
    expect(out).not.toHaveProperty('members');
    expect(out).not.toHaveProperty('followers_count');
    expect(out).not.toHaveProperty('organization');
    expect(out).not.toHaveProperty('my_role');
    expect(out).not.toHaveProperty('is_following');
  });

  it('serializes dates as ISO strings', () => {
    const out = serializeTeam(MINIMAL_ROW) as Record<string, unknown>;
    expect(out.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(out.season_start).toBe('2026-08-01T00:00:00.000Z');
    expect(out.season_end).toBe('2026-12-15T00:00:00.000Z');
  });

  it('returns null for nullable / empty url fields consistently', () => {
    const out = serializeTeam({
      ...MINIMAL_ROW,
      logo_url: '',
      avatar_url: null,
      primary_color: null,
      city: null,
      description: null,
    }) as Record<string, unknown>;
    expect(out.logo_url).toBeNull();
    expect(out.avatar_url).toBeNull();
    expect(out.primary_color).toBeNull();
    expect(out.city).toBeNull();
    expect(out.description).toBeNull();
  });

  it('falls back to safe defaults when privacy/classification fields are missing', () => {
    const out = serializeTeam({
      id: 't1',
      name: 'x',
      description: null,
      status: 'active',
      created_at: new Date(),
      organization_id: 'org',
      // is_private and club_type intentionally missing — simulates
      // legacy rows or partial Prisma selects
    }) as Record<string, unknown>;
    expect(out.is_private).toBe(false); // fail-safe default
    expect(out.club_type).toBe('sport');
    expect(out.extracurricular_category).toBeNull();
  });

  it('includes counts only when the Prisma _count was fetched', () => {
    const withCount = serializeTeam(
      { ...MINIMAL_ROW, _count: { memberships: 12, followers: 7 } },
      { includeCounts: true }
    ) as Record<string, unknown>;
    expect(withCount.members).toBe(12);
    expect(withCount.followers_count).toBe(7);

    // When only memberships was fetched, followers_count must NOT appear
    // as a fake 0 — it's omitted so the client can tell the endpoint
    // doesn't carry that data.
    const onlyMembers = serializeTeam(
      { ...MINIMAL_ROW, _count: { memberships: 5 } },
      { includeCounts: true }
    ) as Record<string, unknown>;
    expect(onlyMembers.members).toBe(5);
    expect(onlyMembers).not.toHaveProperty('followers_count');
  });

  it('embeds organization when opts.includeOrganization is true and relation is present', () => {
    const out = serializeTeam(
      {
        ...MINIMAL_ROW,
        organization: {
          id: 'org_abc',
          name: 'Austin Soccer Club',
          description: 'ASC',
          sport: 'Soccer',
        },
      },
      { includeOrganization: true }
    ) as Record<string, unknown>;
    expect(out.organization).toEqual({
      id: 'org_abc',
      name: 'Austin Soccer Club',
      description: 'ASC',
      sport: 'Soccer',
    });
  });

  it('surfaces organization: null when flag is set but relation absent', () => {
    // Intentionally strict: if caller requests the org block, they get a
    // slot with null so clients can distinguish "no org" from "not
    // requested" (the absent case).
    const out = serializeTeam(MINIMAL_ROW, {
      includeOrganization: true,
    }) as Record<string, unknown>;
    expect(out.organization).toBeNull();
  });

  it('includes viewer state block when opts.includeViewerState is true', () => {
    const out = serializeTeam(MINIMAL_ROW, {
      includeViewerState: true,
      viewerRole: 'coach',
      isFollowing: true,
    }) as Record<string, unknown>;
    expect(out.my_role).toBe('coach');
    expect(out.is_following).toBe(true);
  });

  it('viewer state defaults to null when pre-resolved values are not passed', () => {
    const out = serializeTeam(MINIMAL_ROW, {
      includeViewerState: true,
    }) as Record<string, unknown>;
    expect(out.my_role).toBeNull();
    expect(out.is_following).toBeNull();
  });

  it('returns null when given a null team', () => {
    expect(serializeTeam(null)).toBeNull();
    expect(serializeTeam(undefined)).toBeNull();
  });

  it('leaks nothing sensitive even if caller passes extra fields', () => {
    // Belt-and-braces: a caller might accidentally pass a Team row with
    // adjacent sensitive data via include. Confirm nothing beyond the
    // baseline + opt blocks leaks into the output.
    const out = serializeTeam(
      {
        ...MINIMAL_ROW,
        internal_admin_note: 'payment issue',
        stripe_customer_id: 'cus_xxx',
        password_hash: 'hash',
      },
      { includeCounts: true, includeOrganization: true, includeViewerState: true }
    ) as Record<string, unknown>;
    expect(out).not.toHaveProperty('internal_admin_note');
    expect(out).not.toHaveProperty('stripe_customer_id');
    expect(out).not.toHaveProperty('password_hash');
  });
});
