# Bounded settings appearance follow-up — 2026-09-05

Two current behavior defects reproduced using React Native Testing Library and the real ThemeProvider and FollowedTeams screen. Native system theme and SecureStore, auth identity, and query response are mocked; these are component runtime tests, not device/browser end-to-end tests. No product fixes.

## THEME-01 — Settings subpages bypass the selected application theme

**Open Bug / medium UX priority.** Settings advertises Light/Dark as 'Always use the ... theme' at [app/settings/index.tsx:704](/Users/varsityhub/Code/VarsityHubMobile/app/settings/index.tsx:704). The settings main screen uses `useCustomColorScheme`, but 12 settings subpages import React Native's `useColorScheme` directly, which returns the operating-system preference. With system=light and saved app=dark, the real provider correctly renders `dark:dark`, while the actual Followed Teams title remains light-theme dark text (`#11181C`, expected dark-theme text `#F5F5F5`). Page background also reads the system palette. This is visible theme discontinuity; shared components using the proper hook may render mismatched palettes on the same screen.

- Reproduced: [app/settings/followed-teams.tsx:4](/Users/varsityhub/Code/VarsityHubMobile/app/settings/followed-teams.tsx:4), [app/settings/followed-teams.tsx:15](/Users/varsityhub/Code/VarsityHubMobile/app/settings/followed-teams.tsx:15).
- Same static import pattern: billing-history, contact, data-export, dmca, edit-username, feedback, manage-subscription, privacy-policy, reset-password, terms-of-service, zip-code (plus reproduced followed-teams = 12). Some only style local text, while others style entire surfaces. Runtime reproduction performed on followed-teams, not all 12 individually.
- Expected/fix strategy: consume the already-existing shared `@/hooks/useColorScheme` alias throughout these settings surfaces; test system≠app combinations. No new theme system needed.
- Exploitability/blast/recoverability: no security exploitation; affects any user overriding system appearance; choose matching system theme as workaround. Client fix needs OTA/native release path, not just Railway.

## THEME-02 — New account inherits previous user's appearance when it has no saved preference

**Open Bug / low UX priority.** [hooks/useCustomColorScheme.tsx:63](/Users/varsityhub/Code/VarsityHubMobile/hooks/useCustomColorScheme.tsx:63) reloads per-user storage when `user.id` changes, but only sets state for a nonempty valid stored value. If user A selected dark and user B has no stored preference, B remains dark instead of default system. The code explicitly scopes preferences per auth identity; this absence branch defeats that behavior in memory (does not persist A's value into B's storage).

- Component reproduction: start on user A with saved dark, switch the mocked auth identity to user B, await lookup `vh_theme_preference_theme-user-b` returning null. Actual remains `dark:dark`; expected `system:light` for light system.
- Fix strategy: reset theme state to system on identity changes and apply only the active identity's valid saved value; retain async cancellation guard.
- Exploitability/blast/recoverability: no security escalation or private data exposure; shared-device/account-switch cosmetic preference bleed; manually selecting theme fixes it.

## Verification

Added [settings-theme-audit-20260905.test.tsx](/Users/varsityhub/Code/VarsityHubMobile/app/settings/__tests__/settings-theme-audit-20260905.test.tsx) with two before-fix expected-behavior assertions. Ran:

```sh
npm test -- --runInBand --runTestsByPath app/settings/__tests__/settings-theme-audit-20260905.test.tsx --json --outputFile=/tmp/varsityhub-audit-2026-09-05/settings-theme-results.json
```

Result: **2 tests failed for the specific observed defects, no harness failure**. Provider dark-state controls passed within each test. Output `settings-theme.log` and `settings-theme-results.json`. New file formatted via Prettier. This does not overlap root's settings privacy-debounce/rollback reproduction.
