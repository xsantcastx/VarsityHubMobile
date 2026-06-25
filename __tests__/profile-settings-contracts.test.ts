import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd());
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

// app/features/navigation/screens/ProfileScreen.tsx was deleted; app/profile.tsx
// is the single live profile screen now. Specs that pinned ProfileScreen-only
// UI choices (inline action buttons, ExpandableText post cards) were dropped —
// the consolidated profile.tsx made different, valid choices there.
const profileScreen = read('app/profile.tsx');
const settingsScreen = read('app/settings/index.tsx');

describe('profile/settings note contracts', () => {
  it('profile editing stays inside the edit-profile flow instead of banner shortcuts', () => {
    expect(profileScreen).not.toContain('profile-background-edit-button');
    expect(profileScreen).not.toContain('handleBackgroundImagePress');
    expect(profileScreen).not.toContain('Edit profile picture');
    expect(profileScreen).toContain("router.push('/edit-profile')");
  });

  it('settings only shows provider-specific rows when that provider is actually linked', () => {
    expect(settingsScreen).toContain('const showPasswordSettings = linkedProviders.password;');
    expect(settingsScreen).toContain('const showGoogleStatus = linkedProviders.google;');
    expect(settingsScreen).toContain('const showAppleStatus = linkedProviders.apple;');
    expect(settingsScreen).not.toContain('Connect Google to this account');
    expect(settingsScreen).not.toContain('Connect Apple to this account');
  });

  it('settings delete-account flow only requires a password when the linked providers snapshot says one exists', () => {
    expect(settingsScreen).toContain('const computeDeleteRequiresPassword = useCallback(');
    expect(settingsScreen).toContain(
      '(p: typeof initialLinkedProviders) => p.password && !p.google && !p.apple,'
    );
    expect(settingsScreen).toContain(
      'setDeleteRequiresPassword(computeDeleteRequiresPassword(linkedProviders));'
    );
    expect(settingsScreen).toContain(
      'const confirmation = deleteConfirmation.trim().toUpperCase();'
    );
    expect(settingsScreen).toContain("if (confirmation !== 'DELETE') {");
    expect(settingsScreen).toContain('delete_confirmation: confirmation,');
    expect(settingsScreen).toContain('if (deleteRequiresPassword && !pwd) {');
    expect(settingsScreen).toContain('{deleteRequiresPassword');
    expect(settingsScreen).toContain('placeholder="Type DELETE"');
    expect(settingsScreen).toContain('placeholder="Password"');
    expect(settingsScreen).toContain(
      "? 'This permanently deletes your account. Enter your password to confirm.'"
    );
    expect(settingsScreen).toContain(
      ": 'This permanently deletes your account. No password is required for Apple/Google-only accounts.'"
    );
  });

  it('settings exposes a downgrade path for coach accounts and keeps billing visible for non-rookie plans', () => {
    expect(settingsScreen).toContain('title="Downgrade to Fan Account"');
    expect(settingsScreen).toContain(
      'subtitle="Transfer any team or organization ownership first"'
    );
    expect(settingsScreen).toContain(
      "import { getCanonicalBillingState } from '@/utils/billingState';"
    );
    expect(settingsScreen).toContain('const billingState = getCanonicalBillingState(me as any);');
    expect(settingsScreen).toContain("billingState.selected_plan !== 'rookie'");
    expect(settingsScreen).toContain('!!nextCoachUpgradeCta');
  });

  it('settings re-enters coach onboarding with replace-based handoffs so setup does not stack on top of settings', () => {
    expect(settingsScreen).toContain('router.replace(coachUpgradeCta.route as any);');
    expect(settingsScreen).toContain('router.replace(preferredRoute as any);');
    expect(settingsScreen).toContain('router.replace(');
    expect(settingsScreen).toContain('router.replace(resumeRoute as any);');
    expect(settingsScreen).toContain("'/onboarding/coach-application'");
    expect(settingsScreen).toContain("'/onboarding/step-2-basic'");
    expect(settingsScreen).not.toContain('router.push(coachUpgradeCta.route as any);');
    expect(settingsScreen).not.toContain('router.push(preferredRoute as any);');
    expect(settingsScreen).not.toContain("router.push('/onboarding/coach-application' as any);");
    expect(settingsScreen).not.toContain("router.push('/onboarding/step-2-basic');");
  });

  it('settings account transitions route from the canonical checkAuth snapshot instead of refetching refresh state', () => {
    expect(settingsScreen).toContain('getSettingsSnapshot({ forceRefresh: true })');
    expect(settingsScreen).toContain('getFreshAuthSnapshot(checkAuth, fallback)');
    expect(settingsScreen).not.toContain('User.refresh().catch(() => null)');
  });

  it('settings keeps the private-profile toggle wired to the persisted profile_private preference', () => {
    expect(settingsScreen).toContain('profile_private: !!serverPrefs?.profile_private');
    expect(settingsScreen).toContain('value={!!prefs.profile_private}');
    expect(settingsScreen).toContain('onValueChange={v => patchPrefs({ profile_private: v })}');
  });
});
