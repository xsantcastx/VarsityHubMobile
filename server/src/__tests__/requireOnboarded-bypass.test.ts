/**
 * Regression test: onboarding-create routes may bypass onboarding completion,
 * but they must never bypass email verification.
 *
 * Why this exists:
 *   The app intentionally lets verified coaches create their org/team before
 *   onboarding is fully complete, so `requireOnboarded.ts` carries a narrow
 *   bypass for POST /teams and POST /organizations during onboarding.
 *   Email verification is a separate hard gate and must never be skipped by
 *   those routes.
 *
 * This is a static/structural check over both middlewares. No DB required.
 */

import { describe, it, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const MIDDLEWARE_DIR = join(process.cwd(), 'src', 'middleware');
const verifiedSrc = readFileSync(join(MIDDLEWARE_DIR, 'requireVerified.ts'), 'utf8');
const onboardedSrc = readFileSync(join(MIDDLEWARE_DIR, 'requireOnboarded.ts'), 'utf8');

const hasBypass = (src: string, baseUrl: string) => {
  // Both middlewares express the bypass as:
  //   req.baseUrl === '/<path>' && req.method === 'POST' && (req.path === '/' || req.path === '/create')
  // gated by req.body?.onboarding === true. Catch all three parts.
  const pattern = new RegExp(
    `baseUrl\\s*===\\s*['"]${baseUrl.replace('/', '\\/')}['"]`,
  );
  return pattern.test(src);
};

describe('onboarding-create middleware boundaries', () => {
  it('keeps the onboarding flag as the trigger in requireOnboarded only', () => {
    expect(/onboarding\s*===\s*true/.test(verifiedSrc)).toBe(false);
    expect(/onboarding\s*===\s*true/.test(onboardedSrc)).toBe(true);
  });

  it('does not whitelist team creation inside requireVerified', () => {
    expect(hasBypass(verifiedSrc, '/teams')).toBe(false);
  });

  it('does not whitelist organization creation inside requireVerified', () => {
    expect(hasBypass(verifiedSrc, '/organizations')).toBe(false);
  });

  it('still bypasses team creation in requireOnboarded', () => {
    expect(hasBypass(onboardedSrc, '/teams')).toBe(true);
  });

  it('still bypasses organization creation in requireOnboarded', () => {
    expect(hasBypass(onboardedSrc, '/organizations')).toBe(true);
  });

  it('keeps the requireOnboarded bypass scoped to POST root/create paths', () => {
    expect(/method\s*===\s*['"]POST['"]/.test(onboardedSrc)).toBe(true);
    expect(/path\s*===\s*['"]\/['"]/.test(onboardedSrc)).toBe(true);
  });

  it('gates the onboarded bypass on role: coach + onboarding_completed !== true', () => {
    // Defense-in-depth: even if bypass triggers, it must require the user to
    // be a coach who has not yet completed onboarding. If someone removes
    // either guard, generic users could bypass the gate.
    //
    // v1.0.3: accept both the old literal form (`prefs?.role === 'coach'`,
    // `prefs?.onboarding_completed !== true`) and the new canonical-helper
    // form (`canonicalRole === 'coach'`, `!onboardingComplete` derived from
    // `isUserOnboardingComplete`). Both forms must still require the same
    // two semantic guards — we just accept either spelling so a future
    // canonical-helper refactor doesn't re-break this regression test.
    expect(/role\s*===\s*['"]coach['"]/.test(onboardedSrc)).toBe(true);
    const hasLiteralOnboardingCheck = /onboarding_completed\s*!==\s*true/.test(onboardedSrc);
    const hasCanonicalOnboardingCheck =
      /isUserOnboardingComplete\s*\(/.test(onboardedSrc) &&
      /!onboardingComplete\b/.test(onboardedSrc);
    expect(hasLiteralOnboardingCheck || hasCanonicalOnboardingCheck).toBe(true);
  });

  it('does not embed upload-route bypass rules anymore', () => {
    expect(/baseUrl\s*===\s*['"]\/uploads['"]/.test(onboardedSrc)).toBe(false);
    expect(/upload_context/.test(onboardedSrc)).toBe(false);
  });
});
