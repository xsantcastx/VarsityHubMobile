import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const savedNodeEnv = process.env.NODE_ENV;
const savedJestWorker = process.env.JEST_WORKER_ID;
const savedAppBaseUrl = process.env.APP_BASE_URL;
const savedApiBaseUrl = process.env.API_BASE_URL;
const railwayApiOrigin = 'https://api-production-8ac3.up.railway.app';

process.env.NODE_ENV = 'development';
delete process.env.JEST_WORKER_ID;
process.env.APP_BASE_URL = 'https://varsityhub.app';
process.env.API_BASE_URL = 'https://api.varsityhub.app';
delete process.env.SENDGRID_PARENTAL_CONSENT_REQUEST_TEMPLATE_ID;
delete process.env.SENDGRID_AD_TAKEN_DOWN_PENDING_REVIEW_TEMPLATE_ID;

const mockSend = jest.fn(async () => ({ success: true }));
const mockCaptureException = jest.fn();
const mockCaptureMessage = jest.fn();

jest.unstable_mockModule('../services/email/service.js', () => ({
  getEmailService: jest.fn(async () => ({
    isConfigured: () => true,
    send: mockSend,
  })),
}));

jest.unstable_mockModule('../lib/sentry.js', () => ({
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
}));

const { sendParentalConsentRequestEmail, sendAdTakenDownPendingReviewEmail } =
  await import('../lib/email.js');

process.env.NODE_ENV = savedNodeEnv;
process.env.JEST_WORKER_ID = savedJestWorker;
process.env.APP_BASE_URL = savedAppBaseUrl;
process.env.API_BASE_URL = savedApiBaseUrl;

describe('Local email fallbacks', () => {
  beforeEach(() => {
    mockSend.mockClear();
    mockCaptureException.mockClear();
    mockCaptureMessage.mockClear();
  });

  it('sends parental consent email via local HTML fallback when hosted template is unset', async () => {
    const result = await sendParentalConsentRequestEmail({
      to: 'parent@example.com',
      minorDisplayName: 'Jordan Smith',
      minorEmail: 'jordan@example.com',
      consentToken: 'consent-token-123',
      expiresInDays: 10,
    });

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const payload = mockSend.mock.calls[0]![0] as any;
    expect(payload.templateId).toBeUndefined();
    expect(payload.subject).toBe("Approve Jordan Smith's VarsityHub account");
    expect(payload.html).toContain('Jordan Smith');
    expect(payload.html).toContain(`${railwayApiOrigin}/consent/consent-token-123`);
    expect(payload.text).toContain(`Approve: ${railwayApiOrigin}/consent/consent-token-123`);
    expect(payload.metadata).toEqual({ audit_privacy: 'minor' });
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('Hosted SendGrid template missing; using local HTML fallback'),
      'warning',
      expect.objectContaining({
        context: 'sendgrid_local_fallback_used',
      })
    );
  });

  it('sends ad takedown email via local HTML fallback when hosted template is unset', async () => {
    const result = await sendAdTakenDownPendingReviewEmail({
      to: 'advertiser@example.com',
      businessName: 'Acme Pizza',
      reason: 'Creative requires manual review',
    });

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const payload = mockSend.mock.calls[0]![0] as any;
    expect(payload.templateId).toBeUndefined();
    expect(payload.subject).toBe('Ad update for "Acme Pizza"');
    expect(payload.html).toContain('Acme Pizza');
    expect(payload.html).toContain('Creative requires manual review');
    expect(payload.text).toContain('Reason: Creative requires manual review');
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      expect.stringContaining('Hosted SendGrid template missing; using local HTML fallback'),
      'warning',
      expect.objectContaining({
        context: 'sendgrid_local_fallback_used',
      })
    );
  });
});
