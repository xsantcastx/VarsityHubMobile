/**
 * Pins the security headers the Vercel-hosted web app serves.
 *
 * Context (2026-07-23 security pass): the Express server sets a solid CSP via
 * helmet, but varsityhub.app is a static Expo export served by VERCEL — helmet
 * never runs for it. The web app therefore had no CSP and no HSTS, while its
 * auth tokens live in sessionStorage, so any XSS on the web app was a full
 * account takeover with nothing standing in the way.
 *
 * CSP ships as Report-Only deliberately. The built bundle contains `eval`/
 * `new Function` call sites whose reachability is unverified, and this is a live
 * production site — an enforced CSP that turns out to be one directive short is
 * an outage. Report-Only cannot break rendering, so it collects real violation
 * data first. Flipping to enforcing is a follow-up, gated on that data.
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '..');
const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));

const globalHeaderRule = (vercel.headers as any[]).find(h => h.source === '/(.*)');
const headerValue = (key: string): string | undefined =>
  (globalHeaderRule?.headers as any[]).find(h => h.key.toLowerCase() === key.toLowerCase())?.value;

describe('vercel.json — web app security headers', () => {
  it('applies a global header rule to every path', () => {
    expect(globalHeaderRule).toBeDefined();
    expect(Array.isArray(globalHeaderRule.headers)).toBe(true);
  });

  it('keeps the pre-existing baseline headers', () => {
    expect(headerValue('X-Frame-Options')).toBe('DENY');
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
    expect(headerValue('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(headerValue('Permissions-Policy')).toContain('camera=()');
  });

  it('sends HSTS with at least a one-year max-age', () => {
    const hsts = headerValue('Strict-Transport-Security');
    expect(hsts).toBeDefined();
    const maxAge = Number(/max-age=(\d+)/.exec(hsts!)?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(31536000);
  });

  describe('Content-Security-Policy', () => {
    const csp = () =>
      headerValue('Content-Security-Policy') ?? headerValue('Content-Security-Policy-Report-Only');

    it('is present in either enforcing or report-only form', () => {
      expect(csp()).toBeDefined();
    });

    it('locks down the directives that mitigate token theft via XSS', () => {
      const value = csp()!;
      expect(value).toContain("default-src 'self'");
      expect(value).toContain("object-src 'none'");
      expect(value).toContain("base-uri 'self'");
      expect(value).toContain("form-action 'self'");
      expect(value).toContain("frame-ancestors 'none'");
    });

    it("never allows 'unsafe-inline' or 'unsafe-eval' in script-src", () => {
      const scriptSrc = /script-src ([^;]*)/.exec(csp()!)?.[1] ?? '';
      // The built index.html has zero inline <script> blocks, so neither
      // escape hatch is needed. Re-adding one silently defeats the policy.
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");
    });

    it('allows the origins the app genuinely talks to', () => {
      const connectSrc = /connect-src ([^;]*)/.exec(csp()!)?.[1] ?? '';
      expect(connectSrc).toContain("'self'");
      expect(connectSrc).toContain('https://api-production-8ac3.up.railway.app');
      expect(connectSrc).toContain('sentry.io');
      expect(connectSrc).toContain('posthog.com');
      expect(connectSrc).toContain('stripe.com');
      expect(connectSrc).toContain('https://oauth2.googleapis.com');
    });

    it('allows remote media so shared landing images and videos still render', () => {
      const value = csp()!;
      expect(/img-src ([^;]*)/.exec(value)?.[1]).toContain('https:');
      expect(/media-src ([^;]*)/.exec(value)?.[1]).toContain('https:');
    });
  });

  it('survives the deploy pipeline — headers are carried, not stripped', () => {
    // deploy-web-static.sh strips only build-time keys from the root config.
    const deployScript = fs.readFileSync(path.join(ROOT, 'scripts/deploy-web-static.sh'), 'utf8');
    const stripped = /for \(const key of \[([^\]]*)\]\)/.exec(deployScript)?.[1] ?? '';
    expect(stripped).not.toContain('headers');
  });
});
