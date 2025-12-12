import { paymentErrorLogging, paymentLogging, requestLogging } from '../src/middleware/logging';

describe('Logging Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/test',
      body: {},
    };
    mockRes = {
      statusCode: 200,
      on: jest.fn(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('requestLogging', () => {
    test('adds requestId and startTime to request', () => {
      requestLogging(mockReq, mockRes, mockNext);

      expect(mockReq.requestId).toBeDefined();
      expect(mockReq.startTime).toBeDefined();
      expect(typeof mockReq.requestId).toBe('string');
      expect(typeof mockReq.startTime).toBe('number');
      expect(mockNext).toHaveBeenCalled();
    });

    test('logs incoming request with UUID and method', () => {
      requestLogging(mockReq, mockRes, mockNext);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logArgs = consoleLogSpy.mock.calls[0][0];
      expect(logArgs).toContain('→ GET /test');
      expect(logArgs).toMatch(/\[[\w-]+\]/); // UUID pattern
    });

    test('logs response on finish event with timing', () => {
      requestLogging(mockReq, mockRes, mockNext);

      // Simulate response finish
      const finishHandler = mockRes.on.mock.calls.find(
        (call: any) => call[0] === 'finish'
      )?.[1];

      expect(finishHandler).toBeDefined();
      
      // Call the finish handler
      finishHandler();

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      const responseLog = consoleLogSpy.mock.calls[1][0];
      expect(responseLog).toContain('← GET /test');
      expect(responseLog).toContain('200');
      expect(responseLog).toMatch(/\(\d+ms\)/); // Timing
    });

    test('generates unique requestId for each request', () => {
      const req1: any = { method: 'GET', path: '/a' };
      const req2: any = { method: 'POST', path: '/b' };
      const res1: any = { on: jest.fn() };
      const res2: any = { on: jest.fn() };

      requestLogging(req1, res1, mockNext);
      requestLogging(req2, res2, mockNext);

      expect(req1.requestId).not.toBe(req2.requestId);
    });
  });

  describe('paymentLogging', () => {
    beforeEach(() => {
      mockReq = {
        method: 'POST',
        path: '/payments/checkout',
        body: {
          plan: 'veteran',
          team_count: 3,
          promo_code: 'SAVE10',
        },
        requestId: 'test-uuid-123',
      };
    });

    test('logs payment request with plan details', () => {
      paymentLogging(mockReq, mockRes, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('💳 Payment Request')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Plan: veteran')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Team Count: 3')
      );
      expect(mockNext).toHaveBeenCalled();
    });

    test('does not log promo_code if missing', () => {
      mockReq.body.promo_code = undefined;
      paymentLogging(mockReq, mockRes, mockNext);

      const allLogs = consoleLogSpy.mock.calls.map((call) => call[0]).join(' ');
      expect(allLogs).not.toContain('Promo');
    });

    test('intercepts res.json to log session ID', () => {
      const originalJson = mockRes.json;
      paymentLogging(mockReq, mockRes, mockNext);

      expect(mockRes.json).not.toBe(originalJson);

      // Call intercepted json
      const testBody = { sessionId: 'cs_test_123', url: 'https://checkout.stripe.com/...' };
      mockRes.json(testBody);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stripe Session: cs_test_123')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Checkout URL: https://checkout.stripe.com/')
      );
    });

    test('handles missing requestId gracefully', () => {
      mockReq.requestId = undefined;
      paymentLogging(mockReq, mockRes, mockNext);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('paymentErrorLogging', () => {
    let mockErr: any;

    beforeEach(() => {
      mockErr = {
        statusCode: 402,
        type: 'StripeCardError',
        message: 'Your card was declined',
        raw: {
          decline_code: 'insufficient_funds',
          payment_intent: { id: 'pi_123' },
        },
      };
      mockReq.requestId = 'error-uuid-456';
    });

    test('logs payment error with status code and type', () => {
      paymentErrorLogging(mockErr, mockReq, mockRes, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Payment Error')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Status: 402')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Type: StripeCardError')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Message: Your card was declined')
      );
      expect(mockNext).toHaveBeenCalledWith(mockErr);
    });

    test('logs raw error details if available', () => {
      paymentErrorLogging(mockErr, mockReq, mockRes, mockNext);

      const allLogs = consoleLogSpy.mock.calls.map((call) => call[0]).join(' ');
      expect(allLogs).toContain('decline_code');
      expect(allLogs).toContain('insufficient_funds');
    });

    test('handles missing raw property gracefully', () => {
      mockErr.raw = undefined;
      paymentErrorLogging(mockErr, mockReq, mockRes, mockNext);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith(mockErr);
    });

    test('logs generic errors without Stripe-specific fields', () => {
      const genericErr = new Error('Network timeout');
      paymentErrorLogging(genericErr, mockReq, mockRes, mockNext);

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ Payment Error')
      );
      expect(mockNext).toHaveBeenCalledWith(genericErr);
    });

    test('includes requestId in error logs', () => {
      paymentErrorLogging(mockErr, mockReq, mockRes, mockNext);

      const allLogs = consoleLogSpy.mock.calls.map((call) => call[0]).join(' ');
      expect(allLogs).toContain('[error-uuid-456]');
    });
  });
});
