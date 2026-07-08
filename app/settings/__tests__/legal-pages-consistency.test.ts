/**
 * The privacy policy renders from two live sources that must not drift:
 *   1. app/settings/privacy-policy.tsx — in-app screen + public web route
 *      (bridged at app/privacy-policy.tsx → https://varsityhub.app/privacy-policy)
 *   2. server/src/routes/publicSite.ts — fallback HTML on the API domain
 *
 * This drift is exactly how the store-registered privacy URL ended up 404ing
 * with a year-old policy. See docs/legal/README.md.
 */
import * as fs from 'fs';
import * as path from 'path';

const repoRoot = path.resolve(__dirname, '../../..');
const appPolicy = fs.readFileSync(path.join(repoRoot, 'app/settings/privacy-policy.tsx'), 'utf8');
const publicSite = fs.readFileSync(path.join(repoRoot, 'server/src/routes/publicSite.ts'), 'utf8');

function extractServerPrivacyRoute(source: string): string {
  const start = source.indexOf("publicSiteRouter.get('/privacy-policy'");
  expect(start).toBeGreaterThan(-1);
  const end = source.indexOf('});', start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

const serverPolicy = extractServerPrivacyRoute(publicSite);

function lastUpdated(source: string): string {
  const match = source.match(/Last updated:\s*([A-Za-z]+ \d{1,2}, \d{4})/);
  expect(match).not.toBeNull();
  return match![1];
}

describe('privacy policy consistency (app screen vs server fallback)', () => {
  it('carries the same Last updated date in both sources', () => {
    expect(lastUpdated(appPolicy)).toBe(lastUpdated(serverPolicy));
  });

  // Load-bearing disclosures and protective clauses — each must appear,
  // verbatim, in both the in-app screen and the server fallback page.
  it.each([
    'We do not sell your personal information',
    'do not receive or store full payment card numbers',
    'precise device location solely to verify eligibility',
    'do not track your location in the background',
    'not affiliated with, endorsed by, or sponsored by any sports league',
    'solely responsible for the content they record, upload, or share',
    'removed from backup systems within 90 days',
    'parental or guardian consent',
    'cannot guarantee absolute security',
    'transferred to, stored, and processed in the United States',
    'customerservice@varsityhub.app',
  ])('both sources contain: "%s"', clause => {
    expect(appPolicy).toContain(clause);
    expect(serverPolicy).toContain(clause);
  });

  it('does not name internal vendors or infrastructure', () => {
    for (const vendor of ['Railway', 'PostHog', 'Sentry', 'SendGrid', 'Cloudinary', 'PostgreSQL']) {
      expect(appPolicy).not.toContain(vendor);
      expect(serverPolicy).not.toContain(vendor);
    }
  });
});

describe('public web routes bridge the settings screens', () => {
  it.each([['app/privacy-policy.tsx', './settings/privacy-policy']])(
    '%s re-exports %s',
    (bridgeFile, target) => {
      const bridge = fs.readFileSync(path.join(repoRoot, bridgeFile), 'utf8');
      expect(bridge).toContain(`export { default } from '${target}'`);
    }
  );

  it('account-deletion web route exists for the Play data-deletion listing', () => {
    expect(fs.existsSync(path.join(repoRoot, 'app/account-deletion.tsx'))).toBe(true);
  });
});
