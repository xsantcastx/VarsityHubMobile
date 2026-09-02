import { describe, expect, it } from '@jest/globals';

import { redactTokenQueryParams, scrubSentryRequestData } from '../lib/sentry.js';

describe('scrubSentryRequestData', () => {
  it('strips cookies, auth/cookie headers, and body, and redacts token query params', () => {
    const event = {
      request: {
        method: 'POST',
        url: 'https://api.varsityhub.app/auth/login?token=abc&x=1',
        query_string: 'token=abc&x=1',
        cookies: { session: 'super-secret-session' },
        headers: {
          Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.sig',
          Cookie: 'session=super-secret-session',
          'Content-Type': 'application/json',
        },
        data: { email: 'user@example.com', password: 'hunter2' },
      },
    };

    const scrubbed = scrubSentryRequestData(event);

    // No cookies survive.
    expect(scrubbed.request.cookies).toBeUndefined();

    // Authorization + Cookie headers removed (any casing); benign headers kept.
    expect(scrubbed.request.headers.Authorization).toBeUndefined();
    expect(scrubbed.request.headers.Cookie).toBeUndefined();
    expect(scrubbed.request.headers['Content-Type']).toBe('application/json');

    // Request body (plaintext password/email) removed entirely.
    expect(scrubbed.request.data).toBeUndefined();

    // token query param redacted in both query_string and url; other params kept.
    expect(scrubbed.request.query_string).toBe('token=[redacted]&x=1');
    expect(scrubbed.request.url).toBe('https://api.varsityhub.app/auth/login?token=[redacted]&x=1');
  });

  it('is a no-op when there is no request envelope', () => {
    const event = { exception: { values: [{ type: 'Error', value: 'boom' }] } };
    expect(scrubSentryRequestData(event)).toBe(event);
  });

  it('strips lowercase authorization/cookie header keys too', () => {
    const event = {
      request: {
        headers: { authorization: 'Bearer x', cookie: 'a=b', accept: 'application/json' },
      },
    };
    const scrubbed = scrubSentryRequestData(event);
    expect(scrubbed.request.headers.authorization).toBeUndefined();
    expect(scrubbed.request.headers.cookie).toBeUndefined();
    expect(scrubbed.request.headers.accept).toBe('application/json');
  });

  it('strips operational secret headers', () => {
    const event = {
      request: {
        headers: {
          'x-health-check-secret': 'health-secret',
          'stripe-signature': 'stripe-secret',
          'x-idempotency-key': 'idempotency-key',
          'x-sendgrid-event-webhook-signature': 'sendgrid-secret',
          accept: 'application/json',
        },
      },
    };
    const scrubbed = scrubSentryRequestData(event);
    expect(scrubbed.request.headers['x-health-check-secret']).toBeUndefined();
    expect(scrubbed.request.headers['stripe-signature']).toBeUndefined();
    expect(scrubbed.request.headers['x-idempotency-key']).toBeUndefined();
    expect(scrubbed.request.headers['x-sendgrid-event-webhook-signature']).toBeUndefined();
    expect(scrubbed.request.headers.accept).toBe('application/json');
  });
});

describe('redactTokenQueryParams', () => {
  it('redacts token and access_token values only, preserving other params', () => {
    expect(redactTokenQueryParams('token=abc&x=1')).toBe('token=[redacted]&x=1');
    expect(redactTokenQueryParams('/p?access_token=zzz&y=2')).toBe(
      '/p?access_token=[redacted]&y=2'
    );
  });

  it('does not match unrelated params containing "token"', () => {
    expect(redactTokenQueryParams('csrf_token=keep&x=1')).toBe('csrf_token=keep&x=1');
  });
});
