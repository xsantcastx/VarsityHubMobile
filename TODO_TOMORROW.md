# TODO — Prioritized work (ASAP → Low)

Context: continuing work on the VS Match banner, GameDetails poll modal, Lottie sparkles, and general polish (branch: feature/feed).

Top-level order: critical visual QA and auth/onboarding flows first, then UX & accessibility, then cleanups and optional gating.

1 — Visual QA & smoke test (ASAP)
   - Goal: exercise the new MatchBanner and GameDetails poll modal on device/emulator to surface layout, animation, and bundler issues.
   - Steps:
     - Start Expo and open the app on a device/emulator.
     - Navigate: Feed → open a GameDetails page → open VS quick-poll modal.
     - Test in both Light and Dark themes, and with OS reduced-motion enabled.
     - Verify Lottie(s) render or fall back gracefully.
   - Files to check: `app/game-details/GameDetailsScreen.tsx`, `app/components/MatchBanner.tsx`, `app/components/MatchBannerLottie.tsx`.
   - Acceptance criteria: UI renders without redbox errors; modal content visible and usable; animations either play smoothly or are suppressed with reduced-motion.
   - Estimate: 15–45 minutes (manual).

2 — Fix auth flows (high)
   - Goal: make sign-up/login flows reliable for new users (Google OAuth + router/redirect correctness).
   - Tasks:
     - Implement or gate Google OAuth in `app/sign-up.tsx` (or hide until implemented).
     - Clean up `as any` router casts in `sign-in.tsx` and `verify-email.tsx` (use typed `router` calls).
     - Verify redirects (`/(tabs)`, `/verify-email`) behave correctly after sign-in/up.
   - Files: `app/sign-up.tsx`, `app/sign-in.tsx`, `app/verify-email.tsx`.
   - Acceptance: new users can complete sign up (or see a clear message/gating), and redirects land on expected screens.
   - Estimate: 3–12 hours depending on server/OAuth setup.

3 — Onboarding server wiring (high)
   - Goal: finish onboarding steps that rely on backend/payment so new accounts can fully onboard.
   - Tasks:
     - Wire plan/payment step (`app/onboarding/step-3-plan.tsx`) to Stripe/processor or hide until integrated.
     - Save season dates in `app/onboarding/step-4-season.tsx` to the backend.
     - Ensure `step-5-league.tsx` creates an organization/team as intended.
   - Files: `app/onboarding/*` (steps 1–10).
   - Acceptance: onboarding completes end-to-end and lands the user in the main app.
   - Estimate: 1–3 days (API & payment dependent).

4 — Team edit persistence & settings wiring (medium)
   - Goal: make team editing and password reset persist changes.
   - Tasks:
     - Implement save-to-backend in `app/team-profile.tsx` and `app/edit-team.tsx`.
     - Wire `app/settings/reset-password.tsx` to change-password endpoint.
   - Acceptance: edits persist and UI shows success/failure states.
   - Estimate: 4–16 hours.

5 — Implement safety flows (medium)
   - Goal: provide `report-abuse`, `dm-restrictions`, and blocked-users flows so users can take action from Messages/Settings.
   - Tasks:
     - Build UI forms and wire to backend endpoints.
     - Hook links from `app/messages.tsx` / `app/message-thread.tsx` and `app/settings`.
   - Acceptance: users can submit reports and see confirmations.
   - Estimate: 1–3 days.

6 — Lottie verification & asset cleanup (medium)
   - Goal: ensure `MatchBannerLottie` uses only present animation JSON files and that Metro bundler won't fail.
   - Tasks:
     - Confirm preset mapping in `app/components/MatchBannerLottie.tsx` matches `assets/animations/*.json`.
     - Remove unused placeholder JSONs or replace with smaller fallbacks.
     - Test on iOS/Android emulator for bundler/runtime behavior.
   - Acceptance: no require-time bundler errors; animations show or fallback gracefully.
   - Estimate: 1–4 hours.

7 — Type cleanup: remove `as any` and tighten typings (low–medium)
   - Goal: reduce hidden type problems and tighten router/Animated typing in hot files.
   - Tasks:
     - Repo-wide search for `as any` and fix easy cases; prioritize `MatchBanner.tsx`, `GameDetailsScreen.tsx`, auth files.
   - Acceptance: remove `as any` in high-priority files; remaining casts documented with TODOs.
   - Estimate: 2–6 hours.

8 — Replace blank early-return UIs with friendly fallbacks (low)
   - Goal: avoid blank screens when route params are missing; show friendly messaging or redirect.
   - Tasks:
     - Replace `return null` in user-facing pages (`profile.tsx`, `game-details`, `highlights`) with a message or redirect to Feed.
   - Acceptance: users never see a completely blank screen; they get a helpful fallback.
   - Estimate: 2–8 hours.

9 — Accessibility & contrast sweep (low)
   - Goal: ensure accessibility labels, hints, focus order, and color contrast meet basic standards.
   - Tasks:
     - Check `accessibilityRole`, `accessibilityLabel`, `accessibilityHint` on poll cards, banners, and modal controls.
     - Verify color contrast for pill backgrounds and selected states.
   - Acceptance: reduced-motion honored, labels present, contrast improved where failing.
   - Estimate: 3–8 hours.

10 — Create issues/PRs and acceptance criteria (process)
   - Goal: make the above work trackable and reviewable.
   - Tasks:
     - Create GitHub issues or draft PR(s) for high-priority tasks with steps, file pointers, and acceptance criteria.
   - Acceptance: each high-priority task has an issue or PR with clear scope and testing steps.
   - Estimate: 1–3 hours.

11 — Optional: hide or gate placeholder pages (nice-to-have)
   - Goal: reduce user friction until features are implemented.
   - Tasks:
     - Hide links to placeholder pages or show an interstitial page with ETA/feature-flag.
   - Acceptance: placeholder pages not visible to end users unless feature-flag enabled.
   - Estimate: 1–4 hours.

---

What I can do next (pick one):
- Start Expo now and capture the 4 screenshots (light/dark × modal open/closed). Requires emulator/device.
- Search the repo for `as any` and prepare a cleanup patch for the top-priority files.
- Draft PR(s) for the top 3 tasks with acceptance criteria and a short checklist.

Paste this into your planning board or merge it into `TODO_TOMORROW.md` — it's already saved here.

Onboarding step 5 imports Organization.createOrganization, but no such client wrapper exists, so the screen throws before creating orgs (app/onboarding/step-5-league.tsx:11, src/api/entities.ts). Add the organization API surface next.
Team management UIs call Team.update and expect sport/season/logo_url to persist, but the client exposes only basic list/get/create; saves currently fail at runtime (app/edit-team.tsx:141, app/create-team.tsx:113, src/api/entities.ts:200-210). Extend the wrapper to call /teams/create/PUT /teams/:id.
Subscription flows post to /payments/subscribe, which doesn’t exist; the server exposes /payments/checkout, so onboarding step 3 and manage-subscription can’t launch Stripe (app/onboarding/step-3-plan.tsx:69, app/settings/manage-subscription.tsx:38, src/api/entities.ts:218, server/src/routes/payments.ts:44).
The notifications tab imports Notification helpers that aren’t exported anywhere, so the screen crashes immediately when opened (app/(tabs)/notifications/index.tsx:6, src/api/entities.ts).
TODO_TOMORROW.md still tracks high-priority polish (MatchBanner QA, auth cleanup, onboarding persistence); keep it as the short-term backlog.
Next Steps

Add the missing REST wrappers (Organization, Notification, richer Team helpers) in src/api/entities.ts, matching the server routes, then retest onboarding, notifications, and team edit/create.
Update subscription calls to use /payments/checkout and confirm Stripe plans by running the server (npm run server:dev) and hitting manage-subscription in Expo (npm run start:ci).
After the API fixes, follow the manual QA plan from TODO_TOMORROW.md, paying special attention to MatchBanner visuals and onboarding completion state.