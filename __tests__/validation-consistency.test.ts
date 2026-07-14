/**
 * Regression: screens must use the canonical validators/formatters instead of
 * hand-rolled copies. 2026-07-13 audit found four screens whose local copies
 * had drifted from the canonical rule (weaker password check, missing plan
 * aliases, inverted name precedence, dead-code username validator).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

describe('password validation consistency', () => {
  const src = read('app/settings/reset-password.tsx');
  it('settings change-password uses validatePassword from formUtils', () => {
    expect(src).toMatch(/import\s*\{[^}]*validatePassword[^}]*\}\s*from\s*'@\/utils\/formUtils'/);
    expect(src).toMatch(/validatePassword\(/);
  });
  it('no longer hand-rolls a length-only check', () => {
    expect(src).not.toMatch(/p\.length < 8/);
  });
});

describe('plan tier normalization consistency', () => {
  const src = read('app/(tabs)/create-team.tsx');
  it('create-team uses normalizePlan from constants/plans', () => {
    expect(src).toMatch(/import\s*\{[^}]*normalizePlan[^}]*\}\s*from\s*'@\/constants\/plans'/);
  });
  it('no longer defines a local normalizePlanTier', () => {
    expect(src).not.toMatch(/const normalizePlanTier\s*=/);
  });
});
