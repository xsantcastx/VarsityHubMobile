# Settings behavior audit — September 5, 2026

Current source: `ec27781e3d6cd9688064bb20bab30babd33fd00c`. The main settings page renders in Chromium against a dedicated local API and PostgreSQL database. React Native component tests reproduce three persistence/state defects; two additional appearance defects are documented in [settings-theme.md](settings-theme.md). No product fixes were applied.

## Confirmed persistence defects

### SET-01 — Leaving immediately can discard a privacy change silently

**Open Bug, priority 1 for privacy settings.** The Private Profile switch changes visually immediately, but its API write waits 300 milliseconds. Unmount cleanup cancels the timer without saving or informing the user. Turning privacy on and navigating away in that interval leaves the profile public.

Source: [settings/index.tsx:295](../../../app/settings/index.tsx#L295) cancels timers; [settings/index.tsx:318](../../../app/settings/index.tsx#L318) schedules the write; the actual private-profile control is at line 836. Reproduction: mount the actual screen, toggle Private Profile on, unmount before advancing fake time, then advance one second. **Zero API calls and zero alerts.** Positive control: remain mounted for 301 ms and the expected privacy PATCH occurs.

Exploitability × blast radius × recoverability: normal user action, one account's intended privacy transition, potentially public content exposure while the user believes privacy is enabled. Saving again can correct future visibility; previous disclosure cannot be undone. Fix strategy: persist security-sensitive toggles immediately, or maintain a pending mutation outside the screen with explicit saving/error state. Test rapid back navigation and app backgrounding rather than only checking the handler source.

### SET-02 — Failed batched changes only partly roll back

**Open Bug, priority 2.** Each toggle captures its immediate previous optimistic state. When two notification switches are changed inside the same debounce window and the merged request fails, the final request restores the state before the second toggle. The first unsaved change stays visible as if persisted.

Source: [settings/index.tsx:333](../../../app/settings/index.tsx#L333) captures `prevPrefs`; line 356 restores it. Reproduction: starting with both reminders and team updates enabled, turn both off, reject the merged API call, and advance 301 ms. Error alert appears; Team Updates restores to true, but Game/Event Reminders incorrectly remains false although neither change saved.

Exploitability × blast radius × recoverability: network/API failure, settings changed in that batch, recover by reloading authoritative preferences. Fix strategy: keep the last confirmed server snapshot and reconcile mutations by version, rolling back the whole failed batch without overwriting later successful changes.

### SET-03 — A successful save can look reverted on reopening

**Open Bug, priority 2.** Successful `User.updatePreferences` does not refresh or update AuthProvider's canonical user. Reopening settings uses `getAuthSnapshot`, which returns that existing user immediately. The old privacy value renders even after the new value was successfully sent.

Source: [settings/index.tsx:274](../../../app/settings/index.tsx#L274), line 352's write without canonical-state refresh; [utils/authState.ts:113](../../../utils/authState.ts#L113) prefers the current snapshot. Reproduction: toggle privacy on, advance 301 ms, verify successful PATCH payload, unmount/reopen against the unchanged canonical user. Switch renders false. This component test models a successful API response with a mocked transport; the browser read-only pass did not mutate the setting.

Exploitability × blast radius × recoverability: normal save/revisit sequence, one account's displayed preferences; recover after a real auth refresh or fresh sign-in. Fix strategy: reconcile the authoritative mutation response with the existing AuthProvider mechanism, or await its explicit fresh-snapshot helper after a successful write. Preserve responsiveness and avoid introducing a second user cache.

## Settings inventory and actual coverage

| Area                                              | Verification                                                                                                         | Current result / limit                                                                                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main settings and section navigation              | Actual Chromium + seeded fan + local API/DB                                                                          | Renders, account and notification state loaded, no browser page errors. Two sections share the name Privacy; functional but ambiguous for navigation/accessibility.                       |
| Edit username/profile                             | Existing profile/auth/schema/username API tests and client contracts in full suite; source traced to `User.updateMe` | Covered existing server validation and canonical refresh pass. Older document describing a display-name-only username edit is stale. No device keyboard test.                             |
| Password/provider state                           | Existing actual auth HTTP/database and linked-provider tests; current password screen source                         | Password checks, reset and session revocation covered. OAuth-only controls are conditional. Actual Apple/Google provider sign-in and real mail delivery not run.                          |
| Notification switches                             | Actual screen with mocked success/error API                                                                          | SET-01/02/03 apply. Server notification helpers read preference fields; actual push delivery not tested.                                                                                  |
| Private profile/comment permissions/blocked users | Privacy routes and positive/negative server scenarios; settings component persistence tests                          | Main post privacy guard works in tested cases, but FAN-01/02/03 bypass privacy on alternate reads. Persistence defects above remain.                                                      |
| Appearance                                        | Real ThemeProvider + Followed Teams component, mocked system/storage                                                 | Two reproduced defects in settings-theme.md. System-dark/native-device screenshots not taken.                                                                                             |
| Followed teams/favorites/RSVP history             | Existing list/API and smoke tests; source uses canonical API clients                                                 | Tested empty/read contracts pass. Source presents an error alongside the empty list on Followed Teams and provides no retry button; noted UX follow-up, not an additional reproduced bug. |
| Account deletion                                  | Existing auth/account-boundary/ownership tests in full suite and role helper matrix                                  | Sole-owner restrictions covered; OAuth/password distinction traced. No production account deletion performed.                                                                             |
| Data export                                       | Existing server data-export lifecycle/authorization tests; screen source trace                                       | Requests/status/error contracts covered. Real object-storage generation, signed download and expiry not run.                                                                              |
| Billing/history/subscription                      | Payment agent trace, existing plan/finalization suites                                                               | Open PAY-01/02 and ADS-03/04. Actual payment-provider sandbox transactions not run.                                                                                                       |
| Feedback/contact/request event                    | Existing support auth tests, route/source mapping                                                                    | No real support message or email submitted.                                                                                                                                               |
| Legal screens                                     | Existing legal-pages-consistency test and routes                                                                     | Route/content consistency checked; this was not a legal compliance opinion. Theme subpage issue applies.                                                                                  |
| Founder admin panel                               | Actual founder/org-owner/coach HTTP matrix, source rendering condition                                               | Ordinary org owners/coaches denied founder metrics. Demo identity is deliberately a platform admin.                                                                                       |
| Logout/account switching                          | Existing session tests and theme-switch component                                                                    | Auth boundaries covered; THEME-02 retains previous user's appearance in memory. Multi-device logout/realtime behavior not run.                                                            |

## Evidence

`app/settings/__tests__/settings-audit-20260905.test.tsx`: **4 assertions pass**: one intended-behavior control plus three explicitly labelled observations of broken behavior. Passing these observation tests confirms the defects; it does not close them.

```sh
env -i PATH="$PATH" HOME="$HOME" \
  EXPO_PUBLIC_API_URL=http://127.0.0.1:4399 \
  EXPO_PUBLIC_FORCE_REMOTE_API=1 EXPO_PUBLIC_USE_LOCAL_API=0 NODE_ENV=test \
  npm test -- --runTestsByPath app/settings/__tests__/settings-audit-20260905.test.tsx
```

Output: `/tmp/varsityhub-audit-2026-09-05/settings-repro.log`. Appearance tests have **two expected-behavior failures**; profile network-failure test has **one observation pass** and is documented in fan-tabs.md. These added tests are separate from the existing-suite totals in the main audit.
