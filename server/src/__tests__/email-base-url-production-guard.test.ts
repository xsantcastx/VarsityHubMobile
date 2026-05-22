import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const emailLib = readFileSync(join(repoRoot, 'src/lib/email.ts'), 'utf8');

describe('email base URL production guard', () => {
  it('enforces strict production startup when email URLs resolve via fallback', () => {
    expect(emailLib).toMatch(/function enforceProductionEmailBaseUrlConfig\(\)/);
    expect(emailLib).toMatch(/ALLOW_EMAIL_BASE_URL_FALLBACK/);
    expect(emailLib).toMatch(/if \(API_BASE_URL_RESOLUTION\.usedFallback\)/);
    expect(emailLib).toMatch(/if \(APP_BASE_URL_RESOLUTION\.usedFallback\)/);
    expect(emailLib).toMatch(/process\.exit\(1\)/);
    expect(emailLib).toMatch(/enforceProductionEmailBaseUrlConfig\(\);/);
  });
});
