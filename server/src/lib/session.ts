import { prisma } from './prisma.js';
import {
  signAccessTokenForSession,
  generateRefreshTokenV2,
  hashRefreshTokenSecret,
  REFRESH_TOKEN_EXPIRY_DAYS,
  REFRESH_TOKEN_HASH_VERSION_V2,
} from './jwt.js';

/**
 * Starts a fresh authenticated session for a user. Use this on every path that
 * establishes a new login: /auth/login, /auth/google, /auth/apple,
 * /auth/password/reset.
 *
 * This intentionally allows multiple active devices/surfaces for the same
 * account. A fresh login mints an additional refresh token instead of killing
 * every existing device session. Forced security actions (password change,
 * bans, account deletion) still invalidate all sessions by bumping
 * `session_epoch` and deleting refresh tokens.
 *
 * Returns the raw token pair the caller should send to the client.
 *
 * NOT for /auth/register (new user has no prior session state to preserve) and
 * NOT for /auth/refresh (rotation preserves the existing session).
 */
export async function startNewSession(
  userId: string,
  deviceInfo: string | null,
): Promise<{ access_token: string; refresh_token: string; session_epoch: number }> {
  // v2 always: bcrypt-over-secret with a key_id lookup index.
  const { raw: rawRefresh, keyId, secret } = generateRefreshTokenV2();
  const tokenHash = await hashRefreshTokenSecret(secret);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  // This path only needs the current session_epoch plus a new refresh token row.
  // Avoid an interactive transaction here: production auth latency can exceed
  // Prisma's default 5s interactive transaction timeout and intermittently
  // break otherwise-valid logins.
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { session_epoch: true },
  });

  await prisma.refreshToken.create({
    data: {
      token_hash: tokenHash,
      key_id: keyId,
      hash_version: REFRESH_TOKEN_HASH_VERSION_V2,
      user_id: userId,
      expires_at: expiresAt,
      device_info: deviceInfo,
    },
  });

  const access_token = signAccessTokenForSession(userId, user.session_epoch);
  return { access_token, refresh_token: rawRefresh, session_epoch: user.session_epoch };
}

export async function revokeAllSessions(userId: string): Promise<{ revokedRefreshTokens: number }> {
  const [, revoked] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { session_epoch: { increment: 1 } },
      select: { id: true },
    }),
    prisma.refreshToken.deleteMany({ where: { user_id: userId } }),
  ]);

  return { revokedRefreshTokens: revoked.count };
}
