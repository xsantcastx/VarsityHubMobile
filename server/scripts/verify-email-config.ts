/**
 * Verify Email Configuration
 *
 * Quick script to verify email service is configured correctly
 * Run: npx ts-node server/scripts/verify-email-config.ts
 */

// Load server/.env BEFORE the email service module reads its env. Without
// this, running `npm --prefix server run verify:email` from a fresh shell
// reports every key as missing — even when server/.env has them set.
import 'dotenv/config';
import { getEmailService } from '../src/services/email/service.js';
import {
  CANONICAL_EMAIL_FROM,
  isCanonicalEmailFrom,
  resolveEmailFrom,
} from '../src/lib/emailSender.js';

console.log('🔍 Verifying Email Configuration...\n');

const service = getEmailService();
const validation = service.validateConfig();

console.log('📧 Email Service Status:');
console.log(`   Provider: ${service['config'].provider}`);
console.log(`   Default From: ${service['config'].defaultFrom}`);
console.log(`   Configured: ${service.isConfigured() ? '✅ Yes' : '❌ No'}`);
console.log(`   Valid: ${validation.valid ? '✅ Yes' : '❌ No'}\n`);

const resolvedFrom = resolveEmailFrom();
console.log(`   Canonical Sender: ${isCanonicalEmailFrom(resolvedFrom) ? '✅ Yes' : '❌ No'} (${resolvedFrom})\n`);

if (!validation.valid) {
  console.log('⚠️  Configuration Issues:');
  validation.errors.forEach((error) => {
    console.log(`   - ${error}`);
  });
  console.log('\n');
}

// Check environment variables
console.log('🔐 Environment Variables:');
const requiredVars = [
  'SENDGRID_API_KEY',
  'APP_BASE_URL',
];

requiredVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    // Mask sensitive values
    const displayValue = varName.includes('KEY') 
      ? `${value.substring(0, 5)}...${value.substring(value.length - 5)}`
      : value;
    console.log(`   ✅ ${varName}: ${displayValue}`);
  } else {
    console.log(`   ❌ ${varName}: Not set`);
  }
});

const rawSenderVars = {
  EMAIL_FROM: process.env.EMAIL_FROM || '(unset)',
  FROM_EMAIL: process.env.FROM_EMAIL || '(unset)',
};
console.log(`   ℹ️ EMAIL_FROM raw: ${rawSenderVars.EMAIL_FROM}`);
console.log(`   ℹ️ FROM_EMAIL raw:  ${rawSenderVars.FROM_EMAIL}`);
if (!isCanonicalEmailFrom(resolvedFrom)) {
  console.log(`   ⚠️ Sender should resolve to ${CANONICAL_EMAIL_FROM}`);
}

// Check template IDs
console.log('\n📋 Template IDs:');
const templateVars = [
  'SENDGRID_VERIFICATION_TEMPLATE_ID',
  'SENDGRID_PASSWORD_RESET_TEMPLATE_ID',
  'SENDGRID_TEAM_INVITE_TEMPLATE_ID',
  'SENDGRID_ORG_INVITE_TEMPLATE_ID',
];

templateVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    console.log(`   ✅ ${varName}: Set`);
  } else {
    console.log(`   ⚠️  ${varName}: Not set (optional)`);
  }
});

console.log('\n✨ Verification complete!');
if (validation.valid && service.isConfigured() && isCanonicalEmailFrom(resolvedFrom)) {
  console.log('✅ Email service is ready to use!');
} else {
  console.log('⚠️  Please fix configuration issues above.');
  process.exit(1);
}
