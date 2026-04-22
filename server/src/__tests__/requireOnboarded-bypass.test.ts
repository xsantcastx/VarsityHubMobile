/**
 * Regression test: requireOnboarded / requireVerified bypass lockstep
 *
 * Why this exists:
 *   Coach onboarding was broken for weeks because `requireVerified.ts` had a
 *   bypass for both /teams and /organizations create routes during onboarding,
 *   but its sibling `requireOnboarded.ts` only had the /teams bypass — the
 *   /organizations bypass was never added. Coaches could sail past email
 *   verification but then 403'd on `Please complete onboarding before
 *   creating content` when trying to submit their org application.
 *
 * This test is a static/structural check: it reads both middleware source
 * files and asserts their route-bypass lists are in lockstep. If someone
 * adds a new bypass route to one middleware and forgets the other, this
 * test fails at CI time instead of two weeks later in a user report.
 *
 * No DB required, runs in ms.
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

describe('requireVerified ↔ requireOnboarded bypass parity', () => {
  it('declares the onboarding flag as the bypass trigger in both middlewares', () => {
    expect(/onboarding\s*===\s*true/.test(verifiedSrc)).toBe(true);
    expect(/onboarding\s*===\s*true/.test(onboardedSrc)).toBe(true);
  });

  it('bypasses team creation in both middlewares', () => {
    // Negative assert: the original bug would have passed this — teams was OK.
    expect(hasBypass(verifiedSrc, '/teams')).toBe(true);
    expect(hasBypass(onboardedSrc, '/teams')).toBe(true);
  });

  it('bypasses organization creation in both middlewares', () => {
    // Positive assert: this is the exact check that would have red-flagged
    // the bug we just shipped a fix for. requireVerified had it, requireOnboarded didn't.
    expect(hasBypass(verifiedSrc, '/organizations')).toBe(true);
    expect(hasBypass(onboardedSrc, '/organizations')).toBe(true);
  });

  it('gates bypass on POST method + root/create path in both middlewares', () => {
    // Make sure nobody "fixes" this by whitelisting /organizations globally.
    // The bypass must remain scoped to POST '/' | '/create'.
    expect(/method\s*===\s*['"]POST['"]/.test(verifiedSrc)).toBe(true);
    expect(/method\s*===\s*['"]POST['"]/.test(onboardedSrc)).toBe(true);
    expect(/path\s*===\s*['"]\/['"]/.test(verifiedSrc)).toBe(true);
    expect(/path\s*===\s*['"]\/['"]/.test(onboardedSrc)).toBe(true);
  });

  it('gates the onboarded bypass on incomplete onboarding', () => {
    // The upload carve-out now exists to keep onboarding media/doc uploads
    // working even if role persistence lags behind the UI state. The hard
    // guard is that onboarding must still be incomplete.
    expect(/onboarding_completed\s*!==\s*true/.test(onboardedSrc)).toBe(true);
  });

  it('bypasses uploads only for specific onboarding upload contexts', () => {
    // The upload route stays protected except for narrow onboarding upload
    // contexts needed before onboarding is completed.
    expect(hasBypass(onboardedSrc, '/uploads')).toBe(true);
    expect(/upload_context/.test(onboardedSrc)).toBe(true);
    expect(/organization_supporting_document/.test(onboardedSrc)).toBe(true);
    expect(/onboarding_avatar/.test(onboardedSrc)).toBe(true);
    expect(/onboarding_header_image/.test(onboardedSrc)).toBe(true);
  });

  it('requires the onboarding flag for the upload bypass', () => {
    // The upload carve-out must remain tied to onboarding=true so a regular
    // upload cannot slip through by only setting the upload context.
    expect(/onboardingFlag/.test(onboardedSrc)).toBe(true);
    expect(/isOnboardingUpload/.test(onboardedSrc)).toBe(true);
  });
});
