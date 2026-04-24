jest.mock('expo-linking', () => ({
  parse: jest.fn((url: string) => {
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

    const parsed = new URL(url);
    return {
      scheme: parsed.protocol.replace(':', ''),
      hostname: parsed.hostname,
      path: parsed.pathname,
      queryParams: Object.fromEntries(parsed.searchParams.entries()),
    };
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
});
