# VarsityHub Mobile - Final QA Checklist

**Status:** Ready for comprehensive testing  
**Date:** December 3, 2025  
**Platform:** iOS & Android (via Expo)

---

## 📱 Authentication & Onboarding

### Sign-In / Sign-Up
- [ ] Email/password registration works
- [ ] Email verification email received
- [ ] Can sign in after verification
- [ ] "Forgot password" link works
- [ ] OAuth sign-in (Google/Apple) works
- [ ] Social sign-in creates user correctly
- [ ] Existing user can link OAuth to email account
- [ ] Error messages clear for invalid input
- [ ] No double registration on network retry

### Onboarding Flow (Coach)
- [ ] Step 1 (Role): Can select "Coach"
- [ ] Step 2 (Profile): Can upload photo
- [ ] Step 3 (Plan): Sees subscription options
- [ ] Rookie plan (free): Checkout skips payment
- [ ] Veteran plan: Stripe checkout opens
- [ ] Legend plan: Stripe checkout opens
- [ ] Can complete onboarding without payment
- [ ] Onboarding marked complete in DB
- [ ] Coach role persists after login

### Onboarding Flow (Fan)
- [ ] Step 1: Can select "Fan"
- [ ] Step 2: Can enter profile info
- [ ] No payment step for fans
- [ ] Fan role persists after login

---

## 💳 Payments & Subscriptions

### Stripe Integration
- [ ] Test card (4242 4242 4242 4242) works
- [ ] Invalid card rejected with error
- [ ] Payment success page displays
- [ ] Failed payment shows retry option
- [ ] Transaction logged in database

### Subscription Management
- [ ] Rookie → Veteran upgrade works
- [ ] Veteran → Legend upgrade works
- [ ] Downgrade shows confirmation
- [ ] Promo code accepted (if applicable)
- [ ] Can view subscription status
- [ ] Invoice email received
- [ ] Can cancel subscription

---

## 👥 Team Management (Coach Only)

### Create Team
- [ ] Can create new team with name
- [ ] Can add team description
- [ ] Can set team logo/banner
- [ ] Team appears in "My Teams"
- [ ] Can invite other coaches
- [ ] Team members can view

### Edit Team
- [ ] Can rename team
- [ ] Can update description
- [ ] Can change banner
- [ ] Changes appear immediately
- [ ] Non-coaches cannot edit

### Delete Team
- [ ] Delete button hidden for non-coaches
- [ ] Delete shows confirmation
- [ ] Team removed from list after delete
- [ ] Cannot delete if games/seasons exist (if enforced)

### Manage Members
- [ ] Can view team members
- [ ] Can remove members
- [ ] Can change member role
- [ ] Member gets notification of role change

---

## 🏆 Games & Events

### Create Game/Event (Coach)
- [ ] Can create new game
- [ ] Can set date/time
- [ ] Can set location
- [ ] Can add description
- [ ] Game appears on calendar
- [ ] Admin can auto-approve (if admin)

### View Game Details
- [ ] Shows team info
- [ ] Shows date/time/location
- [ ] Shows roster
- [ ] Shows past games/results
- [ ] Can view game on map

### Game Approvals (Admin)
- [ ] Admin sees pending games
- [ ] Can approve/reject game
- [ ] Coach gets notification
- [ ] Approved games visible in feed

---

## 📝 Posts & Media

### Create Post
- [ ] Can upload photo
- [ ] Can upload video
- [ ] Can add caption
- [ ] Large files (100MB+) don't crash app
- [ ] File size check works (no double-download)
- [ ] Post appears in feed after upload

### View Post
- [ ] Photo displays correctly
- [ ] Video plays (with controls)
- [ ] Caption displays
- [ ] Comments section shows
- [ ] Like button works
- [ ] Share button opens OS sheet
- [ ] Share link is valid (varsityhub.com/posts/...)

### Edit/Delete Post
- [ ] Can edit caption
- [ ] Can delete post (if owner)
- [ ] Deleted post removed from feed
- [ ] Cannot edit/delete others' posts

---

## 💬 Messaging

### Send Direct Message
- [ ] Can start new conversation
- [ ] Can search for recipient
- [ ] Message sends successfully
- [ ] Message appears in conversation
- [ ] Notification received (if not muted)

### Share Post via DM
- [ ] "Send to Friend" navigates to messages
- [ ] Message pre-filled with post link
- [ ] Link is correct (varsityhub.com/posts/...)
- [ ] Can edit message before sending
- [ ] Recipient can click link

### Message Notifications
- [ ] New message shows badge on messages tab
- [ ] Push notification received (if enabled)
- [ ] Can disable notifications
- [ ] Read receipts work (if implemented)

---

## 🎯 Highlights & Discovery

### View Highlights
- [ ] Recent highlights load
- [ ] Can scroll through highlights
- [ ] Location-based highlights work (nearby teams)
- [ ] Filters work (sport, location, date)
- [ ] Can Like/Comment
- [ ] Share button opens OS sheet

### Search
- [ ] Can search for teams
- [ ] Can search for players
- [ ] Can search for games
- [ ] Results appear without lag
- [ ] No "loading entire database" stalls

### Nearby Content
- [ ] Device location used (not stored preferences)
- [ ] Nearby games/teams show first
- [ ] Personalization improves with location

---

## ⚙️ Settings & Profile

### User Profile
- [ ] Can view own profile
- [ ] Can view others' profiles
- [ ] Profile photo displays
- [ ] Can follow/unfollow users
- [ ] Follower count updates
- [ ] Can see follower list

### Edit Profile
- [ ] Can change email
- [ ] Can change password
- [ ] Can update bio
- [ ] Can change interests
- [ ] Can upload new photo
- [ ] Changes save correctly

### Settings
- [ ] Can enable/disable notifications
- [ ] Can enable dark mode
- [ ] Can change app language
- [ ] Can enable location services
- [ ] Can see app version

### Privacy & Security
- [ ] Can block users
- [ ] Blocked users cannot message
- [ ] Can view blocked users list
- [ ] Can unblock users
- [ ] Can delete account

---

## 👮 Admin Features

### Admin Dashboard
- [ ] Shows total users count
- [ ] Shows verified/banned user counts
- [ ] Shows total teams
- [ ] Shows pending ads count
- [ ] Shows recent activity

### Manage Users
- [ ] Can view all users
- [ ] Can search users
- [ ] Can ban user
- [ ] Can unban user
- [ ] Can view user details
- [ ] Activity log updated

### Manage Teams
- [ ] Can view all teams
- [ ] Can delete team
- [ ] Can edit team
- [ ] Cannot delete if coach-owned (unless superadmin)

### Manage Ads
- [ ] Can view pending ads
- [ ] Can approve ad
- [ ] Can reject ad
- [ ] Can delete ad
- [ ] Ad changes immediately visible

### Activity Log
- [ ] Shows all admin actions
- [ ] Can filter by type (user/team/ad/post)
- [ ] Can search by name/email
- [ ] Shows timestamp
- [ ] Shows action description

---

## 📍 Ads System

### Create Ad
- [ ] Can select zip code
- [ ] Gets coverage area message (20 miles)
- [ ] Can upload banner
- [ ] Can add description
- [ ] Can set dates on calendar
- [ ] Can add call-to-action
- [ ] Alternative zip codes show (if primary unavailable)

### Edit Ad
- [ ] Can update banner
- [ ] Can update description
- [ ] Can change dates
- [ ] Changes appear immediately

### View Ads
- [ ] Ads display in feed
- [ ] Banner shows correctly
- [ ] Description visible
- [ ] Call-to-action clickable
- [ ] Coverage area shows (20 miles around zip)

### Ad Calendar
- [ ] Can view ad schedule
- [ ] Shows dates ad is active
- [ ] Can click to edit
- [ ] Can click to delete

### Promo Codes
- [ ] Can enter promo code
- [ ] Discount applied correctly
- [ ] Cannot exceed redemption limit
- [ ] Code validates before payment

---

## 🌍 Location & Permissions

### Location Permission
- [ ] Asks for location on first use
- [ ] Can accept/deny
- [ ] Can enable in settings
- [ ] Works with background location (if needed)

### Device Location Used For:
- [ ] Nearby games (auto-suggestion)
- [ ] Nearby highlights
- [ ] Location-based search results
- [ ] Not stored in profile (uses device location)

---

## 🔔 Notifications

### Permission Flow
- [ ] Asks for notification permission
- [ ] Can enable/disable in settings
- [ ] Can customize notification types

### Push Notifications
- [ ] Message received notification shows
- [ ] Game/event update notification shows
- [ ] Can tap notification to open relevant screen
- [ ] Notification cleared when message/event read

### Email Notifications
- [ ] Email sent for sign-up
- [ ] Email sent for password reset
- [ ] Email sent for payment
- [ ] Can unsubscribe from emails

---

## 🔐 Error Handling & Recovery

### Network Errors
- [ ] Offline mode shows banner
- [ ] Can retry failed action
- [ ] Data persists when reconnected
- [ ] Sync completes without user action

### App Crashes
- [ ] App doesn't crash on large uploads
- [ ] App handles network timeouts gracefully
- [ ] Error boundary shows fallback UI
- [ ] Can retry from error state

### Auth Errors
- [ ] Invalid token redirects to login
- [ ] Session expired shows re-auth prompt
- [ ] Can re-authenticate and continue
- [ ] No loss of in-progress data

### Server Errors
- [ ] 500 error shows user-friendly message
- [ ] 404 not found redirects appropriately
- [ ] Timeout shows retry button
- [ ] Sentry captures errors for debugging

---

## 📊 Performance

### App Loading
- [ ] App launches in <3 seconds
- [ ] Onboarding flow smooth (no lag)
- [ ] Feed loads with <2s initial load
- [ ] Scrolling is smooth (60 FPS if possible)

### Large Files
- [ ] 100MB video uploads without hanging
- [ ] Large photos process quickly
- [ ] No memory spikes during upload

### Search
- [ ] Search returns results in <2s
- [ ] No lag when typing search query
- [ ] Nearby content doesn't block UI

---

## 🌙 Dark Mode

### Visual Design
- [ ] All screens respect dark mode
- [ ] Text is readable in dark mode
- [ ] Buttons are visible in dark mode
- [ ] Media displays correctly

### Consistency
- [ ] Color scheme consistent across screens
- [ ] No hardcoded colors visible in dark mode

---

## 🏃 Edge Cases & Stress Tests

### Multiple Accounts
- [ ] Can switch between accounts
- [ ] Each account has separate data
- [ ] Logout clears sensitive data

### Concurrent Actions
- [ ] Can upload while messaging
- [ ] Multiple tabs don't cause conflicts
- [ ] Rapid button clicks handled (debounce)

### Poor Connectivity
- [ ] App works on 3G
- [ ] Retries work on network change
- [ ] Doesn't crash on WiFi toggle

### Extreme Data
- [ ] 10,000+ followers list scrolls smoothly
- [ ] Team with 100+ games loads
- [ ] 1000+ messages in conversation loads
- [ ] 10MB+ video uploads complete

---

## 📋 Platform-Specific

### iOS
- [ ] Runs on iOS 13+
- [ ] Works on iPhone SE (small screen)
- [ ] Works on iPhone 15 Pro (large screen)
- [ ] iPad layout works (if supported)
- [ ] Apple Sign-In works
- [ ] Camera permission flow works
- [ ] Photo library access works

### Android
- [ ] Runs on Android 8+
- [ ] Works on small phones (5")
- [ ] Works on large phones (6.7"+)
- [ ] Google Sign-In works
- [ ] Camera permission flow works
- [ ] Storage permission flow works
- [ ] Back button behavior correct

---

## 🚀 Pre-Launch Checklist

### Code Quality
- [ ] No console.log (except __DEV__)
- [ ] TypeScript compiles without errors
- [ ] ESLint passes
- [ ] No floating promises
- [ ] No memory leaks

### Infrastructure
- [ ] Database backups configured
- [ ] Error tracking (Sentry) working
- [ ] Monitoring alerts set up
- [ ] API response times <500ms

### Documentation
- [ ] README updated
- [ ] Installation guide clear
- [ ] API docs complete
- [ ] Known issues documented

### Security
- [ ] Secrets not in code
- [ ] API keys rotated
- [ ] HTTPS enforced
- [ ] SQL injection prevented
- [ ] XSS protected

---

## 🧪 Final Verification (Pre-Production)

### Smoke Test Flow
1. [ ] Sign up as new user
2. [ ] Complete onboarding (coach path)
3. [ ] Create team
4. [ ] Create game
5. [ ] Upload post with photo/video
6. [ ] Share post to friend
7. [ ] Search for team
8. [ ] View highlights nearby
9. [ ] Create ad with promo code
10. [ ] Pay for subscription

**Expected Result:** All steps complete without errors

### Regression Test
- [ ] Test all user roles (coach, fan, admin)
- [ ] Test all major screens
- [ ] Test all buttons/forms
- [ ] Test error conditions
- [ ] Test on real devices (not simulator)

---

## ✅ Sign-Off

- [ ] QA tester: ________________  Date: ______
- [ ] Team lead: ________________  Date: ______
- [ ] Product owner: ________________  Date: ______

**Ready for production:** YES / NO

---

## 📝 Known Issues (If Any)

Document any bugs found during testing:

| Issue | Severity | Platform | Status |
|-------|----------|----------|--------|
| (Example) Search lag on Android | Medium | Android | Backlog |
| | | | |
| | | | |

---

**Next Steps After QA:**
1. Fix any critical issues (blockers)
2. Create GitHub issues for non-blocking bugs
3. Deploy to TestFlight (iOS) / Google Play Beta (Android)
4. Collect beta tester feedback
5. Production release (App Store / Play Store)
