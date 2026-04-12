import type { Twilio } from 'twilio';
import { debugLog } from './debugLog.js';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_FROM_PHONE || '';

export const isTwilioConfigured = (): boolean => {
  return !!(accountSid && authToken && fromPhoneNumber);
};

// Initialize Twilio client if configured
let twilioClient: Twilio | null = null;
let twilioInitLogged = false;

async function getTwilioClient(): Promise<Twilio | null> {
  if (!isTwilioConfigured()) {
    if (!twilioInitLogged) {
      debugLog('⚠️ Twilio not configured - SMS verification disabled (email only)');
      twilioInitLogged = true;
    }
    return null;
  }

  if (twilioClient) {
    return twilioClient;
  }

  const { default: twilio } = await import('twilio');
  twilioClient = twilio(accountSid!, authToken!);

  if (!twilioInitLogged) {
    debugLog('✅ Twilio configured - SMS verification enabled');
    twilioInitLogged = true;
  }

  return twilioClient;
}

/**
 * Send SMS verification code to phone number
 */
export async function sendSmsVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
  const client = await getTwilioClient();
  if (!client) {
    debugLog('[twilio] Twilio not configured - skipping SMS');
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
    console.error(`[twilio] ❌ Failed to send SMS to ${phoneNumber}:`, error?.message || error);
    return false;
  }
}

/**
 * Send SMS password reset code
 */
export async function sendSmsPasswordReset(phoneNumber: string, code: string): Promise<boolean> {
  const client = await getTwilioClient();
  if (!client) {
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
    console.error(
      `[twilio] ❌ Failed to send password reset SMS to ${phoneNumber}:`,
      error?.message || error
    );
    return false;
  }
}

/**
 * Send SMS notification (generic)
 */
export async function sendSmsNotification(phoneNumber: string, message: string): Promise<boolean> {
  const client = await getTwilioClient();
  if (!client) {
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
    console.error(
      `[twilio] ❌ Failed to send SMS notification to ${phoneNumber}:`,
      error?.message || error
    );
    return false;
  }
}

export { twilioClient };
