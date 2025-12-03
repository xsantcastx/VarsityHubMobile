# VarsityHub Production Launch Readiness Checklist

**Date:** December 2, 2025  
**Target Launch:** ~10-14 days (mid-December)

---

## ✅ COMPLETED

### TypeScript & Build Stability
- [x] Added `typecheck` script to package.json
- [x] Fixed critical TS errors (50+ → 13 remaining)
- [x] Installed expo-clipboard for share functionality
- [x] Fixed auth hooks (useGoogleAuth) compatibility
- [x] Fixed token imports and missing style properties
- [x] Converted server seed script to ESM

### Code Quality
- [x] Fixed mobile-community EventMap type issues
- [x] Fixed onboarding step-10 isCoach scope
- [x] Fixed uploadAvatar import mismatches
- [x] API import corrections (Team.listFollowed → User.following)

---

## 🟡 IN PROGRESS

### Auth E2E Verification (CRITICAL - Day 1)
- [ ] Test registration flow
- [ ] Verify email delivery (SendGrid dynamic template)
- [ ] Test verification link/code
- [ ] Confirm email_verified flag set
- [ ] Test login with verified account
- [ ] Test logout
- [ ] Test password reset flow
- [ ] Test on iOS simulator
- [ ] Test on Android simulator
- [ ] Test on real device

**Blockers to resolve:**
- Verify SendGrid template variables match (`verification_link`, `user_name`)
- Confirm SMTP fallback works if template fails
- Check server logs for delivery confirmation

---

## 📋 TODO - CRITICAL PATH

### Critical Flows Smoke Test (Day 2-3)
- [ ] **Onboarding Flow**
  - [ ] Role selection (fan/coach)
  - [ ] Basic info (username, DOB, zip)
  - [ ] Plan selection (coaches only)
  - [ ] Organization/team creation
  - [ ] Profile setup
  - [ ] Confirmation screen
  - [ ] Navigate to main app

- [ ] **Post Creation & Feed**
  - [ ] Create image post
  - [ ] Create video post
  - [ ] Create collage
  - [ ] Delete post
  - [ ] Edit post
  - [ ] Vertical feed viewer
  - [ ] Comment on post
  - [ ] Like/upvote post

- [ ] **EventMap & Games**
  - [ ] View events on map
  - [ ] Tap event marker → navigate to game details
  - [ ] Check coordinate rendering (numeric lat/lng)
  - [ ] Filter by zip code
  - [ ] Calendar view

- [ ] **Team Hub**
  - [ ] View upcoming events
  - [ ] Countdown timer display
  - [ ] Navigate to event details
  - [ ] Create new team (coaches)
  - [ ] Manage team members

- [ ] **Notifications**
  - [ ] Request push permissions
  - [ ] Receive test notification
  - [ ] Tap notification → navigate correctly

### Privacy & Permissions (Day 3-4)
- [ ] **Permission Prompts**
  - [ ] Camera (clear justification)
  - [ ] Photos (clear justification)
  - [ ] Location (clear justification)
  - [ ] Microphone (clear justification)
  - [ ] Push notifications (clear justification)

- [ ] **Privacy Policy**
  - [x] Privacy policy file exists
  - [ ] Link in app settings
  - [ ] Link in onboarding
  - [ ] Review and update last updated date
  - [ ] Confirm compliance with Apple/Google requirements

- [ ] **Terms of Service**
  - [x] Terms file exists
  - [ ] Link in app settings
  - [ ] Link in registration
  - [ ] Review and finalize

- [ ] **Data Collection Disclosure**
  - [ ] List all data collected
  - [ ] Explain usage for each data type
  - [ ] Third-party services disclosed (Stripe, Cloudinary, Google)
  - [ ] Retention policies documented

### Build Configuration (Day 4-5)
- [ ] **app.json Review**
  - [x] Bundle identifiers correct (com.xsantcastx.varsityhub)
  - [x] Scheme configured (varsityhubmobile)
  - [x] Permissions declared
  - [x] Usage descriptions present
  - [ ] Update version to 1.0.0 (currently set)
  - [ ] Add Google Maps API keys (currently empty)
  - [ ] Verify icon assets exist
  - [ ] Verify splash screen assets exist

- [ ] **eas.json Review**
  - [x] Production build profile configured
  - [x] Auto-increment enabled
  - [x] Google OAuth client IDs set
  - [x] API URL set to production
  - [ ] Update Apple ID in submit config
  - [ ] Update ASC App ID
  - [ ] Update Apple Team ID
  - [ ] Create/upload Android service account key

- [ ] **Environment Variables**
  - [x] EXPO_PUBLIC_API_URL (production Railway)
  - [x] Google OAuth client IDs (iOS, Android, Web)
  - [ ] Stripe publishable key (verify production key)
  - [ ] Verify all .env variables documented

### Store Assets Preparation (Day 5-7)
- [ ] **App Icons**
  - [ ] iOS icon (1024x1024)
  - [ ] Android adaptive icon
  - [ ] Verify no transparency issues

- [ ] **Screenshots**
  - [ ] iOS 6.7" (iPhone 15 Pro Max) - 3-10 images
  - [ ] iOS 6.5" (iPhone 14 Pro Max) - 3-10 images
  - [ ] iOS 5.5" (iPhone 8 Plus) - optional
  - [ ] iPad Pro 12.9" - optional
  - [ ] Android Phone - 2-8 images
  - [ ] Android Tablet - optional
  - **Recommended screens to capture:**
    - Onboarding flow
    - Feed with posts
    - Event map view
    - Team hub with countdown
    - Profile page
    - Create post flow

- [ ] **Preview Videos** (Optional but recommended)
  - [ ] iOS App Preview (15-30 sec)
  - [ ] Android Feature Graphic (1024x500)

- [ ] **Store Metadata**
  - [ ] **App Name**: VarsityHub (confirm availability)
  - [ ] **Subtitle/Short Description**: "Connect your sports community"
  - [ ] **Description**: Detailed feature list and benefits
  - [ ] **Keywords**: "sports, teams, coach, athlete, events, games" (100 char max iOS)
  - [ ] **Category**: Sports or Social Networking
  - [ ] **Age Rating**: 13+ (verify content)
  - [ ] **Support URL**: https://varsityhub.com/support (create if needed)
  - [ ] **Marketing URL**: https://varsityhub.com (optional)
  - [ ] **Privacy Policy URL**: Host on web and link

### Testing & Quality (Day 7-9)
- [ ] **Device Testing**
  - [ ] iOS 17+ on iPhone 14/15
  - [ ] iOS 16 on iPhone 13
  - [ ] Android 13+ on Pixel/Samsung
  - [ ] Android 12 on older device
  - [ ] Tablet (iPad/Android) if supported

- [ ] **Network Conditions**
  - [ ] Test with slow 3G
  - [ ] Test offline behavior
  - [ ] Test timeout handling (60s limit)
  - [ ] Verify no red error screens on aborts

- [ ] **Performance**
  - [ ] App launch time < 3 seconds
  - [ ] No memory leaks in feed scrolling
  - [ ] Video playback smooth
  - [ ] Image loading optimized

- [ ] **Accessibility**
  - [ ] VoiceOver/TalkBack support
  - [ ] Color contrast ratios
  - [ ] Text scaling support
  - [ ] Touch target sizes (44x44 pt minimum)

### Pre-Launch Final Checks (Day 10-12)
- [ ] **Legal & Compliance**
  - [ ] Terms of Service reviewed by legal (if applicable)
  - [ ] Privacy Policy reviewed by legal (if applicable)
  - [ ] GDPR compliance (if EU users)
  - [ ] COPPA compliance (age 13+ enforced)
  - [ ] App Store Review Guidelines compliance

- [ ] **Payment Integration**
  - [ ] Stripe test mode → production mode
  - [ ] Verify coach subscription plans work
  - [ ] Test payment failure handling
  - [ ] Test subscription cancellation
  - [ ] Verify receipt validation

- [ ] **Backend Production**
  - [ ] Database backups configured
  - [ ] Rate limiting enabled
  - [ ] Error monitoring (Sentry/similar)
  - [ ] Server health checks
  - [ ] Email delivery confirmed (SendGrid production)
  - [ ] CDN/Cloudinary production keys

- [ ] **Build & Submit**
  - [ ] Run production build: `eas build --platform ios --profile production`
  - [ ] Run production build: `eas build --platform android --profile production`
  - [ ] Test builds on real devices
  - [ ] Upload to TestFlight
  - [ ] Internal testing (5-10 testers, 2-3 days)
  - [ ] Fix critical bugs from testers
  - [ ] Submit to App Store
  - [ ] Submit to Google Play

---

## 📊 TIMELINE ESTIMATE

| Phase | Duration | Days |
|-------|----------|------|
| **Auth E2E + Critical Flows** | Complete core functionality testing | 1-3 |
| **Privacy & Permissions** | Compliance and disclosure | 1-2 |
| **Build Config & Assets** | Prepare for stores | 2-3 |
| **Testing & QA** | Device and network testing | 2-3 |
| **Pre-Launch & Review** | Final checks and submission | 2-3 |
| **App Review Process** | Apple: 1-3 days, Google: 1-2 days | 1-3 |

**Total:** 10-14 days to public availability

---

## 🚨 KNOWN BLOCKERS

### High Priority
1. **Google Maps API Keys**: Currently empty in app.json (iOS & Android)
2. **Apple Submission Info**: Need appleId, ascAppId, appleTeamId in eas.json
3. **Android Service Account**: Need service-account-key.json for Play Store
4. **Email Verification**: Must confirm SendGrid template works E2E

### Medium Priority
1. **Remaining TS Errors**: 13 non-blocking errors (team-contacts hoisting, Textarea imports)
2. **Privacy/Terms Links**: Need in-app links to web-hosted policies
3. **Stripe Production**: Verify production publishable key is set

### Low Priority
1. **Icon/Splash Assets**: Verify all sizes generated correctly
2. **Feature Graphics**: Android promotional graphics

---

## 📝 NOTES

- Backend is deployed to Railway production
- OAuth credentials configured for all platforms
- Database migrations applied
- Server health endpoint working (`/health`)
- SendGrid configured with dynamic template
- SMTP fallback configured

**Next Immediate Action:** Complete Auth E2E verification testing with email delivery confirmation.
