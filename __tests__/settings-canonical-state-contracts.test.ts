import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

const feedbackScreen = read('app/settings/feedback.tsx');
const settingsScreen = read('app/settings/index.tsx');

describe('settings canonical state contracts', () => {
  it('feedback no longer does a dead /me warm-up fetch', () => {
    expect(feedbackScreen).not.toContain('User.me()');
    expect(feedbackScreen).not.toContain('Failed to load user data');
  });

  it('settings bootstraps from the auth snapshot before falling back to checkAuth', () => {
    expect(settingsScreen).toContain(
      "const { user, checkAuth, markOnboardingIncompleteLocally, signOut, isAdmin } = useAuth();"
    );
    expect(settingsScreen).toContain(
      "const me = ((user as UserMeResponse | null) ??"
    );
    expect(settingsScreen).not.toContain("const me = (await User.me()) as UserMeResponse;");
  });

  it('settings restart-onboarding preload also reuses auth state instead of refetching /me', () => {
    const restartBlock =
      settingsScreen.match(/const _restartOnboarding = async \(\) => \{[\s\S]*?router\.replace\('\/onboarding\/step-1-role'\);/)?.[0] || '';
    expect(restartBlock).toContain("const me = ((user as UserMeResponse | null) ??");
    expect(restartBlock).toContain("((await checkAuth().catch(() => null)) as UserMeResponse | null))");
    expect(restartBlock).not.toContain('User.me()');
  });
});
