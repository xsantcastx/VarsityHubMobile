# VarsityHub — Pre-Build QA Checklist
> Updated 2026-03-28. Run through every section before any App Store submission.
> Legend: ✅ Pass · ❌ Fail · ⚠️ Warning / Partial

---

## 1. AUTH FLOWS

### Email / Password
- [ ] Register with new email → 6-digit verification code arrives
- [ ] Wrong verification code → specific error shown
- [ ] Correct code → proceeds to onboarding
- [ ] Login with verified account → reaches home feed
- [ ] Login with **unverified** account → redirected to /verify (not home)
- [ ] Forgot password → reset email arrives, link works
- [ ] Reset password → new password accepted, old one rejected
- [ ] Wrong password → friendly error, not a crash
- [ ] Non-existent email → friendly error
- [ ] Repeated failed logins → 429 rate-limit message shown to user

### Apple Sign-In
- [ ] Button visible on iOS only
- [ ] Tap → system sheet appears
- [ ] Complete → account created or logged in
- [ ] Private relay email → accepted, not rejected
- [ ] Existing email-account → merged, not duplicated

### Google Sign-In (**requires new native build v1.1.1+**)
- [ ] Button enabled (not "temporarily unavailable")
- [ ] Tap → browser opens Google consent page
- [ ] Complete → redirected back to app via `com.googleusercontent.apps.*` scheme
- [ ] Existing account with same email → merged
- [ ] Cancel mid-flow → returns to sign-in gracefully (no crash)

### Session Management
- [ ] Logout → token cleared, redirected to sign-in
- [ ] Silent token refresh works (no involuntary logout on 401)
- [ ] Session persists across full app restarts
- [ ] Expired refresh token → graceful redirect to sign-in, not crash

---

## 2. ONBOARDING

### Fan (2 steps)
- [ ] Step 1: select Fan → continues
- [ ] Step 2: username + DOB + zip → Continue enabled only when all valid
- [ ] Keyboard does not cover inputs on **iOS** and **Android**
- [ ] Back on step 2 → returns to step 1
- [ ] Complete → home feed

### Coach (3 steps)
- [ ] Step 1: select Coach → continues
- [ ] Step 2: username + DOB + zip
- [ ] Step 3: league name + org selection
- [ ] Submit → pending-approval screen
- [ ] Pending screen polls every 10 s
- [ ] Admin approves → approved UI shown without requiring app restart
- [ ] Admin rejects → rejected UI shown
- [ ] "Continue as Fan" → completes onboarding as fan
- [ ] After approval: "View Your Organization" navigates correctly

### Guards
- [ ] Cannot reach (tabs) without completing onboarding
- [ ] Unverified user cannot complete onboarding
- [ ] Back on step 1 → stays inside onboarding (no escape)

---

## 3. HOME FEED

- [ ] Feed loads on first open (< 2 s)
- [ ] Pull-to-refresh works
- [ ] Sponsored ad shown when location is set
- [ ] No ad shown when location unknown
- [ ] Upvote → count increments, persists on reload
- [ ] Comment tap → comment thread opens
- [ ] Share tap → share sheet appears
- [ ] Scroll to bottom → next page loads (no duplicate items)
- [ ] Empty state shown when no posts available

---

## 4. DISCOVER / COMMUNITY

- [ ] Posts section loads
- [ ] People section loads
- [ ] **Both load in parallel** (no sequential wait — verify in Railway logs)
- [ ] School / league / zip personalization correct
- [ ] Search bar filters results

---

## 5. CREATE POST

- [ ] Text-only post → submits
- [ ] Image from library → uploads, thumbnail shown
- [ ] Image from camera → uploads
- [ ] Video from library → compresses (check file size), uploads, preview plays
- [ ] Video from camera → `videoExportPreset` applied (iOS), compresses, uploads
- [ ] Video > 100 MB → blocked with error message
- [ ] Video > 30 s → rejected at picker
- [ ] Tag a game → game linked in post
- [ ] Posting outside event window → warning shown (not hard block)
- [ ] Geofence > 3 km → warning shown
- [ ] Submit → post visible in feed
- [ ] Cancel → no draft saved, navigates back

---

## 6. POST DETAIL

- [ ] Opens from feed
- [ ] Images/videos display
- [ ] Comments load
- [ ] Add comment → appears immediately
- [ ] Reply to comment → thread expands
- [ ] Upvote → count updates
- [ ] Author tap → navigates to author's profile
- [ ] Report → sends abuse report

---

## 7. GAMES & MAP

- [ ] Map screen opens
- [ ] **Map auto-centers on user location** (not USA center) on open
- [ ] Location button → re-centers on user
- [ ] "Fit events" → zooms to show all markers
- [ ] Tap marker → game detail sheet
- [ ] RSVP → count updates; cancel RSVP → count decreases
- [ ] Vote for winning team → vote saved
- [ ] Highlights load on game detail

---

## 8. TEAMS

### Create
- [ ] All fields validate
- [ ] Logo upload → preview shown
- [ ] Submit → team created, navigates to team hub
- [ ] **Rookie plan: 3rd team blocked** (enforced server-side)
- [ ] Veteran/Legend: no limit

### Hub
- [ ] Team profile loads
- [ ] Roster list loads
- [ ] Edit team (coach/owner only) → saves
- [ ] Delete team (owner only) → confirmation → deleted

### Roster
- [ ] Invite by username → invite sent
- [ ] Accept invite → appears on roster
- [ ] Remove player → gone from roster
- [ ] Change role → updates
- [ ] Roster limit per plan enforced

### Invites
- [ ] TEAM_INVITE notification received
- [ ] Accept → joins team
- [ ] Decline → invite removed

---

## 9. ORGANIZATIONS (Leagues)

- [ ] Org page loads when `?id=` present in URL
- [ ] Org page falls back to `Organization.mine()` when no id → loads own org
- [ ] Invalid / nonexistent org id → 404 screen (not blank)
- [ ] Railway logs show `[org-get] id=… user=…` on every visit
- [ ] Members list loads
- [ ] Follow / unfollow → count updates
- [ ] Edit org (owner) → saves
- [ ] Join request → admin notified via `[notif]` log
- [ ] Admin approves join request → coach gets JOIN_REQUEST_APPROVED notification

---

## 10. PROFILE

- [ ] Own profile: avatar, username, bio, post count, follower/following counts
- [ ] Other user's profile loads
- [ ] **Follower count tappable → followers list** (paginated, searchable)
- [ ] **Following count tappable → following list** (paginated, searchable)
- [ ] Follow / unfollow → counts update in real time
- [ ] Posts grid loads
- [ ] Edit profile → avatar, bio, username all save

---

## 11. NOTIFICATIONS (test each type)

In-app notification center:
- [ ] FOLLOW — someone follows you
- [ ] UPVOTE — post upvoted
- [ ] COMMENT — post commented
- [ ] COMMENT_REPLY — comment replied
- [ ] MENTION — @mentioned in post
- [ ] TEAM_INVITE — invited to team
- [ ] TEAM_INVITE_ACCEPTED — invite accepted
- [ ] GAME_REMINDER — game starting soon
- [ ] JOIN_REQUEST_APPROVED — coach application approved
- [ ] COACH_REJECTED — application rejected
- [ ] AD_APPROVED — ad approved
- [ ] AD_REJECTED — ad rejected
- [ ] ORG_APPROVED — org approved

Behavior:
- [ ] Unread badge shows on tab
- [ ] Mark all read → badge clears
- [ ] Tap notification → correct screen opens
- [ ] Push notification arrives when app is backgrounded
- [ ] Push tap → correct deep link
- [ ] Railway logs show `[notif] push sent …` for every push

---

## 12. MESSAGES

- [ ] DM list loads
- [ ] Tap thread → opens
- [ ] Send message → appears instantly
- [ ] Unread count badge on tab
- [ ] Group chat loads
- [ ] Send in group → all members receive

---

## 13. ADVERTISEMENTS

### Advertiser (Veteran/Legend only)
- [ ] Rookie tries to create ad → blocked with "plan required" error
- [ ] Ad form validates: business name, email, banner URL, zip code
- [ ] Upload banner → preview shown
- [ ] Submit for approval → pending in My Ads; admin email arrives
- [ ] Ad approval pending → Railway log shows `[ads] for-feed` correctly excluding unpaid ad

### Admin Review
- [ ] Pending ad visible in admin dashboard
- [ ] Approve → status = active, advertiser notified
- [ ] Reject with note → status = rejected, note in email

### Payment
- [ ] Book dates → Stripe payment sheet opens
- [ ] Complete payment → ad status = active
- [ ] Failed payment → ad stays draft

### Feed Display
- [ ] Active ad shown to user **inside** target zip (within 9 km)
- [ ] Active ad **NOT** shown to user outside target zip
- [ ] DB-level bounding box working: Railway log shows `take: 20` result not 50
- [ ] Startup backfill: Railway log shows `[ads] backfill: done` on first deploy

---

## 14. PAYMENTS & SUBSCRIPTIONS

### Stripe (Android)
- [ ] Upgrade → PaymentSheet opens
- [ ] Valid card → success; plan updates immediately
- [ ] Cancel subscription → downgraded at period end

### Apple IAP (iOS)
- [ ] Upgrade → Apple purchase sheet
- [ ] Complete → plan updates
- [ ] Restore purchases → plan restored

### Plan Enforcement (server-side)
- [ ] Rookie: cannot create 3rd team
- [ ] Rookie: cannot create ads
- [ ] Veteran/Legend: no team limit

---

## 15. SETTINGS

- [ ] Edit username → unique check passes, saves
- [ ] Change zip → location updates across app
- [ ] Reset password → email sent
- [ ] Blocked users → unblock works
- [ ] Followed teams → unfollow works
- [ ] RSVP history → shows past RSVPs
- [ ] Privacy Policy / ToS / Core Values → open correctly
- [ ] Logout → session cleared

---

## 16. ADMIN

- [ ] Non-admin cannot reach admin screens (403 returned)
- [ ] Dashboard: user / post / team counts load
- [ ] Ban / warn user → action logged in activity log
- [ ] Coach approval queue → approve / reject
- [ ] Ad review queue → approve / reject
- [ ] Transaction log → payment records present
- [ ] Activity log → recent admin actions shown

---

## 17. EMAIL DELIVERY (send and verify each)

| Email | Trigger | Check |
|-------|---------|-------|
| Verification code | Register | Code present, legible |
| Password reset | Forgot password | Link works, expires after use |
| Password changed | Change password | Security alert arrives |
| Join request approved (league owner) | Admin approves coach | Arrives to coach |
| Join request approved (admin) | Admin route approves | Arrives to coach |
| Ad pending review | Advertiser submits | Arrives to admin email |
| Ad approved | Admin approves ad | Arrives to advertiser |
| Ad rejected | Admin rejects ad | Note included |
| Event approved | Admin approves event | Arrives to organizer |
| Event rejected | Admin rejects event | Arrives to organizer |

---

## 18. KEYBOARD / INPUT (both iOS and Android)

- [ ] Sign-in: keyboard doesn't cover password field
- [ ] Sign-up: keyboard doesn't cover any input
- [ ] Onboarding steps: keyboard doesn't cover inputs
- [ ] Create post: text box scrolls above keyboard
- [ ] Comment input: visible above keyboard
- [ ] Message input: visible above keyboard

---

## 19. NAVIGATION & BACK

- [ ] Back button on every sub-screen works
- [ ] Android hardware back button correct on all screens
- [ ] Edge-swipe back (iOS) on non-FlatList screens
- [ ] Deep link `/organization?id=xxx` loads org page
- [ ] Deep link `/profile/xxx` loads user profile

---

## 20. PERFORMANCE & EDGE CASES

- [ ] Cold start < 3 s on a 3-year-old device
- [ ] Discover loads < 2 s (parallel fetch, not sequential)
- [ ] Map renders without blocking tab navigation
- [ ] Video upload: progress bar moves, doesn't freeze
- [ ] Offline: OfflineBanner visible, no crash
- [ ] Railway 502: "Server temporarily unavailable" shown, not crash

---

## 21. SECURITY SPOT-CHECKS

- [ ] Unauthenticated user cannot reach (tabs)
- [ ] Unauthenticated user cannot reach (tabs) even by navigating directly
- [ ] Unverified user cannot create posts / teams / ads
- [ ] Cannot approve own join request
- [ ] Cannot access admin routes as fan or coach

---

## 22. REACTOTRON (dev builds only)

- [ ] Reactotron desktop app running on dev machine
- [ ] `HOST` in `ReactotronConfig.ts` set to your machine's LAN IP
- [ ] Every API call appears in Reactotron's Network tab
- [ ] `console.tron.log('test')` output appears in Reactotron

---

## 23. SENTRY VERIFICATION

- [ ] Trigger a test error in staging → appears in Sentry < 5 min
- [ ] Sentry project: `varsityhub` (org: `lime-productions`)
- [ ] Backend `SENTRY_DSN` set in Railway env vars
- [ ] No unhandled promise rejections in Railway logs

---

## PRE-SUBMISSION BUILD CHECKLIST

- [ ] `version` incremented in app.config.js if needed
- [ ] `buildNumber` auto-incremented via `autoIncrement: true` in eas.json
- [ ] Google client IDs present in eas.json production env → `withGoogleOAuth` log says "Injected Google OAuth scheme" (not "No valid iOS client ID")
- [ ] Sentry DSN set in eas.json production env
- [ ] `npx tsc --noEmit` → zero errors
- [ ] `npx expo-doctor` → no critical issues
- [ ] Railway `/health` returns 200 and `sentry: true`
- [ ] All Railway env vars confirmed: JWT_SECRET, DATABASE_URL, SENDGRID_API_KEY, STRIPE_SECRET_KEY, APPLE_KEY_ID, APPLE_PRIVATE_KEY
- [ ] Full run-through of sections 1–22 above on a physical device
