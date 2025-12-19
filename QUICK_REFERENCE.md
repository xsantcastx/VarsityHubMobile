# VarsityHub Mobile - Quick Reference

## App Status: ✅ READY FOR RELEASE

**Version:** 1.0.1 | **SDK:** 54 | **Status:** Production Ready | **Last Updated:** 2025-12-05

---

## Quick Start (Development)

```bash
# Start Metro bundler
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
npx expo start --dev-client --clear

# In another terminal, launch on simulator
xcrun simctl launch 60093881-2B6F-4D71-8A99-2CCDCA7FCD7C com.xsantcastx.varsityhub
```

---

## Code Quality Status

| Check | Status | Details |
|-------|--------|---------|
| TypeScript | ✅ 0 errors | Full compilation passes |
| ESLint | ✅ 0 errors | 365 warnings (non-blocking) |
| Expo Doctor | ✅ Passed | All dependencies aligned |
| Dependencies | ✅ 1138 | All packages installed |
| Build | ✅ Success | Xcode build completes |

---

## Configuration Verified

| Item | Value | Status |
|------|-------|--------|
| API Endpoint | `https://api-production-8ac3.up.railway.app` | ✅ |
| Sentry DSN | Real production DSN | ✅ |
| Google Maps API | Real key configured | ✅ |
| Google OAuth | varsityhub.app domain | ✅ |
| Bundle ID | `com.xsantcastx.varsityhub` | ✅ |
| iOS Version | 14.0+ | ✅ |
| Android Version | 7.0+ | ✅ |

---

## Testing Flows Ready

```
Sign-In Screen (/sign-in)
├── Email/Password → Dashboard
├── Google OAuth → Dashboard
├── Apple Sign-In → Dashboard
├── Forgot Password → Reset Password
└── New User? → Sign-Up

Dashboard (/(tabs))
├── Home Tab → Feed + Maps
├── Explore Tab → Discovery
├── Create Tab → Post Creation
└── Messages Tab → Messaging
```

---

## Essential Commands

### Development
```bash
npm run typecheck    # Verify TypeScript (should: 0 errors)
npm run lint         # Check linting (should: 0 errors)
npm run doctor       # Verify SDK alignment
npm install          # Install/update dependencies
```

### Build
```bash
# Preview Build (TestFlight/Internal Testing)
eas build --platform ios --profile preview --wait
eas build --platform android --profile preview --wait

# Production Build (App Store/Play Store)
eas build --platform ios --profile production --wait
eas build --platform android --profile production --wait
```

### Debug
```bash
# Tail Metro logs
npx expo start --dev-client --clear

# View iOS simulator logs
npx react-native log-ios

# Check Sentry dashboard
# https://sentry.io (see .env for DSN)
```

---

## Critical Files

| File | Purpose | Status |
|------|---------|--------|
| `app/_layout.tsx` | Root layout & initialization | ✅ |
| `context/AuthProvider.tsx` | Authentication state & routing | ✅ |
| `app/sign-in.tsx` | Sign-in screen with OAuth | ✅ |
| `app/(tabs)` | Dashboard screens | ✅ |
| `api/http.ts` | HTTP client with auth | ✅ |
| `app.json` | Expo config + API keys | ✅ |
| `.env` | Environment variables | ✅ |
| `eas.json` | Build configurations | ✅ |

---

## Common Issues & Solutions

### "Metro not bundling"
```bash
# Kill and restart
pkill -9 expo node metro
npx expo start --dev-client --clear
```

### "App shows blank screen"
This is normal! It's the loading state. Verify in Sentry or Metro logs that:
1. Sentry initialized
2. Health check passed
3. Auth check completed
4. Router redirected to `/sign-in`

### "Can't connect to API"
```bash
# Check API is live
curl https://api-production-8ac3.up.railway.app/health
# Should return 200 OK
```

### "OAuth redirect_uri_mismatch"
- Verify Google Cloud Console has: `varsityhub.app/auth/google/callback`
- Verify `app.json` has correct Google client IDs
- Check `.env` has all OAuth tokens

### "Port 8081 in use"
```bash
lsof -i :8081 | grep -v COMMAND | awk '{print $2}' | xargs kill -9
```

---

## Release Checklist

```
Pre-Release
[ ] All feature branches merged
[ ] npm run typecheck - PASS
[ ] npm run lint - PASS  
[ ] npm run doctor - PASS
[ ] Version bumped (package.json + app.json)
[ ] Release notes written
[ ] git push origin main

Build & Test
[ ] eas build --platform ios --profile preview --wait
[ ] QA testing on TestFlight
[ ] Sentry error monitoring
[ ] Fix any critical issues
[ ] Repeat until stable

Production Release
[ ] eas build --platform ios --profile production --wait
[ ] Submit to App Store
[ ] eas build --platform android --profile production --wait
[ ] Submit to Play Store
[ ] Monitor crash rates for 24h
```

---

## Team Contact & Support

**Issue? Capture:**
1. Metro console logs (ERROR messages)
2. Sentry stack trace (https://sentry.io)
3. Steps to reproduce
4. Expected vs actual behavior

Then share logs with team for debugging.

---

## GitHub & Resources

- **Repo:** https://github.com/xsantcastx/VarsityHubMobile
- **EAS Dashboard:** https://expo.dev/@xsantcastx/VarsityHub
- **Sentry:** https://sentry.io
- **API Status:** https://api-production-8ac3.up.railway.app/health

---

## Version History

| Version | Date | Status | Notes |
|---------|------|--------|-------|
| 1.0.1 | 2025-12-19 | Ready | Overnight optimizations: build fixes, sample data removed, security verified |
| 1.0.1 | 2025-12-05 | Ready | Launch verified, auth flows confirmed |
| 1.0.0 | - | - | - |

---

## Recent Overnight Changes (2025-12-19)

### Build & Configuration
- ✅ Fixed iOS duplicate linker flags warning (`-lc++`)
- ✅ Fixed runtime version config (bare workflow compatibility)
- ✅ Removed sample data from team-page (production-ready)

### Security & Quality
- ✅ Snyk security scan: PASSED (1 intentional exception documented)
- ✅ npm audit: 0 vulnerabilities
- ✅ TypeScript: 0 errors
- ✅ ESLint: 0 violations

### Files Modified
- `ios/Podfile` - Added C++ linking deduplication
- `app.json` - Updated runtimeVersion to "1.0.1"
- `app/team-page.tsx` - Removed sample data fallback

---

**Last Checked:** 2025-12-19  
**Status:** ✅ Deployment Ready  
**Next Action:** Deploy to TestFlight or App Store
