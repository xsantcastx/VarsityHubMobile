import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { runWithBreaker } from '../../lib/circuitBreaker.js';
import { APPLE_PRODUCT_TO_PLAN } from '../../lib/paymentInternals.js';

// Google Play uses the same subscription SKU strings as Apple, so reuse the one
// canonical product->plan map rather than a second literal that could drift.
export const GOOGLE_PRODUCT_TO_PLAN: Record<string, string> = APPLE_PRODUCT_TO_PLAN;

export const GOOGLE_ALLOWED_PACKAGES = (
  process.env.GOOGLE_PLAY_PACKAGE_NAMES || 'com.varsityhub.varsityhub,com.xsantcastx.varsityhub'
)
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const GOOGLE_PLAY_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_PLAY_SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const GOOGLE_PLAY_API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL = (
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || ''
).trim();
const GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY = (
  process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY || ''
)
  .replace(/\\n/g, '\n')
  .trim();

export function getGooglePurchaseOrderId(purchaseToken: string): string {
  return `google_purchase:${crypto.createHash('sha256').update(String(purchaseToken)).digest('hex')}`;
}

export function hasGooglePlayVerifierConfig() {
  return Boolean(GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL && GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY);
}

async function getGooglePlayAccessToken(): Promise<string | null> {
  if (!hasGooglePlayVerifierConfig()) return null;
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL,
      scope: GOOGLE_PLAY_SCOPE,
      aud: GOOGLE_PLAY_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY,
    { algorithm: 'RS256' }
  );

  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const response = await runWithBreaker(
    'google-play',
    () =>
      fetch(GOOGLE_PLAY_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      }),
    { timeout: 10000 }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Google token exchange failed (${response.status}): ${text || 'no response body'}`
    );
  }
  const payload: any = await response.json();
  return typeof payload?.access_token === 'string' ? payload.access_token : null;
}

export async function verifyGooglePurchaseWithPlayApi(params: {
  packageName: string;
  productId: string;
  purchaseToken: string;
}) {
  const accessToken = await getGooglePlayAccessToken();
  if (!accessToken) {
    return { verified: false as const, reason: 'google_verifier_not_configured' };
  }

  const { packageName, productId, purchaseToken } = params;
  const url = `${GOOGLE_PLAY_API_BASE}/applications/${encodeURIComponent(packageName)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const response = await runWithBreaker(
    'google-play',
    () =>
      fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    { timeout: 10000 }
  );
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    return {
      verified: false as const,
      reason: `google_play_api_${response.status}`,
      details: text || null,
    };
  }

  const payload: any = await response.json();
  const expiryTimeMillis = Number(payload?.expiryTimeMillis || 0);
  const cancelReason = payload?.cancelReason;
  const isExpired = !expiryTimeMillis || expiryTimeMillis <= Date.now();
  const isCanceled = cancelReason !== undefined && cancelReason !== null;
  if (isExpired || isCanceled) {
    return {
      verified: false as const,
      reason: isExpired ? 'google_subscription_expired' : 'google_subscription_canceled',
      details: payload,
    };
  }

  return {
    verified: true as const,
    expiresAt: new Date(expiryTimeMillis).toISOString(),
    details: payload,
  };
}
