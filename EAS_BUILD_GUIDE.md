# EAS Build & Release Configuration

## Current Status

**App:** VarsityHub Mobile v1.0.1 (SDK 54)  
**Status:** Ready for EAS builds  
**Last Verified:** 2025-12-05  

## EAS Configuration

### Files
- `eas.json` - Build profiles configured
- `app.json` - Expo configuration with Google Maps key
- `.env` - All secrets and API endpoints configured

### Build Profiles Available

#### iOS Preview Build
```bash
eas build --platform ios --profile preview
```
- **Target:** TestFlight (Ad Hoc)
- **Signing:** Automatic
- **Distribution:** TestFlight beta
- **Use Case:** QA testing before production

#### iOS Production Build
```bash
eas build --platform ios --profile production
```
- **Target:** App Store
- **Signing:** App Store distribution
- **Distribution:** App Store Connect
- **Requirements:** App Store Connect credentials

#### Android Preview Build
```bash
eas build --platform android --profile preview
```
- **Target:** Internal testing track
- **Build Type:** APK or AAB
- **Distribution:** Google Play internal testing
- **Use Case:** QA testing before production

#### Android Production Build
```bash
eas build --platform android --profile production
```
- **Target:** Google Play Store
- **Build Type:** AAB (Android App Bundle)
- **Distribution:** Google Play Store
- **Requirements:** Play Console credentials

---

## Build Steps

### 1. Verify Code Ready
```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

# Ensure all tests pass
npm run typecheck   # ✅ 0 errors expected
npm run lint        # ✅ 0 errors expected
npm run doctor      # ✅ Passed expected
```

### 2. Commit & Push Latest
```bash
git status          # Verify working tree clean
git log --oneline -5  # Check recent commits
git push origin main
```

### 3. Build for Preview (Testing)

#### iOS Preview (TestFlight)
```bash
eas build --platform ios --profile preview --wait
```

Expected output:
```
✅ Build started
📱 Build URL: https://expo.dev/@xsantcastx/VarsityHub/builds/[BUILD_ID]
⏱️  Estimated time: 10-15 minutes
```

Once build completes:
1. Open Expo dashboard URL
2. Download provisioning profile if needed
3. Visit TestFlight in App Store Connect
4. Invite testers
5. Distribute beta build

#### Android Preview (Google Play Internal)
```bash
eas build --platform android --profile preview --wait
```

Once build completes:
1. Sign into Google Play Console
2. Go to Internal testing track
3. Upload AAB
4. Create testers group
5. Send invite link

### 4. Testing (Phase)
- Distribute to QA team
- Collect feedback on TestFlight/Google Play Console
- Monitor Sentry for crash reports
- Track issues in GitHub

### 5. Build for Production (Release)

#### iOS Production (App Store)
```bash
eas build --platform ios --profile production --wait
```

Once complete:
1. Upload to App Store Connect
2. Add release notes
3. Submit for review
4. Apple review: 24-48 hours
5. Release to App Store

#### Android Production (Google Play Store)
```bash
eas build --platform android --profile production --wait
```

Once complete:
1. Upload to Google Play Console
2. Add release notes
3. Set release type (Staged Rollout recommended for first release)
4. Submit for review
5. Google review: Usually <24 hours
6. Monitor crash/ANR rates

---

## Build Monitoring

### During Build
```bash
# Watch build progress
eas build --platform ios --profile preview

# Or check status in dashboard
open https://expo.dev/@xsantcastx/VarsityHub/builds
```

### After Build
1. **Check Sentry** - Monitor error rates
2. **Review TestFlight Feedback** - Bug reports from testers
3. **Monitor Crashes** - ANR rates, unhandled exceptions
4. **Check Analytics** - Session counts, user retention

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Build fails | Check `git log`, verify .env secrets, run `npm install` |
| Signing errors | Verify Apple Developer credentials in EAS settings |
| Play Store rejection | Check Google Play policies, review app behavior |
| Slow builds | Can take 15-20 min first time; subsequent builds faster |

---

## Environment Variables Required

Verify these are in `.env` before building:

```
# Required for all builds
EXPO_PUBLIC_SENTRY_DSN=https://[...].ingest.sentry.io/[...]
EXPO_PUBLIC_API_URL=https://api-production-8ac3.up.railway.app
EXPO_PUBLIC_APP_SCHEME=varsityhubmobile
EXPO_PUBLIC_NODE_ENV=production

# OAuth Configuration
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=[...]
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=[...]
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=[...]
EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID=[...]

# Payment & Other
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=[...]
EXPO_PUBLIC_ADMIN_EMAILS=[...]
```

All values should be production/verified values (not test keys).

---

## Release Checklist

### Pre-Build
- [ ] All feature branches merged to main
- [ ] `npm run typecheck` passes (0 errors)
- [ ] `npm run lint` passes (0 errors)
- [ ] `npm run doctor` passes
- [ ] Version bumped in `package.json` and `app.json`
- [ ] Release notes written
- [ ] Changelog updated
- [ ] All commits pushed to main

### Build Phase
- [ ] Preview build completes successfully
- [ ] QA testing passes (no critical bugs)
- [ ] Sentry error rate normal
- [ ] TestFlight distributed to testers
- [ ] Internal feedback collected

### Production Release
- [ ] All QA feedback addressed
- [ ] Production build created
- [ ] App Store/Play Store submission ready
- [ ] Release notes final
- [ ] Team notified of release schedule

### Post-Release
- [ ] Monitor Sentry for crashes
- [ ] Check crash/ANR rates for 24 hours
- [ ] Monitor store ratings/reviews
- [ ] Plan next version improvements

---

## Useful Links

- **EAS Dashboard:** https://expo.dev/@xsantcastx/VarsityHub
- **App Store Connect:** https://appstoreconnect.apple.com
- **Google Play Console:** https://play.google.com/console
- **Sentry Project:** https://sentry.io (Check .env for DSN)
- **GitHub Repo:** https://github.com/xsantcastx/VarsityHubMobile

---

## Build History

| Version | Platform | Status | Date | Notes |
|---------|----------|--------|------|-------|
| 1.0.1 | iOS/Android | Ready for build | 2025-12-05 | Launch verification complete |

---

**Next Action:** When ready to test, run:
```bash
eas build --platform ios --profile preview --wait
```

This will create a TestFlight build for QA team to test before production release.
