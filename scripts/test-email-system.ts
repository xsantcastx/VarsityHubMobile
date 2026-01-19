#!/usr/bin/env npx tsx
/**
 * Email System Test Suite
 * 
 * Tests email configuration, endpoints, and functionality
 * 
 * Usage: npx tsx scripts/test-email-system.ts
 */

import { config as loadEnv } from 'dotenv';

// Load environment variables
loadEnv({ path: '.env', override: true });
loadEnv({ path: 'server/.env', override: true });

const API_BASE_URL = process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const TEST_EMAIL = process.env.TEST_EMAIL || 'emilmancero@gmail.com';

interface TestResult {
  name: string;
  success: boolean;
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logResult(result: TestResult) {
  results.push(result);
  const icon = result.success ? '✅' : '❌';
  console.log(`${icon} ${result.name}: ${result.message}`);
  if (result.details && !result.success) {
    console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
  }
}

async function testEmailConfiguration() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║              📧 EMAIL SYSTEM TEST SUITE                      ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log('🔧 STEP 1: EMAIL CONFIGURATION CHECK');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Check SendGrid API Key
  const sendGridKey = process.env.SENDGRID_API_KEY;
  if (!sendGridKey) {
    logResult({
      name: 'SendGrid API Key',
      success: false,
      message: 'SENDGRID_API_KEY not configured',
      details: { envVar: 'SENDGRID_API_KEY' }
    });
  } else {
    const maskedKey = sendGridKey.length > 8 
      ? `${sendGridKey.substring(0, 4)}...${sendGridKey.substring(sendGridKey.length - 4)}`
      : '***';
    logResult({
      name: 'SendGrid API Key',
      success: true,
      message: `Configured (${maskedKey})`
    });
  }
  
  // Check Email From Address
  const emailFrom = process.env.EMAIL_FROM || process.env.FROM_EMAIL || 'noreply@varsityhub.app';
  logResult({
    name: 'Email From Address',
    success: true,
    message: emailFrom
  });
  
  // Check Template IDs
  const templateIds = {
    VERIFICATION: process.env.SENDGRID_VERIFICATION_TEMPLATE_ID,
    PASSWORD_RESET: process.env.SENDGRID_PASSWORD_RESET_TEMPLATE_ID,
    TEAM_INVITE: process.env.SENDGRID_TEAM_INVITE_TEMPLATE_ID,
    ORG_INVITE: process.env.SENDGRID_ORG_INVITE_TEMPLATE_ID,
  };
  
  const missingTemplates: string[] = [];
  Object.entries(templateIds).forEach(([key, value]) => {
    if (!value) {
      missingTemplates.push(key);
    }
  });
  
  if (missingTemplates.length > 0) {
    logResult({
      name: 'Email Templates',
      success: false,
      message: `Missing templates: ${missingTemplates.join(', ')}`,
      details: { missing: missingTemplates }
    });
  } else {
    logResult({
      name: 'Email Templates',
      success: true,
      message: 'All required templates configured'
    });
  }
}

async function testEmailEndpoints() {
  console.log('\n🌐 STEP 2: EMAIL API ENDPOINTS TEST');
  console.log('─────────────────────────────────────────────────────────────────');
  
  const endpoints = [
    {
      path: '/test-emails/verification',
      method: 'POST',
      data: {
        to: TEST_EMAIL,
        token: 'TEST123456',
        name: 'Test User'
      },
      name: 'Verification Email Endpoint'
    },
    {
      path: '/test-emails/password-reset',
      method: 'POST',
      data: {
        to: TEST_EMAIL,
        code: 'RESET789'
      },
      name: 'Password Reset Email Endpoint'
    },
    {
      path: '/test-emails/team-invite',
      method: 'POST',
      data: {
        to: TEST_EMAIL,
        teamName: 'Dallas Lady Tigers',
        organizationName: 'Texas Elite Sports',
        role: 'player',
        inviterName: 'Coach Smith'
      },
      name: 'Team Invite Email Endpoint'
    },
    {
      path: '/test-emails/org-invite',
      method: 'POST',
      data: {
        to: TEST_EMAIL,
        organizationName: 'Texas Elite Sports',
        role: 'coach',
        inviterName: 'Director Johnson'
      },
      name: 'Organization Invite Email Endpoint'
    }
  ];
  
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint.path}`, {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(endpoint.data)
      });
      
      const data = await response.json().catch(() => ({}));
      
      if (response.ok && data.ok) {
        logResult({
          name: endpoint.name,
          success: true,
          message: `Email sent successfully to ${TEST_EMAIL}`
        });
      } else {
        logResult({
          name: endpoint.name,
          success: false,
          message: `Request failed (${response.status})`,
          details: data
        });
      }
    } catch (error) {
      logResult({
        name: endpoint.name,
        success: false,
        message: `Network error: ${error instanceof Error ? error.message : String(error)}`,
        details: { error: String(error) }
      });
    }
  }
}

async function testEmailLibrary() {
  console.log('\n📚 STEP 3: EMAIL LIBRARY DIRECT TEST');
  console.log('─────────────────────────────────────────────────────────────────');
  
  try {
    const { 
      isSendGridConfigured, 
      getMissingEmailTemplates,
      sendVerificationEmail,
      sendPasswordResetEmail 
    } = await import('../server/src/lib/email.js');
    
    // Test SendGrid configuration check
    const isConfigured = isSendGridConfigured();
    logResult({
      name: 'SendGrid Configuration Check',
      success: isConfigured,
      message: isConfigured ? 'SendGrid is configured' : 'SendGrid is NOT configured'
    });
    
    // Check missing templates
    const missing = getMissingEmailTemplates();
    if (missing.length > 0) {
      logResult({
        name: 'Missing Email Templates',
        success: false,
        message: `Missing: ${missing.join(', ')}`,
        details: { missing }
      });
    } else {
      logResult({
        name: 'Missing Email Templates',
        success: true,
        message: 'All required templates are configured'
      });
    }
    
    // Test actual email sending (only if configured)
    if (isConfigured) {
      console.log('\n   📤 Testing actual email sending...');
      
      const verificationResult = await sendVerificationEmail(TEST_EMAIL, 'TEST456789', 'Test User');
      logResult({
        name: 'Send Verification Email',
        success: verificationResult,
        message: verificationResult 
          ? `Email sent to ${TEST_EMAIL}` 
          : 'Failed to send verification email'
      });
      
      const resetResult = await sendPasswordResetEmail(TEST_EMAIL, 'RESET123');
      logResult({
        name: 'Send Password Reset Email',
        success: resetResult,
        message: resetResult 
          ? `Email sent to ${TEST_EMAIL}` 
          : 'Failed to send password reset email'
      });
    } else {
      logResult({
        name: 'Send Verification Email',
        success: false,
        message: 'Skipped - SendGrid not configured'
      });
      logResult({
        name: 'Send Password Reset Email',
        success: false,
        message: 'Skipped - SendGrid not configured'
      });
    }
  } catch (error) {
    logResult({
      name: 'Email Library Import',
      success: false,
      message: `Failed to import email library: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

async function testEmailIntegration() {
  console.log('\n🔗 STEP 4: EMAIL INTEGRATION TESTS');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Test that emails are actually triggered in real flows
  try {
    // Check if server is running
    const healthResponse = await fetch(`${API_BASE_URL}/health`).catch(() => null);
    
    if (!healthResponse || !healthResponse.ok) {
      logResult({
        name: 'Server Health Check',
        success: false,
        message: `Server not accessible at ${API_BASE_URL}`,
        details: { url: API_BASE_URL }
      });
      return;
    }
    
    logResult({
      name: 'Server Health Check',
      success: true,
      message: `Server is running at ${API_BASE_URL}`
    });
    
    // Test test-emails endpoint exists
    const testEmailsResponse = await fetch(`${API_BASE_URL}/test-emails/verification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: TEST_EMAIL })
    }).catch(() => null);
    
    if (testEmailsResponse && testEmailsResponse.ok) {
      logResult({
        name: 'Test Emails Endpoint',
        success: true,
        message: 'Test emails endpoint is accessible'
      });
    } else {
      logResult({
        name: 'Test Emails Endpoint',
        success: false,
        message: 'Test emails endpoint not accessible or not working'
      });
    }
  } catch (error) {
    logResult({
      name: 'Email Integration Tests',
      success: false,
      message: `Integration test failed: ${error instanceof Error ? error.message : String(error)}`
    });
  }
}

async function generateReport() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                      📊 TEST RESULTS SUMMARY                    ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const total = results.length;
  const percentage = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
  
  console.log(`✅ PASSED: ${passed}`);
  console.log(`❌ FAILED: ${failed}`);
  console.log(`📊 TOTAL:  ${total}`);
  console.log(`📈 SUCCESS RATE: ${percentage}%\n`);
  
  if (failed > 0) {
    console.log('❌ FAILED TESTS:');
    console.log('─────────────────────────────────────────────────────────────────');
    results.filter(r => !r.success).forEach(result => {
      console.log(`  • ${result.name}: ${result.message}`);
      if (result.details) {
        console.log(`    ${JSON.stringify(result.details, null, 2).split('\n').join('\n    ')}`);
      }
    });
    console.log();
  }
  
  // Save results
  const fs = await import('fs').then(m => m.promises);
  const report = {
    timestamp: new Date().toISOString(),
    testEmail: TEST_EMAIL,
    apiBaseUrl: API_BASE_URL,
    summary: {
      passed,
      failed,
      total,
      successRate: `${percentage}%`
    },
    results
  };
  
  await fs.writeFile(
    './email-test-results.json',
    JSON.stringify(report, null, 2)
  );
  
  console.log('📄 Results saved to: email-test-results.json\n');
  
  // Recommendations
  if (failed > 0) {
    console.log('💡 RECOMMENDATIONS:');
    console.log('─────────────────────────────────────────────────────────────────');
    
    const missingSendGrid = results.find(r => r.name === 'SendGrid API Key' && !r.success);
    if (missingSendGrid) {
      console.log('  1. Configure SENDGRID_API_KEY in server/.env');
      console.log('     Get API key from: https://app.sendgrid.com/settings/api_keys');
    }
    
    const missingTemplates = results.find(r => r.name.includes('Template') && !r.success);
    if (missingTemplates) {
      console.log('  2. Configure SendGrid template IDs in server/.env');
      console.log('     Required templates:', missingTemplates.details?.missing?.join(', ') || 'See details above');
    }
    
    const endpointFailures = results.filter(r => r.name.includes('Endpoint') && !r.success);
    if (endpointFailures.length > 0) {
      console.log('  3. Check server is running: npm run dev (in server/)');
      console.log(`  4. Verify API_BASE_URL is correct: ${API_BASE_URL}`);
    }
    
    console.log();
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

async function main() {
  try {
    await testEmailConfiguration();
    await testEmailLibrary();
    await testEmailIntegration();
    await testEmailEndpoints();
    await generateReport();
  } catch (error) {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  }
}

main();
