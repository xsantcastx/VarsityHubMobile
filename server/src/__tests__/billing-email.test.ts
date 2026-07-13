import { describe, it, expect, jest } from '@jest/globals';

const savedNodeEnv = process.env.NODE_ENV;
const savedJestWorker = process.env.JEST_WORKER_ID;
const savedAppBaseUrl = process.env.APP_BASE_URL;

process.env.NODE_ENV = 'development';
delete process.env.JEST_WORKER_ID;
process.env.APP_BASE_URL = 'https://varsityhub.app';
process.env.SENDGRID_PAYMENT_FAILED_TEMPLATE_ID = 'd-0123456789abcdef0123456789abcdef';
process.env.SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID = 'd-fedcba9876543210fedcba9876543210';

const mockSend = jest.fn(async () => ({ success: true }));

jest.unstable_mockModule('../services/email/service.js', () => ({
  getEmailService: jest.fn(async () => ({
    isConfigured: () => true,
    send: mockSend,
  })),
}));

const { sendBillingNoticeEmail } = await import('../lib/email.js');

process.env.NODE_ENV = savedNodeEnv;
process.env.JEST_WORKER_ID = savedJestWorker;
process.env.APP_BASE_URL = savedAppBaseUrl;

describe('Billing Email JSON', () => {
  it('preserves refund context and shared links on payment_failed payloads', async () => {
    mockSend.mockClear();

    const result = await sendBillingNoticeEmail({
      to: 'user@example.com',
      type: 'payment_failed',
      planName: 'Ad Reservation',
      amount: '$10.00',
      perks: ['Your dates were fully booked.', 'You have been fully refunded $10.00.'],
      manageLink: 'https://varsityhub.app/settings/manage-subscription',
    });

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const payload = mockSend.mock.calls[0]![0] as any;
    expect(payload.templateData.updatePaymentLink).toBe(
      'https://varsityhub.app/settings/manage-subscription'
    );
    expect(payload.templateData.perks).toEqual([
      'Your dates were fully booked.',
      'You have been fully refunded $10.00.',
    ]);
    expect(payload.templateData.message_lines).toEqual([
      'Your dates were fully booked.',
      'You have been fully refunded $10.00.',
    ]);
    expect(payload.templateData.additional_context).toContain('fully refunded');
    expect(payload.templateData.privacy_policy_url).toBe('https://varsityhub.app/privacy-policy');
    expect(payload.templateData.community_guidelines_url).toBe(
      'https://varsityhub.app/privacy-policy'
    );
    expect(payload.templateData.website_url).toBe('https://varsityhub.app');
    expect(payload.templateData.support_url).toBe('https://varsityhub.app/support');
  });

  it('maps trial-ending features from perks when explicit featuresLosing is absent', async () => {
    mockSend.mockClear();

    const result = await sendBillingNoticeEmail({
      to: 'user@example.com',
      type: 'trial_ending',
      planName: 'VarsityHub Pro',
      perks: ['Unlimited teams', 'Priority support'],
    });

    expect(result).toBe(true);
    expect(mockSend).toHaveBeenCalledTimes(1);

    const payload = mockSend.mock.calls[0]![0] as any;
    expect(payload.templateData.features_losing).toEqual(['Unlimited teams', 'Priority support']);
    expect(payload.templateData.perks).toEqual(['Unlimited teams', 'Priority support']);
    expect(payload.templateData.manageSubscriptionLink).toBe(
      'https://varsityhub.app/settings/manage-subscription'
    );
  });
});
