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

function deriveConsentResolutionReason(
  status: string | null | undefined,
  banReason?: string | null
): 'expired' | 'already_approved' | 'already_denied' | 'not_found' {
  if (status === 'approved') return 'already_approved';
  if (status === 'denied') {
    return banReason === 'Parental consent not received within 14 days'
      ? 'expired'
      : 'already_denied';
  }
  return 'not_found';
}

export type ConsentLookupResult =
  | { ok: true; userId: string; requestedAt: Date }
  | { ok: false; reason: 'not_found' | 'expired' | 'already_approved' | 'already_denied' };

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
      ban_reason: true,
    },
  });
  if (!user || !user.parental_consent_requested_at) {
    return { ok: false, reason: 'not_found' };
  }
  const elapsed = Date.now() - user.parental_consent_requested_at.getTime();
  if (user.parental_consent_status === 'pending' && elapsed > PARENTAL_CONSENT_EXPIRY_MS) {
    return { ok: false, reason: 'expired' };
  }
  if (user.parental_consent_status !== 'pending') {
    return {
      ok: false,
      reason: deriveConsentResolutionReason(user.parental_consent_status, user.ban_reason),
    };
  }
  return {
    ok: true,
    userId: user.id,
    requestedAt: user.parental_consent_requested_at,
  };
}

/**
 * Record parental consent approval. Guards on `pending` so a stale browser tab
 * cannot override a more recent deny/admin action. The token hash is preserved
 * so a replayed link can render the final outcome instead of looking invalid.
 */
export async function recordConsentApproval(
  userId: string
): Promise<
  | { ok: true }
  | { ok: false; reason: 'expired' | 'already_approved' | 'already_denied' | 'not_found' }
> {
  const now = new Date();
  const transition = await prisma.user.updateMany({
    where: { id: userId, parental_consent_status: 'pending' },
    data: {
      parental_consent_status: 'approved',
      parental_consent_at: now,
      banned: false,
      banned_until: null,
      ban_reason: null,
    },
  });
  if (transition.count > 0) {
    return { ok: true };
  }
  const latest = await prisma.user.findUnique({
    where: { id: userId },
    select: { parental_consent_status: true, ban_reason: true },
  });
  return {
    ok: false,
    reason: deriveConsentResolutionReason(latest?.parental_consent_status, latest?.ban_reason),
  };
}

/**
 * Record parental consent denial. Per the agreed policy (soft-block):
 *   - `parental_consent_status = 'denied'`
 *   - `banned = true` with a clear reason so support can reverse if needed
 *   - Pending-state guard so a later click can't override an earlier decision
 *   - Token hash preserved so a replayed link renders the final outcome
 *   - Refresh tokens revoked — the minor can't continue using the app
 *
 * Account data is NOT anonymized on deny; that path is reserved for explicit
 * account deletion or the auto-expire cron after a grace period.
 */
export async function recordConsentDenial(
  userId: string,
  reason?: string
): Promise<
  | { ok: true }
  | { ok: false; reason: 'expired' | 'already_approved' | 'already_denied' | 'not_found' }
> {
  const now = new Date();
  const transition = await prisma.$transaction(async tx => {
    const updated = await tx.user.updateMany({
      where: { id: userId, parental_consent_status: 'pending' },
      data: {
        parental_consent_status: 'denied',
        parental_consent_at: now,
        banned: true,
        banned_until: null,
        ban_reason: reason?.trim() || 'Parental consent denied',
      },
    });
    if (updated.count > 0) {
      await tx.refreshToken.deleteMany({ where: { user_id: userId } });
    }
    return updated.count;
  });
  if (transition > 0) {
    return { ok: true };
  }
  const latest = await prisma.user.findUnique({
    where: { id: userId },
    select: { parental_consent_status: true, ban_reason: true },
  });
  return {
    ok: false,
    reason: deriveConsentResolutionReason(latest?.parental_consent_status, latest?.ban_reason),
  };
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
