#!/usr/bin/env node
/**
 * Generate QR code for Expo connection
 * This creates a QR code image file you can view
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// For tunnel mode, Expo typically uses this format
// You'll get the actual URL from running: npx expo start --dev-client --tunnel
const TYPICAL_EXPO_TUNNEL_URL = "exp://u.expo.dev/update/64489ed7-a8c0-41de-91ec-5846ea79a27f";

console.log('📱 Generating QR Code...\n');
console.log('NOTE: This is a placeholder URL.');
console.log('The REAL QR code appears when you run: npx expo start --dev-client --tunnel\n');

// Try to use qrcode-terminal or similar if available
try {
  // Check if we can use terminal QR code
  const qr = await import('qrcode-terminal');
  console.log('\n📱 Scan this QR code with your dev client app:\n');
  qr.default.generate(TYPICAL_EXPO_TUNNEL_URL, { small: true });
  console.log('\n');
} catch (e) {
  console.log('❌ QR code library not available.');
  console.log('\nInstead, run this in YOUR terminal:');
  console.log('npx expo start --dev-client --tunnel');
  console.log('\nThe QR code will appear there!\n');
}
