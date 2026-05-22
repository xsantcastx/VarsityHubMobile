import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const adsRoute = readFileSync(join(repoRoot, 'src/routes/ads.ts'), 'utf8');

function extractRouteBlock(routeMatcher: RegExp): string {
  const match = adsRoute.match(routeMatcher);
  expect(match?.[0]).toBeTruthy();
  return match![0];
}

describe('ads read-route purity invariants', () => {
  it('does not keep legacy normalization helper that mutates data during GET list reads', () => {
    expect(adsRoute).not.toMatch(/normalizePendingApprovalAdsForResponse/);
  });

  it('keeps GET /ads read-only (no reservation cleanup writes)', () => {
    const listRoute = extractRouteBlock(
      /adsRouter\.get\('\/', requireAuth[\s\S]*?\n\}\)\);/
    );
    expect(listRoute).not.toMatch(/releaseExpiredPendingApprovalReservationsForAd/);
    expect(listRoute).not.toMatch(/prisma\.ad\.update\(/);
    expect(listRoute).not.toMatch(/prisma\.adReservation\.deleteMany\(/);
  });

  it('keeps GET /ads/:id read-only (no status/payment mutation side effects)', () => {
    const singleRoute = extractRouteBlock(
      /adsRouter\.get\('\/:id\(\[a-z0-9\]\{15,50\}\)', requireAuth[\s\S]*?\n\}\)\);/
    );
    expect(singleRoute).not.toMatch(/releaseExpiredPendingApprovalReservationsForAd/);
    expect(singleRoute).not.toMatch(/prisma\.ad\.update\(/);
    expect(singleRoute).not.toMatch(/prisma\.adReservation\.deleteMany\(/);
  });

  it('keeps GET /ads/reservations read-only', () => {
    const reservationsRoute = extractRouteBlock(
      /adsRouter\.get\('\/reservations', requireAuth[\s\S]*?\n\}\)\);/
    );
    expect(reservationsRoute).not.toMatch(/releaseExpiredPendingApprovalReservationsForAd/);
    expect(reservationsRoute).not.toMatch(/prisma\.ad\.update\(/);
    expect(reservationsRoute).not.toMatch(/prisma\.adReservation\.deleteMany\(/);
  });
});
