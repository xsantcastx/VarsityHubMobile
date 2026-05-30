import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const scope = {
  setTag: jest.fn(),
  setContext: jest.fn(),
};

const withScopeMock = jest.fn((callback: (scope: typeof scope) => void) => callback(scope));
const captureExceptionMock = jest.fn();
const captureMessageMock = jest.fn();

jest.unstable_mockModule('@sentry/node', () => ({
  init: jest.fn(),
  withScope: withScopeMock,
  captureException: captureExceptionMock,
  captureMessage: captureMessageMock,
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  configureScope: jest.fn(),
  Handlers: {
    requestHandler: jest.fn(() => jest.fn()),
    tracingHandler: jest.fn(() => jest.fn()),
    errorHandler: jest.fn(() => jest.fn()),
  },
  Integrations: {
    Http: class {},
    OnUncaughtException: class {},
    OnUnhandledRejection: class {},
  },
}));

const { captureException, captureMessage } = await import('../lib/sentry.js');

describe('Sentry scope tagging', () => {
  beforeEach(() => {
    scope.setTag.mockClear();
    scope.setContext.mockClear();
    withScopeMock.mockClear();
    captureExceptionMock.mockClear();
    captureMessageMock.mockClear();
  });

  it('promotes nested extra.context metadata into searchable tags for exceptions', () => {
    captureException(new Error('queue blew up'), {
      extra: {
        context: 'queue_cleanup',
        path: '/admin/coaches/cmpsnx0jt001310ulizn8xxez/approve',
        job: 'cleanup-old-notifications',
        provider: 'sendgrid',
      },
    });

    expect(scope.setTag).toHaveBeenCalledWith('service', 'server');
    expect(scope.setTag).toHaveBeenCalledWith('vh_context', 'queue_cleanup');
    expect(scope.setTag).toHaveBeenCalledWith('route', '/admin/coaches/:id/approve');
    expect(scope.setTag).toHaveBeenCalledWith('job', 'cleanup-old-notifications');
    expect(scope.setTag).toHaveBeenCalledWith('provider', 'sendgrid');
    expect(captureExceptionMock).toHaveBeenCalledWith(expect.any(Error));
  });

  it('keeps explicit top-level context authoritative over nested extra context', () => {
    captureMessage('manual warning', 'warning', {
      context: 'top_level_context',
      route: '/payments/webhook',
      extra: {
        context: 'nested_context',
        route: '/payments/not-used',
        provider: 'stripe',
      },
    });

    expect(scope.setTag).toHaveBeenCalledWith('vh_context', 'top_level_context');
    expect(scope.setTag).toHaveBeenCalledWith('route', '/payments/webhook');
    expect(scope.setTag).toHaveBeenCalledWith('provider', 'stripe');
    expect(captureMessageMock).toHaveBeenCalledWith('manual warning', 'warning');
  });
});
