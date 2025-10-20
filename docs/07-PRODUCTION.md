# 🚀 Production Deployment Guide

**Complete guide to deploying VarsityHub to App Store and Play Store**

---

## 📋 Pre-Launch Checklist

### ✅ Requirements Complete
- [x] App fully developed and tested
- [x] Backend deployed on Railway
- [x] Database configured
- [x] Dark mode implemented
- [x] All features working
- [x] Code committed to GitHub

### ⚠️ Requirements Needed

#### 1. **Apple Developer Account** ($99/year) ❗
- **Enroll**: https://developer.apple.com/programs/
- Get: Apple ID, Team ID, App Store Connect App ID

#### 2. **Google Play Developer** ($25 one-time) ❗
- **Enroll**: https://play.google.com/console/signup
- Get: Service account JSON key

#### 3. **Google Maps API Keys** ❗
- **Get from**: https://console.cloud.google.com/
- Need: iOS key + Android key

#### 4. **App Store Assets** ❗
- App icon (1024x1024)
- Screenshots (5+ per platform)
- App description
- Keywords

#### 5. **Privacy Policy & Terms** (online) ❗
- Host on website or GitHub Pages
- Get public URLs

---

## 🔑 Step 1: Configure API Keys

### Google Maps

**Add to `app.json`:**
```json
{
  "expo": {
    "ios": {
      "config": {
        "googleMapsApiKey": "YOUR_IOS_KEY"
      }
    },
    "android": {
      "config": {
        "googleMaps": {
          "apiKey": "YOUR_ANDROID_KEY"
        }
      }
    }
  }
}
```

---

## 🏗️ Step 2: Configure Build Settings

### Update `eas.json`:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "your-email@gmail.com",
        "ascAppId": "1234567890",
        "appleTeamId": "XXXXXXXXXX"
      },
      "android": {
        "serviceAccountKeyPath": "./service-account-key.json",
        "track": "production"
      }
    }
  }
}
```

---

## 📱 Step 3: Prepare App Store Assets

### Screenshots Required

**iPhone:**
- 6.5" display (iPhone 14 Pro Max, 15 Plus, etc.): 5 screenshots
- 5.5" display (iPhone 8 Plus, older): 5 screenshots

**iPad:**
- 12.9" display: 5 screenshots
- 11" display (optional): 5 screenshots

**Android:**
- Phone (1080x1920 min): 5 screenshots
- Tablet (optional): 2+ screenshots

**Recommended Screenshots:**
1. Onboarding/Welcome screen
2. Feed/Home screen
3. Team management
4. Game details
5. Messaging

### App Icon
- **Location**: `assets/images/icon.png`
- **Size**: 1024x1024 pixels
- **Format**: PNG
- **Requirements**: No transparency, no rounded corners

### App Description

**Short Description** (80 characters):
```
Sports team management platform for athletes, coaches, and fans
```

**Full Description** (4000 characters):
```
VarsityHub is the ultimate sports team management platform connecting athletes, coaches, and fans.

🏆 KEY FEATURES:

Team Management
• Create and manage multiple teams
• Add team members with roles
• Organize team hierarchy

Game Scheduling
• Schedule games and track results
• Manage season calendars
• Live score updates

Communication
• Real-time team messaging
• Direct messages
• Post updates with photos/videos

Event Management
• Create and manage events
• RSVP tracking
• Event reminders

Media Sharing
• Share game photos and videos
• Create highlight reels
• Team galleries

Premium Features
• Advanced analytics
• Priority support
• Enhanced storage
• Remove ads

PERFECT FOR:
- Youth sports leagues
- High school teams
- Club sports
- College intramurals
- Community leagues
- Recreational teams

SUBSCRIPTION TIERS:
• Rookie (Free): Basic features
• Veteran ($9.99/month): Enhanced tools
• Legend ($19.99/month): Premium experience

Download VarsityHub today and elevate your team!

PRIVACY & SECURITY:
We take your privacy seriously. See our privacy policy for details.

SUPPORT:
Questions? Contact us at support@varsityhub.com

Join thousands of teams using VarsityHub! 🚀
```

**Keywords** (iOS, 100 chars):
```
sports,team,schedule,coach,athlete,game,event,messaging,calendar,league
```

---

## 🏥 Step 4: Backend Production Check

### Railway Configuration

**Verify Environment Variables:**
```properties
✅ DATABASE_URL (PostgreSQL)
✅ JWT_SECRET
✅ STRIPE_SECRET_KEY (production key)
✅ STRIPE_WEBHOOK_SECRET
✅ STRIPE_PRICE_VETERAN
✅ STRIPE_PRICE_LEGEND
✅ SMTP credentials
✅ CLOUDINARY credentials
✅ GOOGLE_MAPS_API_KEY
```

**Switch to Production Keys:**
- Stripe: `sk_live_...` (not `sk_test_...`)
- All other services: Production credentials

---

## 🔨 Step 5: Build Production Apps

### Pre-Build Validation

```bash
# Run validation script
npm run validate:pre-launch
```

Fix any errors before proceeding.

### Build Commands

#### Interactive Build (Recommended)
```bash
npm run build:production
```

#### Build Specific Platform
```bash
# iOS only
npm run build:ios

# Android only
npm run build:android

# Both platforms
eas build --platform all --profile production
```

### Monitor Build

Builds run on EAS servers (10-20 minutes each):
- **Check status**: https://expo.dev/accounts/xsantcastx/projects/VarsityHubMobile/builds
- **Download**: Once complete, download files

---

## 📲 Step 6: Test Builds

### iOS Testing
1. Download `.ipa` file from EAS
2. Install via TestFlight or direct install
3. Test on real iPhone
4. Verify all critical features

### Android Testing
1. Download `.aab` file from EAS
2. Install on Android device
3. Test all critical features

**Test Checklist:**
- ✅ Sign up / Login
- ✅ Onboarding flow
- ✅ Team creation
- ✅ Game scheduling
- ✅ Post creation
- ✅ Messaging
- ✅ Payment flow
- ✅ Dark mode
- ✅ Maps display

---

## 📤 Step 7: Submit to Stores

### App Store Submission

```bash
npm run submit:ios
```

**Or manually:**
1. Open App Store Connect
2. Create new app
3. Fill in metadata:
   - App name: "VarsityHub"
   - Subtitle (optional)
   - Description
   - Keywords
   - Screenshots
   - Privacy policy URL
   - Support URL
4. Upload build (from EAS)
5. Set pricing: Free (with in-app purchases)
6. Submit for review

**Review Time**: 24-48 hours typically

### Play Store Submission

```bash
npm run submit:android
```

**Or manually:**
1. Open Play Console
2. Create new app
3. Fill in store listing:
   - App name: "VarsityHub"
   - Short description
   - Full description
   - Screenshots
   - App icon
4. Content rating questionnaire
5. Privacy policy URL
6. Upload build (from EAS)
7. Set pricing: Free (with in-app purchases)
8. Submit for review

**Review Time**: Few hours to 1 day

---

## 📝 Step 8: Complete Store Listings

### App Store Connect

**Required Fields:**
- ✅ App name
- ✅ Subtitle (optional but recommended)
- ✅ Description
- ✅ Keywords
- ✅ Screenshots (all sizes)
- ✅ Privacy policy URL
- ✅ Support URL
- ✅ Age rating: 4+
- ✅ Copyright
- ✅ Contact information

**In-App Purchases:**
- Configure Veteran subscription
- Configure Legend subscription

### Google Play Console

**Required Fields:**
- ✅ App name
- ✅ Short description (80 chars)
- ✅ Full description
- ✅ Screenshots
- ✅ App icon
- ✅ Feature graphic (1024x500)
- ✅ Privacy policy URL
- ✅ Content rating
- ✅ Target audience
- ✅ App category: "Sports"

---

## ⏱️ Step 9: Wait for Approval

### iOS Review Process
- **Time**: 24-48 hours (typically)
- **Status**: Check App Store Connect
- **Common rejections**:
  - Missing privacy policy
  - Broken features
  - Guideline violations
  - Metadata issues

### Android Review Process
- **Time**: Few hours to 1 day
- **Status**: Check Play Console
- **Common rejections**:
  - Content rating incomplete
  - Privacy policy issues
  - Permissions not justified

---

## 🎉 Step 10: Launch!

### Once Approved

**iOS:**
- App goes live immediately (or scheduled)
- Available in App Store
- Monitor App Store Connect analytics

**Android:**
- App published to Play Store
- Available worldwide (or selected countries)
- Monitor Play Console analytics

---

## 📊 Post-Launch Monitoring

### Week 1 Checklist
- [ ] Monitor crash reports
- [ ] Check user reviews
- [ ] Verify payment processing
- [ ] Monitor API error rates
- [ ] Check server performance
- [ ] Review analytics

### Ongoing Tasks
- Weekly: Check reviews and crashes
- Monthly: Review analytics
- Quarterly: Plan feature updates

---

## 🔄 Updating Your App

When you need to release an update:

### 1. Make Changes
```bash
# Make code changes
# Test thoroughly
```

### 2. Update Version
**In `app.json`:**
```json
{
  "expo": {
    "version": "1.0.1"  // Increment version
  }
}
```

### 3. Rebuild
```bash
npm run build:production
```

### 4. Resubmit
```bash
npm run submit:ios
npm run submit:android
```

---

## 💰 Cost Summary

| Item | Cost |
|------|------|
| Apple Developer Program | $99/year |
| Google Play Console | $25 one-time |
| EAS Build (free tier) | Free |
| Railway Hosting | ~$5-20/month |
| **Total First Year** | **~$184-$324** |

---

## 🆘 Troubleshooting

### Build Fails
- Check build logs on EAS
- Verify credentials configured
- Run `npm run lint` locally
- Check TypeScript errors

### Submission Rejected

**iOS Common Issues:**
- Missing or invalid privacy policy
- App crashes on review
- Incomplete metadata
- Guideline 4.3 (spam/duplicate)

**Android Common Issues:**
- Content rating incomplete
- Privacy policy not accessible
- Permissions not justified
- Inappropriate content

### Maps Not Working
- Verify API keys in `app.json`
- Check API restrictions in Google Cloud
- Enable required APIs:
  - Maps SDK for iOS
  - Maps SDK for Android
  - Geocoding API

---

## 📚 Resources

- **Expo EAS**: https://docs.expo.dev/eas/
- **App Store Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Play Store Policies**: https://play.google.com/about/developer-content-policy/
- **Stripe Docs**: https://stripe.com/docs
- **Google Maps**: https://developers.google.com/maps

---

## 🎯 Timeline Estimate

| Phase | Time |
|-------|------|
| Get accounts/keys | 1-2 days |
| Prepare assets | 2-3 hours |
| Configure build | 1 hour |
| Build apps | 1 hour (+ 20-40 min wait) |
| Test builds | 2-3 hours |
| Submit to stores | 1-2 hours |
| **Total Active Work** | **8-12 hours** |
| **Wait for Approval** | **1-3 days** |

---

**Good luck with your launch! 🚀📱**
