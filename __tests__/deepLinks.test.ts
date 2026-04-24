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
});
