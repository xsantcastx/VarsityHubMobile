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

describe('user label consistency', () => {
  const src = read('app/message-thread.tsx');
  it('message-thread uses formatUserLabel', () => {
    expect(src).toMatch(/import\s*\{[^}]*formatUserLabel[^}]*\}\s*from\s*'@\/utils\/userDisplay'/);
    expect(src).toMatch(/formatUserLabel\(otherParticipant/);
  });
  it('no longer inverts precedence with a handle-first inline chain', () => {
    expect(src).not.toMatch(/otherParticipant\.username \? `@\$\{otherParticipant\.username\}`/);
  });
});

describe('username validation consistency', () => {
  it('formUtils exports USERNAME_REGEX and validateUsername uses it', () => {
    const src = read('utils/formUtils.ts');
    expect(src).toMatch(/export const USERNAME_REGEX = \/\^\[a-z0-9_\.\]\+\$\//);
  });
  it('edit-username uses validateUsername instead of a hand-rolled copy', () => {
    const src = read('app/settings/edit-username.tsx');
    expect(src).toMatch(/validateUsername\(/);
    expect(src).not.toMatch(/\/\^\[a-z0-9_\.\]\+\$\/\.test/);
  });
  it('onboarding step-2 imports USERNAME_REGEX instead of defining its own', () => {
    const src = read('app/onboarding/step-2-basic.tsx');
    expect(src).toMatch(/USERNAME_REGEX/);
    expect(src).not.toMatch(/const usernameRe = \//);
  });
});
