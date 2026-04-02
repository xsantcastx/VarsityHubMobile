# MASTER BUG REPORT — VarsityHub Mobile

> Full-app audit across 13 feature areas. 147 bugs identified.
> No fixes applied. This document is for review and prioritization only.

---

## AUTH & ACCOUNT (11 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| AUTH-01 | BLOCKING | `app/reset-password.tsx` | No way to re-request an expired reset code — user is stuck with error and no forward path | LOW | No |
| AUTH-02 | DEGRADED | `app/sign-in.tsx`, `server/src/routes/auth.ts` | Ban response contract mismatch — client reads `ban_reason`/`banned_until` but server never sends those fields; suspended users get generic message | LOW | No |
| AUTH-03 | DEGRADED | `app/verify-identity.tsx` | Bypasses AuthProvider routing after verification — uses imperative navigation, skips coach approval/agreement handling | LOW | Yes (AuthProvider) |
| AUTH-04 | DEGRADED | `app/verify.tsx` | Shows "Automatically continuing in a few seconds..." but no auto-redirect timer exists in this component | LOW | No |
| AUTH-05 | DEGRADED | `api/auth.ts:209-213`, `context/AuthProvider.tsx` | Both `auth.me()` and AuthProvider call `auth.logout()` on 401 — double logout attempt (two `POST /auth/logout` calls) | LOW | Yes (auth) |
| AUTH-06 | COSMETIC | `server/src/routes/auth.ts` (register) | COPPA check in `POST /auth/register` is unreachable — client never sends `dob` at registration | LOW | No |
| AUTH-07 | COSMETIC | `server/src/routes/auth.ts` (apple) | Apple `POST /auth/apple` response omits `is_admin` field unlike login and Google endpoints | LOW | No |
| AUTH-08 | COSMETIC | `app/sign-up.tsx` | `display_name` never sent at registration; server uses email prefix in verification email greeting | LOW | No |
| AUTH-09 | COSMETIC | `app/sign-up.tsx:410-461` | Duplicate TOS/age checkboxes appear in email form view (same state, just visual duplication) | LOW | No |
| AUTH-10 | COSMETIC | `app/forgot-password.tsx` | Swallows ALL errors from code-send request — shows success even on server 500 or network failure | LOW | No |
| AUTH-11 | COSMETIC | Sign-in UX | Google OAuth user who tries email login gets generic "Invalid credentials" with no hint to use Google | LOW | No |

---

## COACH ONBOARDING (7 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| OB-01 | DEGRADED | `app/onboarding/step-3-league.tsx:471` | `league-pending-approval.tsx` is dead code — never navigated to; both join and create flows land on `pending-approval` with wrong UI text | LOW | No |
| OB-02 | COSMETIC | `app/onboarding/step-3-league.tsx:470-471` | `pending-approval` receives no route params (`leagueName`, `ownerName`) — shows generic "the league" placeholder | LOW | No |
| OB-03 | COSMETIC | `app/onboarding/step-2-basic.tsx:350-392` | Coach bio entered in step 2 is silently discarded — fire-and-forget bio save only runs for fans | LOW | No |
| OB-04 | COSMETIC | `app/onboarding/step-1-role.tsx`, `step-2-basic.tsx` | Duplicate `User.me()` calls on every screen focus (2 calls per focus event on each screen) | LOW | No |
| OB-05 | COSMETIC | `app/onboarding/step-2-basic.tsx:27` | Client username regex allows 1-2 char usernames; server requires min(3) — error only surfaces after submission | LOW | No |
| OB-06 | COSMETIC | `app/onboarding/step-3-league.tsx:504-506` | Generic catch-all "Something went wrong" discards server error details (Zod issues not surfaced) | LOW | No |
| OB-07 | COSMETIC | `app/onboarding/step-3-league.tsx:384,470` | `checkAuth()` called fire-and-forget before navigation — potential redirect flicker | LOW | Yes (AuthProvider) |

---

## APPROVAL PROCESS (17 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| AP-01 | DEGRADED | `server/src/routes/organizations.ts` | Manager role gets empty "No pending requests" — `/mine` returns manager orgs but `/pending-coaches` returns 403 for non-owners | MEDIUM | Yes (orgs route) |
| AP-02 | DEGRADED | `app/(tabs)/approvals.tsx` | Approve `note` is silently discarded by server — endpoint reads `team_id` but never reads `note` from body | MEDIUM | No |
| AP-03 | COSMETIC | `app/(tabs)/approvals.tsx` | No success feedback on coach decline — card disappears silently (approve shows green overlay) | LOW | No |
| AP-04 | COSMETIC | `app/(tabs)/approvals.tsx` | Double-tap race on approve — modal can be dismissed and re-triggered while request is in-flight | LOW | No |
| AP-05 | COSMETIC | `app/(tabs)/approvals.tsx` | No `actionLoading` guard during decline — card button stays enabled while in-flight | LOW | No |
| AP-06 | DEGRADED | `server/src/routes/organizations.ts:1871` | Reject endpoint writes reason to `message` field, not `rejection_reason` — data stored inconsistently | LOW | Yes (schema) |
| AP-07 | COSMETIC | `app/(tabs)/event-approvals.tsx` | Double async guard — `useRequireCoach` and `useEffect` both navigate away | LOW | No |
| AP-08 | DEGRADED | `app/(tabs)/event-approvals.tsx:108-132` | `created_by_name`/`created_by` not in games list response — "Submitted by" always undefined on pending game cards | MEDIUM | Yes (games route) |
| AP-09 | DEGRADED | `server/src/routes/events.ts:739-761` | Fan events without `team_id` silently 403 on approve — no UI explanation | MEDIUM | No |
| AP-10 | DEGRADED | `server/src/routes/games.ts` vs `events.ts` | Games approve uses `requireAuth` not `requireVerified` — inconsistent security between event and game approval | LOW | Yes (middleware) |
| AP-11 | COSMETIC | `server/src/routes/games.ts` | Reject reason not persisted for games — only sent in push notification, not stored in DB | MEDIUM | No |
| AP-12 | COSMETIC | `app/(tabs)/event-approvals.tsx` | Error extraction inconsistency — uses `e?.message` not `e?.data?.error` (may show raw string) | LOW | No |
| AP-13 | COSMETIC | `server/src/routes/teams.ts` | Invite lookup is by email, not user_id — invite orphaned if user changes email | LOW | No |
| AP-14 | COSMETIC | `app/(tabs)/event-approvals.tsx` | Decline processing state set inside Alert callback — two overlapping decline requests possible | LOW | No |
| AP-15 | COSMETIC | `app/(tabs)/event-approvals.tsx` | Section 3 label "Authorized User Requests" is misleading — shows outgoing requests, not incoming | LOW | No |
| AP-16 | DEGRADED | `server/src/routes/organizations.ts` | `/organizations/mine` only requires `requireAuth` — unverified user sees orgs but hits 403 on every action | LOW | No |
| AP-17 | COSMETIC | `app/(tabs)/event-approvals.tsx` | No explanation shown when `alreadyExists` org can't be approved by non-owner manager | LOW | No |

---

## AD HOSTING (11 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| AD-01 | BLOCKING | `server/src/utils/adPricing.ts:1-4` | Floating-point pricing: `4.99 * 100 = 498.99...` not `499` — Stripe truncates to wrong cent amount | LOW | Yes (payments) |
| AD-02 | BLOCKING | `app/ad-calendar.tsx:513,529-543` | iOS creates orphaned Stripe PaymentIntent for every IAP purchase — PI is never cancelled | MEDIUM | Yes (payments) |
| AD-03 | BLOCKING | `hooks/useAdIAP.ts:103-107` | iOS multi-product sequential purchase can leave `purchaseAd()` promise unresolved if second IAP stalls — UI stuck in `submitting=true` | MEDIUM | No |
| AD-04 | DEGRADED | `app/edit-ad.tsx:133` | `edit-ad.tsx` does not normalize URLs before sending — users get raw Zod error for `example.com` | LOW | No |
| AD-05 | DEGRADED | `app/ad-calendar.tsx`, `app/edit-ad.tsx` | Rejection `admin_note` is never surfaced to the advertiser in any client screen | LOW | No |
| AD-06 | DEGRADED | `app/ad-confirmation.tsx:128-154` | "Continue Anyway" shows "Your Ad is Live!" when payment is still pending | LOW | No |
| AD-07 | DEGRADED | `server/src/routes/payments.ts` (webhook) | No webhook handler for `payment_intent.canceled` — Android hold stays for 24h if checkout abandoned | MEDIUM | Yes (payments) |
| AD-08 | COSMETIC | `app/admin-ads.tsx:375` | `'paused'` filter tab never has results — server never sets this status | LOW | No |
| AD-09 | COSMETIC | `app/my-ads.tsx:491,497` | `'rejected'` badge can never appear — server resets to `'draft'` on rejection | LOW | No |
| AD-10 | COSMETIC | `app/my-ads.tsx:146` | Delete confirmation warns "non-refundable" for unpaid ads | LOW | No |
| AD-11 | COSMETIC | `app/my-ads.tsx` | `'approved'` and `'active'` badges both render green with no actionable CTA | LOW | No |

---

## GEOFENCING (7 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| GEO-01 | DEGRADED | `app/(tabs)/create-post.tsx:562` vs `server/src/lib/geofencing.ts:112-117` | Time window mismatch — client uses 32h, server uses UTC midnight + 8h — can diverge for most game times | LOW | No |
| GEO-02 | DEGRADED | `app/(tabs)/create-post.tsx:626-632` | "Getting Your Location" alert leads to guaranteed server 403 — user clicks Continue with no coords | LOW | No |
| GEO-03 | DEGRADED | `app/game-details/GameDetailsScreen.tsx:1254-1262` | Story UX says location is optional but server rejects without it — media already uploaded to Cloudinary before rejection | MEDIUM | No |
| GEO-04 | DEGRADED | `server/src/lib/geofencing.ts:158`, `posts.ts:675` | `EVENT_NOT_FOUND` returns HTTP 403 not 404 — client's 404 handler never fires, shows generic message | LOW | No |
| GEO-05 | DEGRADED | `server/src/routes/posts.ts:682`, `gameStories.ts:235` | Game with no associated events silently bypasses all geofencing | LOW | No |
| GEO-06 | COSMETIC | `components/EventMap.tsx:55` | EventMap makes independent permission request — uncoordinated with `useDeviceLocation` | LOW | No |
| GEO-07 | COSMETIC | `hooks/useDeviceLocation.ts:38,65-68` | GPS cache (10min) can submit stale coordinates from before arriving at venue | LOW | No |

---

## TEAMS & ORGANIZATIONS (12 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| TM-01 | BLOCKING | `app/team-viewer.tsx:14-27` | Member shape mismatch — expects `display_name` at top level but server returns it under `user.display_name` — all names/avatars blank | LOW | No |
| TM-02 | BLOCKING | `app/team-viewer.tsx:138` | `handleMemberPress` navigates with membership ID instead of user ID — user profiles fail to load | LOW | No |
| TM-03 | BLOCKING | `app/team-viewer.tsx`, `app/(tabs)/organization.tsx` | Fetches ALL games globally and filters by team name string — wrong games appear, O(n) over entire table | HIGH | Yes (games API) |
| TM-04 | BLOCKING | `app/organization-join-requests.tsx:78` | `rejection_reason` reads `r.message` not `r.rejection_reason` — shows coach's message as admin's reason | LOW | No |
| TM-05 | DEGRADED | `server/src/routes/teams.ts`, `app/(tabs)/edit-team.tsx` | `GET /teams/:id` returns `season_start`/`season_end` not `season` — season label never renders, edit loads blank | MEDIUM | No |
| TM-06 | DEGRADED | `app/(tabs)/organization.tsx` | Fetches ALL teams via `GET /teams` and filters client-side — if >100 teams exist, some orgs teams invisible | MEDIUM | Yes (teams API) |
| TM-07 | DEGRADED | `app/(tabs)/create-team.tsx:358,454` | Upgrade alert shows `$1.50/mo/team` — spec says `$1/mo/team` — pricing display is wrong | LOW | No |
| TM-08 | DEGRADED | `app/(tabs)/edit-team.tsx:228` | Org search uses `startsWith` match — first result auto-assigned even if not exact match | LOW | No |
| TM-09 | DEGRADED | `app/request-join-organization.tsx:113-117` | `team_id` passed as `role` field — server ignores unknown fields, team context silently dropped | LOW | No |
| TM-10 | DEGRADED | `app/(tabs)/organization.tsx` | `isOrgAdmin` depends on `memberships` in GET response — if server omits it, admin buttons never appear | MEDIUM | No |
| TM-11 | COSMETIC | `app/(tabs)/my-team.tsx:50` | Invite role picker includes `owner` — server blocks but client allows the attempt | LOW | No |
| TM-12 | COSMETIC | `app/team-viewer.tsx` | "Total Games" stat counts all games in DB, not just this team's games | LOW | No |

---

## MESSAGING (9 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| MSG-01 | BLOCKING | `app/admin-messages.tsx:67` | Admin messages shows "unknown → unknown" for all senders — server doesn't return `sender_email`/`recipient_email` | LOW | No |
| MSG-02 | DEGRADED | `app/message-thread.tsx:214-218` | All send errors surface as identical "Send Failed" — server returns distinct codes (BLOCKED, DM_RESTRICTED, PROFANITY, SPAM) but client ignores them | LOW | No |
| MSG-03 | DEGRADED | `app/messages.tsx:281`, `message-thread.tsx:160-163` | Organization account check is dead code — `account_type` never present in search/message response | LOW | No |
| MSG-04 | DEGRADED | `api/messages.ts:4` | `Message.unreadCount()` API exists but is never consumed — no global unread badge anywhere | MEDIUM | No |
| MSG-05 | COSMETIC | `server/src/routes/users.ts:1016-1019` | Search/mentions only matches username and email, not display_name — users without username are undiscoverable | LOW | Yes (users route) |
| MSG-06 | COSMETIC | `app/dm-restrictions.tsx:47-48` | Optimistic policy state before save — shows new value even if save fails | LOW | No |
| MSG-07 | COSMETIC | `app/message-thread.tsx:121-122,136-142` | Poll replaces full message list every 5s — auto-scrolls away from history if new message arrives | LOW | No |
| MSG-08 | COSMETIC | `app/messages.tsx`, `message-thread.tsx` | Inbox unread count stale until screen re-focus after marking read | LOW | No |
| MSG-09 | COSMETIC | Client: 1000 chars, Server: 5000 chars | Message content limit mismatch — server allows 5x more than client shows | LOW | No |

---

## PAYMENTS & BILLING (10 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| PAY-01 | BLOCKING | `app/payment-cancel.tsx:34` | Subscription cancel "Try Again" routes to `/onboarding/step-3-league` not `/subscription-paywall` | LOW | No |
| PAY-02 | BLOCKING | `app/billing.tsx:63,802` | Price display mismatch — shows `$1.50/team` in alert but computes `$1.00/team` in billing summary | LOW | No |
| PAY-03 | DEGRADED | `app/settings/manage-subscription.tsx:111-119` | IAP purchase returning `false` shows nothing to user — subscription consumed but not activated, no error alert | MEDIUM | No |
| PAY-04 | DEGRADED | `app/subscription-paywall.tsx:188-203` | Stripe path does not call `finalizeSession` — relies entirely on webhook with no client-side nudge | MEDIUM | No |
| PAY-05 | DEGRADED | `server/src/routes/payments.ts:2751` | Apple S2S: `signedTransactionInfo` decoded with `jwt.decode()` not `jwt.verify()` — inner JWS not independently verified | HIGH | No |
| PAY-06 | DEGRADED | `server/src/routes/payments.ts:3113` | Google Play unverified fallback accepts purchases without Play API verification in non-production | MEDIUM | No |
| PAY-07 | DEGRADED | `app/billing.tsx:161` | Billing monthly cost display computes `quantity * 1.0` — should be `quantity * 1.5` (33% wrong) | LOW | No |
| PAY-08 | COSMETIC | `app/subscription-paywall.tsx:466-468` | Billing copy says "Billed monthly per team" with no price shown for Stripe path | LOW | No |
| PAY-09 | COSMETIC | `app/settings/manage-subscription.tsx` | IAP purchase does not poll for activation — single `User.me()` may return stale plan | LOW | No |
| PAY-10 | COSMETIC | `hooks/useIAP.ts:104` | `finishTransaction()` called even when verify-receipt fails — purchase acknowledged to Apple but DB not updated | MEDIUM | Yes (IAP) |

---

## NOTIFICATIONS (10 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| NF-01 | BLOCKING | `server/src/routes/games.ts:~1521-1540` | Game approval notifications store `meta.game_id` but client reads `meta.event_id` — all game notifications are untappable | LOW | Yes (games route) |
| NF-02 | DEGRADED | `components/NotificationTapHandler.tsx:109` | `coach_approved` push tap goes to `/(tabs)` instead of `/(tabs)/create-team` — misses onboarding CTA | LOW | No |
| NF-03 | DEGRADED | `app/(tabs)/notifications/index.tsx:179` | `ORG_APPROVED` in-app tap bypasses `coach-agreement` — routes directly to `/(tabs)/create-team` | LOW | No |
| NF-04 | DEGRADED | All screens | No app icon badge count — `GET /notifications/unread-count` exists but is never called; `shouldSetBadge: false` hardcoded | MEDIUM | Yes (push config) |
| NF-05 | DEGRADED | `server/src/lib/notifications.ts`, `app/settings/index.tsx` | `team_updates` notification preference is a no-op — server accepts/stores but no push sender checks it | LOW | No |
| NF-06 | COSMETIC | `app/(tabs)/notifications/index.tsx` | Load-more errors are silent — pagination failure shows nothing to user | LOW | No |
| NF-07 | COSMETIC | `server/src/routes/notifications.ts` | `message_id` column comment says "doesn't exist in DB yet" but migration has already run | LOW | No |
| NF-08 | COSMETIC | `components/NotificationTapHandler.tsx` | `SHARE` and `JOIN_REQUEST_DENIED` have no push tap handlers — falls to default (no navigation) | LOW | No |
| NF-09 | COSMETIC | `app/(tabs)/notifications/index.tsx` | `refreshing` closure bug — both spinner and pull-to-refresh indicator show simultaneously | LOW | No |
| NF-10 | COSMETIC | `utils/pushNotifications.ts` | Dead code — exports `registerForPushNotifications` but nothing imports it | LOW | No |

---

## ADMIN DASHBOARD (15 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| ADM-01 | BLOCKING | `server/src/routes/admin.ts:409-435` | Transactions endpoints use weaker inline `requireAdmin` that skips `email_verified` check | LOW | Yes (middleware) |
| ADM-02 | DEGRADED | `server/src/routes/admin.ts:191,257` | `admin_email` field stores user UUID, not email — activity log shows UUIDs | LOW | No |
| ADM-03 | DEGRADED | `api/entities.ts:27-41` | `banned` filter toggle in admin-users is a no-op — param never appended to query string | LOW | No |
| ADM-04 | DEGRADED | `server/src/routes/users.ts:49-70` + `admin.ts:651` | Two ban routes do different things — `/users/:id/ban` bypasses audit log and ban email | MEDIUM | Yes (users route) |
| ADM-05 | DEGRADED | `app/admin-user-detail.tsx:54` | Moderation history errors silently swallowed — shows "No warnings" even if fetch failed | LOW | No |
| ADM-06 | DEGRADED | `app/admin-teams.tsx:73-77` | Bulk team delete reports success regardless of individual failures | LOW | No |
| ADM-07 | DEGRADED | `app/admin-activity-log.tsx` | Activity log capped at 50 entries — no pagination UI despite server supporting it | MEDIUM | No |
| ADM-08 | DEGRADED | `app/admin-activity-log.tsx` | Activity log search fires on every keystroke with no debounce | LOW | No |
| ADM-09 | DEGRADED | `app/admin-create-event.tsx` | Event creation endpoint `POST /games` is not admin-gated server-side — any auth user can call it | MEDIUM | Yes (games route) |
| ADM-10 | COSMETIC | `app/admin-users.tsx:38-48` | No confirmation before banning from user list (detail screen has confirm modal) | LOW | No |
| ADM-11 | COSMETIC | `app/admin-user-detail.tsx:129` | No confirmation before unbanning | LOW | No |
| ADM-12 | COSMETIC | `app/admin-reports.tsx` | Report single-item resolution has no note input — reporter email gets empty reason | LOW | No |
| ADM-13 | COSMETIC | `app/admin-transactions.tsx` | Race condition in `loadData` offset tracking — rapid "Load More" can duplicate records | LOW | No |
| ADM-14 | COSMETIC | `app/admin-transactions.tsx` | Summary card tries both snake_case and camelCase keys — suggests server response format is inconsistent | LOW | No |
| ADM-15 | COSMETIC | `app/admin-user-detail.tsx` | "Download Ads CSV" opens in WebBrowser, not as file download | LOW | No |

---

## PROFILE & SETTINGS (11 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| PS-01 | DEGRADED | `app/(tabs)/edit-profile.tsx:286` | Avatar/header upload shows "Success" alert but isn't persisted until Save — navigating away orphans the Cloudinary asset | LOW | No |
| PS-02 | DEGRADED | `app/profile.tsx:197-200` | Follow error is silent — state reverts but no Alert shown to user | LOW | No |
| PS-03 | DEGRADED | `app/(tabs)/edit-profile.tsx:418` | `display_name: null` sent when field cleared — server `z.string()` rejects null with type error (400) | LOW | No |
| PS-04 | DEGRADED | `app/profile.tsx` | Own profile returns `_count.followers`; other user returns flat `followers_count` — counts break for other users | LOW | No |
| PS-05 | DEGRADED | `app/settings/index.tsx:156-183` | Notification preference toggle errors don't revert local state (comment permission does — inconsistent) | LOW | No |
| PS-06 | COSMETIC | `app/settings/index.tsx:120-121` | Pending host requests fetched but never displayed (stored in `_pendingHostRequests`) | LOW | No |
| PS-07 | COSMETIC | `app/settings/blocked-users.tsx` | Single `loading` boolean causes full list disappearance during block/unblock | LOW | No |
| PS-08 | COSMETIC | `app/settings/zip-code.tsx:59` | Subtitle contains un-interpolated `{zip}` placeholder | LOW | No |
| PS-09 | COSMETIC | `app/settings/feedback.tsx:30-35` | `User.me()` called on mount but result discarded — wasted network request | LOW | No |
| PS-10 | COSMETIC | `app/(tabs)/followers.tsx`, `following.tsx` | Display and search only use `display_name` — users with no display_name are blank and un-searchable | LOW | No |
| PS-11 | COSMETIC | `server/src/routes/users.ts:658-660` | `username-available` checks `display_name OR username` but `PUT /me` only enforces uniqueness by `username` | LOW | Yes (users route) |

---

## EVENTS & SEASONS (15 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| EV-01 | BLOCKING | `app/create-fan-event.tsx` → `POST /games` | Fan events bypass 3-event pending limit — limit only enforced in `POST /events`, not `POST /games` | MEDIUM | Yes (games route) |
| EV-02 | BLOCKING | `app/manage-season.tsx:205` | All games hardcoded to `status: 'upcoming'` after conversion — completed/cancelled games appear as upcoming | LOW | No |
| EV-03 | DEGRADED | `app/(tabs)/event-detail.tsx:340` | Edit button gated on `can_cancel` — coaches with edit permission can't see the button (server allows broader roles) | LOW | No |
| EV-04 | DEGRADED | `app/(tabs)/edit-event.tsx` | Edit form always sends `title` — coaches editing approved events get 403 `Limited edit scope` | LOW | No |
| EV-05 | DEGRADED | `app/public-event.tsx:105-109` | Error path fills screen with fake Unsplash posts for real events on any network error | LOW | No |
| EV-06 | DEGRADED | `app/(tabs)/event-detail.tsx:131-143` | RSVP capacity-full (403) has no specific handler — user gets generic "Unable to update RSVP" | LOW | No |
| EV-07 | DEGRADED | `app/manage-season.tsx`, `season-stats.tsx` | Both fetch 100 games globally without team ID filter — coaches miss their own games in large leagues | HIGH | Yes (games API) |
| EV-08 | DEGRADED | `app/manage-season.tsx` | Standings and Playoffs tabs show entirely static hardcoded data — not labeled as placeholder | LOW | No |
| EV-09 | DEGRADED | `server/src/routes/games.ts` (`PUT /:id/approve`) | Game rejection sends no reason, no email, no in-app notification body — unlike event rejection | MEDIUM | No |
| EV-10 | COSMETIC | `app/create-fan-event.tsx:342-346` | Success message says "submitted for review" even for auto-approved coach events | LOW | No |
| EV-11 | COSMETIC | `app/(tabs)/edit-event.tsx` | Date field is raw text input — no native picker, inconsistent with `create-fan-event.tsx` | LOW | No |
| EV-12 | COSMETIC | `app/public-event.tsx:81,93` | `Event.get(eventId)` called twice for real events with linked games | LOW | No |
| EV-13 | COSMETIC | `app/rsvp-history.tsx` | RSVP history silently drops items where `event.date` is null | LOW | No |
| EV-14 | COSMETIC | `app/rsvp-history.tsx` | "Filter by date" only offers today — no arbitrary date picker | LOW | No |
| EV-15 | COSMETIC | `app/manage-season.tsx` | `_seasonStats` computed but never rendered — display uses static mock data | LOW | No |

---

## FEED & CONTENT (12 issues)

| ID | Severity | File(s) | Root Cause | Complexity | Shared? |
|----|----------|---------|------------|------------|---------|
| FD-01 | BLOCKING | `server/src/routes/gameStories.ts:~136` | `include_expired` param mismatch — client sends `true`, server checks `=== '1'` — creator's expired stories never returned | LOW | No |
| FD-02 | DEGRADED | `app/feed.tsx:~44-55` | 30 parallel RSVP status calls on every feed load — one per game card, no batching | HIGH | Yes (events API) |
| FD-03 | DEGRADED | `app/feed.tsx:310-326` | Followed-feeds have no pagination — only 20 items loaded, no load-more | MEDIUM | No |
| FD-04 | DEGRADED | `app/post-detail.tsx:241-254` | Comments have no pagination — `nextCursor` from server is never stored or used | MEDIUM | No |
| FD-05 | DEGRADED | `app/post-detail.tsx:377-396` | Comment count not updated after posting a comment — stale until re-mount | LOW | No |
| FD-06 | DEGRADED | `app/game-highlights.tsx:~36`, `game-reviews.tsx:~35` | `_loadMore` has no concurrency guard — rapid scroll fires duplicate requests, can double-append | LOW | No |
| FD-07 | DEGRADED | `app/game-reviews.tsx:64-70` | Review cards have no tap-to-navigate — tapping does nothing | LOW | No |
| FD-08 | DEGRADED | `app/highlights.tsx:453-498` | Global search fires on every keystroke without debounce or abort — races cause stale results | LOW | No |
| FD-09 | COSMETIC | `server/src/routes/games.ts:325-390` | Game list cursor is ID-based on date-sorted results — can split same-date games across pages | MEDIUM | Yes (games route) |
| FD-10 | COSMETIC | `app/feed.tsx:293-322` | Sequential game fetch before parallel social-feed batch — adds one RTT to cold-load | LOW | No |
| FD-11 | COSMETIC | `app/feed.tsx:1029-1035`, `components/BannerAd.tsx:147-185` | Ads without `banner_url` show different placeholder icons in feed vs BannerAd component | LOW | No |
| FD-12 | COSMETIC | `app/(tabs)/create-post.tsx:~681`, `server/src/routes/posts.ts:513-529` | Client sends `preview_url` but server schema drops it — server derives it independently | LOW | No |

---

## TOTALS

### By Feature
| Feature | BLOCKING | DEGRADED | COSMETIC | Total |
|---------|----------|----------|----------|-------|
| Auth & Account | 1 | 4 | 6 | 11 |
| Coach Onboarding | 0 | 0 | 7 | 7 |
| Approval Process | 0 | 7 | 10 | 17 |
| Ad Hosting | 3 | 4 | 4 | 11 |
| Geofencing | 0 | 5 | 2 | 7 |
| Teams & Orgs | 4 | 5 | 3 | 12 |
| Messaging | 1 | 3 | 5 | 9 |
| Payments & Billing | 2 | 5 | 3 | 10 |
| Notifications | 1 | 4 | 5 | 10 |
| Admin Dashboard | 1 | 8 | 6 | 15 |
| Profile & Settings | 0 | 5 | 6 | 11 |
| Events & Seasons | 2 | 7 | 6 | 15 |
| Feed & Content | 1 | 7 | 4 | 12 |
| **TOTAL** | **16** | **64** | **67** | **147** |

### By Severity
| Severity | Count |
|----------|-------|
| BLOCKING | 16 |
| DEGRADED | 64 |
| COSMETIC | 67 |
| **Total** | **147** |

---

## SHARED CODE — Bugs That Touch Multiple Features

| Bug ID | Shared Resource | Features Affected |
|--------|----------------|-------------------|
| AD-01 | `server/src/utils/adPricing.ts` | Ad Hosting, Payments |
| AD-02, AD-07 | `server/src/routes/payments.ts` | Ad Hosting, Payments |
| TM-03, EV-07, FD-09, ADM-09 | `server/src/routes/games.ts` (no team filter, cursor, admin gate) | Teams, Events, Feed, Admin |
| TM-06 | `server/src/routes/teams.ts` (no org filter) | Teams, Orgs |
| NF-01 | `server/src/routes/games.ts` (wrong meta key) | Notifications, Events |
| AP-10, ADM-01 | Server middleware (inconsistent auth level) | Approvals, Admin |
| AUTH-03 | `app/verify-identity.tsx` → `context/AuthProvider.tsx` | Auth, Onboarding |
| AUTH-05 | `api/auth.ts`, `context/AuthProvider.tsx` | Auth (all screens) |
| OB-07 | `context/AuthProvider.tsx` | Onboarding (all screens) |
| PS-11, MSG-05 | `server/src/routes/users.ts` | Profile, Messaging |
| PAY-10 | `hooks/useIAP.ts` | Payments, Ads |
| NF-04 | Push notification config | Notifications (all screens) |
| FD-02 | Events RSVP API (no batch endpoint) | Feed, Events |

---

## PRISMA MIGRATIONS REQUIRED

| Bug ID | Migration |
|--------|-----------|
| TM-05 | Add `season` to teams GET response (no schema change — query change) |
| AP-06 | Already done in this PR (`rejection_reason` column) |
| None new | No additional migrations identified |

---

## NATIVE EAS REBUILD REQUIRED (Not OTA-Safe)

| Bug ID | Reason |
|--------|--------|
| Already in PR | `withIAPContext` wrapper (ADS-01 from Phase 3 fixes) |
| No new items | All remaining bugs are OTA-safe |
