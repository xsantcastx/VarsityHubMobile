import type { Twilio } from 'twilio';
import twilio from 'twilio';
import { debugLog } from './debugLog.js';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_FROM_PHONE || '';

const SMS_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const SMS_MAX_PER_WINDOW = 5;
const SMS_DAILY_MAX = 20;
const phoneBuckets = new Map<string, number[]>();
const phoneDailyCounts = new Map<string, { date: string; count: number }>();

const pruneAndCheckRateLimit = (phoneNumber: string) => {
  const now = Date.now();
  const windowStart = now - SMS_WINDOW_MS;

  // Sliding window bucket
  const bucket = phoneBuckets.get(phoneNumber) || [];
  const pruned = bucket.filter((ts) => ts >= windowStart);
  if (pruned.length >= SMS_MAX_PER_WINDOW) {
    return { allowed: false, reason: 'Rate limit exceeded (per 10 minutes)' };
  }

  // Daily cap
  const today = new Date().toISOString().slice(0, 10);
  const daily = phoneDailyCounts.get(phoneNumber) || { date: today, count: 0 };
  const dailyCount = daily.date === today ? daily.count : 0;
  if (dailyCount >= SMS_DAILY_MAX) {
    return { allowed: false, reason: 'Rate limit exceeded (per day)' };
  }

  // Record timestamps only if allowed
  pruned.push(now);
  phoneBuckets.set(phoneNumber, pruned);
  phoneDailyCounts.set(phoneNumber, { date: today, count: dailyCount + 1 });

  return { allowed: true };
};

export const isTwilioConfigured = (): boolean => {
  return !!(accountSid && authToken && fromPhoneNumber);
};

// Initialize Twilio client if configured
let twilioClient: Twilio | null = null;

if (isTwilioConfigured()) {
  twilioClient = twilio(accountSid, authToken);
  debugLog('✅ Twilio configured - SMS verification enabled');
} else {
  debugLog('⚠️ Twilio not configured - SMS verification disabled (email only)');
}

/**
 * Send SMS verification code to phone number
 */
export async function sendSmsVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
  if (!isTwilioConfigured()) {
    debugLog('[twilio] Twilio not configured - skipping SMS');
    return false;
  }

  if (!twilioClient) {
    console.error('[twilio] Twilio client not initialized');
    return false;
  }

  const rateCheck = pruneAndCheckRateLimit(phoneNumber);
  if (!rateCheck.allowed) {
    debugLog(`[twilio] SMS blocked by rate limit for ${phoneNumber}: ${rateCheck.reason}`);
    return false;
  }

  try {
    const message = `Your VarsityHub verification code is: ${code}. This code expires in 30 minutes.`;
    
    await twilioClient.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: phoneNumber,
    });

    debugLog(`[twilio] ✅ SMS sent successfully to ${phoneNumber}`);
    return true;
  } catch (error: any) {
    console.error(`[twilio] ❌ Failed to send SMS to ${phoneNumber}:`, error?.message || error);
    return false;
  }
}

/**
 * Send SMS password reset code
 */
export async function sendSmsPasswordReset(phoneNumber: string, code: string): Promise<boolean> {
  if (!isTwilioConfigured() || !twilioClient) {
    debugLog('[twilio] Twilio not configured - skipping SMS');
    return false;
  }

  const rateCheck = pruneAndCheckRateLimit(phoneNumber);
  if (!rateCheck.allowed) {
    debugLog(`[twilio] Password reset SMS blocked by rate limit for ${phoneNumber}: ${rateCheck.reason}`);
    return false;
  }

  try {
    const message = `Your VarsityHub password reset code is: ${code}. This code expires in 30 minutes.`;
    
    await twilioClient.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: phoneNumber,
    });

    debugLog(`[twilio] ✅ Password reset SMS sent successfully to ${phoneNumber}`);
    return true;
  } catch (error: any) {
    console.error(`[twilio] ❌ Failed to send password reset SMS to ${phoneNumber}:`, error?.message || error);
    return false;
  }
}

/**
 * Send SMS notification (generic)
 */
export async function sendSmsNotification(phoneNumber: string, message: string): Promise<boolean> {
  if (!isTwilioConfigured() || !twilioClient) {
    debugLog('[twilio] Twilio not configured - skipping SMS');
    return false;
  }

  const rateCheck = pruneAndCheckRateLimit(phoneNumber);
  if (!rateCheck.allowed) {
    debugLog(`[twilio] Notification SMS blocked by rate limit for ${phoneNumber}: ${rateCheck.reason}`);
    return false;
  }

  try {
    await twilioClient.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: phoneNumber,
    });

    debugLog(`[twilio] ✅ SMS notification sent successfully to ${phoneNumber}`);
    return true;
  } catch (error: any) {
    console.error(`[twilio] ❌ Failed to send SMS notification to ${phoneNumber}:`, error?.message || error);
    return false;
  }
}

export { twilioClient };
