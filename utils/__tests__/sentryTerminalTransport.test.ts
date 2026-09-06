const mockSetFingerprint = jest.fn();
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setTag: jest.fn(),
  captureException: jest.fn(),
  withScope: jest.fn(callback =>
    callback({ setTag: jest.fn(), setContext: jest.fn(), setFingerprint: mockSetFingerprint })
  ),
}));
jest.mock('@/config/env', () => ({
  getConfig: () => ({ sentryDsn: 'https://test@o1.ingest.sentry.io/1', nodeEnv: 'production' }),
}));
jest.mock('@/utils/analytics', () => ({ captureAnalyticsException: jest.fn() }));
import * as Sentry from '@sentry/react-native';
import { initSentry, captureException } from '../sentry';

describe('terminal transport telemetry', () => {
  const originalDev = __DEV__;
  beforeEach(() => {
    (global as any).__DEV__ = false;
    jest.clearAllMocks();
    initSentry();
  });
  afterEach(() => {
    (global as any).__DEV__ = originalDev;
  });

  it.each([0, 408, 502, 503])(
    'retains terminal status %s at both Sentry filtering stages',
    status => {
      const error = Object.assign(new Error('Unavailable'), { status });
      const beforeSend = (jest.mocked(Sentry.init).mock.calls[0][0] as any).beforeSend;
      expect(beforeSend({}, { originalException: error })).toBeNull();
      const event = { tags: { terminal_transport: 'true' } };
      expect(beforeSend(event, { originalException: error })).toBe(event);
      captureException(error);
      expect(Sentry.captureException).not.toHaveBeenCalled();
      captureException(error, { tags: event.tags });
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    }
  );
});

it('passes a stable failure fingerprint to Sentry rather than custom context only', () => {
  const original = __DEV__;
  (global as any).__DEV__ = false;
  try {
    initSentry();
    captureException(new Error('Recovery failed'), {
      fingerprint: ['ad_receipt_recovery', 'verify'],
    });
    expect(mockSetFingerprint).toHaveBeenCalledWith(['ad_receipt_recovery', 'verify']);
  } finally {
    (global as any).__DEV__ = original;
  }
});
