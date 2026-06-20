jest.mock('expo-linking', () => ({
  parse: jest.fn((url: string) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url);
      return {
        scheme: parsed.protocol.replace(':', ''),
        hostname: parsed.hostname,
        path: parsed.pathname,
        queryParams: Object.fromEntries(parsed.searchParams.entries()),
      };
    }

    const nativeMatch = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^?]+)(?:\?(.*))?$/);
    if (nativeMatch) {
      const [, scheme, path, query] = nativeMatch;
      const queryParams = Object.fromEntries(new URLSearchParams(query || ''));
      return {
        scheme,
        path,
        queryParams,
      };
    }
    throw new Error(`Unexpected test URL: ${url}`);
  }),
}));

import { parseDeepLink } from '@/utils/deepLinks';

describe('parseDeepLink', () => {
  it('parses native admin dashboard review links with query params', () => {
    expect(
      parseDeepLink(
        'varsityhubmobile://admin-dashboard?coach_id=coach-123&action=approve&review=coach_application'
      )
    ).toEqual({
      screen: '/admin-dashboard',
      params: {
        coach_id: 'coach-123',
        action: 'approve',
        review: 'coach_application',
      },
      source: 'scheme',
    });
  });

  it('parses native organization join request review links with query params', () => {
    expect(
      parseDeepLink(
        'varsityhubmobile://organization-join-requests?organization_id=org-123&request_id=req-456&action=reject'
      )
    ).toEqual({
      screen: '/organization-join-requests',
      params: {
        organization_id: 'org-123',
        request_id: 'req-456',
        action: 'reject',
      },
      source: 'scheme',
    });
  });

  it('parses universal organization invite links into the in-app invite screen', () => {
    expect(parseDeepLink('https://varsityhub.app/join/org/org_invite_123')).toEqual({
      screen: '/organization-invites',
      params: { id: 'org_invite_123' },
      source: 'universal',
    });
  });

  it('parses universal team invite links into the in-app invite screen', () => {
    expect(parseDeepLink('https://varsityhub.app/join/team/team_invite_123')).toEqual({
      screen: '/team-invites',
      params: { id: 'team_invite_123' },
      source: 'universal',
    });
  });

  it('parses native manage-subscription links used by billing emails', () => {
    expect(parseDeepLink('varsityhubmobile://manage-subscription')).toEqual({
      screen: '/settings/manage-subscription',
      params: {},
      source: 'scheme',
    });
  });

  it('parses universal manage-subscription links used by billing emails', () => {
    expect(parseDeepLink('https://varsityhub.app/settings/manage-subscription')).toEqual({
      screen: '/settings/manage-subscription',
      params: {},
      source: 'universal',
    });
  });

  it('parses native root settings links', () => {
    expect(parseDeepLink('varsityhubmobile://settings')).toEqual({
      screen: '/settings',
      params: {},
      source: 'scheme',
    });
  });

  it('parses universal root settings links', () => {
    expect(parseDeepLink('https://varsityhub.app/settings')).toEqual({
      screen: '/settings',
      params: {},
      source: 'universal',
    });
  });

  it('parses universal verification links and drops the unused token param (audit #13)', () => {
    // The verify flow confirms via an authenticated POST /verify/confirm with a
    // user-entered code — there is no `token` query param. It was removed from the
    // allowlist, so it must now be dropped while `email` still passes.
    expect(
      parseDeepLink('https://varsityhub.app/verify?token=123456&email=user%40example.com')
    ).toEqual({
      screen: '/verify',
      params: {
        email: 'user@example.com',
      },
      source: 'universal',
    });
  });

  it('fails closed: drops unlisted/injected params not on a route allowlist', () => {
    // Trust-boundary guarantee — an unlisted param (incl. privilege-shaped ones)
    // must never survive into navigation params for an allowlisted route.
    const result = parseDeepLink(
      'https://varsityhub.app/verify?email=user%40example.com&role=owner&is_admin=1&token=abc'
    );
    expect(result?.screen).toBe('/verify');
    expect(result?.params).toEqual({ email: 'user@example.com' });
    expect(result?.params).not.toHaveProperty('role');
    expect(result?.params).not.toHaveProperty('is_admin');
    expect(result?.params).not.toHaveProperty('token');
  });

  it('parses universal admin dashboard review links used by approval emails', () => {
    expect(
      parseDeepLink(
        'https://varsityhub.app/admin-dashboard?review=league_approval&league_id=org-123&action=approve'
      )
    ).toEqual({
      screen: '/admin-dashboard',
      params: {
        review: 'league_approval',
        league_id: 'org-123',
        action: 'approve',
      },
      source: 'universal',
    });
  });

  it('parses universal admin ads links used by review handoff pages', () => {
    expect(parseDeepLink('https://varsityhub.app/admin-ads?ad_id=ad-123&action=reject')).toEqual({
      screen: '/admin-ads',
      params: {
        ad_id: 'ad-123',
        action: 'reject',
      },
      source: 'universal',
    });
  });

  it('parses universal event approval links used by review emails', () => {
    expect(
      parseDeepLink(
        'https://varsityhub.app/event-approvals?event_id=evt-123&review_kind=game&action=approve'
      )
    ).toEqual({
      screen: '/event-approvals',
      params: {
        event_id: 'evt-123',
        review_kind: 'game',
        action: 'approve',
      },
      source: 'universal',
    });
  });

  it('parses universal organization join-request links used by review emails', () => {
    expect(
      parseDeepLink(
        'https://varsityhub.app/organization-join-requests?organization_id=org-123&organization_name=Example+League&request_id=req-456&action=approve'
      )
    ).toEqual({
      screen: '/organization-join-requests',
      params: {
        organization_id: 'org-123',
        organization_name: 'Example League',
        request_id: 'req-456',
        action: 'approve',
      },
      source: 'universal',
    });
  });

  it('parses universal team-hub links into the canonical organization tools route', () => {
    expect(parseDeepLink('https://varsityhub.app/team-hub')).toEqual({
      screen: '/organization',
      params: { tab: 'teams' },
      source: 'universal',
    });
  });

  it('parses canonical organization tools links with query params', () => {
    expect(parseDeepLink('https://varsityhub.app/organization?tab=requests&id=org-123')).toEqual({
      screen: '/organization',
      params: {
        tab: 'requests',
        id: 'org-123',
      },
      source: 'universal',
    });
  });

  it('parses universal create-fan-event links used by event rejection emails', () => {
    expect(parseDeepLink('https://varsityhub.app/create-fan-event')).toEqual({
      screen: '/create-fan-event',
      params: {},
      source: 'universal',
    });
  });

  // Regression matrix for the universal-link contract between server
  // (shareLanding.ts + email.ts) and the mobile parser. If any of these
  // fail, taps on shared/email links land users on the web fallback
  // instead of the native screen.
  describe('plural universal-link aliases (server-served share URLs)', () => {
    const cases: Array<[string, string, string]> = [
      ['/posts/post_abc123', '/post-detail', 'post_abc123'],
      ['/games/game_abc123', '/game-detail', 'game_abc123'],
      ['/events/event_abc123', '/event-detail', 'event_abc123'],
      ['/teams/team_abc123', '/team-page', 'team_abc123'],
      ['/organizations/org_abc123', '/organizations/[id]', 'org_abc123'],
      ['/users/user_abc123', '/user-profile', 'user_abc123'],
    ];
    for (const [path, expectedScreen, expectedId] of cases) {
      it(`parses universal ${path} into ${expectedScreen}`, () => {
        expect(parseDeepLink(`https://varsityhub.app${path}`)).toEqual({
          screen: expectedScreen,
          params: { id: expectedId },
          source: 'universal',
        });
      });
    }
  });

  describe('singular universal-link forms remain supported (legacy share URLs)', () => {
    const cases: Array<[string, string]> = [
      ['/post/post_abc123', '/post-detail'],
      ['/game/game_abc123', '/game-detail'],
      ['/event/event_abc123', '/event-detail'],
      ['/team/team_abc123', '/team-page'],
      ['/user/user_abc123', '/user-profile'],
    ];
    for (const [path, expectedScreen] of cases) {
      it(`parses universal ${path} into ${expectedScreen}`, () => {
        const result = parseDeepLink(`https://varsityhub.app${path}`);
        expect(result?.screen).toBe(expectedScreen);
        expect(result?.source).toBe('universal');
      });
    }
  });

  describe('multi-segment routes without a resource ID', () => {
    it('parses native scheme settings/manage-subscription', () => {
      expect(parseDeepLink('varsityhubmobile://settings/manage-subscription')).toEqual({
        screen: '/settings/manage-subscription',
        params: {},
        source: 'scheme',
      });
    });

    it('parses /join/org without an invite ID (generic invite landing)', () => {
      expect(parseDeepLink('https://varsityhub.app/join/org')).toEqual({
        screen: '/organization-invites',
        params: {},
        source: 'universal',
      });
    });
  });

  describe('rejects unknown shapes', () => {
    it('returns null for an unknown plural resource', () => {
      expect(parseDeepLink('https://varsityhub.app/foos/abc')).toBeNull();
    });

    it('returns null for an unknown multi-segment path', () => {
      expect(parseDeepLink('https://varsityhub.app/settings/something-not-real')).toBeNull();
    });

    it('returns null for malformed IDs that fail validation', () => {
      // Spaces aren't allowed by isValidDeepLinkId
      expect(parseDeepLink('https://varsityhub.app/posts/has spaces')).toBeNull();
    });
  });
});
