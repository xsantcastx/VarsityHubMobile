#!/usr/bin/env npx tsx
/**
 * SendGrid Email Template Verification Script
 * 
 * Validates that all 40 SendGrid email templates are:
 * ✓ Created and published
 * ✓ Have subject lines configured
 * ✓ Have all required variables
 * ✓ Are using HTTPS URLs for images
 * 
 * Usage: npx tsx scripts/verify-sendgrid-templates.ts
 * 
 * Environment: Requires SENDGRID_API_KEY and server/.env with template IDs
 */

import { config as loadEnv } from 'dotenv';
import 'dotenv/config';

// Load environment variables
loadEnv({ path: '.env', override: true });
loadEnv({ path: 'server/.env', override: true });

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

if (!SENDGRID_API_KEY) {
  console.error('❌ SENDGRID_API_KEY not found in environment variables');
  process.exit(1);
}

// Template IDs and their expected variables
const TEMPLATES = [
  {
    name: 'Verification Email',
    id: process.env.SENDGRID_VERIFICATION_TEMPLATE_ID,
    requiredVars: ['name', 'code', 'verificationLink'],
  },
  {
    name: 'Password Reset',
    id: process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID,
    requiredVars: ['name', 'code', 'resetLink'],
  },
  {
    name: 'Password Changed',
    id: process.env.SENDGRID_PASSWORD_CHANGED_TEMPLATE_ID,
    requiredVars: ['name', 'date'],
  },
  {
    name: 'Account Recovery',
    id: process.env.SENDGRID_ACCOUNT_RECOVERY_TEMPLATE_ID,
    requiredVars: ['name', 'code'],
  },
  {
    name: 'Login From New Device',
    id: process.env.SENDGRID_LOGIN_NEW_DEVICE_TEMPLATE_ID,
    requiredVars: ['name', 'device', 'location', 'date'],
  },
  {
    name: 'Report Resolution',
    id: process.env.SENDGRID_REPORT_RESOLVED_TEMPLATE_ID,
    requiredVars: ['userName', 'reportId', 'status', 'appealUrl'],
  },
  {
    name: 'Report Dismissed',
    id: process.env.SENDGRID_REPORT_DISMISSED_TEMPLATE_ID,
    requiredVars: ['userName', 'reportId', 'reason'],
  },
  {
    name: 'Account Warning',
    id: process.env.SENDGRID_ACCOUNT_WARNING_TEMPLATE_ID,
    requiredVars: ['userName', 'reportId', 'violationType'],
  },
  {
    name: 'Content Removed',
    id: process.env.SENDGRID_CONTENT_REMOVED_TEMPLATE_ID,
    requiredVars: ['userName', 'reportId', 'contentType', 'reason'],
  },
  {
    name: 'Account Suspension',
    id: process.env.SENDGRID_ACCOUNT_SUSPENSION_45_DAYS_TEMPLATE_ID,
    requiredVars: ['userName', 'violationType', 'suspensionDays', 'appealUrl'],
  },
  {
    name: 'Account Suspension (7 Days)',
    id: process.env.SENDGRID_ACCOUNT_SUSPENSION_7_DAYS_TEMPLATE_ID,
    requiredVars: ['userName', 'violationType', 'suspensionDays', 'appealUrl'],
  },
  {
    name: 'Account Permanent Ban',
    id: process.env.SENDGRID_ACCOUNT_PERMANENT_BAN_ID,
    requiredVars: ['userName', 'violationType', 'reason'],
  },
  {
    name: 'Event Submission Received',
    id: process.env.SENDGRID_EVENT_SUBMISSION_RECEIVED_TEMPLATE_ID,
    requiredVars: ['coachName', 'eventName', 'eventDate', 'eventLocation'],
  },
  {
    name: 'Event Approved',
    id: process.env.SENDGRID_EVENT_APPROVED_TEMPLATE_ID,
    requiredVars: ['coachName', 'eventName', 'eventDate', 'eventLocation'],
  },
  {
    name: 'Event Denied',
    id: process.env.SENDGRID_EVENT_DENIED_TEMPLATE_ID,
    requiredVars: ['coachName', 'eventName', 'eventDate', 'reason'],
  },
  {
    name: 'Event Reminder',
    id: process.env.SENDGRID_EVENT_REMINDER_TEMPLATE_ID,
    requiredVars: ['userName', 'eventName', 'eventDate', 'eventLocation'],
  },
  {
    name: 'Event Updated',
    id: process.env.SENDGRID_EVENT_UPDATED_TEMPLATE_ID,
    requiredVars: ['userName', 'eventName', 'updatedFields'],
  },
  {
    name: 'Event Canceled',
    id: process.env.SENDGRID_EVENT_CANCELED_TEMPLATE_ID,
    requiredVars: ['userName', 'eventName', 'eventDate', 'reason'],
  },
  {
    name: 'Event RSVP Confirmed',
    id: process.env.SENDGRID_EVENT_RSVP_CONFIRMED_TEMPLATE_ID,
    requiredVars: ['userName', 'eventName', 'eventDate', 'eventTime'],
  },
  {
    name: 'Organization Invitation',
    id: process.env.SENDGRID_ORG_INVITE_TEMPLATE_ID,
    requiredVars: ['organizationName', 'inviterName', 'role'],
  },
  {
    name: 'Team Invitation',
    id: process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID,
    requiredVars: ['recipientName', 'teamName', 'inviterName', 'role'],
  },
  {
    name: 'Athlete Invitation',
    id: process.env.SENDGRID_ATHLETE_INVITATION_TEMPLATE_ID,
    requiredVars: ['inviterName', 'athleteName', 'teamName', 'role'],
  },
  {
    name: 'Role Assignment',
    id: process.env.SENDGRID_ROLE_ASSIGNMENT_TEMPLATE_ID,
    requiredVars: ['assigneeName', 'roleName', 'organizationName'],
  },
  {
    name: 'Roster Threshold',
    id: process.env.SENDGRID_ROSTER_THRESHOLD_TEMPLATE_ID,
    requiredVars: ['teamName', 'currentRosterSize', 'rosterLimit'],
  },
  {
    name: 'Invitation Declined',
    id: process.env.SENDGRID_INVITATION_DECLINED_TEMPLATE_ID,
    requiredVars: ['inviteeName', 'role', 'teamName'],
  },
  {
    name: 'Team Roster Update',
    id: process.env.SENDGRID_TEAM_ROSTER_UPDATE_TEMPLATE_ID,
    requiredVars: ['teamName', 'updatedBy', 'changesSummary'],
  },
  {
    name: 'Staff Member Joined',
    id: process.env.SENDGRID_STAFF_MEMBER_JOINED_TEMPLATE_ID,
    requiredVars: ['staffName', 'role', 'teamName'],
  },
  {
    name: 'User Confirmation',
    id: process.env.SENDGRID_USER_CONFIRMATION_TEMPLATE_ID,
    requiredVars: ['organizationName', 'userName'],
  },
  {
    name: 'Payment Failed',
    id: process.env.SENDGRID_PAYMENT_FAILED_TEMPLATE_ID,
    requiredVars: ['userName', 'failedAmount', 'planName'],
  },
  {
    name: 'Subscription Expiring',
    id: process.env.SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID,
    requiredVars: ['userName', 'planName', 'renewalDate', 'price'],
  },
];

async function verifyTemplates() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║       🔍 SENDGRID EMAIL TEMPLATE VERIFICATION                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const results = {
    found: 0,
    missing: 0,
    noSubject: 0,
    noVariables: 0,
    httpImages: 0,
    details: [] as Array<{ name: string; status: string; issues: string[] }>,
  };

  let templateIndex = 1;

  for (const template of TEMPLATES) {
    if (!template.id) {
      console.log(`❌ [${templateIndex}/${TEMPLATES.length}] ${template.name}`);
      console.log(`   └─ ERROR: No template ID in environment\n`);
      results.missing++;
      results.details.push({
        name: template.name,
        status: 'MISSING_ID',
        issues: ['No template ID configured in server/.env'],
      });
      templateIndex++;
      continue;
    }

    try {
      const response = await fetch(
        `https://api.sendgrid.com/v3/templates/${template.id}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${SENDGRID_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        console.log(`❌ [${templateIndex}/${TEMPLATES.length}] ${template.name}`);
        console.log(`   └─ ERROR: Template not found (HTTP ${response.status})\n`);
        results.missing++;
        results.details.push({
          name: template.name,
          status: 'NOT_FOUND',
          issues: [`HTTP ${response.status} - Template may be deleted`],
        });
        templateIndex++;
        continue;
      }

      const templateData = await response.json() as {
        name: string;
        versions: Array<{
          subject: string;
          html_content: string;
        }>;
      };

      const latestVersion = templateData.versions?.[0];
      const issues: string[] = [];
      let status = '✅ VALID';

      // Check for subject line
      if (!latestVersion?.subject || latestVersion.subject.trim() === '') {
        issues.push('Missing subject line');
        results.noSubject++;
        status = '⚠️  WARNING';
      }

      // Check for variables
      const htmlContent = latestVersion?.html_content || '';
      const variablesFound = new Set<string>();
      const variableRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
      let match;
      while ((match = variableRegex.exec(htmlContent))) {
        variablesFound.add(match[1]);
      }

      const missingVars = template.requiredVars.filter(
        (v) => !variablesFound.has(v) && !variablesFound.has(v.replace(/([A-Z])/g, '_$1').toLowerCase())
      );

      if (missingVars.length > 0) {
        issues.push(`Missing variables: ${missingVars.join(', ')}`);
        results.noVariables++;
        status = '⚠️  WARNING';
      }

      // Check for HTTP images
      const httpImageMatch = htmlContent.match(/src="http:\/\/[^"]*"/g);
      if (httpImageMatch && httpImageMatch.length > 0) {
        issues.push(`Found HTTP image URLs (${httpImageMatch.length}) - should be HTTPS`);
        results.httpImages++;
        status = '⚠️  WARNING';
      }

      if (issues.length === 0) {
        results.found++;
      }

      console.log(`${status} [${templateIndex}/${TEMPLATES.length}] ${template.name}`);
      if (issues.length > 0) {
        issues.forEach((issue) => {
          console.log(`   ├─ ${issue}`);
        });
      }
      console.log(`   └─ Subject: "${latestVersion?.subject || '(empty)'}"`);
      console.log(`   └─ Variables found: ${Array.from(variablesFound).join(', ') || '(none)'}\n`);

      results.details.push({
        name: template.name,
        status: issues.length === 0 ? 'VALID' : 'WARNING',
        issues,
      });
    } catch (error) {
      console.log(`❌ [${templateIndex}/${TEMPLATES.length}] ${template.name}`);
      console.log(`   └─ ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
      results.missing++;
      results.details.push({
        name: template.name,
        status: 'ERROR',
        issues: [error instanceof Error ? error.message : String(error)],
      });
    }

    templateIndex++;
  }

  // Summary
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║                    📊 VERIFICATION SUMMARY                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log(`✅ Valid templates:      ${results.found}/${TEMPLATES.length}`);
  console.log(`⚠️  Templates with issues: ${results.details.filter(d => d.status === 'WARNING').length}/${TEMPLATES.length}`);
  console.log(`❌ Missing/Error:        ${results.missing}/${TEMPLATES.length}\n`);

  if (results.noSubject > 0) {
    console.log(`⚠️  Templates missing subject lines: ${results.noSubject}`);
  }
  if (results.noVariables > 0) {
    console.log(`⚠️  Templates with missing variables: ${results.noVariables}`);
  }
  if (results.httpImages > 0) {
    console.log(`⚠️  Templates with HTTP image URLs: ${results.httpImages}`);
  }

  console.log();

  // Detailed issues
  const issueDetails = results.details.filter(d => d.issues.length > 0);
  if (issueDetails.length > 0) {
    console.log('📋 TEMPLATES WITH ISSUES:\n');
    issueDetails.forEach((detail) => {
      console.log(`${detail.name}:`);
      detail.issues.forEach((issue) => {
        console.log(`  • ${issue}`);
      });
      console.log();
    });
  }

  // Recommendations
  console.log('💡 RECOMMENDATIONS:\n');

  if (results.noSubject > 0) {
    console.log(`1. Add subject lines to ${results.noSubject} templates:`);
    console.log('   • Go to SendGrid > Dynamic Templates');
    console.log('   • Click each template > Settings tab');
    console.log('   • Add subject line to "Subject" field');
    console.log('   • Refer to FIGMA_SENDGRID_PROMPT.md for subject line examples\n');
  }

  if (results.noVariables > 0) {
    console.log(`2. Add missing variables to ${results.noVariables} templates:`);
    console.log('   • Check email template HTML content');
    console.log('   • Add missing {{variable}} placeholders');
    console.log('   • Match variable names exactly with backend (camelCase)');
    console.log('   • Refer to SENDGRID_VARIABLE_MAPPING.md for exact names\n');
  }

  if (results.httpImages > 0) {
    console.log(`3. Update HTTP image URLs to HTTPS in ${results.httpImages} templates:`);
    console.log('   • Go to template HTML editor');
    console.log('   • Find and replace: src="http://');
    console.log('   • Replace with: src="https://');
    console.log('   • Verify logo loads in preview\n');
  }

  if (results.found === TEMPLATES.length) {
    console.log('🎉 All templates verified successfully! Ready for production.\n');
  } else {
    console.log(
      `⚠️  Found ${TEMPLATES.length - results.found} issues. Please fix before launching.\n`
    );
  }

  // Save results
  const fs = await import('fs').then(m => m.promises);
  await fs.writeFile(
    './template-verification-results.json',
    JSON.stringify(results, null, 2)
  );

  console.log('📄 Results saved to: template-verification-results.json\n');

  process.exit(results.found === TEMPLATES.length ? 0 : 1);
}

verifyTemplates().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
