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

// ─── 1. Environment check ───────────────────────────────────────
console.log('\n═══ VarsityHub Email Diagnostics ═══\n');

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const EMAIL_FROM = resolveEmailFrom();
const NODE_ENV = process.env.NODE_ENV || 'development';

console.log(`Environment:        ${NODE_ENV}`);
console.log(`SENDGRID_API_KEY:   ${SENDGRID_API_KEY ? `set (${SENDGRID_API_KEY.substring(0, 5)}...)` : '❌ MISSING'}`);
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

const TEMPLATE_KEYS = [
  ['VERIFICATION', 'SENDGRID_VERIFICATION_TEMPLATE_ID', 'SENDGRID_USER_CONFIRMATION_TEMPLATE_ID'],
  ['PASSWORD_RESET', 'SENDGRID_PASSWORD_RESET_TEMPLATE_ID'],
  ['TEAM_INVITE', 'SENDGRID_TEAM_INVITE_TEMPLATE_ID'],
  ['ORG_INVITE', 'SENDGRID_ORG_INVITE_TEMPLATE_ID'],
  ['JOIN_REQUEST_ADMIN', 'SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID', 'SENDGRID_LEAGUE_PENDING_APPROVAL_TEMPLATE_ID'],
  ['JOIN_REQUEST_APPROVED', 'SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID'],
  ['JOIN_REQUEST_DENIED', 'SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID'],
  ['EVENT_APPROVED', 'SENDGRID_EVENT_APPROVED_TEMPLATE_ID'],
  ['EVENT_DENIED', 'SENDGRID_EVENT_DENIED_TEMPLATE_ID'],
  ['EVENT_CANCELED', 'SENDGRID_EVENT_CANCELED_TEMPLATE_ID', 'SENDGRID_EVENT_CANCELLATION_TEMPLATE_ID'],
  ['PAYMENT_FAILED', 'SENDGRID_PAYMENT_FAILED_TEMPLATE_ID'],
  ['SUBSCRIPTION_EXPIRING', 'SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID'],
  ['AD_PENDING_REVIEW', 'SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID'],
  ['AD_APPROVED', 'SENDGRID_AD_APPROVED_TEMPLATE_ID'],
  ['AD_REJECTED', 'SENDGRID_AD_REJECTED_TEMPLATE_ID'],
  ['ORG_APPROVED', 'SENDGRID_ORG_APPROVAL_TEMPLATE_ID'],
  ['ORG_DENIED', 'SENDGRID_ORG_DENIAL_TEMPLATE_ID'],
  ['ADMIN_ACTION_CONFIRMATION', 'SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID'],
] as const;

const REQUIRED = ['VERIFICATION', 'PASSWORD_RESET', 'TEAM_INVITE', 'ORG_INVITE'];
let missingRequired = 0;
let missingOptional = 0;

for (const [label, ...envKeys] of TEMPLATE_KEYS) {
  const value = envKeys.map(k => process.env[k]).find(Boolean);
  const isRequired = REQUIRED.includes(label);
  if (value) {
    console.log(`  ✅ ${label}: ${value.substring(0, 12)}...`);
  } else if (isRequired) {
    console.log(`  ❌ ${label}: MISSING (REQUIRED — server will exit in production)`);
    missingRequired++;
  } else {
    console.log(`  ⚠️  ${label}: not set (optional)`);
    missingOptional++;
  }
}

console.log(`\nRequired: ${REQUIRED.length - missingRequired}/${REQUIRED.length} present`);
if (missingOptional) console.log(`Optional: ${missingOptional} missing`);

if (missingRequired > 0) {
  console.error('\n❌ Missing required template IDs — server will crash on startup in production.');
}

// ─── 3. SendGrid API connectivity ───────────────────────────────
console.log('\n── SendGrid API Connectivity ──');

import sgMail from '@sendgrid/mail';
sgMail.setApiKey(SENDGRID_API_KEY);

const probeTo = process.env.EMAIL_PROBE_TO;

if (!probeTo) {
  console.log('ℹ️  No EMAIL_PROBE_TO set — skipping live send test.');
  console.log('   To send a test email, re-run with: EMAIL_PROBE_TO=you@example.com');
  console.log('\n═══ Diagnostics complete (config-only mode) ═══\n');
  process.exit(missingRequired > 0 ? 1 : 0);
}

console.log(`Sending test email to: ${probeTo}`);
const fromAddr = EMAIL_FROM;

try {
  const [response] = await sgMail.send({
    to: probeTo,
    from: fromAddr,
    subject: `[VarsityHub Diagnostic] Email probe — ${new Date().toISOString()}`,
    text: 'This is a diagnostic probe from diagnose-email.ts. If you received this, SendGrid delivery from your production config is working.',
    html: '<p>This is a diagnostic probe from <code>diagnose-email.ts</code>.</p><p>If you received this, SendGrid delivery from your production config is working.</p>',
  });

  console.log(`✅ SendGrid accepted the email (HTTP ${response.statusCode})`);
  console.log(`   x-message-id: ${response.headers?.['x-message-id'] || '(none)'}`);
  console.log('\n   Check inbox (and spam) for the probe email.');
  console.log('   If it doesn\'t arrive within 2 minutes, the issue is:');
  console.log('   - Sender domain authentication (SPF/DKIM) in SendGrid');
  console.log('   - SendGrid account suspension or sending limits');
  console.log('   - Inbox-side filtering');
} catch (err: any) {
  console.error(`❌ SendGrid rejected the send request`);
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
    console.error('\n   → SENDGRID_API_KEY is invalid or revoked. Generate a new one in SendGrid console.');
  } else if (status === 403) {
    console.error('\n   → Sender identity not verified, or account restricted. Check SendGrid Sender Authentication.');
  } else if (status === 400) {
    console.error('\n   → Bad request — likely EMAIL_FROM address is not verified as a sender in SendGrid.');
  }

  process.exit(1);
}

console.log('\n═══ Diagnostics complete ═══\n');
process.exit(0);
