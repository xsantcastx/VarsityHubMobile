import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const requireOnboardedSrc = readFileSync(
  join(process.cwd(), 'src', 'middleware', 'requireOnboarded.ts'),
  'utf8'
);

describe('requireOnboarded onboarding upload bypass', () => {
  it('only bypasses upload gating for specific onboarding upload contexts', () => {
    expect(/baseUrl\s*===\s*['"]\/uploads['"]/.test(requireOnboardedSrc)).toBe(true);
    expect(/path\s*===\s*['"]\/files['"]/.test(requireOnboardedSrc)).toBe(true);
    expect(/path\s*===\s*['"]\/['"]/.test(requireOnboardedSrc)).toBe(true);
    expect(/path\s*===\s*['"]\/avatar['"]/.test(requireOnboardedSrc)).toBe(true);
    expect(/req\.query\?\.onboarding/.test(requireOnboardedSrc)).toBe(true);
    expect(/req\.query\?\.upload_context/.test(requireOnboardedSrc)).toBe(true);
    expect(/organization_supporting_document/.test(requireOnboardedSrc)).toBe(true);
    expect(/onboarding_avatar/.test(requireOnboardedSrc)).toBe(true);
    expect(/onboarding_header_image/.test(requireOnboardedSrc)).toBe(true);
  });

  it('keeps the upload bypass scoped to incomplete onboarding', () => {
    expect(/onboarding_completed\s*!==\s*true/.test(requireOnboardedSrc)).toBe(true);
    expect(/onboardingUploadContexts\.has\(uploadContext\)/.test(requireOnboardedSrc)).toBe(true);
  });
});
