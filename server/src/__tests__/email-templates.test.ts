/**
 * Unit tests for email template helpers (isSendGridConfigured, getMissingEmailTemplates)
 */
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';

describe('Email template helpers', () => {
  const originalEnv = process.env;
  const validTemplateId = 'd-0123456789abcdef0123456789abcdef';

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
    process.env.SENDGRID_VERIFICATION_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_ORG_INVITE_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_EVENT_APPROVED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_EVENT_DENIED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_EVENT_CANCELED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_PAYMENT_FAILED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_AD_APPROVED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_AD_REJECTED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_ORG_APPROVAL_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_ORG_DENIAL_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_PARENTAL_CONSENT_REQUEST_TEMPLATE_ID = validTemplateId;
    const { getMissingEmailTemplates } = await import('../lib/email.js');
    const missing = getMissingEmailTemplates();
    expect(missing).toHaveLength(0);
  });

  it('treats invalid template IDs as missing', async () => {
    process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID = 'd-not-a-real-guid';
    const { getMissingEmailTemplates } = await import('../lib/email.js');
    expect(getMissingEmailTemplates(['TEAM_INVITE'])).toEqual(['team_invite']);
  });

  it('buildLeagueApprovalReviewUrl points into the admin app flow', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    const { buildLeagueApprovalReviewUrl } = await import('../lib/email.js');
    const url = buildLeagueApprovalReviewUrl({ leagueId: 'org_123', action: 'approve' });
    expect(url).toContain('https://varsityhub.app/admin-dashboard');
    expect(url).toContain('review=league_approval');
    expect(url).toContain('league_id=org_123');
    expect(url).toContain('action=approve');
  });

  it('buildCoachApplicationReviewUrl points to a browser-safe admin dashboard URL', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    const { buildCoachApplicationReviewUrl } = await import('../lib/email.js');
    const url = buildCoachApplicationReviewUrl({ coachId: 'user_123', action: 'reject' });
    expect(url).toContain('https://varsityhub.app/admin-dashboard');
    expect(url).toContain('review=coach_application');
    expect(url).toContain('coach_id=user_123');
    expect(url).toContain('action=reject');
  });

  it('buildCoachJoinRequestReviewUrl points into the organization join-request app flow', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    const { buildCoachJoinRequestReviewUrl } = await import('../lib/email.js');
    const url = buildCoachJoinRequestReviewUrl({
      organizationId: 'org_123',
      organizationName: 'Example League',
      requestId: 'req_456',
      action: 'approve',
    });
    expect(url).toContain('https://varsityhub.app/organization-join-requests');
    expect(url).toContain('organization_id=org_123');
    expect(url).toContain('organization_name=Example+League');
    expect(url).toContain('request_id=req_456');
    expect(url).toContain('action=approve');
  });

  it('buildEventReviewUrl points into the event approvals app flow', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    const { buildEventReviewUrl } = await import('../lib/email.js');
    const url = buildEventReviewUrl({
      reviewId: 'evt_123',
      reviewKind: 'game',
      action: 'reject',
    });
    expect(url).toContain('https://varsityhub.app/event-approvals');
    expect(url).toContain('event_id=evt_123');
    expect(url).toContain('review_kind=game');
    expect(url).toContain('action=reject');
  });

  it('buildAdReviewUrl points to a browser-safe admin ads URL', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    const { buildAdReviewUrl } = await import('../lib/email.js');
    const url = buildAdReviewUrl({ adId: 'ad_123', action: 'reject' });
    expect(url).toContain('https://varsityhub.app/admin-ads');
    expect(url).toContain('ad_id=ad_123');
    expect(url).toContain('action=reject');
  });
});
