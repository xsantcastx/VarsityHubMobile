import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

const serverIndex = read('src/index.ts');
const fixture = read('src/lib/appReviewFixture.ts');
const adminEmails = read('src/lib/adminEmails.ts');
const createDemoScript = read('scripts/create-demo-account.ts');
const verifyAppReviewScript = read('scripts/verify-app-review-account.ts');
const adsRoute = read('src/routes/ads.ts');

describe('App Review root-cause guards', () => {
  it('does not mutate the App Review account during server startup anymore', () => {
    expect(serverIndex).not.toMatch(/demo@varsityhub\.app/);
    expect(serverIndex).not.toMatch(/const reviewPassword/);
    expect(serverIndex).not.toMatch(/prisma\.user\.upsert\(\{\s*where:\s*\{\s*email:\s*'demo@varsityhub\.app'/);
  });

  it('keeps the App Review fixture on a coach-approved rookie/free state', () => {
    expect(fixture).toMatch(/APP_REVIEW_EMAIL = 'demo@varsityhub\.app'/);
    expect(fixture).toMatch(/approval_status: 'APPROVED'/);
    expect(fixture).toMatch(/role: 'coach'/);
    expect(fixture).toMatch(/APP_REVIEW_PLAN = 'rookie'/);
    expect(fixture).toMatch(/APP_REVIEW_SUBSCRIPTION_TIER = 'free'/);
    expect(fixture).toMatch(/APP_REVIEW_AD_NAME = 'VarsityHub Review Coach Demo Ad'/);
  });

  it('grants admin access to the exact App Review demo email through the shared admin helper', () => {
    expect(adminEmails).toMatch(/import \{ APP_REVIEW_EMAIL \} from '\.\/appReviewFixture\.js';/);
    expect(adminEmails).toMatch(/withAppReviewAdminAccess/);
    expect(adminEmails).toMatch(/APP_REVIEW_EMAIL\.trim\(\)\.toLowerCase\(\)/);
  });

  it('routes the legacy demo-account script through the shared App Review fixture', () => {
    expect(createDemoScript).toMatch(/ensureAppReviewFixture/);
    expect(createDemoScript).toMatch(/APP_REVIEW_PASSWORD/);
    expect(createDemoScript).not.toMatch(/role:\s*'fan'/);
  });

  it('lets localhost app-review verification self-host the API instead of assuming one is already running', () => {
    expect(verifyAppReviewScript).toMatch(/Started embedded local API/);
    expect(verifyAppReviewScript).toMatch(/await ensureLocalServer\(\)/);
    expect(verifyAppReviewScript).toMatch(/await ensureLocalFixture\(\)/);
    expect(verifyAppReviewScript).toMatch(/await import\('\.\.\/src\/testApp\.js'\)/);
    expect(verifyAppReviewScript).toMatch(/LOCALHOST_FALLBACK_PASSWORD/);
    expect(verifyAppReviewScript).toMatch(/await shutdownEmbeddedLocalServer\(\)/);
    expect(verifyAppReviewScript).toMatch(/review has admin access/);
  });

  it('limits ad approval bypass to the exact App Review demo email', () => {
    expect(adsRoute).toMatch(/import \{ APP_REVIEW_EMAIL \} from '\.\.\/lib\/appReviewFixture\.js';/);
    expect(adsRoute).toMatch(
      /String\(user\?\.email \|\| ''\)\s*\.trim\(\)\s*\.toLowerCase\(\)\s*===\s*APP_REVIEW_EMAIL\.toLowerCase\(\)/
    );
    expect(adsRoute).not.toMatch(/@varsityhub\.app['"]?\s*\.test/);
    expect(adsRoute).not.toMatch(/includes\(\s*APP_REVIEW_EMAIL/);
    expect(adsRoute).not.toMatch(/startsWith\(\s*APP_REVIEW_EMAIL/);
  });
});
