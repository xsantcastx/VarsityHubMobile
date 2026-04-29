/**
 * Unit tests for email template helpers (isSendGridConfigured, getMissingEmailTemplates)
 */
import { describe, expect, it, beforeEach, afterEach, jest } from '@jest/globals';

describe('Email template helpers', () => {
  const originalEnv = process.env;
  const validTemplateId = 'd-0123456789abcdef0123456789abcdef';
  const validHyphenatedTemplateId = 'd-01234567-89ab-cdef-0123-456789abcdef';
  const vanityOrigin = 'https://varsityhub.app';

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.API_BASE_URL = 'https://api.varsityhub.app';
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
    process.env.SENDGRID_AD_PAYMENT_CONFIRMED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_ORG_APPROVAL_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_ORG_DENIAL_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_PARENTAL_CONSENT_REQUEST_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_INVITATION_DECLINED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_EVENT_UPDATED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_CONTENT_REMOVED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_REPORT_DISMISSED_TEMPLATE_ID = validTemplateId;
    process.env.SENDGRID_REPORT_RESOLVED_TEMPLATE_ID = validTemplateId;
    const { getMissingEmailTemplates } = await import('../lib/email.js');
    const missing = getMissingEmailTemplates();
    expect(missing).toHaveLength(0);
  });

  it('treats invalid template IDs as missing', async () => {
    process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID = 'd-not-a-real-guid';
    const { getMissingEmailTemplates } = await import('../lib/email.js');
    expect(getMissingEmailTemplates(['TEAM_INVITE'])).toEqual(['team_invite']);
  });

  it('accepts hyphenated SendGrid template IDs at runtime', async () => {
    process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID = validHyphenatedTemplateId;
    const { getMissingEmailTemplates, isValidSendGridTemplateId } = await import('../lib/email.js');
    expect(isValidSendGridTemplateId(validHyphenatedTemplateId)).toBe(true);
    expect(getMissingEmailTemplates(['TEAM_INVITE'])).toEqual([]);
  });

  it('reports when API and app email links are falling back to canonical vanity hosts', async () => {
    process.env.APP_BASE_URL = 'https://api.varsityhub.app';
    process.env.API_BASE_URL = 'https://varsityhub.app';
    const { getEmailBaseUrlDiagnostics } = await import('../lib/email.js');
    expect(getEmailBaseUrlDiagnostics()).toEqual({
      api: expect.objectContaining({
        envKey: 'API_BASE_URL',
        resolvedValue: 'https://varsityhub.app',
        usedFallback: false,
        reason: 'configured',
      }),
      app: expect.objectContaining({
        envKey: 'APP_BASE_URL',
        resolvedValue: 'https://varsityhub.app',
        usedFallback: true,
        reason: 'blocked_host',
      }),
    });
  });

  it('reports configured email link base URLs when env values are valid', async () => {
    process.env.APP_BASE_URL = 'https://lime.varsityhub.app';
    process.env.API_BASE_URL = 'https://api-production-8ac3.up.railway.app';
    const { getEmailBaseUrlDiagnostics } = await import('../lib/email.js');
    expect(getEmailBaseUrlDiagnostics()).toEqual({
      api: expect.objectContaining({
        envKey: 'API_BASE_URL',
        resolvedValue: 'https://api-production-8ac3.up.railway.app',
        usedFallback: false,
        reason: 'configured',
      }),
      app: expect.objectContaining({
        envKey: 'APP_BASE_URL',
        resolvedValue: 'https://lime.varsityhub.app',
        usedFallback: false,
        reason: 'configured',
      }),
    });
  });

  it('buildLeagueApprovalReviewUrl points into the admin app flow', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    process.env.API_BASE_URL = 'https://api.varsityhub.app';
    const { buildLeagueApprovalReviewUrl } = await import('../lib/email.js');
    const { verifyJwt } = await import('../lib/jwt.js');
    const url = buildLeagueApprovalReviewUrl({ leagueId: 'org_123', action: 'approve' });
    const parsed = new URL(url);
    expect(parsed.origin).toBe(vanityOrigin);
    expect(parsed.pathname).toBe('/organizations/org_123/approve');
    const token = parsed.searchParams.get('token');
    expect(token).toBeTruthy();
    expect(verifyJwt(token!)).toMatchObject({ orgId: 'org_123', action: 'approve_league' });
    expect((verifyJwt(token!) as any)?.jti).toEqual(expect.any(String));
  });

  it('falls back to the vanity domain when the deprecated api subdomain is configured', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    process.env.API_BASE_URL = 'https://api.varsityhub.app';
    const { buildLeagueApprovalReviewUrl } = await import('../lib/email.js');
    const url = buildLeagueApprovalReviewUrl({ leagueId: 'org_123', action: 'approve' });
    const parsed = new URL(url);
    expect(parsed.origin).toBe(vanityOrigin);
    expect(parsed.pathname).toBe('/organizations/org_123/approve');
  });

  it('buildCoachApplicationReviewUrl points to a browser-safe admin dashboard URL', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    process.env.API_BASE_URL = 'https://api.varsityhub.app';
    const { buildCoachApplicationReviewUrl } = await import('../lib/email.js');
    const { verifyJwt } = await import('../lib/jwt.js');
    const url = buildCoachApplicationReviewUrl({ coachId: 'user_123', action: 'reject' });
    const parsed = new URL(url);
    expect(parsed.origin).toBe(vanityOrigin);
    expect(parsed.pathname).toBe('/admin/coaches/user_123/reject');
    const token = parsed.searchParams.get('token');
    expect(token).toBeTruthy();
    expect(verifyJwt(token!)).toMatchObject({ coachId: 'user_123', action: 'reject_coach' });
  });

  it('buildCoachJoinRequestReviewUrl issues a signed-token direct-action URL on the API host', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    process.env.API_BASE_URL = 'https://api.varsityhub.app';
    const { buildCoachJoinRequestReviewUrl } = await import('../lib/email.js');
    const { verifyJwt } = await import('../lib/jwt.js');
    const url = buildCoachJoinRequestReviewUrl({
      organizationId: 'org_123',
      organizationName: 'Example League',
      requestId: 'req_456',
      action: 'approve',
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe(vanityOrigin);
    expect(parsed.pathname).toBe('/organizations/join-requests/req_456/email/approve');
    const token = parsed.searchParams.get('token');
    expect(token).toBeTruthy();
    expect(verifyJwt(token!)).toMatchObject({
      requestId: 'req_456',
      orgId: 'org_123',
      action: 'approve_join_request',
    });
  });

  it('buildCoachJoinRequestReviewUrl falls back to the app deep-link when no requestId is provided', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    process.env.API_BASE_URL = 'https://api.varsityhub.app';
    const { buildCoachJoinRequestReviewUrl } = await import('../lib/email.js');
    const url = buildCoachJoinRequestReviewUrl({
      organizationId: 'org_123',
      organizationName: 'Example League',
      action: 'reject',
    });
    expect(url).toContain(`${vanityOrigin}/organization-join-requests`);
    expect(url).toContain('organization_id=org_123');
    expect(url).toContain('action=reject');
  });

  it('buildEventReviewUrl points into the event approvals app flow', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    process.env.API_BASE_URL = 'https://api.varsityhub.app';
    const { buildEventReviewUrl } = await import('../lib/email.js');
    const { verifyJwt } = await import('../lib/jwt.js');
    const url = buildEventReviewUrl({
      reviewId: 'evt_123',
      reviewKind: 'game',
      action: 'reject',
    });
    const parsed = new URL(url);
    expect(parsed.origin).toBe(vanityOrigin);
    expect(parsed.pathname).toBe('/games/evt_123/reject');
    const token = parsed.searchParams.get('token');
    expect(token).toBeTruthy();
    expect(verifyJwt(token!)).toMatchObject({
      reviewId: 'evt_123',
      reviewKind: 'game',
      action: 'reject_game',
    });
  });

  it('buildAdReviewUrl points to a browser-safe admin ads URL', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    process.env.API_BASE_URL = 'https://api.varsityhub.app';
    const { buildAdReviewUrl } = await import('../lib/email.js');
    const { verifyJwt } = await import('../lib/jwt.js');
    const url = buildAdReviewUrl({ adId: 'ad_123', action: 'reject' });
    const parsed = new URL(url);
    expect(parsed.origin).toBe(vanityOrigin);
    expect(parsed.pathname).toBe('/ads/ad_123/reject');
    const token = parsed.searchParams.get('token');
    expect(token).toBeTruthy();
    expect(verifyJwt(token!)).toMatchObject({ adId: 'ad_123', action: 'reject_ad' });
  });

  it('buildAbuseReportReviewUrl points to a signed abuse-report action URL', async () => {
    process.env.APP_BASE_URL = 'https://varsityhub.app';
    process.env.API_BASE_URL = 'https://api.varsityhub.app';
    const { buildAbuseReportReviewUrl } = await import('../lib/email.js');
    const { verifyJwt } = await import('../lib/jwt.js');
    const url = buildAbuseReportReviewUrl({ reportId: 'rep_123', action: 'dismiss' });
    const parsed = new URL(url);
    expect(parsed.origin).toBe(vanityOrigin);
    expect(parsed.pathname).toBe('/admin/reports/rep_123/dismiss');
    const token = parsed.searchParams.get('token');
    expect(token).toBeTruthy();
    expect(verifyJwt(token!)).toMatchObject({
      reportId: 'rep_123',
      action: 'dismiss_abuse_report',
    });
  });
});
