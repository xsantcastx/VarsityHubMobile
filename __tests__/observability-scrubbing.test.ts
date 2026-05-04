import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const sentryMock = {
  init: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
  withScope: jest.fn(),
};

const posthogCapture = jest.fn();
const posthogIdentify = jest.fn();
const posthogCreatePersonProfile = jest.fn();
const posthogSetPersonProperties = jest.fn();
const posthogReset = jest.fn();
const posthogScreen = jest.fn();

jest.mock('@sentry/react-native', () => ({
  __esModule: true,
  default: sentryMock,
  ...sentryMock,
}));

jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    capture: posthogCapture,
    captureException: posthogCapture,
    identify: posthogIdentify,
    createPersonProfile: posthogCreatePersonProfile,
    setPersonProperties: posthogSetPersonProperties,
    reset: posthogReset,
    screen: posthogScreen,
    register: jest.fn(),
  })),
}));

jest.mock('@/config/env', () => ({
  getConfig: () => ({
    sentryDsn: 'https://public@example.sentry.io/123',
    nodeEnv: 'production',
  }),
  getEnvValue: (key: string, fallback = '') => {
    if (key === 'EXPO_PUBLIC_POSTHOG_API_KEY') return 'phc_test_key';
    if (key === 'EXPO_PUBLIC_POSTHOG_HOST') return 'https://us.i.posthog.com';
    return fallback;
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '1.0.2',
      runtimeVersion: '1.0.2',
      sdkVersion: '52.0.0',
    },
  },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
}));

describe('observability payload scrubbing', () => {
  beforeEach(() => {
    jest.resetModules();
    sentryMock.init.mockReset();
    sentryMock.setTag.mockReset();
    sentryMock.setUser.mockReset();
    sentryMock.captureException.mockReset();
    sentryMock.addBreadcrumb.mockReset();
    sentryMock.withScope.mockImplementation(((cb: (scope: any) => void) => {
      cb({
        setTag: jest.fn(),
        setContext: jest.fn(),
      });
    }) as any);
    posthogCapture.mockReset();
    posthogIdentify.mockReset();
    posthogCreatePersonProfile.mockReset();
    posthogSetPersonProperties.mockReset();
    posthogReset.mockReset();
    posthogScreen.mockReset();
    (global as any).__DEV__ = false;
  });

  it('redacts sensitive fields from Sentry exception context and tags', () => {
    const scope = {
      setTag: jest.fn(),
      setContext: jest.fn(),
    };
    sentryMock.withScope.mockImplementation(((cb: (currentScope: typeof scope) => void) => cb(scope)) as any);

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sentry = require('@/utils/sentry') as typeof import('@/utils/sentry');

    sentry.initSentry();
    sentry.captureException(new Error('boom'), {
      token: 'secret-token',
      nested: { email: 'coach@example.com', keep: 'ok' },
      tags: {
        route: '/organization',
        authorization: 'Bearer secret-token',
        context: 'coach_org_tools',
      },
    });

    expect(scope.setContext).toHaveBeenCalledWith(
      'custom',
      expect.objectContaining({
        token: '[redacted]',
        nested: expect.objectContaining({
          email: '[redacted]',
          keep: 'ok',
        }),
      })
    );
    expect(scope.setTag).toHaveBeenCalledWith('route', '/organization');
    expect(scope.setTag).toHaveBeenCalledWith('context', 'coach_org_tools');
    expect(scope.setTag).not.toHaveBeenCalledWith('authorization', expect.anything());
  });

  it('redacts sensitive analytics properties before sending to PostHog', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const analyticsModule = require('@/utils/analytics') as typeof import('@/utils/analytics');

    analyticsModule.initAnalytics();
    analyticsModule.analytics.track('event_created', {
      token: 'secret-token',
      nested: { email: 'coach@example.com', keep: 'ok' },
      attendees: [{ phone: '5551234567' }, { keep: true }],
    });

    expect(posthogCapture).toHaveBeenCalledWith(
      'event_created',
      expect.objectContaining({
        token: '[redacted]',
      })
    );

    const payload = posthogCapture.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(String(payload.nested)).toContain('"email":"[redacted]"');
    expect(String(payload.nested)).toContain('"keep":"ok"');
    expect(Array.isArray(payload.attendees)).toBe(true);
    expect(String((payload.attendees as unknown[])[0])).toContain('"phone":"[redacted]"');
  });
});
