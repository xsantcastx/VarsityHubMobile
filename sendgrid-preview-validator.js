#!/usr/bin/env node

/**
 * SendGrid Template Preview & Link Validator
 * 
 * This script:
 * 1. Reads SendGrid template HTML files
 * 2. Loads test data JSON files
 * 3. Performs variable substitution
 * 4. Validates all links (CTA, security, social, etc.)
 * 5. Verifies LimeProd globe configuration
 * 6. Generates preview URL for manual testing in SendGrid UI
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
];

// Link validation patterns
const LINK_PATTERNS = {
  cta: {
    resetLink: /https:\/\/varsityhub\.app\/reset\?code=[^"&]+&email=[^"]+/,
    mobileResetLink: /varsityhubmobile:\/\/reset\/[^"]+/,
  },
  security: {
    privacy: /https:\/\/varsityhub\.app\/privacy/,
    security: /https:\/\/varsityhub\.app\/security/,
    support: /mailto:support@varsityhub\.app/,
  },
  social: {
    instagram: /https:\/\/www\.instagram\.com\/varsityhubapp\//,
    tiktok: /https:\/\/www\.tiktok\.com\/@varsityhubapp/,
    youtube: /https:\/\/www\.youtube\.com\/@varsityhubapp/,
    facebook: /https:\/\/www\.facebook\.com\/varsityhubapp\//,
    limeprod: /https:\/\/limeprod\.com/,
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
    for (const [key, pattern] of Object.entries(LINK_PATTERNS.cta)) {
      const match = html.match(pattern);
      if (match) {
        results.cta[key] = { status: '✅', link: match[0] };
      } else {
        results.cta[key] = { status: '❌', link: 'NOT FOUND' };
        results.errors.push(`CTA link "${key}" not found in ${templateName}`);
      }
    }
  } else {
    results.cta = { note: 'CTAs not expected for this template' };
  }

  // Check security links
  for (const [key, pattern] of Object.entries(LINK_PATTERNS.security)) {
    const match = html.match(pattern);
    if (match) {
      results.security[key] = {
        status: '✅',
        link: match[0],
      };
    } else {
      results.security[key] = {
        status: '⚠️',
        link: 'NOT FOUND',
      };
    }
  }

  // Check social links
  for (const [key, pattern] of Object.entries(LINK_PATTERNS.social)) {
    const match = html.match(pattern);
    if (match) {
      results.social[key] = {
        status: '✅',
        link: match[0],
      };
    } else {
      results.social[key] = {
        status: '❌',
        link: 'NOT FOUND',
      };
      results.errors.push(`Social link "${key}" not found in ${templateName}`);
    }
  }

  // Special check: Verify LimeProd globe SVG
  if (html.includes('limeprod.com') && html.includes('globe') || html.includes('svg')) {
    results.limeprodGlobe = {
      status: '✅',
      found: true,
    };
  } else {
    results.limeprodGlobe = {
      status: '⚠️',
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

      console.log(`\n   Security Links:`);
      for (const [key, data] of Object.entries(validationResults.security)) {
        console.log(`   ${data.status} ${key}: ${data.link}`);
      }

      console.log(`\n   Social Media Links:`);
      for (const [key, data] of Object.entries(validationResults.social)) {
        console.log(`   ${data.status} ${key}: ${data.link}`);
      }

      console.log(`\n   LimeProd Globe:`);
      console.log(`   ${validationResults.limeprodGlobe.status} SVG & Link to https://limeprod.com`);

      if (validationResults.errors.length > 0) {
        console.log(`\n   ⚠️ Errors Found:`);
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
    console.log('  1. Log in to SendGrid Dashboard');
    console.log('  2. Navigate to Email → Templates');
    console.log('  3. Open each template');
    console.log('  4. Click "Preview" and select test JSON data');
    console.log('  5. Verify all links are clickable and functional');
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
