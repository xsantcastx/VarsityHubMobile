import { describe, expect, it } from '@jest/globals';
import {
  SERIALIZE_ORGANIZATION_BASELINE_FIELDS,
  serializeOrganization,
} from '../lib/serializeOrganization.js';

const MINIMAL_ROW = {
  id: 'org_123',
  name: 'Westhill Academy',
  description: 'Test organization',
  logo_url: 'https://cdn.example/logo.png',
  profile_picture_url: 'https://cdn.example/profile.png',
  background_url: 'https://cdn.example/bg.png',
  sport: 'Basketball',
  org_type: 'school',
  location: 'Syracuse, NY',
  zip_code: '13210',
  season_start: new Date('2026-08-01T00:00:00Z'),
  season_end: new Date('2027-05-30T00:00:00Z'),
  status: 'active',
  created_at: new Date('2026-01-01T00:00:00Z'),
  admin_approved: true,
  contact_info: 'coach@example.com',
};

describe('serializeOrganization', () => {
  it('includes every baseline field on a bare row', () => {
    const out = serializeOrganization(MINIMAL_ROW) as Record<string, unknown>;
    for (const field of SERIALIZE_ORGANIZATION_BASELINE_FIELDS) {
      expect(out).toHaveProperty(field);
    }
  });

  it('aliases avatar_url and formatted_address from stored fields', () => {
    const out = serializeOrganization(MINIMAL_ROW) as Record<string, unknown>;
    expect(out.avatar_url).toBe('https://cdn.example/profile.png');
    expect(out.formatted_address).toBe('Syracuse, NY');
  });

  it('serializes dates as ISO strings', () => {
    const out = serializeOrganization(MINIMAL_ROW) as Record<string, unknown>;
    expect(out.created_at).toBe('2026-01-01T00:00:00.000Z');
    expect(out.season_start).toBe('2026-08-01T00:00:00.000Z');
    expect(out.season_end).toBe('2027-05-30T00:00:00.000Z');
  });

  it('omits count/team/viewer blocks when opts are unset', () => {
    const out = serializeOrganization(MINIMAL_ROW) as Record<string, unknown>;
    expect(out).not.toHaveProperty('_count');
    expect(out).not.toHaveProperty('members_count');
    expect(out).not.toHaveProperty('followers_count');
    expect(out).not.toHaveProperty('teams');
    expect(out).not.toHaveProperty('is_following');
  });

  it('includes counts in both nested and top-level forms when fetched', () => {
    const out = serializeOrganization(
      { ...MINIMAL_ROW, _count: { teams: 4, memberships: 23, followers: 11 } },
      { includeCounts: true }
    ) as Record<string, unknown>;

    expect(out._count).toEqual({ teams: 4, memberships: 23, followers: 11 });
    expect(out.teams_count).toBe(4);
    expect(out.members_count).toBe(23);
    expect(out.followers_count).toBe(11);
  });

  it('includes teams when requested and preserves empty vs missing', () => {
    const withTeams = serializeOrganization(
      {
        ...MINIMAL_ROW,
        teams: [
          {
            id: 'team_1',
            name: 'Varsity',
            description: null,
            sport: 'Basketball',
            season_start: null,
            season_end: null,
            status: 'active',
            logo_url: null,
            avatar_url: 'https://cdn.example/team.png',
            created_at: new Date('2026-01-02T00:00:00Z'),
            _count: { memberships: 14 },
          },
        ],
      },
      { includeTeams: true }
    ) as Record<string, unknown>;

    expect(withTeams.teams).toEqual([
      {
        id: 'team_1',
        name: 'Varsity',
        description: null,
        sport: 'Basketball',
        season_start: null,
        season_end: null,
        status: 'active',
        logo_url: null,
        avatar_url: 'https://cdn.example/team.png',
        created_at: '2026-01-02T00:00:00.000Z',
        _count: { memberships: 14 },
      },
    ]);

    const notFetched = serializeOrganization(MINIMAL_ROW, {
      includeTeams: true,
    }) as Record<string, unknown>;
    expect(notFetched.teams).toBeNull();
  });

  it('includes viewer state when requested', () => {
    const out = serializeOrganization(MINIMAL_ROW, {
      includeViewerState: true,
      isFollowing: true,
    }) as Record<string, unknown>;
    expect(out.is_following).toBe(true);
  });

  it('leaks nothing sensitive even if caller passes extra fields', () => {
    const out = serializeOrganization(
      {
        ...MINIMAL_ROW,
        supporting_document_url: 'https://cdn.example/private.pdf',
        rejection_reason: 'internal only',
        approved_by: 'user_123',
      },
      { includeCounts: true, includeTeams: true, includeViewerState: true }
    ) as Record<string, unknown>;

    expect(out).not.toHaveProperty('supporting_document_url');
    expect(out).not.toHaveProperty('rejection_reason');
    expect(out).not.toHaveProperty('approved_by');
  });
});
