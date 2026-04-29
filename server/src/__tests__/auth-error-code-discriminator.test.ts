import { describe, expect, it } from '@jest/globals';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function getRepoRoot(): string {
  const cwd = process.cwd();
  return existsSync(join(cwd, 'server')) ? cwd : join(cwd, '..');
}

describe('auth verify/reset error code contract', () => {
  it('returns stable machine-readable codes from auth routes', () => {
    const repoRoot = getRepoRoot();
    const authSrc = readFileSync(join(repoRoot, 'server', 'src', 'routes', 'auth.ts'), 'utf8');

    expect(authSrc).toContain("sendAuthError(res, 400, 'Invalid payload', 'INVALID_PAYLOAD')");
    expect(authSrc).toContain("'RESET_LOCKED'");
    expect(authSrc).toContain("'RESET_RATE_LIMITED'");
    expect(authSrc).toContain("'RESET_CODE_INVALID'");
    expect(authSrc).toContain("'RESET_CODE_EXPIRED'");
    expect(authSrc).toContain("'VERIFY_REQUEST_COOLDOWN'");
    expect(authSrc).toContain("'VERIFY_REQUEST_RATE_LIMITED'");
    expect(authSrc).toContain("'VERIFY_NO_CODE'");
    expect(authSrc).toContain("'VERIFY_CODE_EXPIRED'");
    expect(authSrc).toContain("'VERIFY_CODE_INVALID'");
  });

  it('uses error codes in the mobile verify/reset UX instead of brittle message includes', () => {
    const repoRoot = getRepoRoot();
    const resetScreen = readFileSync(join(repoRoot, 'app', 'reset-password.tsx'), 'utf8');
    const verifyScreen = readFileSync(join(repoRoot, 'app', 'verify.tsx'), 'utf8');

    expect(resetScreen).toContain("errorCode === 'RESET_CODE_EXPIRED'");
    expect(resetScreen).toContain("errorCode === 'RESET_CODE_INVALID'");
    expect(resetScreen).not.toContain("error.toLowerCase().includes('expired')");
    expect(resetScreen).not.toContain("error.toLowerCase().includes('invalid')");

    expect(verifyScreen).toContain("code === 'VERIFY_CODE_EXPIRED'");
    expect(verifyScreen).toContain("code === 'VERIFY_CODE_INVALID'");
    expect(verifyScreen).toContain("code === 'VERIFY_NO_CODE'");
    expect(verifyScreen).not.toContain("errorMsg.includes('expired')");
    expect(verifyScreen).not.toContain("errorMsg.includes('Invalid code')");
    expect(verifyScreen).not.toContain("errorMsg.includes('No verification in progress')");
  });
});
