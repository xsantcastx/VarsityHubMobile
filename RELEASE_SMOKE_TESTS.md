# Release Smoke Tests

Run this checklist on a real iOS or Android device build (not a simulator
screen, not a web preview, not "it compiled in CI") before tagging any
release. Takes ~15 minutes. Catches the class of bug where CI is green but
core user flows are broken end-to-end.

**Why this exists:** between 1.0.0 and 1.0.1 the app shipped with three
core user flows broken (profile header layout, ad banner upload, coach
upgrade). Every server-side audit passed. The bugs only surfaced when
someone actually tapped through the flows on a real build. That's the
gap this checklist closes.

**Gate rule:** all six flows pass → tag the release. Any one fails →
halt the release, fix the flow, re-run all six (not just the failing
one — fixes sometimes break adjacent flows).

---

## Pre-flight

Before running the flows, verify:

- [ ] Staging or prod build is installed on a real device
- [ ] You have credentials for four test accounts: one fresh adult fan,
      one approved coach, one fresh minor (13–17 DOB), one platform admin
- [ ] Railway deploy for the release SHA is green
- [ ] `[Jobs] Redis connected` + `[cron] Overnight tasks scheduled`
      visible in Railway boot logs
- [ ] All required env vars present in Railway for the current export
      adapter and core services:
      `DATA_EXPORT_S3_BUCKET`, `DATA_EXPORT_S3_REGION`,
      `DATA_EXPORT_S3_ACCESS_KEY_ID`,
      `DATA_EXPORT_S3_SECRET_ACCESS_KEY`,
      optional `DATA_EXPORT_S3_ENDPOINT`,
      `REDIS_URL`, all `SENDGRID_*_TEMPLATE_ID`,
      `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `JWT_SECRET`

---

## Flow 1 — Fan signup + onboarding

1. Open the app fresh (uninstall + reinstall if needed to clear cache)
2. Tap **Sign Up**
3. Enter email + password, DOB set to an adult age, select **Fan** role
4. Receive verification email → enter the 6-digit code
5. Complete onboarding screens: username, profile, ZIP, sports interests
6. Arrive at the main feed

**Expected success indicators:**

- Verification email arrives within 2 minutes
- Onboarding progresses through every step with no back-tracking or
  silent validation failures
- Feed loads with content (posts, ads, teams the user can discover)
- Bottom nav shows: Feed, Highlights, +, Discover, Profile
- No "session expired" or forced re-login on arrival at the feed
- Settings screen shows the user's email, username, and DOB correctly

**Common failures to watch for:**

- Verification email missing → check `SENDGRID_VERIFICATION_TEMPLATE_ID`
  in prod env
- Onboarding loops back after completion → `/me` cache not invalidated
  after `complete-onboarding`
- Feed empty when other test accounts have posts → privacy filter or
  block list bug

---

## Flow 2 — Coach upgrade from fan account

Prerequisite: Flow 1 completed, you're logged in as a fresh adult fan.

1. Navigate to **Settings**
2. Tap **Upgrade to Coach Account** at the bottom
3. On the confirmation dialog, tap **Continue**
4. Expected: you land on the first coach onboarding step (not bounced
   back to settings, not stuck on a spinner)
5. Select a plan tier (Rookie is free)
6. Create or join an organization (league)
7. Create your first team
8. Accept the coach agreement
9. Arrive at the coach dashboard

**Expected success indicators:**

- After tapping Continue, the app navigates immediately to coach
  onboarding — no delay, no blank screen
- Your `preferences.role` now reads `coach` — confirm by going back to
  Settings and noting the UI switches to coach-only options
- `approval_status` is `PENDING` until an org admin approves you
- If you chose a paid tier (Veteran/Legend), you're routed to Stripe
  checkout, not straight to the dashboard
- Team creation succeeds and appears in "My Teams"

**Common failures to watch for:**

- Nothing happens after Continue → `/me` cache stale, role didn't update
  in UI even though server did
- Bounced back to Settings → navigation target missing after upgrade
  success
- "Please complete onboarding" 403 after upgrade → `requireOnboarded`
  sees `onboarding_completed: false` but no onboarding UI was shown

---

## Flow 3 — Create and submit an ad

Prerequisite: logged in as an approved onboarded user (any role, Flow 1
or 2 complete).

1. Open the + menu (bottom nav)
2. Tap **Create Ad**
3. Fill business name, contact name, contact email
4. Tap **Tap to upload banner**
5. Grant photo library permission if prompted
6. Select an image from photo library
7. Image preview appears; fill remaining fields (target zip, description)
8. Tap **Submit for Approval**
9. Check admin surface: a platform admin logs in and sees the new ad in
   the review queue

**Expected success indicators:**

- Image picker opens on tap
- Selected image previews in the upload slot (not a generic "Image Error"
  alert)
- Submit-for-approval returns success and shows a "pending review" state
- Admin review email is delivered within 2 minutes
- Ad appears in `/admin/reports` or the ads moderation queue

**Common failures to watch for:**

- "Image Error" alert with no specific cause → client-side picker or
  image-loading error being collapsed; the real error should now surface
  with the BannerUpload.tsx fix
- Upload succeeds but admin doesn't see the ad → moderation queue query
  missing new records
- Permission denied by iOS → `app.json` missing
  `NSPhotoLibraryUsageDescription`

---

## Flow 4 — Post, comment, and RSVP

Prerequisite: two test accounts (Accounts A and B), both onboarded.

On Account A:

1. Navigate to Feed → tap + → **Create Post**
2. Write a short text post with one @mention of Account B
3. Submit

On Account B:

4. Expect a push notification within 30 seconds ("@A mentioned you in
   a post")
5. Tap the notification → lands on the post detail
6. Add a comment
7. Upvote the post
8. Navigate to Events → find a public event → tap **RSVP Going**

**Expected success indicators:**

- Account B receives push notification (not just in-app — actual iOS/
  Android system notification banner)
- Tapping notification deep-links to the post, not the app home screen
- Comment appears immediately on Account A's view (via optimistic UI or
  refresh)
- Upvote count increments on Account B's view
- RSVP persists — leaving and returning to the event shows "Going" state

**Common failures to watch for:**

- Push notification never arrives → `EXPO_ACCESS_TOKEN` misconfigured,
  or user's `push_token` is stale
- Notification arrives but tap goes to app home → deep-link registration
  issue in Expo Router
- Comment posts but doesn't appear until app restart → feed cache not
  invalidated on comment create
- RSVP button looks like it worked but doesn't persist → optimistic UI
  not backed by successful API call

---

## Flow 5 — Minor signup + parental consent

Prerequisite: an email address you control for the parent inbox (can be
a + alias on your own email).

1. Open the app fresh
2. Tap Sign Up
3. Enter DOB for a 15-year-old (current year minus 15)
4. Enter the minor's email + password
5. Prompt appears for parent email — enter your parent-controlled
   address
6. Verify the minor's own email first
7. Expected: onboarded-only routes return
   `PARENTAL_CONSENT_PENDING` (feed blocked, content creation blocked)
8. Check parent inbox for consent email within 2 minutes
9. Tap **Approve** in the parent email
10. Return to minor's app, refresh → feed now accessible

**Expected success indicators:**

- Under-13 signup is rejected with `COPPA_UNDER_13`, not silently
  accepted
- 13–17 signup routes through consent flow, not the adult flow
- Parent email arrives with approve/deny buttons and a 14-day expiry
  note
- Approve link lands on a success page, not a 404
- Minor's next API call succeeds (consent status cached server-side,
  not requiring a full re-login)

**Common failures to watch for:**

- Consent email missing → `SENDGRID_PARENTAL_CONSENT_REQUEST_TEMPLATE_ID`
  not set in prod env (this was the 1.0.1 bug that demoted the template
  to "recommended")
- Approve click succeeds but app still blocks minor → `/me` cache not
  invalidated after consent approval
- Minor can create posts before consent → `requireOnboarded` gate
  broken

---

## Flow 6 — Data export

Prerequisite: logged in as any verified, email-verified user.

1. Navigate to **Settings** → **Data Export**
2. Tap **Request Export**
3. Status badge shows "Pending" or "Building"
4. Wait up to 60 seconds; screen auto-polls
5. Status badge flips to "Ready"
6. Tap **Download**
7. System browser or share sheet opens; ZIP file downloads
8. Open the ZIP — contains MANIFEST.json + ~24 domain JSON files

**Expected success indicators:**

- POST `/me/data-export` returns 202, not 503
- Row appears in the exports list with `status: pending`
- Worker picks it up within 30 seconds, status flips to `building` then
  `ready`
- Download link is a short-lived signed URL from the current storage
  adapter, not a bare public object URL. The exact query-param shape is
  provider-dependent; for the current S3-compatible adapter it often
  includes time-limited auth params, but do not fail the release solely
  because the param names changed if the link downloads correctly and
  expires when expected.
- ZIP contents include `profile.json`, `preferences.json`,
  `billing_summary.json`, plus the rest of the 24 domains
- No raw Stripe IDs, password hashes, OAuth identifiers, refresh tokens
  in any JSON file

**Common failures to watch for:**

- 503 on request → object storage adapter not configured
  (`DATA_EXPORT_S3_*` env vars missing) or Redis unreachable (queue
  can't accept jobs)
- Status stuck on "building" > 5 minutes → worker crashed; the cleanup
  cron at 5 AM will reap as `stuck_build_reaped` but user is stuck until
  then
- Download link returns 403/AccessDenied → storage credentials,
  bucket/container policy, or signed-URL generation mismatch in the
  current object storage backend
- Signed URL leaked in an app log → client should never log the URL

---

## Post-flight (after all 6 pass)

- [ ] Tag the release: `git tag v1.0.X && git push origin v1.0.X`
- [ ] EAS/App Store/Play submit or `eas update --branch production`
- [ ] Update `RELEASE_SMOKE_TESTS.md` if any flow surfaced a new
      failure mode worth capturing
- [ ] If this release includes a DB migration, verify
      `prisma migrate deploy` ran in Railway logs before users hit the
      new code

---

## If a flow fails mid-release

1. Do **not** ship with a partial pass. Ship nothing until all six are
   green or the failing flow is documented as a known regression with a
   hotfix PR queued.
2. File a ticket describing: flow number, step number, expected vs
   actual, screenshot if possible
3. Fix, redeploy, re-run all six (not just the one that failed — fixes
   have adjacent-flow breakage patterns)

---

## Maintaining this checklist

Add a new step to a flow whenever:

- A bug ships to production that this checklist would have caught if
  the step had existed
- A new feature adds a user-facing surface (new screen, new critical
  path)

Remove steps when:

- The flow is retired from the product
- An automated test now covers the same ground with equal or higher
  confidence (then link the test in place of the manual step)

Last updated: 2026-04-20. Covers releases 1.0.2 forward.
