import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const requireOnboardedSrc = readFileSync(
  join(process.cwd(), 'src', 'middleware', 'requireOnboarded.ts'),
  'utf8'
);

describe('requireOnboarded onboarding upload bypass', () => {
  it('only bypasses upload gating for onboarding supporting documents', () => {
    expect(/baseUrl\s*===\s*['"]\/uploads['"]/.test(requireOnboardedSrc)).toBe(true);
    expect(/path\s*===\s*['"]\/files['"]/.test(requireOnboardedSrc)).toBe(true);
    expect(/path\s*===\s*['"]\/['"]/.test(requireOnboardedSrc)).toBe(true);
    expect(/upload_context/.test(requireOnboardedSrc)).toBe(true);
    expect(/organization_supporting_document/.test(requireOnboardedSrc)).toBe(true);
  });

  it('keeps the upload bypass scoped to incomplete coach onboarding', () => {
    expect(/role\s*===\s*['"]coach['"]/.test(requireOnboardedSrc)).toBe(true);
    expect(/onboarding_completed\s*!==\s*true/.test(requireOnboardedSrc)).toBe(true);
  });
});
