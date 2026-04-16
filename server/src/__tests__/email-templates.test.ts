/**
 * Unit tests for email template helpers (isSendGridConfigured, getMissingEmailTemplates)
 */
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';

describe('Email template helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('isSendGridConfigured returns false when SENDGRID_API_KEY is empty', async () => {
    process.env.SENDGRID_API_KEY = '';
    const { isSendGridConfigured } = await import('../lib/email.js');
    expect(isSendGridConfigured()).toBe(false);
  });

  it('isSendGridConfigured returns true when SENDGRID_API_KEY is set', async () => {
    process.env.SENDGRID_API_KEY = 'SG.test-key';
    const { isSendGridConfigured } = await import('../lib/email.js');
    expect(isSendGridConfigured()).toBe(true);
  });

  it('getMissingEmailTemplates returns required keys when env vars are empty', async () => {
    process.env.SENDGRID_VERIFICATION_TEMPLATE_ID = '';
    process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID = '';
    process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID = '';
    process.env.SENDGRID_ORG_INVITE_TEMPLATE_ID = '';
    const { getMissingEmailTemplates } = await import('../lib/email.js');
    const missing = getMissingEmailTemplates();
    expect(missing).toContain('verification');
    expect(missing).toContain('password_reset');
    expect(missing).toContain('team_invite');
    expect(missing).toContain('org_invite');
  });

  it('getMissingEmailTemplates returns empty when all required are set', async () => {
    process.env.SENDGRID_VERIFICATION_TEMPLATE_ID = 'd-xxx';
    process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID = 'd-xxx';
    process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID = 'd-xxx';
    process.env.SENDGRID_ORG_INVITE_TEMPLATE_ID = 'd-xxx';
    const { getMissingEmailTemplates } = await import('../lib/email.js');
    const missing = getMissingEmailTemplates();
    expect(missing).toHaveLength(0);
  });
});
