import crypto from 'crypto';
import { prisma } from './prisma.js';

const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const ACCESS_TOKEN_EXPIRY = '1h'; // Reduced from 7d

export interface RefreshTokenPayload {
  userId: string;
  token: string;
  expiresAt: Date;
}

/**
 * Generate a cryptographically secure refresh token
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Store a refresh token in the database
 */
export async function createRefreshToken(userId: string): Promise<RefreshTokenPayload> {
  const token = generateRefreshToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await prisma.refreshToken.create({
    data: {
      user_id: userId,
      token,
      expires_at: expiresAt,
      revoked: false,
    },
  });

  return { userId, token, expiresAt };
}

/**
 * Validate and consume a refresh token
 * Returns userId if valid, null if invalid/expired/revoked
 */
export async function validateRefreshToken(token: string): Promise<string | null> {
  const record = await prisma.refreshToken.findUnique({
    where: { token },
  });

  if (!record) return null;
  if (record.revoked) return null;
  if (record.expires_at < new Date()) return null;

  return record.user_id;
}

/**
 * Revoke a specific refresh token
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { token },
    data: { revoked: true },
  });
}

/**
 * Revoke all refresh tokens for a user (on password change, suspicious activity)
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { user_id: userId, revoked: false },
    data: { revoked: true },
  });
}

/**
 * Clean up expired tokens (run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expires_at: { lt: new Date() } },
        { revoked: true, updated_at: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, // Delete revoked tokens older than 7 days
      ],
    },
  });
  return result.count;
}

export { ACCESS_TOKEN_EXPIRY };
