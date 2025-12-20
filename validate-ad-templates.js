#!/usr/bin/env node

/**
 * SendGrid Ad Email Template Validator
 * 
 * Validates that ad templates (reservation, payment, goes-live) have:
 * 1. All required variables substituted
 * 2. CTA links render with test data values
 * 3. LimeProd branding present
 */

const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, 'sendgrid-templates');
const TEST_DATA_DIR = path.join(TEMPLATES_DIR, 'test-data');

const AD_TEMPLATES = [
  {
    name: 'ad-reservation-confirmation',
    file: 'ad-reservation-confirmation.html',
    testData: 'ad-reservation-confirmation.json',
    expectedCtas: ['checkout_link'],
    expectedFields: ['advertiser_name', 'business_name', 'reserved_dates', 'total_cost', 'target_zip'],
  },
  {
    name: 'ad-payment-required',
    file: 'ad-payment-required.html',
    testData: 'ad-payment-required.json',
    expectedCtas: ['checkout_link'],
    expectedFields: ['advertiser_name', 'business_name', 'total_cost', 'hours_remaining'],
  },
  {
    name: 'ad-goes-live',
    file: 'ad-goes-live.html',
    testData: 'ad-goes-live.json',
    expectedCtas: ['analytics_dashboard_url'],
    expectedFields: ['advertiser_name', 'business_name', 'ad_title', 'target_zip', 'live_until'],
  },
];

function readFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
  return fs.readFileSync(filePath, 'utf-8');
}

function substituteVariables(html, data) {
  let result = html;
  for (const [key, value] of Object.entries(data)) {
    const pattern = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(pattern, value);
  }
  return result;
}

function validateTemplate(template) {
  const result = {
    template: template.name,
    passed: true,
    errors: [],
    warnings: [],
  };

  try {
    // Read template and test data
    const templateHtml = readFile(path.join(TEMPLATES_DIR, template.file));
    const testDataJson = readFile(path.join(TEST_DATA_DIR, template.testData));
    const testData = JSON.parse(testDataJson);

    // Check expected fields are in test data
    for (const field of template.expectedFields) {
      if (!(field in testData)) {
        result.passed = false;
        result.errors.push(`Missing test data field: ${field}`);
      }
    }

    // Substitute variables
    const rendered = substituteVariables(templateHtml, testData);

    // Check for unsubstituted variables
    const unsubstituted = rendered.match(/{{[\w_]+}}/g);
    if (unsubstituted) {
      result.passed = false;
      result.errors.push(`Unsubstituted variables: ${unsubstituted.join(', ')}`);
    }

    // Check CTAs are present
    for (const ctaField of template.expectedCtas) {
      const ctaValue = testData[ctaField];
      if (!ctaValue) {
        result.passed = false;
        result.errors.push(`Missing CTA test data: ${ctaField}`);
      } else if (!rendered.includes(ctaValue)) {
        result.passed = false;
        result.errors.push(`CTA not found in rendered template: ${ctaField}`);
      }
    }

    // Check LimeProd branding
    if (!rendered.includes('https://limeprod.com')) {
      result.passed = false;
      result.errors.push(`LimeProd footer link missing`);
    }

    // Check for data-analytics="false" in ad templates (disables SendGrid click wrapping)
    const anchorCount = (rendered.match(/<a /g) || []).length;
    const analyticsDisabled = (rendered.match(/data-analytics="false"/g) || []).length;
    if (anchorCount > 0 && analyticsDisabled === 0) {
      result.warnings.push(`No data-analytics="false" attributes found (${anchorCount} anchors)`);
    }

  } catch (error) {
    result.passed = false;
    result.errors.push(error.message);
  }

  return result;
}

function main() {
  console.log('\n🎯 VarsityHub Ad Template Validator\n');
  console.log('='.repeat(60));

  const results = [];
  let passCount = 0;

  for (const template of AD_TEMPLATES) {
    const result = validateTemplate(template);
    results.push(result);

    console.log(`\n📧 ${result.template}`);
    console.log('-'.repeat(60));

    if (result.passed) {
      console.log('✅ PASS');
      passCount++;
    } else {
      console.log('❌ FAIL');
    }

    if (result.errors.length > 0) {
      console.log('\nErrors:');
      result.errors.forEach(err => console.log(`  • ${err}`));
    }

    if (result.warnings.length > 0) {
      console.log('\nWarnings:');
      result.warnings.forEach(warn => console.log(`  ⚠️  ${warn}`));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Summary: ${passCount}/${AD_TEMPLATES.length} templates passed\n`);

  if (passCount === AD_TEMPLATES.length) {
    console.log('🎉 All ad templates are valid!\n');
    process.exit(0);
  } else {
    console.log('⚠️  Some templates failed validation.\n');
    process.exit(1);
  }
}

main();
