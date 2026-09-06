import jwt from 'jsonwebtoken';
import { Environment, SignedDataVerifier } from '@apple/app-store-server-library';
import { APPLE_ROOT_CA_G3 } from './appleRootCaG3.js';

// Immutable Apple certificate trust, certificate signatures/purpose, bundle and
// environment validation live in Apple's verifier, not issuer-name comparisons.
// Offline verification uses the signed date for certificate validity, preserving
// recovery of older receipts. It does not claim online OCSP/revocation checks.
function verifierFor(token: string, notification = false): SignedDataVerifier {
  if (typeof token !== 'string' || token.length > 100000)
    throw new Error('Invalid Apple signed payload');
  const decoded = jwt.decode(token) as any;
  const environment = notification
    ? (decoded?.data?.environment ?? decoded?.summary?.environment)
    : decoded?.environment;
  if (environment !== Environment.SANDBOX && environment !== Environment.PRODUCTION) {
    throw new Error('Unsupported Apple signed environment');
  }
  const bundleId = process.env.APPLE_BUNDLE_ID?.trim();
  if (!bundleId) throw new Error('APPLE_BUNDLE_ID is required for Apple verification');
  // Public application identifier; same App Store app as eas.json submit config.
  const appAppleId = Number(process.env.APPLE_APP_ID || '6758405187');
  if (!Number.isSafeInteger(appAppleId) || appAppleId <= 0)
    throw new Error('Invalid Apple app identifier');
  return new SignedDataVerifier([APPLE_ROOT_CA_G3], false, environment, bundleId, appAppleId);
}

export async function verifyAppleSignedJws(token: string): Promise<any> {
  try {
    return await verifierFor(token).verifyAndDecodeTransaction(token);
  } catch {
    throw new Error('Untrusted Apple signed transaction');
  }
}
export async function verifyAppleNotificationJws(token: string): Promise<any> {
  try {
    return await verifierFor(token, true).verifyAndDecodeNotification(token);
  } catch {
    throw new Error('Untrusted Apple signed notification');
  }
}
export async function verifyAppleRenewalJws(token: string): Promise<any> {
  try {
    return await verifierFor(token).verifyAndDecodeRenewalInfo(token);
  } catch {
    throw new Error('Untrusted Apple signed renewal');
  }
}
