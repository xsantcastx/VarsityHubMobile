import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Apple Sign In Token Verification
// Uses key: LS9X6BV22K
// Team ID and Bundle ID from app.json

export interface AppleTokenPayload {
  iss: string; // Issuer (https://appleid.apple.com)
  aud: string; // Audience (bundle ID)
  sub: string; // Subject (unique user identifier)
  iat: number; // Issued at
  exp: number; // Expiration
  email?: string;
  email_verified?: boolean;
  is_private_email?: boolean;
}

/**
 * Verify Apple Sign In identity token
 * @param identityToken JWT token from Apple Sign In
 * @returns Decoded token payload if valid
 */
export async function verifyAppleToken(identityToken: string): Promise<AppleTokenPayload | null> {
  try {
    // Get Apple's public keys
    const response = await fetch('https://appleid.apple.com/auth/keys');
    const { keys } = (await response.json()) as { keys: Array<{ kid: string; use: string; alg: string; kty: string; n: string; e: string }> };

    // Decode token header to find kid
    const header = JSON.parse(
      Buffer.from(identityToken.split('.')[0], 'base64').toString('utf-8')
    ) as { kid: string; alg: string };

    // Find the matching public key
    const publicKey = keys.find(key => key.kid === header.kid);
    if (!publicKey) {
      console.error('[apple-auth] Public key not found for kid:', header.kid);
      return null;
    }

    // Convert JWK to PEM format for verification
    const n = Buffer.from(publicKey.n, 'base64');
    const e = Buffer.from(publicKey.e, 'base64');
    
    // Build PKCS#1 RSA public key
    const publicKeyPem = createPublicKeyFromJWK(n, e);

    // Verify JWT signature
    const decoded = jwt.verify(identityToken, publicKeyPem, {
      algorithms: ['RS256'],
      issuer: 'https://appleid.apple.com',
      audience: process.env.APPLE_BUNDLE_ID || 'com.xsantcastx.varsityhub',
    }) as AppleTokenPayload;

    // Additional validation
    if (decoded.iss !== 'https://appleid.apple.com') {
      console.error('[apple-auth] Invalid issuer:', decoded.iss);
      return null;
    }

    if (decoded.aud !== (process.env.APPLE_BUNDLE_ID || 'com.xsantcastx.varsityhub')) {
      console.error('[apple-auth] Invalid audience:', decoded.aud);
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('[apple-auth] Token verification failed:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Helper: Convert JWK RSA components to PEM format
 * Used for JWT verification with Apple's public keys
 */
function createPublicKeyFromJWK(n: Buffer, e: Buffer): string {
  // This converts JWK (JSON Web Key) to OpenSSL PEM format
  // For production, consider using a library like 'jwk-to-pem'
  // For now, we'll use Node's built-in crypto.createPublicKey
  
  const keyObject = crypto.createPublicKey({
    key: {
      kty: 'RSA',
      n: n.toString('base64url'),
      e: e.toString('base64url'),
    },
    format: 'jwk',
  });

  return keyObject.export({ type: 'spki', format: 'pem' }) as string;
}

/**
 * Load Apple Sign In private key from file system
 * Used for server-to-server communication with Apple (if needed in future)
 * 
 * Key ID: LS9X6BV22K
 * Location: server/.keys/AuthKey_LS9X6BV22K.p8
 */
export function loadApplePrivateKey(): string | null {
  try {
    const keyPath = path.join(process.cwd(), 'server', '.keys', 'AuthKey_LS9X6BV22K.p8');
    if (!fs.existsSync(keyPath)) {
      console.warn('[apple-auth] Private key not found at:', keyPath);
      return null;
    }
    return fs.readFileSync(keyPath, 'utf-8');
  } catch (error) {
    console.error('[apple-auth] Failed to load private key:', error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Environment variables required:
 * - APPLE_BUNDLE_ID: Bundle identifier (com.xsantcastx.varsityhub)
 * - APPLE_TEAM_ID: Apple Developer Team ID
 * - APPLE_KEY_ID: Key ID (LS9X6BV22K)
 * 
 * File location:
 * - server/.keys/AuthKey_LS9X6BV22K.p8
 */
