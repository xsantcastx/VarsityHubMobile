/**
 * Parental consent helpers for VarsityHub.
 *
 * Minors aged 13–17 can't complete onboarding without a parent/guardian
 * approving their account. This module owns:
 *   - Token generation + SHA-256 hashing (single-use, stored hashed)
 *   - Token verification
 *   - The 14-day expiry window
 *   - State-transition helpers for `approve` / `deny` / `expire`
 *
 * It does NOT own the HTTP layer or the email layer — the routes call these
 * helpers and handle responses; the email template is wired in `lib/email.ts`.
 */

import crypto from 'node:crypto';
import { prisma } from './prisma.js';

/** Consent-link expiry window. 14 days matches COPPA industry norms. */
export const PARENTAL_CONSENT_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;

/** Length of the raw token in bytes before hex encoding (→ 64 hex chars). */
const TOKEN_BYTES = 32;

/**
 * Generate a cryptographically random consent token. Returns the raw token
 * (for inclusion in the email link) and its SHA-256 hash (for DB storage).
 * The raw token is never stored — same pattern as refresh_token.
 */
export function generateConsentToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const hash = hashConsentToken(raw);
  return { raw, hash };
}

/** SHA-256 hash a consent token, hex-encoded. Matches refresh-token pattern. */
export function hashConsentToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export type ConsentLookupResult =
  | { ok: true; userId: string; requestedAt: Date }
  | { ok: false; reason: 'not_found' | 'expired' | 'already_resolved' };

/**
 * Look up the user matching a consent token. Validates that:
 *   - The token hash exists in the DB
 *   - The status is still `pending` (already-approved/denied rejects replays)
 *   - The `requested_at` is within the 14-day window
 *
 * Returns `ok: false` with a categorical reason on failure so callers can
 * render a useful confirmation page ("this link expired" vs "already used").
 */
export async function lookupConsentByToken(rawToken: string): Promise<ConsentLookupResult> {
  if (!rawToken || typeof rawToken !== 'string' || rawToken.length < 16) {
    return { ok: false, reason: 'not_found' };
  }
  const hash = hashConsentToken(rawToken);
  const user = await prisma.user.findFirst({
    where: { parental_consent_token_hash: hash },
    select: {
      id: true,
      parental_consent_status: true,
      parental_consent_requested_at: true,
    },
  });
  if (!user || !user.parental_consent_requested_at) {
    return { ok: false, reason: 'not_found' };
  }
  if (user.parental_consent_status !== 'pending') {
    return { ok: false, reason: 'already_resolved' };
  }
  const elapsed = Date.now() - user.parental_consent_requested_at.getTime();
  if (elapsed > PARENTAL_CONSENT_EXPIRY_MS) {
    return { ok: false, reason: 'expired' };
  }
  return {
    ok: true,
    userId: user.id,
    requestedAt: user.parental_consent_requested_at,
  };
}

/**
 * Record parental consent approval. Clears the token hash (single-use),
 * sets `parental_consent_status = 'approved'` and the timestamp. Should only
 * be called after a successful `lookupConsentByToken`.
 */
export async function recordConsentApproval(userId: string): Promise<void> {
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: {
      parental_consent_status: 'approved',
      parental_consent_at: now,
      parental_consent_token_hash: null,
    },
  });
}

/**
 * Record parental consent denial. Per the agreed policy (soft-block):
 *   - `parental_consent_status = 'denied'`
 *   - `banned = true` with a clear reason so support can reverse if needed
 *   - Token hash cleared so a second click doesn't flip back
 *   - Refresh tokens revoked — the minor can't continue using the app
 *
 * Account data is NOT anonymized on deny; that path is reserved for explicit
 * account deletion or the auto-expire cron after a grace period.
 */
export async function recordConsentDenial(userId: string, reason?: string): Promise<void> {
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        parental_consent_status: 'denied',
        parental_consent_at: now,
        parental_consent_token_hash: null,
        banned: true,
        ban_reason: reason?.trim() || 'Parental consent denied',
      },
    }),
    prisma.refreshToken.deleteMany({ where: { user_id: userId } }),
  ]);
}

/**
 * Initiate a fresh consent request (or re-issue on resend). Overwrites any
 * prior token hash so the older email link stops working. Returns the RAW
 * token for inclusion in the email.
 */
export async function issueConsentToken(userId: string): Promise<string> {
  const { raw, hash } = generateConsentToken();
  const now = new Date();
  await prisma.user.update({
    where: { id: userId },
    data: {
      parental_consent_status: 'pending',
      parental_consent_requested_at: now,
      parental_consent_token_hash: hash,
      // Explicitly null the resolved timestamp so the state machine is clean
      // on resend after a prior approval was rolled back by an admin.
      parental_consent_at: null,
    },
  });
  return raw;
}
