import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROUTES_DIR = join(process.cwd(), 'src', 'routes');
const APP_SRC = readFileSync(join(process.cwd(), 'src', 'app.ts'), 'utf8');
const ADS_SRC = readFileSync(join(ROUTES_DIR, 'ads.ts'), 'utf8');

const extractRegistrationLine = (source: string, pattern: RegExp): string | null => {
  const match = source.match(pattern);
  if (!match) return null;
  const start = match.index ?? 0;
  const tail = source.slice(start);
  const handlerMatch = tail.match(/asyncHandler\s*\(|handleAdSubmitForApproval\b|handleAdApprove\b|handleAdReject\b/);
  const end = handlerMatch ? (handlerMatch.index ?? tail.length) : tail.length;
  return tail.slice(0, end + 32);
};

describe('Ads route gating', () => {
  it('POST /ads uses auth + verified + plan, not onboarding', () => {
    const line = extractRegistrationLine(ADS_SRC, /adsRouter\.post\(\s*['"]\/['"]/);
    expect(line).not.toBeNull();
    expect(line ?? '').toMatch(/\brequireAuth\b/);
    expect(line ?? '').toMatch(/\brequireVerified\b/);
    expect(line ?? '').toMatch(/\badCreationLimiter\b/);
    expect(line ?? '').not.toMatch(/\brequireOnboarded\b/);
  });

  it('POST /ads/:id/submit-for-approval uses auth + verified, not onboarding', () => {
    const line = extractRegistrationLine(
      ADS_SRC,
      /adsRouter\.post\(\s*['"]\/:id\/submit-for-approval['"]/
    );
    expect(line).not.toBeNull();
    expect(line ?? '').toMatch(/\brequireAuth\b/);
    expect(line ?? '').toMatch(/\brequireVerified\b/);
    expect(line ?? '').not.toMatch(/\brequireOnboarded\b/);
  });

  it('DELETE /ads/:id uses auth + verified, not onboarding', () => {
    const line = extractRegistrationLine(
      ADS_SRC,
      /adsRouter\.delete\(\s*['"]\/:id\(\[a-z0-9\]\{15,50\}\)['"]/
    );
    expect(line).not.toBeNull();
    expect(line ?? '').toMatch(/\brequireAuth\b/);
    expect(line ?? '').toMatch(/\brequireVerified\b/);
    expect(line ?? '').not.toMatch(/\brequireOnboarded\b/);
  });

  it('app.ts does not register a duplicate submit-for-approval route', () => {
    expect(APP_SRC).not.toMatch(/\/ads\/:id\/submit-for-approval/);
    expect(APP_SRC).not.toMatch(/handleAdSubmitForApproval/);
  });
});
