# App Store Compliance, Accessibility, and Grade-A Audit

**Date:** February 23, 2026  
**Scope:** App Store guidelines, accessibility, push permissions, user safety, onboarding, legal, payment compliance

---

## 1. App Store Review Guidelines Compliance

| Requirement                  | Status       | Notes                                                                                                                                                                                  |
| ---------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Report offensive content** | ✅ Yes       | Settings → Report Abuse; Message thread → Report user. Uses `POST /support/contact`.                                                                                                   |
| **Block users**              | ✅ Yes       | `User.block(id)`, Settings → Manage Blocked Users, Message thread → Block. Server enforces block on messaging.                                                                         |
| **Account deletion**         | ✅ Yes       | Settings → Delete Account. `DELETE /me` anonymizes user (email, display_name, etc.), clears preferences, removes follows/upvotes/bookmarks, deletes comments.                          |
| **In-app purchases**         | ⚠️ B2B       | Coach subscriptions (Veteran, Legend) use Stripe Checkout (web). iOS hides paid plans (iosPaidPlansDisabled) — Rookie only in-app. B2B/reader app exemption may apply for coach tools. |
| **Push permission timing**   | ❌ Too early | Requested in AuthProvider immediately after login — before user sees content or understands value. Apple prefers in-context requests.                                                  |

---

## 2. Accessibility Audit

| Check                    | Status         | Notes                                                                                                                                 |
| ------------------------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Accessibility labels** | ⚠️ Partial     | ~40 components have `accessibilityLabel` (feed, create-post, game-details, team-contacts, etc.). Many Pressables/Buttons lack labels. |
| **Color contrast**       | ⚠️ Not audited | Uses `Colors[colorScheme]` — no explicit WCAG contrast check. Muted text may fail AA.                                                 |
| **VoiceOver**            | ⚠️ Partial     | Labeled elements work; unlabeled interactive elements (tabs, list items) may be announced generically.                                |
| **Focus order**          | ⚠️ Unknown     | No explicit `accessibilityViewIsModal` or focus management.                                                                           |

**Gaps:** Many list items, tab bar buttons, and form fields lack `accessibilityLabel`. No `accessibilityHint` on most controls. `utils/accessibility.ts` exists but recommendations are not enforced.

---

## 3. Push Notification Permission Audit

| Check                 | Status       | Notes                                                                                                                                          |
| --------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **When requested**    | ❌ Too early | `AuthProvider.checkAuth` → `setupPushNotifications(me.id)` immediately after login. User has not seen feed, value, or any content.             |
| **Explanation**       | ❌ None      | `requestPermissionsAsync()` called with no pre-prompt or explanation. System dialog only.                                                      |
| **Step 9 (Features)** | ⚠️ Optional  | Step 9 has notification toggle; requests permission when user enables it. But AuthProvider also requests on every login — redundant and early. |

**Recommendation:** Remove push request from AuthProvider. Request only when user enables notifications in Step 9 or Settings, with a pre-prompt: "Enable notifications to get game reminders, RSVP updates, and messages."

---

## 4. Social Media — Echo Chamber & Discover

| Check                                   | Status    | Notes                                                                                                                  |
| --------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Discover shows non-followed content** | ✅ Yes    | `discoverPosts` = posts from people user does NOT follow. `followingPosts` = from followed. Both shown.                |
| **Diversity**                           | ✅ Yes    | Trending + listPage; nonFollowing prioritized for discover tab.                                                        |
| **Algorithm**                           | ⚠️ Simple | No ML; uses recency, upvotes, zip. No explicit "diversity injection" but discover tab surfaces non-followed by design. |

---

## 5. User Safety Features

| Feature                      | Status     | Notes                                                                                                            |
| ---------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| **Block user**               | ✅ Yes     | Full block flow; messaging enforced server-side.                                                                 |
| **Restrict who can comment** | ❌ No      | No "comment permissions" (e.g. followers only, no one). Anyone can comment on posts.                             |
| **Private profile**          | ❌ No      | `PRIVATE_ACCOUNT` in settings.ts is a local key only; server has no `profile_private`. Profile is always public. |
| **Hide location**            | ⚠️ Partial | `zip_code` in preferences; no explicit "hide location" toggle. Location used for discover/highlights.            |

---

## 6. Onboarding Completion Rate — Fan Path

| Step                | Required?       | Fan Path                                        |
| ------------------- | --------------- | ----------------------------------------------- |
| 1. Role             | Yes             | Select "Fan"                                    |
| 2. Basic            | Yes             | Username, DOB, zip                              |
| 3. Plan             | No (coach only) | Skipped                                         |
| 4. Organization     | No (coach only) | Skipped                                         |
| 6. Authorized users | No (coach only) | Skipped                                         |
| 7. Profile          | Yes             | Username (already from step 2), optional fields |
| 8. Interests        | Optional        | Can skip                                        |
| 9. Features         | Optional        | Notifications, location toggles; can skip       |
| 10. Confirmation    | Yes             | Complete onboarding                             |

**Minimum steps for fan to see feed:** 4 (Role → Basic → Profile → Confirmation). Steps 8 and 9 can be skipped via reducer.

**Risk:** Step 2 requires DOB + zip — some users may drop off. No "skip for now" on step 2.

---

## 7. Legal & Compliance — Data Retention & GDPR

| Check                             | Status     | Notes                                                                                                                                                          |
| --------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Data retention after deletion** | ✅ Aligned | `DELETE /me` immediately anonymizes. Policy and implementation both state "no grace period — anonymization is effective upon deletion."                        |
| **GDPR deletion flow**            | ⚠️ Partial | User can delete account from Settings. No dedicated "Request data deletion" or "GDPR request" flow.                                                            |
| **Data download**                 | ✅ Yes     | `GET /users/me/export` returns full JSON export. Settings has "Export My Data" button that downloads profile, posts, comments, messages, follows, preferences. |

---

## 8. Policy Enforcement

| Check                     | Status     | Notes                                                                                                                                  |
| ------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Prohibited content**    | ✅ Defined | Product policy text and moderation flows cover illegal, harmful, abusive, impersonation, spam, harassment, and related abuse patterns. |
| **Technical enforcement** | ⚠️ Partial | `contentFilter.ts` blocks profanity, bullying, spam on posts/events/comments. No enforcement on team names, bios, messages.            |
| **Coach misuse**          | ❌ No      | No check that coach content is sports-related. Platform is sports-focused but not technically restricted.                              |

---

## 9. Payment Compliance — Webhook & Fallback

| Check                              | Status      | Notes                                                                                                                |
| ---------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------- |
| **Webhook signature verification** | ✅ Yes      | `stripe.webhooks.constructEvent(body, sig, webhookSecret)` — rejects invalid signatures with 400.                    |
| **Raw body for webhook**           | ✅ Yes      | `rawBodyPaths` excludes `/payments/webhook` from JSON parser so signature can be verified.                           |
| **Payment success, webhook fails** | ✅ Fallback | `POST /payments/finalize-session` lets client finalize by session_id when webhook is unavailable. User is not stuck. |

---

## 10. Grade Impact — Prioritized Fixes

| Gap                                | Grade Impact | Fix                                                                           |
| ---------------------------------- | ------------ | ----------------------------------------------------------------------------- |
| **COPPA age gate**                 | Critical     | Add age < 13 block at signup; reject DOB indicating under 13.                 |
| **Content moderation speed**       | High         | Mount reports router; add in-post Report; consider admin push on new reports. |
| **Database query performance**     | High         | Add indexes: `deleted_at`, `country_code`, `status` (Event).                  |
| **Apple accessibility**            | Medium       | Add accessibilityLabel to all interactive elements; verify contrast.          |
| **User privacy controls**          | Medium       | Add private profile, restrict comments, hide location toggle.                 |
| **Data download/deletion**         | Medium       | Add `GET /me/export`; clarify retention vs. purge.                            |
| **Onboarding step count**          | Medium       | Consider optional step 2 fields or "skip" for fans to reduce friction.        |
| **Webhook signature verification** | ✅ Done      | Already implemented.                                                          |

---

## Summary — Current Grade: B-

**Strengths:** Block, report, account deletion, webhook verification, payment fallback, discover diversity, Stripe B2B handling.

**Critical gaps:** COPPA age gate, push permission timing, accessibility coverage, private profile, data export.

**Honest professor note:** The app has more features than most launch apps. Architecture is solid, security is decent. The gap is between "features built" and "working reliably under real-world conditions." Fix the items above in a focused week to reach A-.
