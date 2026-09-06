#!/usr/bin/env npx tsx
/**
 * diagnose-email.ts
 *
 * Standalone email pipeline diagnostic. Tests configuration, provider
 * connectivity, and optionally sends a real probe email.
 *
 * Run locally:  cd server && npx tsx scripts/diagnose-email.ts
 * Run on Railway: railway run npx tsx scripts/diagnose-email.ts
 *
 * Optional env:
 *   EMAIL_PROBE_TO=you@example.com   — sends a live test email
 *
 * Does NOT require HEALTH_CHECK_SECRET. Exit 0 = config OK.
 */

import 'dotenv/config';
import {
  CANONICAL_EMAIL_FROM,
  isCanonicalEmailFrom,
  resolveEmailFrom,
} from '../src/lib/emailSender.js';
import {
  getSendGridApiKeyFingerprint,
  isPlaceholderSendGridApiKey,
  isValidSendGridApiKey,
} from '../src/lib/sendgridConfig.js';
import {
  getEmailBaseUrlDiagnostics,
  getMissingEmailTemplates,
  getMissingRecommendedTemplates,
  REQUIRED_TEMPLATE_KEYS,
  sendOrganizationInviteEmail,
  sendPasswordResetEmail,
  sendTeamInviteEmail,
  sendVerificationEmail,
} from '../src/lib/email.js';

// ─── 1. Environment check ───────────────────────────────────────
console.log('\n═══ VarsityHub Email Diagnostics ═══\n');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM = resolveEmailFrom();
const NODE_ENV = process.env.NODE_ENV || 'development';
const missingCriticalTemplates = getMissingEmailTemplates();
const missingRecommendedTemplates = getMissingRecommendedTemplates();
const baseUrlDiagnostics = getEmailBaseUrlDiagnostics();
const probeTo = process.env.EMAIL_PROBE_TO;
const probeMode = (process.env.EMAIL_PROBE_MODE || 'verification').trim().toLowerCase();

console.log(`Environment:        ${NODE_ENV}`);
console.log(`SENDGRID_API_KEY:   ${SENDGRID_API_KEY ? 'set (value redacted)' : '❌ MISSING'}`);
console.log(`Key fingerprint:    ${SENDGRID_API_KEY ? 'redacted' : '(none)'}`);
console.log(
  `Key status:         ${
    !SENDGRID_API_KEY
      ? 'missing'
      : isPlaceholderSendGridApiKey(SENDGRID_API_KEY)
        ? 'placeholder'
        : isValidSendGridApiKey(SENDGRID_API_KEY)
          ? 'valid-looking'
          : 'invalid-looking'
  }`
);
console.log(`EMAIL_FROM:         ${EMAIL_FROM}`);
console.log(`EMAIL_OVERRIDE_TO:  ${process.env.EMAIL_OVERRIDE_TO || '(none)'}`);
if (!isCanonicalEmailFrom(EMAIL_FROM)) {
  console.warn(`⚠️  Sender drift: expected ${CANONICAL_EMAIL_FROM}, got ${EMAIL_FROM}`);
}

if (!SENDGRID_API_KEY) {
  console.error('\n❌ SENDGRID_API_KEY is not set — emails cannot be sent.');
  console.error('   Set it in Railway environment variables or local server/.env');
  process.exit(1);
}

if (!SENDGRID_API_KEY.startsWith('SG.')) {
  console.error('\n❌ SENDGRID_API_KEY does not start with "SG." — likely invalid.');
  process.exit(1);
}

// ─── 2. Template IDs ────────────────────────────────────────────
console.log('\n── Template IDs ──');
console.log(
  `  Critical:    ${REQUIRED_TEMPLATE_KEYS.length - missingCriticalTemplates.length}/${REQUIRED_TEMPLATE_KEYS.length} configured`
);
if (missingCriticalTemplates.length > 0) {
  console.log(`  ❌ Missing critical:    ${missingCriticalTemplates.join(', ')}`);
} else {
  console.log('  ✅ All critical transactional templates configured');
}
if (missingRecommendedTemplates.length > 0) {
  console.log(`  ⚠️  Missing recommended: ${missingRecommendedTemplates.join(', ')}`);
} else {
  console.log('  ✅ Recommended templates configured');
}

console.log('\n── Email Link URLs ──');
for (const [label, diag] of Object.entries(baseUrlDiagnostics)) {
  console.log(
    `  ${label.toUpperCase()}: ${diag.resolvedValue} ${diag.usedFallback ? `(fallback: ${diag.reason})` : '(configured)'}`
  );
}

if (missingCriticalTemplates.length > 0) {
  console.error(
    '\n❌ Missing critical template IDs — production startup should fail, and template-based emails will not work.'
  );
}

// ─── 3. SendGrid API connectivity ───────────────────────────────
console.log('\n── Delivery Probe ──');

if (!probeTo) {
  console.log('ℹ️  No EMAIL_PROBE_TO set — skipping live send test.');
  console.log('   To send a test email, re-run with: EMAIL_PROBE_TO=you@example.com');
  console.log(
    '   Optional: EMAIL_PROBE_MODE=verification|password_reset|team_invite|org_invite|core'
  );
  console.log('\n═══ Diagnostics complete (config-only mode) ═══\n');
  process.exit(missingCriticalTemplates.length > 0 ? 1 : 0);
}

console.log(`Probe recipient:     ${probeTo}`);
console.log(`Probe mode:          ${probeMode}`);

try {
  const runProbe = async (mode: string) => {
    switch (mode) {
      case 'verification':
        return sendVerificationEmail(probeTo, '000000', 'VarsityHub Probe');
      case 'password_reset':
        return sendPasswordResetEmail(probeTo, '000000');
      case 'team_invite':
        return sendTeamInviteEmail({
          to: probeTo,
          teamName: 'VarsityHub Diagnostics',
          recipientName: 'VarsityHub Probe',
          inviterName: 'VarsityHub System',
          role: 'member',
          inviteToken: 'diag-team-invite',
        });
      case 'org_invite':
        return sendOrganizationInviteEmail({
          to: probeTo,
          organizationName: 'VarsityHub Diagnostics',
          recipientName: 'VarsityHub Probe',
          inviterName: 'VarsityHub System',
          role: 'member',
          inviteToken: 'diag-org-invite',
        });
      case 'core': {
        const results = await Promise.all([
          sendVerificationEmail(probeTo, '000000', 'VarsityHub Probe'),
          sendPasswordResetEmail(probeTo, '000000'),
          sendTeamInviteEmail({
            to: probeTo,
            teamName: 'VarsityHub Diagnostics',
            recipientName: 'VarsityHub Probe',
            inviterName: 'VarsityHub System',
            role: 'member',
            inviteToken: 'diag-team-invite',
          }),
          sendOrganizationInviteEmail({
            to: probeTo,
            organizationName: 'VarsityHub Diagnostics',
            recipientName: 'VarsityHub Probe',
            inviterName: 'VarsityHub System',
            role: 'member',
            inviteToken: 'diag-org-invite',
          }),
        ]);
        return results.every(Boolean);
      }
      default:
        throw new Error(
          `Unknown EMAIL_PROBE_MODE "${mode}". Expected verification, password_reset, team_invite, org_invite, or core.`
        );
    }
  };

  const sent = await runProbe(probeMode);
  if (!sent) {
    throw new Error(
      'Email sender returned false — inspect Railway logs for SendGrid/template errors'
    );
  }

  console.log('✅ Probe email accepted by the configured sender');
  console.log('\n   Check inbox (and spam) for the probe email.');
  console.log(
    "   If it doesn't arrive within 2 minutes, the issue is likely downstream of app code:"
  );
  console.log('   - Sender domain authentication (SPF/DKIM) in SendGrid');
  console.log('   - SendGrid account suspension or sending limits');
  console.log('   - Inbox-side filtering');
} catch (err: any) {
  console.error(`❌ Probe failed`);
  console.error(`   Status: ${err?.code ?? err?.response?.statusCode ?? 'unknown'}`);
  console.error(`   Message: ${err?.message}`);

  if (err?.response?.body?.errors) {
    console.error('   SendGrid errors:');
    for (const e of err.response.body.errors) {
      console.error(`     - ${e.message} (field: ${e.field || 'n/a'})`);
    }
  }

  // Common diagnoses
  const status = err?.code ?? err?.response?.statusCode;
  if (status === 401) {
    console.error(
      '\n   → SENDGRID_API_KEY is invalid or revoked. Generate a new one in SendGrid console.'
    );
  } else if (status === 403) {
    console.error(
      '\n   → Sender identity not verified, or account restricted. Check SendGrid Sender Authentication.'
    );
  } else if (status === 400) {
    console.error(
      '\n   → Bad request — likely a template payload/template ID/sender verification issue.'
    );
  }

  process.exit(1);
}

console.log('\n═══ Diagnostics complete ═══\n');
process.exit(0);
