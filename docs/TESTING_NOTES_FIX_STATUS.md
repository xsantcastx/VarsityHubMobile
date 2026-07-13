# Testing Notes Fix Status

**Last updated:** 2026-03-15  
**Source:** Release Readiness Review, Pre-Release Fixes plan, user testing notes

## ✅ DONE (Verified)

| Item              | Status | Notes                                                                          |
| ----------------- | ------ | ------------------------------------------------------------------------------ |
| Onboarding bypass | ✅     | `onboarding_completed !== true` in AuthProvider + index.tsx                    |
| Proceed as Fan    | ✅     | pending-approval.tsx + league-pending-approval.tsx both have "Continue as Fan" |
| TypeScript        | ✅     | `npm run typecheck` passes                                                     |
| Lint              | ✅     | `npm run lint` passes                                                          |
| Ad approval flow  | ✅     | Submit for approval → admin approves → pay. No charge until approved.          |
| Ad re-run         | ✅     | Once approved, no re-approval for future runs                                  |

## 🔧 DONE THIS SESSION

| Item                       | Status                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------- |
| League → VarsityHub label  | ✅ "Back to League Setup" → "Back to Organization Setup"                           |
| Coach quick actions        | ✅ Already correct: 1 team → teamId; multiple → team picker; 0 → Create Team alert |
| IAP diagnostics            | ✅ Added setError on fetchProducts fail; warn when SKU not in store                |
| Repo health                | ✅ Ran clean-repo-artifacts; check passes                                          |
| Tests                      | ✅ All 79 tests pass                                                               |
| Event page team buttons    | ✅ Warriors/Cavaliers navigate to team-profile (fallback: search by name)          |
| Light/dark mode (calendar) | ✅ Discover calendar selectedDayTextColor fixed to #FFFFFF                         |
| Messages unread badge      | ✅ Feed header shows numeric count when unread > 0                                 |
| Story post                 | ✅ Caption below media (no overlap); borderWidth: 0 on story tile                  |
| Keyboard empty space       | ✅ Reduced keyboardVerticalOffset (8px) in KeyboardAwareScreen, OnboardingLayout   |
| School org                 | ✅ Larger org name input (64px); dropdown for "Select organization to join"        |
| LocationPicker             | ✅ listView zIndex/elevation so dropdown appears above keyboard                    |
| IAP (server)               | ✅ Guard: returns 503 with clear message when APPLE_IAP_SHARED_SECRET missing      |

## ⚠️ CONFIG VERIFICATION (Railway / Env)

| Item               | Action                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Upload persistence | Verify `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` in Railway |
| IAP                | Verify `APPLE_IAP_SHARED_SECRET` in Railway; test on EAS build (not Expo Go)             |

## 📋 REMAINING (Medium Priority)

| Item             | Plan Reference                                                                            |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Location section | Organization page already has Location between About and Teams; team-page could add venue |

## Release Gate (from CHECKLIST.md)

- [ ] `./scripts/check-repo-health.sh` passes
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] Smoke test against production
