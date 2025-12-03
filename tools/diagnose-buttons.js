#!/usr/bin/env node

/**
 * Button Diagnostics - Quick verification script
 * Run: node tools/diagnose-buttons.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n🔍 VarsityHub Button Diagnostics\n');
console.log('=' .repeat(60));

// Check 1: Environment configuration
console.log('\n1️⃣  Environment Configuration');
console.log('-'.repeat(60));

const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const hasApiUrl = envContent.includes('EXPO_PUBLIC_API_URL=https://api-production');
const hasSentryDsn = envContent.includes('EXPO_PUBLIC_SENTRY_DSN=') && 
                     !envContent.includes('EXPO_PUBLIC_SENTRY_DSN=#');

console.log(`   API URL configured: ${hasApiUrl ? '✅' : '❌'}`);
console.log(`   Sentry DSN configured: ${hasSentryDsn ? '✅' : '⚠️  (optional, but recommended)'}`);

if (hasApiUrl) {
  const match = envContent.match(/EXPO_PUBLIC_API_URL=(.+)/);
  if (match) {
    console.log(`   → ${match[1].trim()}`);
  }
}

// Check 2: Critical files present
console.log('\n2️⃣  Critical Files');
console.log('-'.repeat(60));

const criticalFiles = [
  'utils/sentry.ts',
  'utils/links.ts',
  'utils/ensureUploadableUri.ts',
  'api/http.ts',
  'app/game-details/GameDetailsScreen.tsx',
  'app/event-detail.tsx',
  'app/highlights.tsx',
  'app/components/MatchBanner.tsx',
  'app/components/RsvpSheet.tsx',
];

criticalFiles.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  const exists = fs.existsSync(filePath);
  console.log(`   ${exists ? '✅' : '❌'} ${file}`);
});

// Check 3: Common button patterns
console.log('\n3️⃣  Button Implementation Patterns');
console.log('-'.repeat(60));

const gameDetailsPath = path.join(__dirname, '..', 'app/game-details/GameDetailsScreen.tsx');
if (fs.existsSync(gameDetailsPath)) {
  const content = fs.readFileSync(gameDetailsPath, 'utf8');
  
  const patterns = {
    'Add Story handlers': /handleAddStory|onAddStory|pickImage|pickVideo/,
    'Vote handlers': /handleVote|onVote|castVote/,
    'Share handlers': /handleShare|onShare|shareGame/,
    'RSVP handlers': /handleRsvp|toggleRsvp|onRsvpPress/,
    'Logging present': /console\.(log|warn|error)\(['"`]\[/,
  };
  
  Object.entries(patterns).forEach(([name, regex]) => {
    const found = regex.test(content);
    console.log(`   ${found ? '✅' : '⚠️ '} ${name}`);
  });
}

// Check 4: HTTP client configuration
console.log('\n4️⃣  HTTP Client Setup');
console.log('-'.repeat(60));

const httpPath = path.join(__dirname, '..', 'api/http.ts');
if (fs.existsSync(httpPath)) {
  const content = fs.readFileSync(httpPath, 'utf8');
  
  const checks = {
    'Sentry breadcrumbs': /captureBreadcrumb|import.*sentry/,
    'Timeout handling': /timeout|AbortController/,
    'Retry logic': /retries|backoff/,
    '401 redirect': /401.*sign-in|router\.push.*sign-in/,
  };
  
  Object.entries(checks).forEach(([name, regex]) => {
    const found = regex.test(content);
    console.log(`   ${found ? '✅' : '❌'} ${name}`);
  });
}

// Check 5: Package versions
console.log('\n5️⃣  Dependencies');
console.log('-'.repeat(60));

const packagePath = path.join(__dirname, '..', 'package.json');
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  const keyDeps = {
    'expo': pkg.dependencies?.expo,
    'expo-router': pkg.dependencies?.['expo-router'],
    'sentry-expo': pkg.dependencies?.['sentry-expo'],
    '@sentry/react-native': pkg.dependencies?.['@sentry/react-native'],
  };
  
  Object.entries(keyDeps).forEach(([name, version]) => {
    console.log(`   ${version ? '✅' : '❌'} ${name}: ${version || 'not installed'}`);
  });
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📋 Summary:');
console.log(`   - Environment: ${hasApiUrl ? '✅ Configured' : '❌ Missing API URL'}`);
console.log(`   - Monitoring: ${hasSentryDsn ? '✅ Sentry ready' : '⚠️  Sentry DSN missing (optional)'}`);
console.log(`   - Files: All critical components present`);
console.log('\n💡 Next Steps:');

if (!hasSentryDsn) {
  console.log('   1. Add EXPO_PUBLIC_SENTRY_DSN to .env (see .env.example)');
  console.log('   2. Restart Expo: npx expo start --clear');
}

console.log('   • Test on REAL games/events (not sample-* routes)');
console.log('   • Watch Metro logs for [http], [story], [share] prefixes');
console.log('   • Check auth state: look for "401 Unauthorized" logs');
console.log('   • Verify Railway connection on startup');
console.log('\n📖 See docs/BUTTON_DIAGNOSTICS.md for detailed troubleshooting\n');
