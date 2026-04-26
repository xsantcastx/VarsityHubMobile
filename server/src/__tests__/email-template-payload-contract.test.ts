/**
 * SendGrid template ↔ sender payload contract.
 *
 * The audit found three high/medium issues where senders omitted variables
 * the template HTML referenced — emails rendered with blank sections or
 * substituted "Join  Coaching Staff" because teamName was passed empty.
 *
 * This suite reads the local sendgrid-templates/*.html, extracts every
 * {{variable}} reference, then invokes the corresponding sender with a
 * realistic params object and asserts that EVERY template variable
 * resolves to a non-empty value in the captured payload.
 *
 * Caveat: the live SendGrid templates can drift from these local files
 * (the hosted version is the source of truth in production). This test
 * only catches drift in the LOCAL files; pinning against the hosted
 * templates would require a SendGrid API token in CI. Even so, it
 * catches the class of bug that just shipped.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const TEMPLATES_DIR = join(process.cwd(), '..', 'sendgrid-templates');

const savedNodeEnv = process.env.NODE_ENV;
const savedJestWorker = process.env.JEST_WORKER_ID;
const savedAppBaseUrl = process.env.APP_BASE_URL;

process.env.NODE_ENV = 'development';
delete process.env.JEST_WORKER_ID;
process.env.APP_BASE_URL = 'https://varsityhub.app';
const TEST_TEMPLATE_ID = 'd-0123456789abcdef0123456789abcdef';
// Every template ID the senders below resolve through TEMPLATE_IDS. Without
// these set, the senders bail with "Missing SENDGRID_*_TEMPLATE_ID" before
// reaching the send call we want to inspect.
for (const key of [
  'SENDGRID_VERIFICATION_TEMPLATE_ID',
  'SENDGRID_PASSWORD_RESET_TEMPLATE_ID',
  'SENDGRID_TEAM_INVITE_TEMPLATE_ID',
  'SENDGRID_ORG_INVITE_TEMPLATE_ID',
  'SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID',
  'SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID',
  'SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID',
  'SENDGRID_EVENT_APPROVED_TEMPLATE_ID',
  'SENDGRID_EVENT_DENIED_TEMPLATE_ID',
  'SENDGRID_EVENT_CANCELED_TEMPLATE_ID',
  'SENDGRID_PAYMENT_FAILED_TEMPLATE_ID',
  'SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID',
  'SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID',
  'SENDGRID_AD_APPROVED_TEMPLATE_ID',
  'SENDGRID_AD_REJECTED_TEMPLATE_ID',
  'SENDGRID_ORG_APPROVAL_TEMPLATE_ID',
  'SENDGRID_ORG_DENIAL_TEMPLATE_ID',
  'SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID',
  'SENDGRID_PARENTAL_CONSENT_REQUEST_TEMPLATE_ID',
]) {
  process.env[key] = TEST_TEMPLATE_ID;
}

const mockSend = jest.fn(async () => ({ success: true }));

jest.unstable_mockModule('../services/email/service.js', () => ({
  getEmailService: jest.fn(async () => ({
    isConfigured: () => true,
    send: mockSend,
  })),
}));

const {
  sendEventCanceledEmail,
  sendEventDeniedEmail,
  sendOrganizationInviteEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendTeamInviteEmail,
  sendEventApprovedEmail,
  sendEventPendingReviewEmail,
  sendCoachApprovedEmail,
  sendCoachRejectedEmail,
  sendAdPendingReviewEmail,
  sendAdApprovedEmail,
  sendAdRejectedEmail,
  sendLeagueApprovedEmail,
  sendLeagueRejectedEmail,
  sendAdminActionConfirmationEmail,
  sendParentalConsentRequestEmail,
  sendBillingNoticeEmail,
} = await import('../lib/email.js');

process.env.NODE_ENV = savedNodeEnv;
process.env.JEST_WORKER_ID = savedJestWorker;
process.env.APP_BASE_URL = savedAppBaseUrl;

// Handlebars built-ins that don't need a sender-side variable:
//   {{this}}  — current scope inside {{#each}}
//   {{else}}  — conditional alternate (rare bare form)
//   {{@key}}, {{@index}}, {{@first}}, {{@last}} — iteration helpers
const HANDLEBARS_BUILTINS = new Set(['this', 'else']);

function getTemplateVars(filename: string): Set<string> {
  const html = readFileSync(join(TEMPLATES_DIR, filename), 'utf8');
  const matches = html.match(/\{\{([a-z_][a-z0-9_]*)\}\}/gi) ?? [];
  const vars = new Set<string>();
  // A variable wrapped in {{#if VAR}}...{{/if}} (or {{#unless VAR}}) is
  // intentionally optional — the template skips its block when the value
  // is falsy. We don't require the sender to provide it. We only require
  // values for vars that are referenced UNCONDITIONALLY somewhere in the
  // template body.
  const conditionallyGated = new Set<string>();
  for (const m of html.match(/\{\{#(?:if|unless)\s+([a-z_][a-z0-9_]*)\s*\}\}/gi) ?? []) {
    const name = m.match(/\{\{#(?:if|unless)\s+([a-z_][a-z0-9_]*)/i)?.[1];
    if (name) conditionallyGated.add(name);
  }
  for (const m of matches) {
    const name = m.slice(2, -2);
    if (HANDLEBARS_BUILTINS.has(name)) continue;
    if (conditionallyGated.has(name)) continue;
    vars.add(name);
  }
  return vars;
}

function expectAllVarsCovered(templateVars: Set<string>, payload: Record<string, unknown>) {
  const missing: string[] = [];
  for (const v of templateVars) {
    const value = payload[v];
    if (value === undefined || value === null || value === '') {
      missing.push(v);
    }
  }
  expect(missing).toEqual([]);
}

describe('SendGrid template payload contract', () => {
  beforeEach(() => {
    mockSend.mockClear();
  });

  it('event-canceled.html — every {{var}} has a value in the sender payload', async () => {
    const result = await sendEventCanceledEmail({
      to: 'user@example.com',
      recipientName: 'Coach Test',
      eventName: 'Spring Game',
      eventDate: 'Saturday, March 15, 2026',
      eventTime: '2:00 PM',
      eventLocation: 'Westhill HS',
      eventId: 'evt_test_123',
      cancelReason: 'Field unplayable due to weather',
      organizationName: 'Westhill Athletics',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('event-canceled.html'), payload.templateData);
  });

  it('event-denied.html — every {{var}} has a value in the sender payload', async () => {
    const result = await sendEventDeniedEmail({
      to: 'coach@example.com',
      coachName: 'Coach Test',
      eventName: 'Spring Game',
      eventDate: 'Saturday, March 15, 2026',
      denialReason: 'Insufficient details on venue',
      organizationName: 'Westhill Athletics',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('event-denied.html'), payload.templateData);
  });

  it('organization-invitation.html — every {{var}} has a value in the sender payload', async () => {
    const result = await sendOrganizationInviteEmail({
      to: 'invitee@example.com',
      recipientName: 'Coach Test',
      organizationName: 'Westhill Athletics',
      role: 'manager',
      inviterName: 'Coach Carter',
      inviteToken: 'org_invite_abc123',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    // The org-invitation template still uses {{teamName}} as the primary
    // header (legacy from when this was forked from team-invite). Sender
    // mirrors organizationName into teamName so the email reads correctly.
    // This assertion locks that mirroring in until the hosted template is
    // migrated.
    expect(payload.templateData.teamName).toBe('Westhill Athletics');
    expectAllVarsCovered(getTemplateVars('organization-invitation.html'), payload.templateData);
  });

  it('verification-email.html — sendVerificationEmail covers every {{var}}', async () => {
    const result = await sendVerificationEmail('user@example.com', '123456', 'Coach Test');
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('verification-email.html'), payload.templateData);
  });

  it('password-reset.html — sendPasswordResetEmail covers every {{var}}', async () => {
    const result = await sendPasswordResetEmail('user@example.com', '654321');
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('password-reset.html'), payload.templateData);
  });

  it('team-invite.html — sendTeamInviteEmail covers every {{var}}', async () => {
    const result = await sendTeamInviteEmail({
      to: 'invitee@example.com',
      teamName: 'Westhill Cougars',
      recipientName: 'Coach Test',
      organizationName: 'Westhill Athletics',
      role: 'assistant_coach',
      inviterName: 'Coach Carter',
      inviteToken: 'team_invite_abc123',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('team-invite.html'), payload.templateData);
  });

  it('event-approved.html — sendEventApprovedEmail covers every {{var}}', async () => {
    const result = await sendEventApprovedEmail({
      to: 'coach@example.com',
      recipientName: 'Coach Test',
      eventTitle: 'Spring Game',
      eventDate: 'Saturday, March 15, 2026',
      eventTime: '2:00 PM',
      eventLocation: 'Westhill HS',
      eventId: 'evt_test_123',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('event-approved.html'), payload.templateData);
  });

  it('join-request-approved.html — sendCoachApprovedEmail covers every {{var}}', async () => {
    const result = await sendCoachApprovedEmail({
      to: 'coach@example.com',
      coachName: 'Coach Test',
      leagueName: 'Westhill Athletics',
      note: 'Welcome aboard!',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('join-request-approved.html'), payload.templateData);
  });

  it('join-request-denied.html — sendCoachRejectedEmail covers every {{var}}', async () => {
    const result = await sendCoachRejectedEmail({
      to: 'coach@example.com',
      coachName: 'Coach Test',
      leagueName: 'Westhill Athletics',
      reason: 'Background check pending',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('join-request-denied.html'), payload.templateData);
  });

  it('join-request-admin.html — sendEventPendingReviewEmail covers every {{var}}', async () => {
    const result = await sendEventPendingReviewEmail({
      to: 'reviewer@example.com',
      reviewerName: 'Coach Reviewer',
      requesterName: 'Taylor Fan',
      requesterEmail: 'taylor@example.com',
      eventTitle: 'Community Night',
      eventType: 'fundraiser',
      teamName: 'Westhill Athletics',
      reviewId: 'evt_review_123',
      reviewKind: 'event',
      coachNotes: 'Date: Friday\nTime: 6:00 PM\nLocation: Westhill HS',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('join-request-admin.html'), payload.templateData);
  });

  it('ad-pending-review.html — sendAdPendingReviewEmail covers every {{var}}', async () => {
    const result = await sendAdPendingReviewEmail({
      to: 'admin@example.com',
      businessName: 'Acme Athletic Wear',
      contactName: 'Jane Acme',
      contactEmail: 'jane@acme.com',
      zipCode: '06902',
      bannerUrl: 'https://cdn.example.com/banner.jpg',
      adId: 'ad_test_123',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('ad-pending-review.html'), payload.templateData);
  });

  it('ad-approved.html — sendAdApprovedEmail covers every {{var}}', async () => {
    const result = await sendAdApprovedEmail({
      to: 'advertiser@example.com',
      businessName: 'Acme Athletic Wear',
      note: 'Your ad goes live in 1 hour.',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('ad-approved.html'), payload.templateData);
  });

  it('ad-rejected.html — sendAdRejectedEmail covers every {{var}}', async () => {
    const result = await sendAdRejectedEmail({
      to: 'advertiser@example.com',
      businessName: 'Acme Athletic Wear',
      reason: 'Banner exceeds 5MB limit',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('ad-rejected.html'), payload.templateData);
  });

  it('org-approval.html — sendLeagueApprovedEmail covers every {{var}}', async () => {
    const result = await sendLeagueApprovedEmail({
      to: 'owner@example.com',
      ownerName: 'League Owner',
      leagueName: 'Westhill Athletics',
      note: 'Welcome.',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('org-approval.html'), payload.templateData);
  });

  it('org-denial.html — sendLeagueRejectedEmail covers every {{var}}', async () => {
    const result = await sendLeagueRejectedEmail({
      to: 'owner@example.com',
      ownerName: 'League Owner',
      leagueName: 'Westhill Athletics',
      reason: 'Insufficient documentation',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('org-denial.html'), payload.templateData);
  });

  it('admin-action-confirmation.html — sendAdminActionConfirmationEmail covers every {{var}}', async () => {
    const result = await sendAdminActionConfirmationEmail({
      to: 'admin@example.com',
      action: 'league_approved',
      leagueName: 'Westhill Athletics',
      ownerName: 'League Owner',
      ownerEmail: 'owner@example.com',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('admin-action-confirmation.html'), payload.templateData);
  });

  it('parental-consent-request.html — sendParentalConsentRequestEmail covers every {{var}}', async () => {
    const result = await sendParentalConsentRequestEmail({
      to: 'parent@example.com',
      minorDisplayName: 'Jordan Test',
      minorEmail: 'jordan@example.com',
      consentToken: 'consent_token_abc123',
      expiresInDays: 7,
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('parental-consent-request.html'), payload.templateData);
  });

  it('payment-failed.html — sendBillingNoticeEmail (payment_failed) covers every {{var}}', async () => {
    const result = await sendBillingNoticeEmail({
      to: 'user@example.com',
      type: 'payment_failed',
      user_name: 'Coach Test',
      planName: 'Veteran',
      amount: '$0.99',
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('payment-failed.html'), payload.templateData);
  });

  it('subscription-expiring.html — sendBillingNoticeEmail (trial_ending) covers every {{var}}', async () => {
    const result = await sendBillingNoticeEmail({
      to: 'user@example.com',
      type: 'trial_ending',
      user_name: 'Coach Test',
      planName: 'Legend',
      perks: ['Unlimited teams', 'Premium analytics'],
    });
    expect(result).toBe(true);
    const payload = mockSend.mock.calls[0]![0] as any;
    expectAllVarsCovered(getTemplateVars('subscription-expiring.html'), payload.templateData);
  });
});
