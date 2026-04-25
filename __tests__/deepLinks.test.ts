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
    expect(
      parseDeepLink('https://varsityhub.app/admin-ads?ad_id=ad-123&action=reject')
    ).toEqual({
      screen: '/admin-ads',
      params: {
        ad_id: 'ad-123',
        action: 'reject',
      },
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
