# Content & Accessibility Readiness (Dec 6, 2025)

## Localization & Copy Parity
| Area | Status | Notes / Next Actions |
| --- | --- | --- |
| `locales/en.json` | ⚠️ Incomplete | File only contains app name/display name; extract UI copy from `components/OfflineBanner.tsx`, `app/feed.tsx`, onboarding, payment screens. |
| Additional locales (es, fr, etc.) | ⚠️ Missing | Create stubs under `locales/` or confirm English-only launch; update product docs accordingly. |
| Push/email copy | ⏳ Pending | Verify messages in `server/src/lib/email.ts` and Expo push payloads match final marketing language. |
| Support/help links | ⏳ Pending | Confirm in-app links reference live privacy policy and help center URLs. |

## Accessibility / UX Checks
| Topic | Status | Notes / Recommended Fixes |
| --- | --- | --- |
| Dynamic Type / font scaling | ⏳ Pending | Large blocks (e.g., `app/feed.tsx` cards, `OfflineBanner`) use fixed font sizes; run device tests with iOS Accessibility > Larger Text. |
| Color contrast | ⏳ Pending | Validate text on dark backgrounds (e.g., RSVP badges, error banners) meets WCAG AA. |
| Screen reader labels | ⚠️ Limited | Buttons such as notification rows (`app/feed.tsx` around line 1130) lack `accessibilityRole`/`accessibilityLabel`. Audit high-traffic actions. |
| Keyboard navigation | ⏳ Pending | Ensure modals (`notificationsMenu`) announce focus and close buttons have labels. |
| Performance hot spots | ⏳ Pending | Feed screen runs heavy work inside `useEffect` and renders dozens of Pressables; profile instrumentation recommended (e.g., `onEndReached`, `initialNumToRender`). |

## Action Items
1. **Localization pass** – Extract strings into `locales/en.json`, add fallbacks for missing translations, and wire `i18n` loader prior to submission.
2. **Copy approval** – Review onboarding/payment copy with Product & Legal, update docs if changes required.
3. **Accessibility test run** – Use VoiceOver/TalkBack on iOS/Android to validate focus order, hints, and button labels; log issues in `QA_EXECUTION_LOG.md`.
4. **Performance spot-check** – Record profiles (Xcode Instruments / Android Profiler) while scrolling feed/highlights to confirm <16 ms frame time; capture metrics in `APP_FIXES_LOG.md`.

> Update this document as items are validated. Mark ✅ with tester/owner initials and timestamp.
