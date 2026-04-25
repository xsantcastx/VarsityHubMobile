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
process.env.SENDGRID_EVENT_CANCELED_TEMPLATE_ID = TEST_TEMPLATE_ID;
process.env.SENDGRID_EVENT_DENIED_TEMPLATE_ID = TEST_TEMPLATE_ID;
process.env.SENDGRID_ORG_INVITE_TEMPLATE_ID = TEST_TEMPLATE_ID;

const mockSend = jest.fn(async () => ({ success: true }));

jest.unstable_mockModule('../services/email/service.js', () => ({
  getEmailService: jest.fn(async () => ({
    isConfigured: () => true,
    send: mockSend,
  })),
}));

const { sendEventCanceledEmail, sendEventDeniedEmail, sendOrganizationInviteEmail } = await import(
  '../lib/email.js'
);

process.env.NODE_ENV = savedNodeEnv;
process.env.JEST_WORKER_ID = savedJestWorker;
process.env.APP_BASE_URL = savedAppBaseUrl;

function getTemplateVars(filename: string): Set<string> {
  const html = readFileSync(join(TEMPLATES_DIR, filename), 'utf8');
  const matches = html.match(/\{\{([a-z_][a-z0-9_]*)\}\}/gi) ?? [];
  return new Set(matches.map((m) => m.slice(2, -2)));
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
});
