import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const authSrc = readFileSync(fileURLToPath(new URL('../routes/auth.ts', import.meta.url)), 'utf8');

describe('auth duplicate-account race guards', () => {
  it('registers with case-insensitive duplicate lookup and P2002 conflict recovery', () => {
    expect(authSrc).toMatch(
      /const exists = await prisma\.user\.findFirst\(\{\s*where:\s*\{\s*email:\s*\{\s*equals:\s*sanitizedEmail,\s*mode:\s*'insensitive'/
    );
    expect(authSrc).toMatch(/if \(createErr\?\.code === 'P2002'\)/);
    expect(authSrc).toMatch(/errorCode:\s*'EMAIL_ALREADY_REGISTERED'/);
  });

  it('keeps OAuth create paths on the existing-account 409 flow after create races', () => {
    expect(authSrc).toMatch(
      /buildOAuthExistingAccountConflict\(\{\s*email,\s*user:\s*existingUser,\s*providerLabel:\s*'Google'/
    );
    expect(authSrc).toMatch(
      /buildOAuthExistingAccountConflict\(\{\s*email:\s*userEmail,\s*user:\s*existingUser,\s*providerLabel:\s*'Apple'/
    );
    expect(authSrc).toMatch(/createErr\?\.code === 'P2002'/);
  });
});
