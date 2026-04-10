/**
 * Verify Email Configuration
 * 
 * Quick script to verify email service is configured correctly
 * Run: npx ts-node server/scripts/verify-email-config.ts
 */

import { getEmailService } from '../src/services/email/service.js';

console.log('🔍 Verifying Email Configuration...\n');

const service = getEmailService();
const validation = service.validateConfig();

console.log('📧 Email Service Status:');
console.log(`   Provider: ${service['config'].provider}`);
console.log(`   Default From: ${service['config'].defaultFrom}`);
console.log(`   Configured: ${service.isConfigured() ? '✅ Yes' : '❌ No'}`);
console.log(`   Valid: ${validation.valid ? '✅ Yes' : '❌ No'}\n`);

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
  'EMAIL_PROVIDER',
  'SENDGRID_API_KEY',
  'EMAIL_FROM',
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
if (validation.valid && service.isConfigured()) {
  console.log('✅ Email service is ready to use!');
} else {
  console.log('⚠️  Please fix configuration issues above.');
  process.exit(1);
}
