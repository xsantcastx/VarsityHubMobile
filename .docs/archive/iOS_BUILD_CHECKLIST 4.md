# iOS Build & Deployment Checklist

## Pre-Build (Run Locally)

### 1. Set Apple Credentials
```bash
export EXPO_APPLE_ID="your-apple-id@email.com"
export EXPO_APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"  # App-specific password from appleid.apple.com
```

**How to get app-specific password:**
- Visit https://appleid.apple.com/account/security
- Sign in
- Click "App-Specific Passwords" under Security
- Select "Other (Custom description)" and type "VarsityHub EAS"
- Copy the 16-character password

### 2. Verify Build Prerequisites
```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
npm run typecheck        # Should pass with 0 errors
npm audit               # Should show 0 vulnerabilities
git status              # Should be clean (no uncommitted changes)
```

### 3. Run EAS Production Build
```bash
# Option A: Automated script (recommended)
./eas-build-ios.sh

# Option B: Manual command
eas build --platform ios --profile production --non-interactive

# Option C: Interactive (EAS will prompt)
eas build --platform ios --profile production
```

---

## During Build (~30-45 minutes)

- Monitor progress at: https://expo.dev/accounts/lime_prod/projects/varsityhub/builds
- EAS will:
  1. Validate credentials
  2. Download dependencies
  3. Build React Native bundle
  4. Compile iOS app
  5. Sign with Apple certificate
  6. Create IPA artifact

---

## Post-Build

### If Build Succeeds ✅

**Option 1: Submit to TestFlight**
1. Open EAS dashboard link from build output
2. Click "Review on App Store Connect"
3. Complete TestFlight submission form
4. Invite testers via email

**Option 2: Download IPA**
1. Go to build details in EAS
2. Click "Download artifact"
3. Use Xcode Organizer or Apple Configurator 2 to install on device

### If Build Fails ❌

1. Check build logs in EAS dashboard
2. Common issues:
   - **Expired credentials:** Refresh app-specific password
   - **Certificate expired:** Renew in Apple Developer account
   - **Code signing:** Verify `B5H8F69RW5` team is correct
   - **Network:** Retry after confirming internet connection

---

## EAS Configuration Reference

**File:** `eas.json`  
**Profile:** `production`

Current settings:
```json
{
  "cli": {
    "version": ">= 11.0.0"
  },
  "build": {
    "production": {
      "ios": {
        "profile": "release"
      }
    }
  }
}
```

---

## Rollback / Recovery

If build artifacts are corrupted or need to be reset:

```bash
# Clear EAS build cache (optional)
eas build:cancel <build-id>

# Clean local build artifacts
rm -rf .eas/build

# Retry build
./eas-build-ios.sh
```

---

## Monitoring & Debugging

**Check build status:**
```bash
eas build:list --limit 10
```

**View live logs:**
```bash
eas build:view <build-id>
```

**Inspect app.json configuration:**
```bash
cat app.json | grep -A 10 '"ios"'
```

---

## Success Criteria

✅ Build submitted to EAS  
✅ Build completes without errors  
✅ IPA artifact available for download  
✅ TestFlight build available in App Store Connect  
✅ QA testers can access via TestFlight link  

---

**Last Updated:** December 19, 2025  
**Branch:** `chore/deploy-checklist`  
**Status:** Ready for build submission
