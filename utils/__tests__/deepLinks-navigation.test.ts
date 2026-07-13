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

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock('@/context/NavigationHistoryContext', () => ({
  getCurrentHref: jest.fn(),
}));

import { router } from 'expo-router';
import { getCurrentHref } from '@/context/NavigationHistoryContext';
import { handleDeepLink } from '@/utils/deepLinks';

describe('handleDeepLink navigation contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('pushes when the deep link target differs from the current route', () => {
    (getCurrentHref as jest.Mock).mockReturnValue('/(tabs)/feed');

    expect(handleDeepLink('https://varsityhub.app/settings/manage-subscription')).toBe(true);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/settings/manage-subscription',
      params: {},
    });
  });

  it('does not push when the deep link already matches the current route', () => {
    (getCurrentHref as jest.Mock).mockReturnValue('/organization?id=org-123&tab=requests');

    expect(handleDeepLink('https://varsityhub.app/organization?tab=requests&id=org-123')).toBe(
      true
    );

    expect(router.push).not.toHaveBeenCalled();
  });
});
