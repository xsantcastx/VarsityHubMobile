import { prisma } from './prisma.js';
import { signAccessTokenForSession, generateRefreshToken, hashRefreshToken, REFRESH_TOKEN_EXPIRY_DAYS } from './jwt.js';

/**
 * Starts a fresh authenticated session for a user and invalidates every other
 * active session that user holds. Use this on every path that establishes a
 * new login: /auth/login, /auth/google, /auth/apple, /auth/password/reset.
 *
 * What it does, atomically where it matters:
 * 1. Bump `User.session_epoch` — this immediately invalidates every access
 *    token the user holds (the auth middleware rejects tokens whose `se`
 *    claim doesn't match the current epoch).
 * 2. Delete every existing RefreshToken for the user — no other device can
 *    rotate tokens to stay logged in.
 * 3. Mint a new access-token / refresh-token pair bound to the new epoch,
 *    and persist the refresh token's hash with the caller-provided device
 *    identifier.
 *
 * Returns the raw token pair the caller should send to the client.
 *
 * NOT for /auth/register (new user has no other sessions to kick) and NOT
 * for /auth/refresh (rotation preserves the existing session).
 */
export async function startNewSession(
  userId: string,
  deviceInfo: string | null,
): Promise<{ access_token: string; refresh_token: string; session_epoch: number }> {
  const rawRefresh = generateRefreshToken();
  const tokenHash = hashRefreshToken(rawRefresh);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // Bump the epoch, purge old refresh tokens, and write the new one in a
  // single transaction so we can't end up with a user whose epoch advanced
  // but whose refresh tokens weren't cleared (or vice-versa).
  const { session_epoch } = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { session_epoch: { increment: 1 } },
      select: { session_epoch: true },
    });
    await tx.refreshToken.deleteMany({ where: { user_id: userId } });
    await tx.refreshToken.create({
      data: {
        token_hash: tokenHash,
        user_id: userId,
        expires_at: expiresAt,
        device_info: deviceInfo,
      },
    });
    return updated;
  });

  const access_token = signAccessTokenForSession(userId, session_epoch);
  return { access_token, refresh_token: rawRefresh, session_epoch };
}
