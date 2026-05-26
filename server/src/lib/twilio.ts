import type { Twilio } from 'twilio';
import twilio from 'twilio';
import { debugLog } from './debugLog.js';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_FROM_PHONE || '';

export const isTwilioConfigured = (): boolean => {
  return !!(accountSid && authToken && fromPhoneNumber);
};

let twilioClient: Twilio | null = null;
let twilioInitAttempted = false;

function getTwilioClient(): Twilio | null {
  if (twilioClient || twilioInitAttempted) return twilioClient;

  twilioInitAttempted = true;

  if (!isTwilioConfigured()) {
    debugLog('⚠️ Twilio not configured - SMS verification disabled (email only)');
    return null;
  }

  try {
    twilioClient = twilio(accountSid, authToken);
    debugLog('✅ Twilio configured - SMS verification enabled');
  } catch (error: any) {
    console.error('[twilio] Failed to initialize Twilio client:', error?.message || error);
    twilioClient = null;
  }

  return twilioClient;
}

/**
 * Send SMS verification code to phone number
 */
export async function sendSmsVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
  if (!isTwilioConfigured()) {
    debugLog('[twilio] Twilio not configured - skipping SMS');
    return false;
  }

  const client = getTwilioClient();
  if (!client) {
    console.error('[twilio] Twilio client not initialized');
    return false;
  }

  try {
    const message = `Your VarsityHub verification code is: ${code}. This code expires in 30 minutes.`;
    
    await client.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: phoneNumber,
    });

    debugLog(`[twilio] ✅ SMS sent successfully to ${phoneNumber}`);
    return true;
  } catch (error: any) {
    console.error('[twilio] Failed to send SMS:', error?.message || error);
    return false;
  }
}

/**
 * Send SMS password reset code
 */
export async function sendSmsPasswordReset(phoneNumber: string, code: string): Promise<boolean> {
  const client = getTwilioClient();
  if (!isTwilioConfigured() || !client) {
    debugLog('[twilio] Twilio not configured - skipping SMS');
    return false;
  }

  try {
    const message = `Your VarsityHub password reset code is: ${code}. This code expires in 30 minutes.`;
    
    await client.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: phoneNumber,
    });

    debugLog(`[twilio] ✅ Password reset SMS sent successfully to ${phoneNumber}`);
    return true;
  } catch (error: any) {
    console.error('[twilio] Failed to send password reset SMS:', error?.message || error);
    return false;
  }
}

/**
 * Send SMS notification (generic)
 */
export async function sendSmsNotification(phoneNumber: string, message: string): Promise<boolean> {
  const client = getTwilioClient();
  if (!isTwilioConfigured() || !client) {
    debugLog('[twilio] Twilio not configured - skipping SMS');
    return false;
  }

  try {
    await client.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: phoneNumber,
    });

    debugLog(`[twilio] ✅ SMS notification sent successfully to ${phoneNumber}`);
    return true;
  } catch (error: any) {
    console.error('[twilio] Failed to send SMS notification:', error?.message || error);
    return false;
  }
}

export { twilioClient };
