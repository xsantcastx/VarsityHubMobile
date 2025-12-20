#!/usr/bin/env node

/**
 * SendGrid Template Smoke Test
 * 
 * Sends test emails for ALL SendGrid templates to verify:
 * - Template IDs match between code and SendGrid
 * - Dynamic template data renders correctly (no {{tokens}} visible)
 * - Links are not wrapped with tracking URLs
 * - Server logs show no missing data errors
 * 
 * Usage:
 *   node smoke-test.js [--to recipient@example.com] [--template template-name] [--dry-run]
 * 
 * Examples:
 *   node smoke-test.js --to test@example.com                    # Test all templates
 *   node smoke-test.js --to test@example.com --template password-reset  # Test single
 *   node smoke-test.js --dry-run                                # Show payloads without sending
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(title, 'blue');
  log(`${'='.repeat(60)}\n`, 'blue');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarn(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'gray');
}

// Parse command-line arguments
const args = process.argv.slice(2);
let testEmail = 'test@example.com';
let templateFilter = null;
let dryRun = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--to' && args[i + 1]) {
    testEmail = args[i + 1];
    i++;
  } else if (args[i] === '--template' && args[i + 1]) {
    templateFilter = args[i + 1];
    i++;
  } else if (args[i] === '--dry-run') {
    dryRun = true;
  }
}

// Load environment variables
require('dotenv').config();

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (!SENDGRID_API_KEY) {
  logError('SENDGRID_API_KEY not found in .env');
  process.exit(1);
}

logSection('SendGrid Template Smoke Test');
log(`Test Email: ${testEmail}`, 'blue');
log(`Dry Run: ${dryRun ? 'Yes (no emails sent)' : 'No (emails will be sent)'}`, 'blue');
if (templateFilter) log(`Filter: ${templateFilter}`, 'blue');

// Template metadata
const templates = [
  // Authentication
  { name: 'password-reset', envVar: 'SENDGRID_PASSWORD_RESET_TEMPLATE_ID', category: 'Authentication' },
  { name: 'password-changed', envVar: 'SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID', category: 'Authentication' },
  { name: 'verification-email', envVar: 'SENDGRID_VERIFICATION_TEMPLATE_ID', category: 'Authentication' },
  
  // Events
  { name: 'event-reminder', envVar: 'SENDGRID_EVENT_REMINDER_TEMPLATE_ID', category: 'Events' },
  { name: 'event-canceled', envVar: 'SENDGRID_EVENT_CANCELED_TEMPLATE_ID', category: 'Events' },
  { name: 'event-updated', envVar: 'SENDGRID_EVENT_UPDATED_TEMPLATE_ID', category: 'Events' },
  { name: 'event-approved', envVar: 'SENDGRID_EVENT_APPROVED_TEMPLATE_ID', category: 'Events' },
  { name: 'event-denied', envVar: 'SENDGRID_EVENT_DENIED_TEMPLATE_ID', category: 'Events' },
  { name: 'event-rsvp-confirmed', envVar: 'SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID', category: 'Events' },
  { name: 'event-submission-received', envVar: 'SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID', category: 'Events' },
  
  // Billing/Ads
  { name: 'ad-payment-required', envVar: 'SENDGRID_AD_PAYMENT_REQUIRED_TEMPLATE_ID', category: 'Billing/Ads' },
  { name: 'ad-reservation-confirmation', envVar: 'SENDGRID_AD_RESERVATION_CONFIRMATION_TEMPLATE_ID', category: 'Billing/Ads' },
  { name: 'ad-goes-live', envVar: 'SENDGRID_AD_GOES_LIVE_TEMPLATE_ID', category: 'Billing/Ads' },
  { name: 'payment-failed', envVar: 'SENDGRID_PAYMENT_FAILED_TEMPLATE_ID', category: 'Billing/Ads' },
  { name: 'payment-receipt', envVar: 'SENDGRID_PAYMENT_RECEIPT_TEMPLATE_ID', category: 'Billing/Ads' },
  { name: 'subscription-canceled', envVar: 'SENDGRID_SUBSCRIPTION_CANCELED_TEMPLATE_ID', category: 'Billing/Ads' },
  { name: 'subscription-expiring', envVar: 'SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID', category: 'Billing/Ads' },
  { name: 'billing-notice', envVar: 'SENDGRID_BILLING_NOTICE_TEMPLATE_ID', category: 'Billing/Ads' },
  
  // Moderation
  { name: 'report-resolved', envVar: 'SENDGRID_REPORT_RESOLVED_TEMPLATE_ID', category: 'Moderation' },
  { name: 'report-dismissed', envVar: 'SENDGRID_REPORT_DISMISSED_TEMPLATE_ID', category: 'Moderation' },
  { name: 'content-removed', envVar: 'SENDGRID_CONTENT_REMOVED_TEMPLATE_ID', category: 'Moderation' },
  { name: 'account-warning', envVar: 'SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID', category: 'Moderation' },
  { name: 'account-suspension-7-days', envVar: 'SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID', category: 'Moderation' },
  { name: 'account-suspension-45-days', envVar: 'SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID', category: 'Moderation' },
  { name: 'permanent-ban', envVar: 'SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID', category: 'Moderation' },
  
  // Organization/Team
  { name: 'organization-invitation', envVar: 'SENDGRID_ORG_INVITE_TEMPLATE_ID', category: 'Organization' },
  { name: 'athlete-invitation', envVar: 'SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID', category: 'Organization' },
  { name: 'role-assignment', envVar: 'SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID', category: 'Organization' },
  { name: 'staff-member-joined', envVar: 'SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID', category: 'Organization' },
  { name: 'team-roster-update', envVar: 'SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID', category: 'Organization' },
  { name: 'invitation-declined', envVar: 'SENDGRID_INVITATION_DECLINED_TEMPLATE_ID', category: 'Organization' },
  { name: 'coach-onboarding', envVar: 'SENDGRID_COACH_ONBOARDING_TEMPLATE_ID', category: 'Organization' },
  { name: 'roster-threshold', envVar: 'SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID', category: 'Organization' },
  
  // Security
  { name: 'security-alert', envVar: 'SENDGRID_SECURITY_ALERT_TEMPLATE_ID', category: 'Security' },
  { name: 'login-from-new-device', envVar: 'SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID', category: 'Security' },
  
  // Misc
  { name: 'user-confirmation', envVar: 'SENDGRID_USER_CONFIRMATION_TEMPLATE_ID', category: 'Misc' },
  { name: 'account-recovery', envVar: 'SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID', category: 'Misc' },
  { name: 'plan-limit-warning', envVar: 'SENDGRID_PLAN_LIMIT_WARNING_TEMPLATE_ID', category: 'Misc' },
];

// Filter templates if specified
let toTest = templateFilter 
  ? templates.filter(t => t.name.includes(templateFilter))
  : templates;

if (toTest.length === 0) {
  logError(`No templates found matching filter: ${templateFilter}`);
  process.exit(1);
}

// Load test data
function loadTestData(templateName) {
  const testDataPath = path.join(__dirname, 'test-data', `${templateName}.json`);
  try {
    const data = fs.readFileSync(testDataPath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return null;
  }
}

// Send email via SendGrid API
async function sendEmail(templateId, to, dynamicTemplateData) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      personalizations: [
        {
          to: [{ email: to }],
        },
      ],
      from: {
        email: process.env.EMAIL_FROM || 'noreply@varsityhub.app',
        name: 'VarsityHub Smoke Test',
      },
      template_id: templateId,
      dynamic_template_data: dynamicTemplateData,
    });

    const options = {
      hostname: 'api.sendgrid.com',
      port: 443,
      path: '/v3/mail/send',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ success: true, statusCode: res.statusCode });
        } else {
          reject(new Error(`SendGrid API Error ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Main test function
async function runTests() {
  const results = {
    total: toTest.length,
    sent: 0,
    failed: 0,
    missing: 0,
    errors: [],
  };

  let currentCategory = '';

  for (const template of toTest) {
    // Print category header
    if (currentCategory !== template.category) {
      currentCategory = template.category;
      logSection(currentCategory);
    }

    const templateId = process.env[template.envVar];
    const testData = loadTestData(template.name);

    log(`\nTemplate: ${template.name}`, 'blue');

    // Check template ID
    if (!templateId) {
      logWarn(`Env var ${template.envVar} not set - SKIPPING`);
      results.missing++;
      continue;
    }
    logInfo(`Template ID: ${templateId}`);

    // Check test data
    if (!testData) {
      logWarn(`Test data not found: test-data/${template.name}.json - SKIPPING`);
      results.missing++;
      continue;
    }
    logInfo(`Test data loaded (${Object.keys(testData).length} fields)`);

    if (dryRun) {
      logInfo('DRY RUN - Payload would be:');
      console.log(JSON.stringify(testData, null, 2));
      results.sent++;
      logSuccess('Ready to send');
      continue;
    }

    // Send email
    try {
      await sendEmail(templateId, testEmail, testData);
      results.sent++;
      logSuccess('Email sent successfully');
    } catch (error) {
      results.failed++;
      results.errors.push({
        template: template.name,
        error: error.message,
      });
      logError(`Failed: ${error.message}`);
    }

    // Rate limit: 1 request per 100ms to avoid hitting SendGrid limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  logSection('Test Summary');
  log(`Total Templates: ${results.total}`, 'blue');
  log(`Tests Run: ${results.sent}`, 'blue');
  log(`Missing Config: ${results.missing}`, 'blue');
  log(`Failed: ${results.failed}`, 'blue');

  if (results.failed === 0 && results.missing === 0) {
    logSuccess(`All ${results.sent} templates tested successfully!`);
    log(`\nCheck your inbox (${testEmail}) for test emails.`, 'green');
    log('Verify each email has:', 'green');
    log('  ✓ No {{token}} or {{variable}} placeholders visible', 'green');
    log('  ✓ All links work (not wrapped with SendGrid tracking URLs)', 'green');
    log('  ✓ Dynamic content populated correctly (names, dates, links)', 'green');
  } else if (results.failed > 0) {
    logError(`\n${results.failed} template(s) failed. See errors above.`);
    log('\nCommon issues:', 'yellow');
    log('  - SENDGRID_*_TEMPLATE_ID env var not set', 'yellow');
    log('  - Template ID does not exist in SendGrid UI', 'yellow');
    log('  - Dynamic template data missing required fields', 'yellow');
    process.exit(1);
  } else {
    logWarn(`\n${results.missing} template(s) skipped due to missing config.`);
    log('Set the missing SENDGRID_*_TEMPLATE_ID env vars and try again.', 'yellow');
  }

  if (results.errors.length > 0) {
    log('\nDetailed Errors:', 'red');
    results.errors.forEach(err => {
      log(`  ${err.template}: ${err.error}`, 'red');
    });
  }
}

// Run
runTests().catch(err => {
  logError(`Fatal error: ${err.message}`);
  process.exit(1);
});
