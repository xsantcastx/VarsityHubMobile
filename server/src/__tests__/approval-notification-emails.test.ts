/**
 * getApprovalNotificationEmails must ALWAYS include the super admin
 * (customerservice@varsityhub.app) so banner-ad / new-org approvals are never
 * silently diverted away from customer service by ADMIN_EMAILS config.
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { SUPER_ADMIN_EMAIL, getApprovalNotificationEmails } from '../lib/adminEmails.js';

const ORIGINAL = {
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  ADMIN_NOTIFICATION_EMAILS: process.env.ADMIN_NOTIFICATION_EMAILS,
};

beforeEach(() => {
  delete process.env.ADMIN_EMAILS;
  delete process.env.ADMIN_NOTIFICATION_EMAILS;
});

afterEach(() => {
  process.env.ADMIN_EMAILS = ORIGINAL.ADMIN_EMAILS;
  process.env.ADMIN_NOTIFICATION_EMAILS = ORIGINAL.ADMIN_NOTIFICATION_EMAILS;
});

describe('getApprovalNotificationEmails', () => {
  it('includes the super admin when no admin env vars are set', () => {
    expect(getApprovalNotificationEmails()).toContain(SUPER_ADMIN_EMAIL);
  });

  it('includes the super admin even when ADMIN_EMAILS points elsewhere (the original bug)', () => {
    process.env.ADMIN_EMAILS = 'admin@varsityhub.app,owner@varsityhub.app';
    const emails = getApprovalNotificationEmails();
    expect(emails).toContain('admin@varsityhub.app');
    expect(emails).toContain(SUPER_ADMIN_EMAIL);
  });

  it('includes the super admin even when ADMIN_NOTIFICATION_EMAILS is set without it', () => {
    process.env.ADMIN_NOTIFICATION_EMAILS = 'someone@varsityhub.app';
    expect(getApprovalNotificationEmails()).toContain(SUPER_ADMIN_EMAIL);
  });

  it('does not duplicate the super admin when it is already configured', () => {
    process.env.ADMIN_NOTIFICATION_EMAILS = SUPER_ADMIN_EMAIL;
    const count = getApprovalNotificationEmails().filter(e => e === SUPER_ADMIN_EMAIL).length;
    expect(count).toBe(1);
  });
});
