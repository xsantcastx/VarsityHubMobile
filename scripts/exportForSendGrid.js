#!/usr/bin/env node
/**
 * Export and normalize SendGrid templates.
 *
 * What it does:
 * - Fetches templates from SendGrid using IDs in server/.env (TEMPLATE_IDS in server/src/lib/email.ts)
 * - Normalizes variables: snake_case -> camelCase in both HTML and subject
 * - Upgrades HTTP asset URLs to HTTPS
 * - Applies curated subject lines for each template
 * - Writes cleaned HTML + metadata to ./sendgrid-templates/
 *
 * NOTE: This script DOES NOT modify templates in SendGrid. It only exports and
 * fixes them locally so you can upload the cleaned HTML back into SendGrid.
 *
 * Usage:
 *   node scripts/exportForSendGrid.js
 */

import { config as loadEnv } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load env from root and server
loadEnv({ path: '.env', override: true });
loadEnv({ path: 'server/.env', override: true });

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (!SENDGRID_API_KEY) {
  console.error('❌ SENDGRID_API_KEY is missing. Add it to .env or server/.env');
  process.exit(1);
}

const OUTPUT_DIR = path.resolve(process.cwd(), 'sendgrid-templates');

const templateDefs = [
  // Auth & Security
  { key: 'VERIFICATION', env: 'SENDGRID_VERIFICATION_TEMPLATE_ID', name: 'Verification Email', subject: 'Verify your VarsityHub account' },
  { key: 'PASSWORD_RESET', env: 'SENDGRID_PASSWORD_RESET_TEMPLATE_ID', name: 'Password Reset', subject: 'Reset your VarsityHub password' },
  { key: 'PASSWORD_CHANGED', env: 'SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID', name: 'Password Changed', subject: 'Your VarsityHub password was changed' },
  { key: 'ACCOUNT_RECOVERY', env: 'SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID', name: 'Account Recovery', subject: 'Recover your VarsityHub account' },
  { key: 'LOGIN_NEW_DEVICE', env: 'SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID', name: 'Login From New Device', subject: 'VarsityHub login from new device' },
  // Moderation & Trust
  { key: 'REPORT_RESOLVED', env: 'SENDGRID_REPORT_RESOLVED_TEMPLATE_ID', name: 'Report Resolved', subject: 'Your report has been resolved' },
  { key: 'REPORT_DISMISSED', env: 'SENDGRID_REPORT_DISMISSED_TEMPLATE_ID', name: 'Report Dismissed', subject: 'Your report has been dismissed' },
  { key: 'ACCOUNT_WARNING', env: 'SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID', name: 'Account Warning', subject: 'Account warning from VarsityHub' },
  { key: 'CONTENT_REMOVED', env: 'SENDGRID_CONTENT_REMOVED_TEMPLATE_ID', name: 'Content Removed', subject: 'Your content was removed' },
  { key: 'ACCOUNT_SUSPENSION_7_DAYS', env: 'SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID', name: 'Account Suspension 7 Days', subject: 'Your account has been suspended for 7 days' },
  { key: 'ACCOUNT_SUSPENSION_45_DAYS', env: 'SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID', name: 'Account Suspension 45 Days', subject: 'Your account has been suspended for 45 days' },
  { key: 'ACCOUNT_PERMANENT_BAN', env: 'SENDGRID_ACCOUNT_PERMANENT_BAN_TEMPLATE_ID', name: 'Permanent Ban', subject: 'Your VarsityHub account has been permanently banned' },
  // Events
  { key: 'EVENT_SUBMISSION_RECEIVED', env: 'SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID', name: 'Event Submission Received', subject: 'We received your event: {{eventName}}' },
  { key: 'EVENT_APPROVED', env: 'SENDGRID_EVENT_APPROVED_TEMPLATE_ID', name: 'Event Approved', subject: 'Your event {{eventName}} was approved' },
  { key: 'EVENT_DENIED', env: 'SENDGRID_EVENT_DENIED_TEMPLATE_ID', name: 'Event Denied', subject: 'Your event {{eventName}} was denied' },
  { key: 'EVENT_REMINDER', env: 'SENDGRID_EVENT_REMINDER_TEMPLATE_ID', name: 'Event Reminder', subject: 'Reminder: {{eventName}} is coming up' },
  { key: 'EVENT_UPDATED', env: 'SENDGRID_EVENT_UPDATED_TEMPLATE_ID', name: 'Event Updated', subject: '{{eventName}} details have been updated' },
  { key: 'EVENT_CANCELED', env: 'SENDGRID_EVENT_CANCELED_TEMPLATE_ID', name: 'Event Canceled', subject: '{{eventName}} has been canceled' },
  { key: 'EVENT_RSVP_CONFIRMED', env: 'SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID', name: 'Event RSVP Confirmed', subject: 'Your RSVP for {{eventName}} is confirmed' },
  // Invitations & Membership
  { key: 'ORGANIZATION_INVITATION', env: 'SENDGRID_ORG_INVITE_TEMPLATE_ID', name: 'Organization Invitation', subject: "You're invited to join {{organizationName}}" },
  { key: 'TEAM_INVITATION', env: 'SENDGRID_TEAM_INVITE_TEMPLATE_ID', name: 'Team Invitation', subject: "You're invited to join {{teamName}}" },
  { key: 'ATHLETE_INVITATION', env: 'SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID', name: 'Athlete Invitation', subject: "You've been invited to {{teamName}}" },
  { key: 'ROLE_ASSIGNMENT', env: 'SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID', name: 'Role Assignment', subject: "You've been assigned {{roleName}} at {{organizationName}}" },
  { key: 'ROSTER_THRESHOLD', env: 'SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID', name: 'Roster Threshold', subject: '{{teamName}} roster is near the limit' },
  { key: 'INVITATION_DECLINED', env: 'SENDGRID_INVITATION_DECLINED_TEMPLATE_ID', name: 'Invitation Declined', subject: 'An invitation was declined for {{teamName}}' },
  { key: 'TEAM_ROSTER_UPDATE', env: 'SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID', name: 'Team Roster Update', subject: '{{teamName}} roster was updated' },
  { key: 'STAFF_MEMBER_JOINED', env: 'SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID', name: 'Staff Member Joined', subject: '{{staffName}} joined {{teamName}}' },
  // Org lifecycle
  { key: 'USER_CONFIRMATION', env: 'SENDGRID_USER_CONFIRMATION_TEMPLATE_ID', name: 'User Confirmation', subject: 'Welcome to {{organizationName}}' },
  // Billing
  { key: 'PAYMENT_FAILED', env: 'SENDGRID_PAYMENT_FAILED_TEMPLATE_ID', name: 'Payment Failed', subject: 'Payment failed for your VarsityHub subscription' },
  { key: 'SUBSCRIPTION_EXPIRING', env: 'SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID', name: 'Subscription Expiring', subject: 'Your VarsityHub subscription renews on {{renewalDate}}' },
];

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function camelize(name) {
  if (!name.includes('_')) return name;
  return name
    .split('_')
    .filter(Boolean)
    .map((part, index) => (index === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function upgradeHttpToHttps(input) {
  return input.replace(/(src|href)="http:\/\//gi, '$1="https://');
}

function normalizePlaceholders(input) {
  return input.replace(/\{\{\s*([^\}\s]+)\s*\}\}/g, (_match, p1) => {
    const clean = p1.trim();
    const camel = camelize(clean);
    return `{{${camel}}}`;
  });
}

function normalizeContent(html) {
  return upgradeHttpToHttps(normalizePlaceholders(html));
}

async function fetchTemplate(templateId) {
  const response = await fetch(`https://api.sendgrid.com/v3/templates/${templateId}` , {
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} while fetching template ${templateId}`);
  }
  const data = await response.json();
  const latest = data?.versions?.[0];
  if (!latest) {
    throw new Error(`Template ${templateId} has no versions`);
  }
  return { name: data.name, latest };
}

async function run() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const summary = [];

  for (const def of templateDefs) {
    const templateId = process.env[def.env];
    if (!templateId) {
      summary.push({ key: def.key, status: 'missing-id', message: `No env var ${def.env}` });
      console.warn(`⚠️  Skipping ${def.name}: env ${def.env} not set`);
      continue;
    }

    try {
      const { name: remoteName, latest } = await fetchTemplate(templateId);
      const normalizedHtml = normalizeContent(latest.html_content || '');
      const normalizedSubject = normalizePlaceholders(def.subject || latest.subject || '');

      const baseName = `${slugify(def.name)}.html`;
      const outPath = path.join(OUTPUT_DIR, baseName);

      const header = [
        `<!-- Template: ${def.name} (${def.key}) -->`,
        `<!-- Template ID: ${templateId} -->`,
        `<!-- Source Name: ${remoteName || 'n/a'} -->`,
        `<!-- Subject: ${normalizedSubject} -->`,
        '',
      ].join('\n');

      fs.writeFileSync(outPath, `${header}${normalizedHtml}`, 'utf8');

      summary.push({
        key: def.key,
        name: def.name,
        env: def.env,
        templateId,
        subject: normalizedSubject,
        file: path.relative(process.cwd(), outPath),
        status: 'ok',
      });

      console.log(`✅ Exported ${def.name} -> ${outPath}`);
    } catch (error) {
      summary.push({ key: def.key, status: 'error', message: error.message, env: def.env });
      console.error(`❌ Failed ${def.name}: ${error.message}`);
    }
  }

  const summaryPath = path.join(OUTPUT_DIR, 'export-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary }, null, 2));
  console.log(`\n📄 Summary written to ${summaryPath}`);

  const checklistPath = path.join(OUTPUT_DIR, 'README.md');
  const checklist = [];
  checklist.push('# SendGrid Template Export');
  checklist.push('');
  checklist.push('This folder was generated by `scripts/exportForSendGrid.js`.');
  checklist.push('Upload each HTML file into its matching SendGrid Dynamic Template.');
  checklist.push('');
  checklist.push('## Steps to upload');
  checklist.push('1) Open SendGrid → Dynamic Templates');
  checklist.push('2) Pick the template by name');
  checklist.push('3) Click "Edit" → replace HTML with the generated file');
  checklist.push('4) Set the subject (already in the file header)');
  checklist.push('5) Save & publish');
  checklist.push('');
  checklist.push('## Export Summary');
  for (const item of summary) {
    if (item.status !== 'ok') continue;
    checklist.push(`- [ ] ${item.name} (${item.env}) → ${item.file}`);
  }
  fs.writeFileSync(checklistPath, checklist.join('\n'));
  console.log(`📌 Checklist written to ${checklistPath}`);
}

run().catch((error) => {
  console.error('❌ Export failed:', error);
  process.exit(1);
});
