/**
 * Regression: malformed request URLs (e.g. bot probes like /%c0%2eenv with
 * invalid percent-encoding) make Express throw a URIError from
 * decodeURIComponent during route matching. The error handler must treat this
 * as a 400 client error and must NOT report it to Sentry — otherwise every
 * internet scanner hitting the public site produces a bogus 500 + alert.
 */
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const captureExceptionMock = jest.fn();

jest.unstable_mockModule('../lib/sentry.js', () => ({
  captureException: captureExceptionMock,
  getSentryRouteTag: () => 'malformed',
}));

const { errorHandler } = await import('../middleware/errorHandler.js');

function makeRes() {
  const res: any = {
    statusCode: 200,
    headersSent: false,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

const req: any = { path: '/%c0%2eenv', method: 'GET', body: {} };

describe('errorHandler — malformed request URLs', () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  it('responds 400 for a URIError and does not report to Sentry', () => {
    const res = makeRes();
    const err = new URIError("Failed to decode param '/%c0%2eenv'");

    errorHandler(err as any, req, res, jest.fn() as any);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: 'Malformed request URL', code: 'BAD_REQUEST' });
    expect(captureExceptionMock).not.toHaveBeenCalled();
  });

  it('still reports genuine unknown errors to Sentry (guard is narrow)', () => {
    const res = makeRes();
    const err = new Error('something genuinely broke');

    errorHandler(err as any, req, res, jest.fn() as any);

    expect(res.statusCode).toBe(500);
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });
});
