import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;

if (!accountSid || !authToken || !verifySid) {
  console.warn(
    '[Twilio] Missing required environment variables. SMS functionality will be disabled.'
  );
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * Sends a verification code to a phone number using Twilio Verify.
 * @param phone The phone number in E.164 format (e.g., +15551234567).
 * @returns The status of the verification request.
 */
export async function sendSmsVerification(phone: string): Promise<any> {
  if (!client || !verifySid) {
    console.log('[dev] SMS verification: returning mock success.');
    return { status: 'pending' };
  }

  try {
    const verification = await client.verify.v2
      .services(verifySid)
      .verifications.create({ to: phone, channel: 'sms' });
    console.log(`[Twilio] Verification sent. Status: ${verification.status}`);
    return verification;
  } catch (error) {
    console.error('[Twilio] Failed to send verification:', error);
    throw new Error('Failed to send SMS verification.');
  }
}

/**
 * Checks a verification code for a phone number using Twilio Verify.
 * @param phone The phone number in E.164 format.
 * @param code The 6-digit code from the user.
 * @returns The status of the verification check.
 */
export async function checkSmsVerification(phone: string, code: string): Promise<any> {
  if (!client || !verifySid) {
    console.log('[dev] SMS verification check: returning mock success.');
    // In dev, any 6-digit code starting with '1' is valid
    if (code.length === 6 && code.startsWith('1')) {
      return { status: 'approved' };
    }
    return { status: 'pending' };
  }

  try {
    const verificationCheck = await client.verify.v2
      .services(verifySid)
      .verificationChecks.create({ to: phone, code });
    console.log(`[Twilio] Verification check complete. Status: ${verificationCheck.status}`);
    return verificationCheck;
  } catch (error) {
    console.error('[Twilio] Failed to check verification:', error);
    throw new Error('Failed to check SMS verification.');
  }
}
