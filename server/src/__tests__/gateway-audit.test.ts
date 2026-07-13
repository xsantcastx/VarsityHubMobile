/**
 * Gateway audit — structural regression guards.
 *
 * These tests lock findings from the 2026-04-23 gateway audit so the gaps
 * can't silently reopen. Five classes of invariant:
 *   1. Write routes on `/posts/:id/...` require requireVerified + requireOnboarded
 *   2. Rate limiters applied to payment / upload / auth endpoints
 *   3. DISABLE_RATE_LIMITING fatally exits in production
 *   4. ALLOW_APPLE_SIM_TOKENS fatally exits in production
 *   5. Apple JWKS fetch fails fast with a timeout
 *   6. Admin-mutating endpoints have requireAdmin
 */

import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');

const posts = read('routes/posts.ts');
const payments = read('routes/payments.ts');
const uploads = read('routes/uploads.ts');
const admin = read('routes/admin.ts');
const auth = read('routes/auth.ts');
const rateLimiters = read('middleware/rateLimiters.ts');
const app = read('app.ts');

describe('gateway audit invariants', () => {
  // ──────────────────────────────────────────────────────────────────────
  // Posts: every write route needs requireVerified + requireOnboarded
  // ──────────────────────────────────────────────────────────────────────

  describe('posts write routes have the full gateway chain', () => {
    const writeRoutes = [
      { path: "'/:id/poll'", name: 'POST /posts/:id/poll' },
      { path: "'/:id/poll/vote'", name: 'POST /posts/:id/poll/vote' },
      { path: "'/:id/comments'", name: 'POST /posts/:id/comments' },
    ];

    for (const { path, name } of writeRoutes) {
      it(`${name} has requireAuth + requireVerified + requireOnboarded`, () => {
        // Find the POST definition specifically — the path literal may also
        // appear in a GET route (reading comments doesn't need the full
        // chain). Anchor on postsRouter.post( to grab the write route.
        const regex = new RegExp(`postsRouter\\.post\\(\\s*${path}[\\s\\S]{0,400}`);
        const block = posts.match(regex)?.[0] || '';
        expect(block.length).toBeGreaterThan(0);
        expect(block).toMatch(/requireAuth/);
        expect(block).toMatch(/requireVerified/);
        expect(block).toMatch(/requireOnboarded/);
      });
    }
  });

  // ──────────────────────────────────────────────────────────────────────
  // Rate limiters applied where they should be
  // ──────────────────────────────────────────────────────────────────────

  describe('rate limiters', () => {
    it('payments router uses paymentLimiter', () => {
      expect(payments).toMatch(/paymentLimiter/);
    });

    it('uploads router uses uploadLimiter', () => {
      expect(uploads).toMatch(/uploadLimiter/);
    });

    it('auth routes mounted under authLimiter at app level', () => {
      // The /auth mount uses authMountLimiter (renamed from authLimiter); accept either name.
      expect(app).toMatch(/auth(Mount)?Limiter[^)]*authRouter|'\/auth'[^)]*auth(Mount)?Limiter/);
    });

    it('defaultApiLimiter applied at parent router level', () => {
      expect(app).toMatch(/defaultApiLimiter/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Production env-gate safety — fatal on misconfig, not soft-warn
  // ──────────────────────────────────────────────────────────────────────

  describe('production env-gate safety (hard-fail, not warn)', () => {
    it('DISABLE_RATE_LIMITING exits with process.exit(1) in production', () => {
      // The old behavior was a warning. The invariant is: if rateLimitingDisabled
      // AND production, the process must exit — soft-warning is how silent DoS
      // foot-guns ship.
      const block = rateLimiters.match(/rateLimitingDisabled[\s\S]{0,900}/)?.[0] || '';
      expect(block).toMatch(/NODE_ENV\s*===\s*['"]production['"]/);
      expect(block).toMatch(/process\.exit\(1\)/);
    });

    it('ALLOW_APPLE_SIM_TOKENS exits with process.exit(1) in production', () => {
      // Pattern: production check + ALLOW_APPLE_SIM_TOKENS check + exit(1),
      // all in the same guard block. Matches regardless of param order.
      expect(auth).toMatch(
        /NODE_ENV\s*===\s*['"]production['"][\s\S]{0,200}ALLOW_APPLE_SIM_TOKENS[\s\S]{0,500}process\.exit\(1\)/
      );
    });

    it('Apple JWKS fetch uses an abort timeout instead of a bare fetch', () => {
      expect(auth).toMatch(/APPLE_JWKS_TIMEOUT_MS\s*=\s*10_000/);
      expect(auth).toMatch(/new AppError\(503,\s*'Apple sign-in is temporarily unavailable'/);
      expect(auth).toMatch(/fetch\(APPLE_JWKS_URL,\s*\{\s*signal:\s*controller\.signal\s*\}\)/);
      expect(auth).toMatch(/controller\.abort\(\)/);
    });

    it('STRIPE_WEBHOOK_SECRET exits with process.exit(1) in production (regression of existing guard)', () => {
      const block = payments.match(/STRIPE_WEBHOOK_SECRET[\s\S]{0,600}/)?.[0] || '';
      expect(block).toMatch(/process\.exit\(1\)/);
    });

    it('STRIPE_SECRET_KEY throws fatal in production (regression of existing guard)', () => {
      expect(payments).toMatch(/STRIPE_SECRET_KEY must be set in production/);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Admin gating — no admin-mutating endpoint can skip requireAdmin
  // ──────────────────────────────────────────────────────────────────────

  describe('admin router protection', () => {
    it('admin router imports requireAdmin middleware', () => {
      expect(admin).toMatch(/requireAdmin/);
    });

    it('admin.ts uses requireVerified on endpoints reading req.user', () => {
      // Admin routes must be verified users — a banned/unverified admin
      // account is still a liability.
      expect(admin).toMatch(/requireVerified/);
    });

    it('coach review POST routes are registered exactly once', () => {
      const approveMatches = admin.match(/adminRouter\.post\(\s*'\/coaches\/:id\/approve'/g) || [];
      const rejectMatches = admin.match(/adminRouter\.post\(\s*'\/coaches\/:id\/reject'/g) || [];
      expect(approveMatches).toHaveLength(1);
      expect(rejectMatches).toHaveLength(1);
    });
  });

  // ──────────────────────────────────────────────────────────────────────
  // Global app-level guards
  // ──────────────────────────────────────────────────────────────────────

  describe('global middleware mounts (app.ts)', () => {
    it('authMiddleware (JWT decoder) mounted globally before router', () => {
      expect(app).toMatch(/app\.use\(authMiddleware\)/);
    });

    it('CORS applied at app level', () => {
      expect(app).toMatch(/app\.use\(cors/);
    });

    it('parentalConsent middleware applied at parent router (COPPA compliance)', () => {
      expect(app).toMatch(/requireParentalConsent/);
    });
  });
});
