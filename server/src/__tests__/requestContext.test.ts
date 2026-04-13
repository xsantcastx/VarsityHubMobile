import { describe, expect, it, jest } from '@jest/globals';
import { requestContextMiddleware, resolveIncomingRequestId } from '../middleware/requestContext.js';

describe('request context middleware', () => {
  it('reuses a valid incoming request id', () => {
    expect(resolveIncomingRequestId('abc-123_request')).toBe('abc-123_request');
  });

  it('falls back when the incoming request id is invalid', () => {
    expect(resolveIncomingRequestId('bad value with spaces', () => 'generated-id')).toBe('generated-id');
  });

  it('writes the resolved request id to the request and response', () => {
    const childLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const child = jest.fn().mockReturnValue(childLogger);
    const req: any = {
      headers: { 'x-request-id': 'request-1234' },
      method: 'GET',
      originalUrl: '/health',
      url: '/health',
      log: { child },
      user: undefined,
    };
    const res: any = {
      setHeader: jest.fn(),
    };
    const next = jest.fn();

    requestContextMiddleware(req, res, next);

    expect(req.id).toBe('request-1234');
    expect(req.requestId).toBe('request-1234');
    expect(req.log).toBe(childLogger);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', 'request-1234');
    expect(next).toHaveBeenCalled();
  });
});
