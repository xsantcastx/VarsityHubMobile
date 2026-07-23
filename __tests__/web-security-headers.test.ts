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
    const csp = () => headerValue('Content-Security-Policy');

    /**
     * ENFORCING, not Report-Only. Verified 2026-07-23 against the real built
     * bundle served with this exact policy applied as enforcing: the app
     * rendered and navigated with zero violations, while `eval()` threw
     * EvalError and an injected inline <script> did not run — i.e. the
     * XSS -> sessionStorage token theft path is actually closed, not just
     * reported on. Report-Only protects nobody; do not downgrade it.
     */
    it('is enforcing, not report-only', () => {
      expect(csp()).toBeDefined();
      expect(headerValue('Content-Security-Policy-Report-Only')).toBeUndefined();
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
      // Verified live: eval() throws EvalError and injected inline <script>
      // does not run under this policy.
      expect(scriptSrc).not.toContain("'unsafe-inline'");
      expect(scriptSrc).not.toContain("'unsafe-eval'");
    });

    /**
     * vercel.json rewrites 7 paths (/share, /events/:id, /games/:id, /posts/:id,
     * /teams/:id, /users/:id, /programs/:id) to the Express server. Vercel
     * applies these headers to proxied responses too, so the policy must admit
     * the server-rendered Expo Router hydration script — otherwise every OG /
     * share-landing page breaks. A specific sha256 hash permits exactly that one
     * known script and nothing else, so it does not weaken the policy (verified:
     * an arbitrary injected inline script is still blocked with the hash present).
     * Must stay identical to EXPO_ROUTER_HYDRATION_INLINE_HASH in server/src/app.ts.
     */
    it('admits the server-rendered hydration script by hash, for proxied share/OG pages', () => {
      const serverApp = fs.readFileSync(path.join(ROOT, 'server/src/app.ts'), 'utf8');
      const serverHash = /EXPO_ROUTER_HYDRATION_INLINE_HASH = "([^"]+)"/.exec(serverApp)?.[1];

      expect(serverHash).toBeDefined();
      const bare = serverHash!.replace(/^'|'$/g, '');
      expect(/script-src ([^;]*)/.exec(csp()!)?.[1]).toContain(bare);
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
