/**
 * beforeSend geofence filter — expected posting-flow 403s
 * (POSTING_WINDOW_CLOSED, TOO_FAR_FROM_VENUE, LOCATION_REQUIRED,
 * NO_EVENT_LOCATION) are handled in-screen and must never reach Sentry.
 */

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  setTag: jest.fn(),
  setUser: jest.fn(),
  withScope: jest.fn(),
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));
jest.mock('@/config/env', () => ({
  getConfig: () => ({ sentryDsn: '', nodeEnv: 'test' }),
}));
jest.mock('@/utils/analytics', () => ({
  captureAnalyticsException: jest.fn(),
}));

import { isExpectedGeofenceBusinessError } from '@/utils/sentry';

/** Mirror the error shape thrown by api/http.ts for a JSON 403. */
function makeHttpError(code: string): Error {
  const err: any = new Error(code);
  err.status = 403;
  err.data = { error: code, message: 'human readable reason' };
  return err;
}

describe('isExpectedGeofenceBusinessError', () => {
  it.each([
    'POSTING_WINDOW_CLOSED',
    'TOO_FAR_FROM_VENUE',
    'LOCATION_REQUIRED',
    'NO_EVENT_LOCATION',
  ])('drops api/http.ts-shaped 403 errors carrying code %s', code => {
    expect(isExpectedGeofenceBusinessError(makeHttpError(code))).toBe(true);
  });

  it('matches the code inside the error message when data is absent', () => {
    const err = new Error('Request failed: TOO_FAR_FROM_VENUE');
    expect(isExpectedGeofenceBusinessError(err)).toBe(true);
  });

  it('matches the code inside the event exception value', () => {
    const event = { exception: { values: [{ value: 'POSTING_WINDOW_CLOSED' }] } };
    expect(isExpectedGeofenceBusinessError(undefined, event)).toBe(true);
  });

  it('matches the code inside event tags', () => {
    const event = { tags: { error_code: 'LOCATION_REQUIRED' } };
    expect(isExpectedGeofenceBusinessError(undefined, event)).toBe(true);
  });

  it('keeps unrelated errors', () => {
    expect(isExpectedGeofenceBusinessError(new Error('Network request failed'))).toBe(false);
    expect(isExpectedGeofenceBusinessError(makeHttpError('EVENT_NOT_FOUND'))).toBe(false);
    expect(
      isExpectedGeofenceBusinessError(undefined, {
        exception: { values: [{ value: 'TypeError: cannot read property' }] },
        tags: { context: 'create-post' },
      })
    ).toBe(false);
  });
});
