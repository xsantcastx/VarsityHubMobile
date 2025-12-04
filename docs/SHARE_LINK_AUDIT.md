# Share Link Audit

**Date:** December 3, 2025  
**Owner:** Mobile Platform  
**Goal:** Ensure every share action produces a canonical VarsityHub link with modern fallbacks (copy link, error handling, analytics).

---

## Quick Summary

| Surface | File | Link Source | Current Fallback | Gaps |
|---------|------|-------------|------------------|------|
| Event detail | `app/event-detail.tsx` | `AppLinks.event` (ID → `/events/:id`) | None. Errors are logged only. | No copy-link fallback, no analytics, no error toast for users. |
| Post detail | `app/post-detail.tsx` | `AppLinks.post` (ID → `/posts/:id`) | None. Fails silently in catch. | Duplicated logic per screen, no clipboard fallback, no share telemetry. |
| Highlights feed | `app/highlights.tsx` | `AppLinks.post/highlight` | Clipboard fallback only when RN `Share` is unavailable. | Does not surface context (team, author), no tracking. |
| Game detail (story view + rail) | `app/game-details/GameDetailsScreen.tsx`, `GameVerticalFeedScreen.tsx` | `AppLinks.game` & `AppLinks.post` | None. | Missing fallback + user feedback, share text inconsistent across components. |
| Team/Coach CTA buttons (Discover tab) | `app/(tabs)/discover/mobile-community.tsx` | Hard-coded string right now | N/A | Needs to reuse canonical helper when share opens. |
| Organization/Team invites | `AppLinks.organizationInvite`, `AppLinks.teamInvite` (used in onboarding + invites) | Provided via API/email, not RN Share | Copy handled by browser/email | Need validation that deep links match iOS/Android configs. |

---

## Observations

1. **Share logic lives in five different components.** Each assembles the share message slightly differently and only `app/highlights.tsx` offers a clipboard fallback. If the native share sheet fails, the user silently loses the action.
2. **No analytics or logging for user behavior.** We can't tell which entities are getting shared, making it hard to measure virality.
3. **Link consistency depends on `AppLinks`.** All in-app share flows correctly route to `utils/links.ts`, but we have not validated that the generated web paths (`/events/:id`, `/posts/:id`, etc.) map to a live hosted page with Open Graph previews.
4. **No copy-link or toast UX.** Users expect “Copy Link”/“Share via…” options (like Instagram). We only surface a basic `Share.share` call.
5. **Federated deep-link configs unverified.** We generate `varsityhubmobile://event/:id` but haven’t confirmed that iOS Associated Domains and Android intent filters actually open the correct route.

---

## Recommended Actions

1. **Create a reusable share helper** (hook or utility) that:
   - Accepts an entity type/id and optional context lines.
   - Calls `Share.share` with consistent error handling.
   - Provides `copyLink()` fallback (with success toast).
   - Emits analytics events (`share_attempted`, `share_failed`, `share_copied`).
2. **Refactor event detail, post detail, and game detail** to use this helper first. Highlights and Discover CTAs can follow.
3. **Add a “Copy link” secondary action** anywhere a share button exists (long-press or overflow menu) so users can manually share even if the native sheet fails.
4. **Validate universal linking setup** for every path defined in `utils/links.ts` (posts, events, games, teams, users, invites).
5. **Backfill instrumentation** (console logs → analytics) so we can understand which entity types generate traffic.

---

Tracking this audit ensures future share endpoints (team pages, organization hubs, marketplace listings) plug into a single, reliable system instead of duplicating logic. This document should be updated whenever a new share surface ships or when web/universal link behavior changes.
