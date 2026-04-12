# Device Smoke Checklist

Your side of the release gate. Install the **signed release build** (not dev client, not TestFlight preview — the actual submission artifact) on one iPhone and one Android. Work through this once per platform. Check boxes as you go.

Time budget: ~45 min per platform if nothing breaks.

If you hit a fail, stop the release and file it. Green on the whole list = code side of the gate closed; the rest is Railway + migrations.

---

## Before you start

- [ ] Production API is deployed and reachable (`curl $API_URL/health` returns JSON with `ready: true` — or at least `pushTicketMigration: true`)
- [ ] You have **two accounts**: your own and a second test account. Several tests require sender + recipient.
- [ ] You have a real credit card you're OK using on Stripe test mode if staging, or a real card if smoke-testing prod
- [ ] Phone notifications are not silenced (Focus modes off, DND off)
- [ ] You're on mobile data for at least one pass — don't test the whole thing on fast wi-fi

---

## 1 · Cold start + first-run auth (the most fragile path)

- [ ] Uninstall any previous version
- [ ] Install the release build
- [ ] **Open the app for the first time** → lands on sign-in, no white screen, no red error
- [ ] Tap "Create one" → signup screen loads
- [ ] Sign up with a fresh email + password → verification screen appears with "Check Your Email"
- [ ] Enter the 6-digit code from email → lands in onboarding step 1 (role selection)
- [ ] Complete onboarding (role, basics, etc.) → lands on home feed
- [ ] **Kill the app completely** (swipe away from multitasking)
- [ ] Reopen → lands on home feed **without** asking to sign in again (token persisted)
- [ ] Force-quit, wait **15+ minutes**, reopen → still signed in (access-token refresh works)

**Fail = the refresh-token flow I wrote isn't holding across a real idle window. Don't ship.**

---

## 2 · Sign in with Apple (iOS only)

- [ ] From a fresh install, tap "Continue with Apple"
- [ ] Apple sheet appears, choose "Share My Email" (not "Hide My Email")
- [ ] Completes → you land on onboarding (new account) or home feed (returning)
- [ ] In a separate pass: use "Hide My Email"
- [ ] Completes without error → if this is a new account, `/me` shows an email like `apple_xxx@appleid.local` OR a private-relay address, NOT your real one
- [ ] **Never auto-merged with an existing email account** — if you had an account with the same email, signing in with Apple + Hide Email should NOT have linked the two (that's the `appleEmailVerified` gate I added)

---

## 3 · Sign in with Google

- [ ] Fresh install → tap "Continue with Google"
- [ ] Google picker shows, pick an account → completes → onboarding or home
- [ ] Works on mobile data, not just wi-fi

---

## 4 · Email verification timing

- [ ] Sign up → code arrives within 30s
- [ ] Enter wrong code 3 times → get a rate-limit / invalid message, not a hang
- [ ] Request a new code → old code rejected, new code works

---

## 5 · Core content flow

- [ ] Create a text post → appears at the top of your feed immediately
- [ ] Create a post with an image (camera) → image uploads, appears in feed
- [ ] Create a post with an image (photo library) → same
- [ ] Pull-to-refresh → feed updates
- [ ] Scroll the feed for 30 seconds → no visible jank, no missing images, no duplicate posts
- [ ] Tap someone else's post → detail screen opens
- [ ] Upvote, comment, bookmark → all persist after backing out

---

## 6 · Private profile + block (new code, worth verifying)

- [ ] Account A: Settings → toggle **Private Profile** on
- [ ] Account B (not following A): go to A's profile → sees limited info only
- [ ] Account B: searches the feed → none of A's posts appear
- [ ] Account B: follows A → A approves
- [ ] Account B: refreshes feed → A's posts now appear
- [ ] Account A: blocks Account B → B's posts vanish from A's feed immediately
- [ ] Account A → B's profile: blocked state clearly shown
- [ ] Account A unblocks → B's posts return

---

## 7 · Direct messages

- [ ] Account A → Account B: send a DM → arrives on B's device
- [ ] B receives a push notification for the new DM (if foregrounded, an in-app banner is fine)
- [ ] B replies → A sees it
- [ ] Unread badge on B's tab bar reflects the unread count
- [ ] Open the thread → badge clears
- [ ] Background A's app, send another DM from B → push arrives, tapping it opens the correct thread

**This is the #3 item from the release-pass — push end-to-end.** If the badge doesn't clear or the push doesn't arrive, the PushTicket flow has a problem.

---

## 8 · Group chat (if team-scoped)

- [ ] Both accounts join the same team
- [ ] Open the team's group chat → list shows with last message + member count (max 3 avatars per your closure-pass fix)
- [ ] Post a message → other account receives it
- [ ] Unread count on the chat row is accurate (exact count, not 0/1)

---

## 9 · Events + games

- [ ] Coach account creates a game with a home team → success
- [ ] Fan account tries to create a game → blocked with clear error
- [ ] RSVP to a game → appears in your RSVPs
- [ ] Sample game from onboarding: try to post a story → rejected with the "sample game" message (the FK-bug fix)
- [ ] Real game within geofence: post a story → succeeds
- [ ] Real game outside geofence: post a story → blocked with distance/location message

---

## 10 · Ads (if you're testing payment)

- [ ] Coach account creates an ad → validates fields, creates draft
- [ ] Try to use a `javascript:` or `data:` URL in `target_url` → rejected (the zod allowlist I added)
- [ ] Try to create more ads than your plan allows → 403 with quota message (the plan-gate I added)
- [ ] Pay for an ad using Stripe test card → completes, ad becomes active
- [ ] **Admin** reviews the ad → approve → ad stays active
- [ ] Admin rejects a different ad → becomes rejected, owner gets notified

---

## 11 · Deep links (cold start + background)

You need a URL the app knows about. Send yourself one from a different device or paste into Messages/Notes.

- [ ] `https://varsityhub.app/posts/<known-id>` from Messages, **app killed** → opens app, lands on that post
- [ ] Same URL with the app in the background → returns to the post
- [ ] `varsityhubmobile://post/<id>` scheme link → same behavior
- [ ] `javascript:alert(1)` or `varsityhubmobile://<random>` → app opens but does nothing / shows a fallback (the scheme allowlist I added)
- [ ] Tap a push notification from the lock screen with the app terminated → opens to the correct screen

---

## 12 · Network edge cases

- [ ] Turn on airplane mode → open the app → shows a clear "offline" or cached state, no crash
- [ ] Come back online → feed reloads
- [ ] Force a 401 (if you can): wait for access token to expire naturally → next action should silently refresh, not log you out
- [ ] Slow network (iOS Network Link Conditioner / Android dev settings) → feed still loads, doesn't hang forever

---

## 13 · Permissions

- [ ] First camera use → iOS/Android permission prompt with your custom copy (check wording is professional)
- [ ] Deny it → app shows a useful fallback message, not a crash
- [ ] First location use → prompt with copy
- [ ] First notifications prompt → happens at the right moment in onboarding, not on cold start

---

## 14 · Dark mode

- [ ] Toggle system dark mode while the app is open → every screen you can reach re-renders correctly
- [ ] Specifically check: feed, profile, DMs, checkout, signup. No white boxes, no invisible text
- [ ] Kill and reopen in dark mode → no flash of light mode

---

## 15 · Account lifecycle

- [ ] Account deletion flow reachable from Settings within 3 taps (Apple requires this)
- [ ] Delete account → confirms, signs you out, you can't log back in with the same credentials
- [ ] Sign out → returns to sign-in screen cleanly
- [ ] Password reset → email arrives, link works, new password works

---

## 16 · Reviewer-sensitive

- [ ] Privacy policy link on signup opens **in-app** (not external browser) — Apple guidance
- [ ] Terms link same
- [ ] Report a post → submission works, clear confirmation shown
- [ ] Block a user from within a post detail → works

---

## What to do when something fails

1. **Don't "test around it."** If you find yourself working out how to make a test pass instead of recording the failure, stop.
2. Screenshot + note the exact device, OS version, build number
3. Check server logs (`railway logs --tail 100`) for the timeframe
4. Check Sentry for a related event
5. File it as a release blocker and decide whether to fix-and-recut or ship-with-known-issue

## When everything is green

- [ ] Final `bash scripts/release-checks/release-pass.sh` (the driver) passes end-to-end
- [ ] `/health` reports `ready: true` and no missing migration warnings
- [ ] Version numbers in `app.json` match the tag you're about to push
- [ ] OTA pipeline check green: `bash scripts/release-checks/ota-check.sh` returns manifests for both iOS + Android on the `production` channel
- [ ] Release notes written
- [ ] Someone **other than you** has done §11 (deep links) on a fresh install — you're too close to it

## OTA sanity before first post-release update

After the release is live but **before** pushing your first `eas update`, rehearse the OTA flow on an internal device:

- [ ] `eas update --branch preview --message "ota canary"` against a trivial JS change
- [ ] Install the preview build on a device; note something visibly different (e.g. add a debug marker to a screen)
- [ ] Kill + reopen the app — the change should appear on the second launch (your `fallbackToCacheTimeout: 0` policy applies the update on next start, not mid-session)
- [ ] Verify with `eas update:list --branch preview` that the update is listed
- [ ] Only after this rehearsal — push to `--branch production`

Then submit.

---

**Estimated time for the full list:** 1.5–2 hours across both platforms if nothing breaks. Most single failures cost 15–30 min to diagnose. Budget for at least one discovery.
