import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const routesDir = join(repoRoot, 'src/routes');
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');
const adminRoute = read('src/routes/admin.ts');

describe('app-review route isolation', () => {
  it('keeps app-review fixture references out of live routes (except explicit admin ops)', () => {
    const routeFiles = readdirSync(routesDir).filter((entry) => entry.endsWith('.ts'));
    const allowedRouteFiles = new Set(['admin.ts']);
    const forbiddenReference = /APP_REVIEW_EMAIL|appReviewFixture|demo@varsityhub\.app/;

    const offenders = routeFiles
      .filter((file) => !allowedRouteFiles.has(file))
      .filter((file) => forbiddenReference.test(read(`src/routes/${file}`)));

    expect(offenders).toEqual([]);
  });

  it('keeps the ads route completely detached from app-review fixture identifiers', () => {
    const adsRoute = read('src/routes/ads.ts');
    expect(adsRoute).not.toMatch(/APP_REVIEW/);
    expect(adsRoute).not.toMatch(/appReviewFixture/);
    expect(adsRoute).not.toMatch(/demo@varsityhub\.app/);
  });

  it('uses APP_REVIEW_EMAIL constant in admin wipe route instead of hardcoded literal', () => {
    expect(adminRoute).toMatch(/import \{ APP_REVIEW_EMAIL \} from '\.\.\/lib\/appReviewFixture\.js';/);
    expect(adminRoute).toMatch(/where: \{ email: APP_REVIEW_EMAIL \}/);
    expect(adminRoute).not.toMatch(/where: \{ email: 'demo@varsityhub\.app' \}/);
  });
});
