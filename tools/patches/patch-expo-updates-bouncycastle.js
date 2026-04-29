// Patch expo-updates Android build.gradle to use newer Bouncy Castle artifacts.
// Safe to run multiple times.

const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  '..',
  'node_modules',
  'expo-updates',
  'android',
  'build.gradle'
);

const FROM = 'implementation("org.bouncycastle:bcutil-jdk15to18:1.78.1")';
const TO = 'implementation("org.bouncycastle:bcutil-jdk15to18:1.81")';

try {
  if (!fs.existsSync(target)) {
    console.log('[patch-expo-updates-bouncycastle] Target not found, skipping');
    process.exit(0);
  }

  const src = fs.readFileSync(target, 'utf8');
  if (src.includes(TO)) {
    console.log('[patch-expo-updates-bouncycastle] Already patched');
    process.exit(0);
  }

  if (!src.includes(FROM)) {
    console.log('[patch-expo-updates-bouncycastle] Expected dependency line not found, skipping');
    process.exit(0);
  }

  fs.writeFileSync(target, src.replace(FROM, TO), 'utf8');
  console.log('[patch-expo-updates-bouncycastle] Patched expo-updates Android dependency');
} catch (error) {
  console.warn('[patch-expo-updates-bouncycastle] Failed:', error && error.message);
}
