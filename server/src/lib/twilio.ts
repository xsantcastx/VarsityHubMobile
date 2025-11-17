import type { Twilio } from 'twilio';
import twilio from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromPhoneNumber = process.env.TWILIO_FROM_PHONE || '';

export const isTwilioConfigured = (): boolean => {
  return !!(accountSid && authToken && fromPhoneNumber);
};

// Initialize Twilio client if configured
let twilioClient: Twilio | null = null;

if (isTwilioConfigured()) {
  twilioClient = twilio(accountSid, authToken);
  console.log('✅ Twilio configured - SMS verification enabled');
} else {
  console.log('⚠️ Twilio not configured - SMS verification disabled (email only)');
}

/**
 * Send SMS verification code to phone number
 */
export async function sendSmsVerificationCode(phoneNumber: string, code: string): Promise<boolean> {
  if (!isTwilioConfigured()) {
    console.log('[twilio] Twilio not configured - skipping SMS');
    return false;
  }

  if (!twilioClient) {
    console.error('[twilio] Twilio client not initialized');
    return false;
  }

  try {
    const message = `Your VarsityHub verification code is: ${code}. This code expires in 30 minutes.`;
    
    await twilioClient.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: phoneNumber,
    });

    console.log(`[twilio] ✅ SMS sent successfully to ${phoneNumber}`);
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
    console.log('[twilio] Twilio not configured - skipping SMS');
    return false;
  }

  try {
    const message = `Your VarsityHub password reset code is: ${code}. This code expires in 30 minutes.`;
    
    await twilioClient.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: phoneNumber,
    });

    console.log(`[twilio] ✅ Password reset SMS sent successfully to ${phoneNumber}`);
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
    console.log('[twilio] Twilio not configured - skipping SMS');
    return false;
  }

  try {
    await twilioClient.messages.create({
      body: message,
      from: fromPhoneNumber,
      to: phoneNumber,
    });

    console.log(`[twilio] ✅ SMS notification sent successfully to ${phoneNumber}`);
    return true;
  } catch (error: any) {
    console.error(`[twilio] ❌ Failed to send SMS notification to ${phoneNumber}:`, error?.message || error);
    return false;
  }
}

export { twilioClient };
