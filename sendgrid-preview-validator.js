#!/usr/bin/env node

/**
 * SendGrid Template Preview & Link Validator
 * 
 * This script:
 * 1. Reads SendGrid template HTML files
 * 2. Loads test data JSON files
 * 3. Performs variable substitution
 * 4. Validates primary CTA links (checkout, analytics, reset, etc.)
 * 5. Confirms LimeProd branding and links
 * 6. Reports on ad template rendering
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Configuration
const TEMPLATES_DIR = path.join(__dirname, 'sendgrid-templates');
const TEST_DATA_DIR = path.join(TEMPLATES_DIR, 'test-data');
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

// Templates to test
const TEMPLATES = [
  {
    name: 'password-reset',
    file: 'password-reset.html',
    testData: 'password-reset.json',
    description: 'Password reset with {{resetLink}} CTA',
    ctaRequired: true,
  },
  {
    name: 'password-changed',
    file: 'password-changed.html',
    testData: 'password-changed.json',
    description: 'Password changed confirmation',
    ctaRequired: false,
  },
  {
    name: 'account-recovery',
    file: 'account-recovery.html',
    testData: 'account-recovery.json',
    description: 'Account recovery notice with support footer',
    ctaRequired: false,
  },
  {
    name: 'ad-reservation-confirmation',
    file: 'ad-reservation-confirmation.html',
    testData: 'ad-reservation-confirmation.json',
    description: 'Ad reservation confirmation with checkout CTA and optional preview',
    ctaRequired: true,
  },
  {
    name: 'ad-payment-required',
    file: 'ad-payment-required.html',
    testData: 'ad-payment-required.json',
    description: 'Ad payment reminder with 1-hour expiration and checkout CTA',
    ctaRequired: true,
  },
  {
    name: 'ad-goes-live',
    file: 'ad-goes-live.html',
    testData: 'ad-goes-live.json',
    description: 'Ad goes live with analytics dashboard CTA and optional preview',
    ctaRequired: true,
  },
];

// Link validation patterns
const LINK_PATTERNS = {
  cta: {
    resetLink: /https:\/\/varsityhub\.app\/reset\?code=[^"&]+&email=[^"]+/,
    mobileResetLink: /varsityhubmobile:\/\/reset\/[^"]+/,
  },
};

/**
 * Read template file
 */
function readTemplate(templateFile) {
  const filePath = path.join(TEMPLATES_DIR, templateFile);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Template not found: ${filePath}`);
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * Read test data JSON
 */
function readTestData(testDataFile) {
  const filePath = path.join(TEST_DATA_DIR, testDataFile);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Test data not found: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * Substitute variables in template
 */
function substituteVariables(html, data) {
  let result = html;
  for (const [key, value] of Object.entries(data)) {
    const pattern = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(pattern, value);
  }
  return result;
}

/**
 * Validate links in HTML
 */
function validateLinks(html, templateName, templateConfig) {
  const results = {
    cta: {},
    security: {},
    social: {},
    errors: [],
  };

  // Check CTA links
  if (templateConfig.ctaRequired) {
    // Default security templates
    let foundAny = false;
    for (const [key, pattern] of Object.entries(LINK_PATTERNS.cta)) {
      const match = html.match(pattern);
      if (match) {
        results.cta[key] = { status: '✅', link: match[0] };
        foundAny = true;
      }
    }

    // Ad templates: verify CTAs using injected test data values
    // We check for presence of known fields used as CTAs
    const dynamicCtas = [];
    try {
      const dataPath = path.join(TEST_DATA_DIR, templateConfig.testData);
      const testJson = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
      if (testJson.checkout_link) dynamicCtas.push({ key: 'checkout_link', value: testJson.checkout_link });
      if (testJson.analytics_dashboard_url) dynamicCtas.push({ key: 'analytics_dashboard_url', value: testJson.analytics_dashboard_url });
    } catch (_) {}

    for (const cta of dynamicCtas) {
      if (html.includes(cta.value)) {
        results.cta[cta.key] = { status: '✅', link: cta.value };
        foundAny = true;
      } else {
        results.cta[cta.key] = { status: '❌', link: 'NOT FOUND' };
        results.errors.push(`CTA link "${cta.key}" not found in ${templateName}`);
      }
    }

    if (!foundAny) {
      results.errors.push(`No CTA links detected in ${templateName}`);
    }
  } else {
    results.cta = { note: 'CTAs not expected for this template' };
  }

  // Check LimeProd branding
  if (html.includes('https://limeprod.com') && (html.includes('globe') || html.includes('svg'))) {
    results.limeprodBranding = {
      status: '✅',
      found: true,
    };
  } else if (html.includes('limeprod.com')) {
    results.limeprodBranding = {
      status: '⚠️',
      found: true,
      note: 'LimeProd link present but no SVG detected',
    };
  } else {
    results.limeprodBranding = {
      status: '❌',
      found: false,
    };
  }

  return results;
}

/**
 * Generate report
 */
function generateReport(template, testData, validationResults) {
  const report = {
    template: template.name,
    description: template.description,
    testData,
    validation: validationResults,
    timestamp: new Date().toISOString(),
  };
  return report;
}

/**
 * Main execution
 */
function main() {
  console.log('\n🚀 SendGrid Template Preview & Link Validator\n');
  console.log('='.repeat(60));

  if (!fs.existsSync(TEMPLATES_DIR)) {
    console.error(`❌ Templates directory not found: ${TEMPLATES_DIR}`);
    process.exit(1);
  }

  if (!fs.existsSync(TEST_DATA_DIR)) {
    console.error(`❌ Test data directory not found: ${TEST_DATA_DIR}`);
    process.exit(1);
  }

  let allReports = [];
  let totalErrors = 0;

  // Process each template
  for (const template of TEMPLATES) {
    console.log(`\n📧 Testing: ${template.name}`);
    console.log('-'.repeat(60));

    try {
      // Read template and test data
      const templateHtml = readTemplate(template.file);
      const testDataObj = readTestData(template.testData);

      console.log(`   Test Data:`, JSON.stringify(testDataObj, null, 2)
        .split('\n')
        .map((line, i) => i === 0 ? line : '   ' + line)
        .join('\n'));

      // Substitute variables
      const renderedHtml = substituteVariables(templateHtml, testDataObj);

      // Validate links
      const validationResults = validateLinks(renderedHtml, template.name, template);

      console.log(`\n   CTA Buttons:`);
      const ctaEntries = Object.entries(validationResults.cta);
      if (ctaEntries.length === 1 && ctaEntries[0][0] === 'note') {
        console.log(`   ℹ️ ${ctaEntries[0][1]}`);
      } else {
        for (const [key, data] of ctaEntries) {
          if (data && data.status && typeof data.link === 'string') {
            console.log(`   ${data.status} ${key}: ${data.link.substring(0, 60)}${data.link.length > 60 ? '...' : ''}`);
          }
        }
      }

      console.log(`\n   Branding:`);
      console.log(`   ${validationResults.limeprodBranding.status} LimeProd link & branding`);

      if (validationResults.errors.length > 0) {
        console.log(`\n   ⚠️ Issues Found:`);
        validationResults.errors.forEach(err => console.log(`   - ${err}`));
        totalErrors += validationResults.errors.length;
      }

      // Generate report
      const report = generateReport(template, testDataObj, validationResults);
      allReports.push(report);

      console.log(`\n   ✅ Template processing complete`);
    } catch (error) {
      console.error(`   ❌ Error: ${error.message}`);
      totalErrors++;
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 SUMMARY\n');
  console.log(`Templates tested:     ${TEMPLATES.length}`);
  console.log(`Total errors found:   ${totalErrors}`);
  console.log(`Status:               ${totalErrors === 0 ? '✅ PASS' : '❌ FAIL'}`);

  if (totalErrors === 0) {
    console.log('\n🎉 All templates validated successfully!');
    console.log('\nNext steps:');
    console.log('  ✅ Ad templates (reservation, payment, goes-live) validated');
    console.log('  📋 Verify CTA links render correctly in SendGrid preview');
    console.log('  🔗 Test checkout & analytics URLs in live environment');
    console.log('  📧 Confirm email delivery + rendering on client devices');
  } else {
    console.log('\n⚠️  Some template CTAs need review. Check details above.');
  }

  // Save detailed report
  const reportPath = path.join(__dirname, 'sendgrid-preview-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(allReports, null, 2));
  console.log(`\n📄 Detailed report saved to: ${reportPath}`);

  console.log('\n' + '='.repeat(60) + '\n');

  process.exit(totalErrors === 0 ? 0 : 1);
}

// Run
main();
