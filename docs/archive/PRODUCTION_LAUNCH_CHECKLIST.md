# 🚀 VarsityHub Production Launch Checklist

## Current Status: Ready for Final Review
**Target Launch Date:** TBD
**App Version:** 1.0.0

---

## ✅ COMPLETED ITEMS

### 1. **App Configuration** ✅
- [x] App name: "VarsityHub"
- [x] Bundle ID (iOS): `com.xsantcastx.varsityhub`
- [x] Package name (Android): `com.xsantcastx.varsityhub`
- [x] Version: 1.0.0
- [x] Description ready
- [x] Deep linking configured: `varsityhubmobile://`

### 2. **Backend Infrastructure** ✅
- [x] Production API deployed on Railway: `https://api-production-8ac3.up.railway.app`
- [x] Database configured (Prisma + PostgreSQL)
- [x] Environment variables set
- [x] API endpoints tested
- [x] Team deletion endpoint implemented
- [x] Auth system working (email + Google OAuth)

### 3. **Features Completed** ✅
- [x] Onboarding flow (10 steps) with AsyncStorage persistence
- [x] Dark mode support (all screens)
- [x] Team management & deletion
- [x] Post creation & fullscreen media viewer
- [x] Messaging system
- [x] Payment integration (Stripe)
- [x] Ad system
- [x] Game/Event management
- [x] User profiles
- [x] Subscription tiers (Rookie/Veteran/Legend)

### 4. **Google OAuth** ✅
- [x] Android Client ID configured
- [x] iOS Client ID configured
- [x] Web Client ID configured
- [x] Expo Client ID configured

### 5. **Code Quality** ✅
- [x] All merge conflicts resolved
- [x] Code pushed to `main` and `develope` branches
- [x] TypeScript compilation clean
- [x] No critical errors

---

## ⚠️ ITEMS REQUIRING ATTENTION

### 📱 **App Store Assets** (CRITICAL)

#### Icons & Graphics
- [ ] **App Icon** (1024x1024 PNG)
  - Location: `./assets/images/icon.png`
  - Action: Verify it's production-ready, not placeholder
  
- [ ] **Adaptive Icon** (Android, 1024x1024 PNG)
  - Location: `./assets/images/adaptive-icon.png`
  - Action: Verify foreground image is correct
  
- [ ] **Splash Screen**
  - Location: `./assets/images/splash-icon.png`
  - Action: Verify splash screen displays correctly

#### Screenshots (REQUIRED for App Store & Play Store)
- [ ] **iPhone Screenshots** (6.5" & 5.5" displays)
  - [ ] 1. Onboarding/Welcome screen
  - [ ] 2. Feed/Home screen
  - [ ] 3. Team management
  - [ ] 4. Game details
  - [ ] 5. Messaging
  
- [ ] **Android Screenshots** (Phone & Tablet)
  - [ ] Same 5 screens as iPhone
  
- [ ] **iPad Screenshots** (12.9" & 11" displays)
  - [ ] Same 5 screens optimized for tablet

#### Store Listings
- [ ] **App Description** (Short & Full)
  - Short: < 80 characters
  - Full: < 4000 characters
  - Include keywords: sports, team, management, schedule, messaging
  
- [ ] **Keywords** (iOS, max 100 characters)
  - Suggested: "sports,team,schedule,coach,athlete,game,event,messaging"
  
- [ ] **Privacy Policy URL**
  - Action: Create and host privacy policy
  - Suggested: Use your website or GitHub Pages
  
- [ ] **Support URL**
  - Action: Create support page
  
- [ ] **Marketing URL** (optional)
  - Your website or landing page

### 🔐 **Security & Credentials**

#### Apple Developer Account
- [ ] Enrolled in Apple Developer Program ($99/year)
- [ ] **Apple ID**: Update in `eas.json` → `submit.production.ios.appleId`
- [ ] **App Store Connect App ID**: Update `ascAppId` in `eas.json`
- [ ] **Team ID**: Update `appleTeamId` in `eas.json`

#### Google Play Console
- [ ] Enrolled in Google Play ($25 one-time)
- [ ] **Service Account Key**: Create and save as `./service-account-key.json`
  - Instructions: https://docs.expo.dev/submit/android/

#### API Keys
- [ ] **Google Maps API Key** (iOS & Android)
  - Current: Empty in `app.json`
  - Action: Add production API keys
  - Get from: https://console.cloud.google.com/
  
- [ ] **Stripe Keys** (Production)
  - Check backend `.env` for production keys
  
- [ ] **Cloudinary** (Production)
  - Check backend `.env` for production keys

### 🔧 **Configuration Files**

#### app.json Updates Needed
```json
{
  "ios": {
    "config": {
      "googleMapsApiKey": "YOUR_IOS_GOOGLE_MAPS_KEY" // ⚠️ REQUIRED
    }
  },
  "android": {
    "config": {
      "googleMaps": {
        "apiKey": "YOUR_ANDROID_GOOGLE_MAPS_KEY" // ⚠️ REQUIRED
      }
    }
  }
}
```

#### eas.json Updates Needed
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "YOUR_APPLE_ID@email.com", // ⚠️ REQUIRED
        "ascAppId": "YOUR_APP_STORE_CONNECT_ID", // ⚠️ REQUIRED
        "appleTeamId": "YOUR_TEAM_ID" // ⚠️ REQUIRED
      }
    }
  }
}
```

### 🧪 **Testing** (HIGHLY RECOMMENDED)

- [ ] **Internal Testing** (TestFlight & Internal Testing Track)
  - [ ] Test on iOS devices (iPhone)
  - [ ] Test on Android devices (multiple manufacturers)
  - [ ] Test onboarding flow
  - [ ] Test payments
  - [ ] Test all major features
  
- [ ] **Beta Testing** (Optional but recommended)
  - [ ] Invite 10-50 beta testers
  - [ ] Collect feedback
  - [ ] Fix critical bugs

### 📝 **Legal & Compliance**

- [ ] **Privacy Policy** (REQUIRED)
  - Must include:
    - Data collection practices
    - Google OAuth usage
    - Payment processing (Stripe)
    - User content handling
    - Location data usage
    - Camera/Photo permissions
  
- [ ] **Terms of Service** (REQUIRED)
  
- [ ] **Age Rating**
  - Current assumption: 4+ (iOS) / Everyone (Android)
  - Review content guidelines

- [ ] **Export Compliance** (iOS)
  - Currently set: `ITSAppUsesNonExemptEncryption: false`
  - Review if app uses encryption beyond standard HTTPS

### 🌍 **Backend Production Checks**

- [ ] **Database Backups** configured on Railway
- [ ] **Environment Variables** all set in Railway dashboard
- [ ] **Custom Domain** (optional but professional)
  - Instead of: `api-production-8ac3.up.railway.app`
  - Use: `api.varsityhub.com`
  
- [ ] **Rate Limiting** configured
- [ ] **Error Logging** (Sentry, LogRocket, etc.)
- [ ] **Monitoring** (uptime checks)

---

## 🚀 BUILD & SUBMIT PROCESS

### Step 1: Update Version Numbers (if needed)
```bash
# In app.json, increment version
"version": "1.0.0" → "1.0.1" (for updates)
```

### Step 2: Build for Production

#### iOS Build
```bash
eas build --platform ios --profile production
```

#### Android Build
```bash
eas build --platform android --profile production
```

### Step 3: Submit to Stores

#### Submit to App Store
```bash
eas submit --platform ios --profile production
```

#### Submit to Play Store
```bash
eas submit --platform android --profile production
```

---

## 📊 POST-LAUNCH MONITORING

### Week 1 After Launch
- [ ] Monitor crash reports
- [ ] Check user reviews
- [ ] Monitor server load/performance
- [ ] Check payment processing
- [ ] Verify push notifications work
- [ ] Monitor API error rates

### Ongoing
- [ ] Set up analytics (Google Analytics, Mixpanel, etc.)
- [ ] Plan update schedule (bug fixes, features)
- [ ] Monitor App Store Connect metrics
- [ ] Monitor Play Console metrics

---

## 🆘 SUPPORT RESOURCES

- **Expo EAS Documentation**: https://docs.expo.dev/eas/
- **App Store Review Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Google Play Policies**: https://play.google.com/about/developer-content-policy/
- **Stripe Documentation**: https://stripe.com/docs

---

## ✅ FINAL PRE-LAUNCH CHECKLIST

Before running `eas build`:
1. [ ] All code committed and pushed to `main`
2. [ ] Version number updated in `app.json`
3. [ ] Google Maps API keys added
4. [ ] Apple Developer credentials in `eas.json`
5. [ ] Google Play service account key created
6. [ ] Privacy policy URL available
7. [ ] App icons verified
8. [ ] Screenshots prepared
9. [ ] Store descriptions written
10. [ ] Tested on physical devices

**Once all items are checked, you're ready to build and submit!** 🎉

---

## 📝 NOTES
- First-time App Store review typically takes 24-48 hours
- Google Play review typically takes a few hours to a day
- Always test on physical devices before submitting
- Keep builds organized with version tags in git
