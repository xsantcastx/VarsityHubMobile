# Day 4: Release Mechanics & App Store Submission

**Goal:** Version bump → Release notes → EAS builds → TestFlight/Play Store submission → Monitor

**Timeline:** 6-8 hours (mostly waiting for builds)

**Success Metric:** Builds submitted to both stores, internal QA passed

---

## ⏰ Day 4 Timeline

```
09:00 AM - Start: Version bump & release notes (30 mins)
09:30 AM - Kick off: EAS builds (5-10 mins, builds run async)
10:00 AM - While building: Prepare store metadata (30 mins)
10:30 AM - Continue: Write release notes in detail (30 mins)
11:00 AM - Monitor: iOS build progress (ongoing)
11:30 AM - Lunch (builds should still be running)
01:00 PM - Checkpoint: Check build status
01:30 PM - Deploy: iOS to TestFlight (if ready)
02:00 PM - Deploy: Android to Play Store (if ready)
03:00 PM - Start: Internal QA on TestFlight
04:00 PM - Final: Monitoring checks + submission
05:00 PM - Monitor: App review tracking
```

---

## 🎯 Checkpoint 4.1: Version Bump (15 mins)

### Update app.json

```json
{
  "expo": {
    "version": "1.0.0",
    "ios": {
      "buildNumber": "1"
    },
    "android": {
      "versionCode": 1
    }
  }
}
```

**Steps:**
```bash
# Edit app.json
# Update version from current to target (e.g., 1.0.0)
# Update iOS buildNumber (increment: 1 → 2)
# Update Android versionCode (increment: 1 → 2)

# Verify changes
grep -E '"version"|"buildNumber"|"versionCode"' app.json
```

### Update package.json

```json
{
  "version": "1.0.0"
}
```

**Steps:**
```bash
# Edit package.json
# Update version to match app.json

# Verify
grep '"version"' package.json
```

### Commit Version Bump

```bash
git add app.json package.json
git commit -m "Release: Bump version to 1.0.0 for production launch

- app.json version: 1.0.0
- iOS buildNumber: 1
- Android versionCode: 1"

git push origin main
```

**Success Criteria:**
- ✅ app.json updated
- ✅ package.json updated
- ✅ Version numbers match
- ✅ CI passes (should be quick)

---

## 🎯 Checkpoint 4.2: Release Notes (45 mins)

### Create CHANGELOG.md

```markdown
# Changelog

## [1.0.0] - December 6, 2025

### ✨ New Features
- **Game Voting:** Vote for your favorite team in any game
- **Event RSVP:** Confirm attendance with real-time capacity tracking
- **Story Uploads:** Share photos and videos from games
- **Deep Linking:** Share games and events with auto-opening links
- **Team Management:** Create and manage sports teams
- **Game Calendar:** Browse all upcoming games and events
- **Real-time Updates:** Live vote counts and RSVP status

### 🎨 Improvements
- Enhanced error monitoring with Sentry
- Improved upload reliability (retry logic)
- Better authentication flow (no more 401 loops)
- Faster team navigation
- Optimized database queries

### 🐛 Bug Fixes
- Fixed 401 redirect infinite loops
- Resolved story upload timeouts
- Fixed RSVP count not updating
- Fixed share link generation
- Fixed Stripe payment modal not opening

### 📱 Platform-Specific
**iOS:**
- Apple Sign-In integration
- Full camera/gallery access
- Deep linking support

**Android:**
- Full permissions support
- Gesture navigation support
- Edge-to-edge display

### 🔐 Security & Privacy
- Sentry error monitoring (no PII collected)
- Secure token storage
- HTTPS-only API communication
- Privacy policy updated

### 📊 Performance
- Cold launch time: <3 seconds
- Navigation smooth at 60fps
- Memory usage optimized
- Upload bandwidth efficient

### 🙏 Credits
Built with React Native, Expo, and React Navigation

---

## Previous Versions

[List any previous versions if applicable]
```

### App Store Connect Description

```
VarsityHub: The Ultimate Sports Team Social Platform

Vote on games, RSVP to events, share stories, and stay connected with your team.

✨ Features:
• Real-time voting on games
• RSVP to events with live capacity
• Upload and share game stories
• Team management tools
• Deep linking for instant sharing
• Offline support

🎯 Perfect for:
- College & high school athletes
- Coaches & team managers
- Sports fans & supporters
- Team communities

🏆 Join thousands of athletes staying connected through VarsityHub!

Website: https://varsityhub.app
Privacy: https://varsityhub.app/privacy
Support: support@varsityhub.app
```

### Play Store Description

Similar to App Store, optimized for Google Play length limits (4,000 chars).

```
VarsityHub - Vote • RSVP • Share

The ultimate sports team social platform for athletes, coaches, and fans.

✨ Key Features:
- Vote for teams in live games
- RSVP to events with real-time counts
- Upload and share game stories
- Manage teams and rosters
- Instant share links
- Works offline

Perfect for:
- College & high school sports
- Club sports teams
- Intramural leagues
- Sports communities

📲 Stay connected. Stay athletic. VarsityHub.

www.varsityhub.app
```

### Keywords (iOS)
```
sports, voting, team, RSVP, social, events, games, athletes, communities
```

### Keywords (Android)
```
sports voting team rsvp social games events athletes
```

### Time: 45 mins

**Success Criteria:**
- ✅ CHANGELOG.md written and complete
- ✅ App Store description ready
- ✅ Play Store description ready
- ✅ Keywords finalized

---

## 🎯 Checkpoint 4.3: Build Production Bundles (30-60 mins runtime)

### Prerequisites
- Xcode 16+ installed (for iOS)
- Android NDK installed (for Android)
- EAS CLI installed: `npm install -g eas-cli`
- Signed into EAS account: `eas login`

### iOS Build

```bash
# Trigger iOS production build
eas build --platform ios --profile production

# Output:
# ✅ Build initiated: d8f5c4a2-1234
# 📱 iOS production build starting...
# ⏳ This typically takes 20-30 minutes

# Monitor progress:
eas build --status
# Or visit: https://expo.dev/accounts/@xsantcastx/projects/VarsityHubMobile/builds
```

### Android Build

```bash
# Trigger Android production build (can run parallel with iOS)
eas build --platform android --profile production

# Output:
# ✅ Build initiated: e9g6d5b3-5678
# 📱 Android production build starting...
# ⏳ This typically takes 15-25 minutes
```

### Monitor Both Builds

```bash
# Check status
eas build --status

# Watch logs (optional)
eas build:view <build-id> --verbose

# Expected timeline:
# t+0m  → Build queued
# t+5m  → Building dependencies
# t+15m → Compiling source
# t+20m → Signing
# t+25m → Android done, iOS still going
# t+30m → iOS done
```

### While Waiting: Prepare Store Metadata

**During the 20-30 minute build time:**

1. Create App Store Connect app (if not existing)
   - https://appstoreconnect.apple.com
   - App name, bundle ID, etc.

2. Create Google Play app (if not existing)
   - https://play.google.com/console
   - App name, package name, etc.

3. Prepare screenshots:
   - iOS: 6 required sizes
   - Android: 6 required sizes
   - See store documentation for exact dimensions

4. Prepare icons:
   - Already in app.json: `./assets/images/icon.png`
   - Should be 1024x1024 PNG
   - No transparency required

### Success Criteria
- ✅ iOS build completes (status = "completed")
- ✅ Android build completes (status = "completed")
- ✅ No errors in build logs
- ✅ Bundle sizes reasonable:
  - iOS: <50MB typical
  - Android: <60MB typical

### If Build Fails

```bash
# Check build logs
eas build:log <build-id>

# Common issues:
# - Dependency resolution error → npm clean-install
# - Code signing error → Check EAS configuration
# - Out of memory → Try again (temporary server issue)
# - TypeScript error → Fix code, trigger new build

# Retry build
eas build --platform ios --profile production --clear-cache
```

---

## 🎯 Checkpoint 4.4: Deploy to TestFlight (5 mins)

### After iOS Build Completes

```bash
# Submit to TestFlight
eas submit --platform ios --profile production

# When prompted:
# ? Select an existing app: [Choose your app]
# ? Would you like to upload a new version? [Yes]

# Automated process:
# 1. Notarizes build
# 2. Signs with distribution certificate
# 3. Uploads to App Store Connect
# 4. Adds to TestFlight

# Expected: Completes in 2-5 minutes
```

### Manual Upload (if eas submit fails)

```bash
# Download build
eas build:log <build-id> | grep "https://" | tail -1

# Download to local machine
curl -O <build-download-url>  # .ipa file

# Upload via Transporter
open -a Transporter  # macOS app
# Add .ipa file → Deliver

# Or via Xcode
xcode-select --install
# Xcode → Organizer → <.ipa> → Distribute App
```

### TestFlight Configuration

Once uploaded to App Store Connect:

1. Select build in TestFlight section
2. Configure test information:
   - What to test
   - Beta notes
   - Contact info
3. Add internal testers (recommended first)
4. Add external testers (if doing beta)

### Verification

```bash
# Check status in App Store Connect
# https://appstoreconnect.apple.com
# → TestFlight → VarsityHub → Builds

# Expected: Build appears with status "Missing Compliance"
# Action: Fill out compliance questionnaire
```

---

## 🎯 Checkpoint 4.5: Deploy to Play Store (10 mins)

### After Android Build Completes

```bash
# Submit to Play Store
eas submit --platform android --profile production

# When prompted:
# ? Select an existing app: [Choose your app]
# ? Would you like to upload a new version? [Yes]
# ? Select .aab format: [Yes - recommended]

# Automated process:
# 1. Downloads .aab from EAS
# 2. Uploads to Play Store Console
# 3. Assigns to production track

# Expected: Completes in 2-5 minutes
```

### Manual Upload (if eas submit fails)

```bash
# Go to Play Store Console
# https://play.google.com/console

# Steps:
# 1. Navigate to Your App → Release → Production
# 2. Click "Create Release"
# 3. Select version to release
# 4. Add release notes
# 5. Review and roll out (to 100%)
```

### Play Store Configuration

1. **Store Listing:**
   - App name ✅
   - Short description ✅
   - Full description ✅
   - Screenshots ✅
   - Icon ✅
   - Feature graphic (optional)

2. **Ratings:**
   - Content rating questionnaire ✅
   - App category ✅
   - Target audience ✅

3. **Privacy:**
   - Privacy policy URL ✅
   - Data collection questions ✅

4. **Release:**
   - Choose rollout percentage (start at 10-50% if unsure)
   - Or go to 100% if confident

---

## 🎯 Checkpoint 4.6: Internal QA on TestFlight (90 mins)

### Setup

```bash
# Add yourself as TestFlight tester
# https://appstoreconnect.apple.com
# TestFlight → Testers → Add
# Select "Internal Testers" group

# Download TestFlight app on device
App Store → Search "TestFlight" → Install
```

### QA Checklist

**Fresh Install Test:**
```bash
# Delete app from device
# Open TestFlight → Install VarsityHub
# Wait for installation

# Expected:
✅ App installs without error
✅ Splash screen shows
✅ Home screen loads
✅ No crashes on startup
```

**Onboarding Test:**
```bash
# If new account:
✅ Role selection works
✅ Email verification sends
✅ SMS optional/skipped
✅ Profile photo upload works
✅ Onboarding completes
✅ Land in Feed
```

**Core Flows (5 mins each):**
```bash
# Feed
✅ Load without errors
✅ Scroll smooth (60fps)
✅ Images load properly

# Vote
✅ Tap team → vote posts
✅ Count updates
✅ Clear vote works

# Events
✅ Calendar shows events
✅ Event detail opens
✅ RSVP works

# Team
✅ Can view teams
✅ Can tap team → detail
✅ Team info loads
```

**Critical Payment (5 mins):**
```bash
# Billing
✅ Tap subscription
✅ Stripe modal opens
✅ Card input shows
✅ Test card payment works (4242... card)
✅ Success screen shows
✅ Subscription activates in profile
```

**Monitoring (5 mins):**
```bash
# Check Sentry dashboard
# Should see test errors appearing
✅ Session tracking working
✅ Error capturing working
✅ No crash on critical flows
```

### Time: 90 mins

**Success Criteria:**
- ✅ App installs cleanly
- ✅ No crashes on critical flows
- ✅ Auth/voting/payment work
- ✅ Sentry capturing events
- ✅ No show-stopper bugs

### If QA Fails

```bash
# If CRITICAL bug found:
1. Note exact repro steps
2. Check Sentry for error details
3. Check what changed since Day 3
4. If simple fix:
   - Fix code
   - Commit
   - Push to main
   - Wait for CI pass
   - Trigger new EAS build
   - Resubmit to TestFlight
5. If complex:
   - Delay release by 1 day
   - Fix properly
   - Retest thoroughly

# If MEDIUM bug:
- Document
- Fix before public launch
- Doesn't block TestFlight submission
```

---

## 🎯 Checkpoint 4.7: Monitoring Dashboard Check (20 mins)

### Sentry Health

```bash
# https://sentry.io → VarsityHubMobile

# Check:
✅ Issues tab: <5 total issues
✅ Errors/hour: <10
✅ Crash-free sessions: >95%
✅ Performance: p95 <500ms
```

### Railway Logs

```bash
# https://railway.app → VarsityHubMobile

# Check:
✅ No 500 errors
✅ API response times good
✅ Database healthy
✅ Email delivery working
```

### GitHub Actions

```bash
# https://github.com/xsantcastx/VarsityHubMobile/actions

# Check:
✅ Latest run passed
✅ No lint errors blocking CI
✅ No type errors
```

### SendGrid Delivery

```bash
# https://sendgrid.com → Activity

# Check:
✅ Test emails delivered
✅ No bounces
✅ No spam marking
```

**Success Criteria:**
- ✅ All monitoring green
- ✅ Error rates acceptable
- ✅ Performance good
- ✅ No critical issues

---

## 🎯 Checkpoint 4.8: App Store Submission (30 mins)

### iOS App Store

**Requirements:**

```markdown
- Version number filled
- Build selected from TestFlight
- Description complete
- Screenshots (6) uploaded
- Icon uploaded (1024x1024)
- Support URL filled
- Privacy policy URL filled
- Contact email filled
- Category selected
- Rating filled out
- Content rating questionnaire completed
```

**Steps:**

1. Go to https://appstoreconnect.apple.com
2. Select VarsityHub → Version Management
3. Fill in "What's New":
   ```
   Welcome to VarsityHub v1.0.0!
   
   ✨ This is our launch release with:
   - Game voting system
   - Event RSVP with capacity
   - Story uploads from games
   - Share links for instant access
   
   We can't wait to see you on the field!
   ```
4. Select build from TestFlight
5. Review all metadata (should be pre-filled)
6. Click "Save"
7. Click "Submit for Review"

**Expected Review Time:** 1-3 days

### Android Play Store

**Requirements:**

```markdown
- Version number filled
- .aab bundle uploaded
- Screenshots (8) uploaded
- Icon uploaded
- Short description filled
- Full description filled
- Privacy policy URL filled
- Support email filled
- Content rating questionnaire completed
- Target audience specified
```

**Steps:**

1. Go to https://play.google.com/console
2. Select VarsityHub
3. Navigate to Release → Production
4. Create new release
5. Confirm version code
6. Add release notes:
   ```
   Welcome to VarsityHub v1.0.0!
   
   Vote on games, RSVP to events, and share your sports story.
   ```
7. Review content rating (should be pre-completed)
8. Configure rollout: Start at 10% (safe) or 100% (confident)
9. Click "Review Release"
10. Click "Start Rollout to Production"

**Expected Review Time:** 2-4 hours (usually faster than iOS)

### Time: 30 mins

**Success Criteria:**
- ✅ iOS submitted to App Review
- ✅ Android submitted to Play Store
- ✅ Both show in "In Review" status
- ✅ No submission blockers

---

## 📋 Day 4 Final Checklist

```bash
# ✅ Code & Build
[ ] Version bumped (1.0.0)
[ ] git status clean (all committed)
[ ] CI passed (last run green)
[ ] TypeScript: 0 errors
[ ] Lint: <100 warnings

# ✅ Builds
[ ] iOS build completed (no errors)
[ ] Android build completed (no errors)
[ ] Both <50-60MB
[ ] Signed correctly

# ✅ Store Submission
[ ] Submitted to App Store
[ ] Submitted to Play Store
[ ] Both showing in review queue
[ ] Release notes complete
[ ] Metadata complete

# ✅ Testing
[ ] TestFlight QA passed
[ ] Critical flows working
[ ] No crashes on startup
[ ] Payment tested

# ✅ Monitoring
[ ] Sentry: <10 errors/hour
[ ] Railway: No 500 errors
[ ] SendGrid: Emails delivering
[ ] CI: Green

# ✅ Communication
[ ] Team notified: "Submitted to both stores"
[ ] Tracking link shared
[ ] Review timeline explained
[ ] Post-launch plan documented
```

---

## 📢 Day 4 Team Announcement

```markdown
🚀 VarsityHub Mobile v1.0.0 - Submitted!

We just submitted VarsityHub to:
✅ Apple App Store
✅ Google Play Store

Timeline:
- iOS: Review in 1-3 days
- Android: Review in 2-4 hours

Current Status:
📱 Both apps in review queue
🟢 All monitoring systems healthy
✅ Internal QA complete

What's Next:
- Monitor review progress
- Watch for approval notifications
- Prepare release day communications
- Monitor error rates closely

Links:
- App Store Connect: [link]
- Play Store Console: [link]
- Sentry Dashboard: [link]
- Railway Monitoring: [link]

Questions? Check #varsityhub-launch channel
```

---

## 📊 Post-Submission Monitoring

### First 24 Hours

```bash
# Watch for:
✅ App approved/rejected notifications
✅ Sentry error spike
✅ Railway API errors
✅ User reports (social/email)

# Check every 2 hours:
curl -s https://api-production-8ac3.up.railway.app/health | jq '.integrations'
# Should all be true
```

### If Rejected

```markdown
Common Reasons:
- Missing privacy policy → Add URL to Review Notes
- Crashes during review → Fix code, resubmit
- Misleading description → Update metadata
- Policy violation → Review guidelines, fix

Response Time: 24-48 hours
Solution: Address feedback, resubmit same day
```

### If Approved

```markdown
✅ iOS: Available on App Store
✅ Android: Available on Google Play

Next Steps:
1. Create launch announcement
2. Enable marketing campaigns
3. Send press release (optional)
4. Monitor user feedback
5. Track download metrics
6. Plan v1.0.1 hotfixes
7. Plan v1.1 features
```

---

## 🎓 Day 4 Sign-Off

```markdown
## Day 4 Final Sign-Off (December 6, 2025)

### ✅ All Milestones Complete
- [x] Version bumped to 1.0.0
- [x] Release notes written
- [x] iOS production build complete
- [x] Android production build complete
- [x] Submitted to App Store
- [x] Submitted to Play Store
- [x] Internal QA passed
- [x] All monitoring green

### ✅ Review Queue
- [x] iOS: In App Review
- [x] Android: In Play Store Review
- [x] Expected approval: 1-3 days (iOS), 2-4 hours (Android)

### ✅ Post-Launch Plan
- [x] Monitoring escalation contacts assigned
- [x] Sentry alerts configured
- [x] Team on-call rotation ready
- [x] Hotfix plan documented
- [x] v1.0.1 patch release plan ready

### 🎯 Success Metrics
- Sentry: <10 errors/hour ✅
- CI: Green ✅
- TypeScript: 0 errors ✅
- Lint: <100 warnings ✅
- TestFlight QA: Passed ✅

### 🚀 READY FOR LAUNCH
```

---

**🎉 You've completed the 4-day publishing path! Your app is now in the hands of Apple and Google. Time to monitor, celebrate, and prepare the next release! 🚀**
