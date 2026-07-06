# VarsityHub Full UAT Checklist

Organized by user journey.

- `P0` = ship-blocker
- `P1` = important
- `P2` = nice-to-have
- `⚡` = recently changed this session, prioritize
- `📱` = device-only, not reliably testable in simulator/CI

## 1. Auth & Account

### 1.1 Sign-up (P0)

- [ ] ⚡ Email/password sign-up creates account, sends verification email from `noreply@varsityhub.app`
- [ ] Google OAuth sign-up on Android and iOS
- [ ] 📱 Apple Sign-In sign-up
- [ ] Verification email arrives, 6-digit code works, code expires after window
- [ ] Resend verification works and is rate-limited
- [ ] Duplicate email is blocked with a clear error

### 1.2 Sign-in (P0)

- [ ] ⚡ Email/password sign-in routes to the correct post-auth screen through `getPostAuthRouteDecision`
- [ ] Google OAuth sign-in
- [ ] 📱 Apple Sign-In sign-in
- [ ] Wrong password shows an error and does not leak whether the email exists
- [ ] ⚡ Signed-in user attempting to sign in as another user is blocked with `Sign out before signing in to a different account`
- [ ] ⚡ All four paths enforce the account-boundary guard

### 1.3 Sign-out (P0)

- [ ] Sign-out clears session, push token, and navigates to `/sign-in`
- [ ] After sign-out, `/me` returns `401`
- [ ] After sign-out, push notifications stop arriving on this device

### 1.4 Password reset (P1)

- [ ] Forgot-password sends reset email from `noreply@` with a 6-digit code
- [ ] Code-based reset flow completes
- [ ] Old password no longer works

### 1.5 Email verification states (P1)

- [ ] Unverified user routes to `/verify`
- [ ] Verified user with no role routes to `/onboarding/step-1-role`

## 2. Onboarding

### 2.1 Fan path (P0)

- [ ] `step-1-role`: pick `Fan` and continue to `step-2-basic`
- [ ] `step-2-basic`: enter name and zip, complete onboarding
- [ ] User lands on `/(tabs)` feed

### 2.2 Coach path: create new league (P0) ⚡

- [ ] `step-1-role`: pick `Coach` and continue to `step-2-basic`
- [ ] `step-2-basic` continues to `step-3-league`
- [ ] Choose `Create new league`, fill org details, submit
- [ ] User reaches league-pending-approval screen
- [ ] Admin notification email arrives at `customerservice@varsityhub.app` with org details
- [ ] Admin approves, coach receives approval email from `noreply@`, app swaps to `You're Approved!` within about 2 seconds of foregrounding
- [ ] `Continue Coach Setup` goes to `/onboarding/coach-agreement`
- [ ] Accepting the agreement enters the app

### 2.3 Coach path: join existing league (P0) ⚡

- [ ] Zero-org empty state renders correctly on `Join existing`
- [ ] Search for an existing org returns results
- [ ] Request to join submits successfully
- [ ] User reaches pending-approval screen
- [ ] League owner receives `Coach Request` email and push
- [ ] Owner approves and coach swaps to approved, then coach agreement, then app access
- [ ] Owner rejects and coach sees rejected state
- [ ] Rejected coach cannot reapply within the 48-hour cooldown
- [ ] Reapply works after 48 hours

### 2.4 Approval-during-pending race (P0) ⚡

- [ ] Coach on pending screen foregrounds app after backend approval and screen swaps without manual reload
- [ ] Same for backend rejection

### 2.5 Locked-role and direct entry (P1) ⚡

- [ ] User with a locked prior role resumes at the correct step with no dead end
- [ ] User with an existing org is not sent blindly back through `step-3`

### 2.6 `Proceed as fan` escape (P1)

- [ ] Pending coach can use the app as a fan
- [ ] Pending coach can later return to coach flow without losing application state

## 3. Profile & Settings

### 3.1 Profile (P0)

- [ ] View own profile with avatar, display name, bio, posts, and teams
- [ ] Edit profile, including avatar upload, display name, bio, and persistence
- [ ] View another user's profile at `/user-profile`
- [ ] Follow and unfollow another user
- [ ] Followers and Following lists load and paginate

### 3.2 Settings menu (P1)

- [ ] Settings index renders all sections
- [ ] Manage subscription works
- [ ] Billing history loads past charges
- [ ] Notification toggles persist
- [ ] Privacy Policy, Terms, DMCA, and Core Values open correctly
- [ ] Username edit enforces uniqueness
- [ ] Reset password from inside settings requires re-auth
- [ ] Zip code change updates feed scope
- [ ] Followed teams and favorites lists render
- [ ] Blocked users list renders and unblock works
- [ ] DM restrictions toggle persists
- [ ] Data export request submits and status reflects correctly
- [ ] Feedback form submits and lands in `customerservice@` from `noreply@`

### 3.3 Account deletion (P0)

- [ ] Delete account requires re-auth
- [ ] Deleted account can no longer sign in
- [ ] Push tokens are cleared

## 4. Teams & Organizations

### 4.1 Org owner side (P0)

- [ ] Create team within own org and see it in the team list
- [ ] Edit org details including name, sport, and logo
- [ ] Invite a coach via email and receive the invite from `noreply@`
- [ ] Invite link routes recipient into accept flow whether signed in or not
- [ ] Invite acceptance grants the correct role
- [ ] Organization join requests page lists pending coach requests
- [ ] Approve and reject join requests and confirm coach gets notification

### 4.2 Coach side (P0)

- [ ] Joined coach can view team hub, roster, and schedule
- [ ] Joined coach can create a new game or event for own team
- [ ] Joined coach can edit team within scope, edit roster, and invite parents or players

### 4.3 Member removal and role changes (P1)

- [ ] Removing a member revokes access
- [ ] Demoting a coach updates role correctly
- [ ] Owner role cannot be granted through generic membership or invite endpoints and returns `403`

### 4.4 Plan limits (P1)

- [ ] Rookie plan blocks or paywalls the 5th team
- [ ] Veteran plan respects 100-roster and 5-authorized-user limits
- [ ] Legend plan behaves as unlimited

## 5. Posts & Feed

### 5.1 Feed (P0)

- [ ] Feed loads, scrolls, and pull-to-refresh works
- [ ] Posts render correctly for text, images, videos, and embedded events
- [ ] Geographic scope respects zip code filter
- [ ] Ads interleave correctly

### 5.2 Create post (P0)

- [ ] Text post submits
- [ ] Image post uploads through Cloudinary direct and falls back through proxy if direct fails
- [ ] Video post uploads, transcodes, and plays in feed
- [ ] Tagging a team or event works
- [ ] Post creation is still gated by `requireOnboarded`

### 5.3 Post interactions (P1)

- [ ] Like and unlike persist
- [ ] Add, edit, and delete own comment
- [ ] Reply threading works
- [ ] Share generates a deep link to `/post-detail`
- [ ] Report post reaches admin notification flow
- [ ] Delete own post works

### 5.4 Post detail (P1)

- [ ] Direct link to post detail works on cold start and from background
- [ ] Comments load and paginate

## 6. Events & Games

### 6.1 Create event (P0)

- [ ] Coach can create an event with team context and RSVP enabled
- [ ] Fan can create a community event
- [ ] Geocoding fills `lat/lng` from address
- [ ] Event approval flow works end to end, including approval email, rejection email, and in-app visibility

### 6.2 Event interactions (P0)

- [ ] RSVP `yes/no/maybe` persists
- [ ] RSVP history appears in profile
- [ ] Event detail loads with map, RSVPs, and comments
- [ ] Event polls work on event-only events and do not fall back incorrectly to `eventId`
- [ ] Event-canceled email reaches RSVP'd users

### 6.3 Games (P0)

- [ ] Game detail page renders score, plays, photos, highlights, and reviews
- [ ] Add play is enforced server-side by team membership
- [ ] Game stories work
- [ ] Game photos upload and display
- [ ] Game reviews submit
- [ ] Game highlights play

### 6.4 Tournaments (P1)

- [ ] Tournament list, detail, and bracket render

## 7. Payments & Subscriptions

### 7.1 Subscription paywall (P0) 📱

- [ ] Paywall appears for the right user states
- [ ] iOS shows Apple IAP only and no Stripe links
- [ ] Android uses Stripe PaymentSheet

### 7.2 Apple IAP (P0) 📱

- [ ] Veteran monthly purchase succeeds and upgrades immediately
- [ ] Legend yearly purchase succeeds
- [ ] Receipt validation is enforced server-side through Apple
- [ ] Restore purchases works across install or device

### 7.3 Stripe on Android (P0)

- [ ] PaymentSheet opens and completes
- [ ] Webhook updates subscription state server-side
- [ ] Failed payment sends `sendBillingNoticeEmail(payment_failed)` from `noreply@`
- [ ] Trial ending sends `sendBillingNoticeEmail(trial_ending)` from `noreply@`

### 7.4 Subscription management (P1)

### 7.5 Ad booking (P0) 📱

- [ ] Draft ad can be submitted for approval and moves to pending review
- [ ] Approved ad can be booked again without re-entering the approval flow
- [ ] Archived but previously approved ad can be booked again
- [ ] Past dates are rejected before checkout starts
- [ ] Fully booked dates are blocked with a clear error
- [ ] iOS ad checkout uses Apple IAP only for `MOND_THURS` and `FRI_SUN`
- [ ] Android ad checkout uses Stripe PaymentSheet and does not depend on Play ad IAP SKUs
- [ ] Successful payment activates the ad and reserves the selected dates
- [ ] Failed or canceled payment releases held dates back to available inventory

- [ ] Manage subscription shows current plan and renewal date
- [ ] Cancel works on iOS through App Store sub page and on Android in-app
- [ ] Resume and tier changes work

### 7.5 Ad payments (P0)

- [ ] Failed checkout holds are fatal with no partial bookings
- [ ] Successful ad payment routes to `/payment-success` and creates booking

## 8. Ads

### 8.1 Book an ad (P0)

- [ ] Any signed-in user can submit an ad with no plan or role gate
- [ ] Submit-ad form accepts business info, banner upload at `<= 5MB`, zip targeting, and date range
- [ ] Booking horizon beyond 56 days returns `400`
- [ ] Ad calendar shows available slots in zip
- [ ] Submit-for-approval triggers admin email from `noreply@` with approve and reject buttons
- [ ] Payment holds succeed

### 8.2 Admin moderation (P0)

- [ ] Admin sees pending ads in admin-ads
- [ ] Approve sends approval email and ad goes live
- [ ] Reject sends rejection email with reason
- [ ] Takedown after live sends takedown email

### 8.3 My ads (P1)

- [ ] My Ads lists user's ads with status
- [ ] Editing own ad re-triggers approval if text or image changed
- [ ] Deleting own ad works

### 8.4 Ad in feed (P1)

- [ ] Ad renders in feed at the correct cadence
- [ ] Tapping tracks impression and click
- [ ] Reporting an ad reaches admin queue

## 9. Messaging

### 9.1 Direct messages (P1)

- [ ] Open existing thread
- [ ] Send text and image messages
- [ ] Receive message in real time or next foreground
- [ ] Read receipts work
- [ ] Blocking from a thread works

### 9.2 Group chats (P1)

- [ ] Create group chat
- [ ] Add and remove members
- [ ] Leave group
- [ ] Group thread renders correctly

### 9.3 DM restrictions (P2)

- [ ] Restriction-enabled user cannot be DM'd by strangers
- [ ] Settings toggle persists

## 10. Notifications

### 10.1 In-app (P1)

- [ ] Notifications tab lists items and paginates
- [ ] Tapping a notification deep-links to the correct screen
- [ ] Mark-as-read works

### 10.2 Push (P0) 📱

- [ ] Push permission is prompted on the first relevant action
- [ ] Push token registers server-side after sign-in
- [ ] ⚡ Push token de-dup clears prior user's token when a different user signs in on the same device
- [ ] Push arrives for comment, RSVP, coach approval, ad approval, and message
- [ ] Tapping a push opens the correct deep-link target
- [ ] Push works from cold start, not just background

## 11. Search & Discovery

### 11.1 Search (P1)

- [ ] Search finds users, teams, orgs, and posts
- [ ] Trigram-backed results are relevant and not obviously slow
- [ ] Empty query and zero-result states render gracefully

### 11.2 Discover tab (P1)

- [ ] Discover renders feeds such as trending and nearby
- [ ] Filters work

## 12. Admin Dashboard

### 12.1 Access control (P0)

- [ ] Non-admin user cannot see admin tabs and gets `403` on admin endpoints
- [ ] Admin in `ADMIN_EMAILS` sees admin section

### 12.2 Admin queues (P0) ⚡

- [ ] Coach Applications approve and reject works and sends correct emails
- [ ] League Approvals approve and reject sends emails to org owner
- [ ] Ad Moderation approve, reject, and takedown work
- [ ] Event Approvals work
- [ ] Reports queue renders and functions

### 12.3 Admin tooling (P1)

- [ ] User detail page loads and allows suspend, role change, and activity view
- [ ] Activity log is chronological
- [ ] Metrics dashboard works
- [ ] Transactions log works
- [ ] Admin broadcast or admin messages tooling works if present

## 13. Cross-cutting Concerns

### 13.1 Deep links (P0) ⚡

- [ ] Cold-start deep link opens the correct post-auth screen
- [ ] ⚡ Deep links older than 5 minutes are not consumed
- [ ] Deep link to a deleted resource fails gracefully with a 404-style screen instead of crashing

### 13.2 Dark mode (P1)

- [ ] Dark mode toggle works in settings
- [ ] All screens remain readable in light and dark mode
- [ ] No legibility regressions from hardcoded text colors

### 13.3 Offline behavior (P1)

- [ ] Offline banner appears when network drops
- [ ] Queued actions retry on reconnect or fail clearly
- [ ] `OfflineBanner` dynamic-imports `@react-native-community/netinfo` safely

### 13.4 OTA updates (P0) 📱

- [ ] App Store binary `runtimeVersion` matches what production OTA published
- [ ] OTA downloads in background and applies on second cold start
- [ ] Newly added native modules use safe dynamic import when needed

### 13.5 Permissions (P0) 📱

- [ ] Camera prompt and denial fallback work
- [ ] Photo library prompt and denial fallback work
- [ ] Location prompt and denial fallback work
- [ ] Push permission prompt and denial fallback work

### 13.6 Session enforcement (P0) ⚡

- [ ] Token expiry auto signs out
- [ ] Backend session-enforcement test remains green
- [ ] Two-device sign-in behavior matches product design

## 14. Email Deliverability Spot Checks

Trigger each and confirm inbox arrival plus the correct `From` line.

- [ ] Verification on sign-up
- [ ] Password reset
- [ ] Team invite
- [ ] Org invite
- [ ] Billing `payment_failed`
- [ ] Billing `trial_ending`
- [ ] Coach join request to org owner
- [ ] Coach application admin email to `customerservice@`
- [ ] League approval request to `customerservice@`
- [ ] League approved to owner
- [ ] League rejected to owner
- [ ] Coach approved to coach
- [ ] Coach rejected to coach
- [ ] Admin action confirmation
- [ ] Ad pending review to `customerservice@`
- [ ] Ad approved
- [ ] Ad rejected
- [ ] Ad taken down pending review
- [ ] Event approved
- [ ] Event denied
- [ ] Event canceled
- [ ] Parental consent request

Validation rule:

- [ ] Every email `From` line reads `noreply@varsityhub.app`
- [ ] No `customerservice@` sender regressions

## 15. Backend-only / API Regression

- [ ] `npm --prefix server test` is green
- [ ] `npx tsc --noEmit --project server/tsconfig.json` has no new errors
- [ ] `findMany` usage audit does not reveal new unbounded queries
- [ ] `req.user` route audit does not reveal new missing auth guards
- [ ] Direct `sgMail.send` remains isolated to the email provider path
- [ ] `DISABLE_RATE_LIMITING=1` is not set in Railway
- [ ] `ALLOW_APPLE_SIM_TOKENS=1` is not set in Railway

## Test Environment Guide

| Where                     | What is realistic                                   |
| ------------------------- | --------------------------------------------------- |
| Simulator / emulator      | Most UI flows, sign-in, onboarding, posts, events   |
| Dev client on real device | Everything above plus push and OAuth                |
| TestFlight build          | Device-only flows including IAP sandbox, push, OTA  |
| Production install        | Real IAP charges, full OTA flow, real notifications |

## Triage Suggestion

### If you only have 15 minutes

- [ ] §1.1 Sign-up
- [ ] §1.2 Sign-in boundary guard
- [ ] §2.2 or §2.3 one end-to-end coach onboarding flow
- [ ] §10.2 Push de-dup
- [ ] §12.2 One admin approval round-trip

### If you have 2 hours

- [ ] Everything above
- [ ] §3 Profile and Settings
- [ ] §5 Posts and Feed
- [ ] §7 One IAP purchase
- [ ] §8 One ad submission round-trip
- [ ] §13.1 One deep link

### For full UAT

- [ ] Work top to bottom
- [ ] Record every `❌` with screen, account, platform, and repro
