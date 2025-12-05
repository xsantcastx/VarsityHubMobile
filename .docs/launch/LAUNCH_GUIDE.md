# 🚀 VarsityHub Production Launch Guide

## Quick Start

### 1. Validate Your Setup
```bash
npm run validate:pre-launch
```

This will check:
- ✅ All required configuration files
- ✅ Google Maps API keys
- ✅ App icons and assets
- ✅ Privacy policy and terms
- ✅ Environment variables

### 2. Build for Production

#### Option A: Interactive Build Script (Recommended)
```bash
npm run build:production
```

#### Option B: Build Specific Platform
```bash
# iOS only
npm run build:ios

# Android only
npm run build:android
```

### 3. Submit to Stores

After builds complete successfully:

```bash
# Submit to App Store
npm run submit:ios

# Submit to Play Store
npm run submit:android
```

---

## Prerequisites

### Required Before Building

1. **Apple Developer Account** ($99/year)
   - Enrolled at: https://developer.apple.com/programs/
   - Team ID, App ID, and Apple ID ready

2. **Google Play Developer Account** ($25 one-time)
   - Enrolled at: https://play.google.com/console/signup
   - Service account key created

3. **EAS CLI Installed**
   ```bash
   npm install -g eas-cli
   eas login
   ```

4. **Google Maps API Keys**
   - iOS key configured in `app.json`
   - Android key configured in `app.json`
   - Get keys from: https://console.cloud.google.com/

5. **App Store Assets**
   - App icon (1024x1024)
   - Screenshots for all device sizes
   - App description and keywords
   - Privacy policy URL
   - Support URL

---

## Configuration Checklist

### app.json
- [ ] Version number set correctly
- [ ] iOS Google Maps API key added
- [ ] Android Google Maps API key added
- [ ] Bundle identifier correct: `com.xsantcastx.varsityhub`
- [ ] Permissions properly configured

### eas.json
- [ ] Apple ID configured
- [ ] App Store Connect App ID configured
- [ ] Apple Team ID configured
- [ ] Google Play service account key path set

### .env
- [ ] Production API URL: `https://api-production-8ac3.up.railway.app`
- [ ] All Google OAuth client IDs configured
- [ ] Environment set to `production`

---

## Build Process

### What Happens During Build

1. **Code Compilation**
   - TypeScript → JavaScript
   - Assets optimized
   - Bundle created

2. **Platform-Specific**
   - **iOS**: `.ipa` file created for App Store
   - **Android**: `.aab` (App Bundle) or `.apk` file created

3. **Build Time**
   - Approximately 10-20 minutes per platform
   - Monitor progress at: https://expo.dev/builds

### Build Profiles

- **development**: For testing with Expo Go
- **preview**: For internal distribution (TestFlight/Internal Testing)
- **production**: For App Store/Play Store submission

---

## Submission Process

### iOS (App Store)

1. **Build Complete**
   - EAS creates `.ipa` file
   - Automatically signs with your certificates

2. **Auto-Submit** (if configured)
   ```bash
   npm run submit:ios
   ```
   - Uploads to App Store Connect
   - You review and submit for review

3. **Manual Submit**
   - Download `.ipa` from EAS
   - Upload via Transporter app or Xcode

4. **Review Process**
   - Apple reviews (typically 24-48 hours)
   - They may ask questions
   - Once approved, you set release date

### Android (Play Store)

1. **Build Complete**
   - EAS creates `.aab` (App Bundle)

2. **Auto-Submit** (if configured)
   ```bash
   npm run submit:android
   ```
   - Uploads to Play Console
   - Published to selected track

3. **Manual Submit**
   - Download `.aab` from EAS
   - Upload via Play Console

4. **Review Process**
   - Google reviews (typically few hours to 1 day)
   - Once approved, available in Play Store

---

## Post-Launch

### Monitor Your App

1. **App Store Connect** (iOS)
   - https://appstoreconnect.apple.com
   - Check downloads, ratings, crashes

2. **Play Console** (Android)
   - https://play.google.com/console
   - Check installs, ratings, crashes

3. **Backend Monitoring**
   - Railway dashboard for API health
   - Check error logs

### Update Process

When you need to release an update:

1. Make code changes
2. Update version in `app.json`
   ```json
   "version": "1.0.1" → "1.0.2"
   ```
3. Commit changes
4. Run build again:
   ```bash
   npm run build:production
   ```
5. Submit to stores

---

## Troubleshooting

### Build Fails

**Problem**: Build fails on EAS  
**Solution**: 
- Check build logs at expo.dev
- Verify all credentials are correct
- Ensure no TypeScript errors: `npm run lint`

### Submission Rejected

**iOS Rejection**  
Common reasons:
- Missing privacy policy
- Incomplete metadata
- Guideline violations
- Crashing on review

**Android Rejection**  
Common reasons:
- Missing content rating
- Privacy policy issues
- Permissions not justified

### API Keys Not Working

**Problem**: Google Maps not displaying  
**Solution**:
- Verify API keys in app.json
- Check API restrictions in Google Cloud Console
- Enable required APIs:
  - Maps SDK for iOS
  - Maps SDK for Android
  - Geocoding API

---

## Support Resources

- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **App Store Guidelines**: https://developer.apple.com/app-store/review/guidelines/
- **Play Console Help**: https://support.google.com/googleplay/android-developer/
- **VarsityHub Checklist**: See `PRODUCTION_LAUNCH_CHECKLIST.md`

---

## Emergency Contacts

- **EAS Support**: https://expo.dev/contact
- **Apple Developer Support**: https://developer.apple.com/contact/
- **Google Play Support**: https://support.google.com/googleplay/android-developer/

---

## Quick Commands Reference

```bash
# Validate setup
npm run validate:pre-launch

# Build (interactive)
npm run build:production

# Build specific platform
npm run build:ios
npm run build:android

# Submit to stores
npm run submit:ios
npm run submit:android

# Check build status
eas build:list

# Check EAS account
eas whoami

# Update EAS credentials
eas credentials
```

---

**Good luck with your launch! 🚀**

For detailed checklist, see: `PRODUCTION_LAUNCH_CHECKLIST.md`
