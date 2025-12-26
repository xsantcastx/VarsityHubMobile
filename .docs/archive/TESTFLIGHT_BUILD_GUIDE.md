# TestFlight Build & Submission Guide

**Status:** iOS Build in Progress  
**Date:** December 20, 2025  
**Version:** 1.0.1 (Build 53)  
**Target:** TestFlight for Real Device Testing

---

## 🚀 Quick Start

Your EAS build is in progress. To complete the TestFlight submission:

### Step 1: Provide Apple Credentials (If Prompted)
```bash
# If EAS asks for Apple account credentials, you have two options:

# Option A: Use App-Specific Password (Recommended for CI/CD)
# 1. Go to https://appleid.apple.com/account
# 2. Security → App Passwords
# 3. Generate password for "EAS Build"
# 4. Use that password when prompted

# Option B: Authenticate with Full Apple Account
# Just enter your Apple ID and password when prompted
```

### Step 2: Check Build Status
```bash
# Monitor the build progress:
eas build:list

# Or watch the build logs in real-time:
eas build:view --build-id <build-id>
```

### Step 3: Auto-Submit to TestFlight (If Using --auto-submit)
Once the build completes, it will automatically submit to TestFlight.

**Build config from eas.json:**
```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "sanchezemil82@gmail.com",
        "ascAppId": "6754257357",
        "appleTeamId": "B5H8F69RW5"
      }
    }
  }
}
```

---

## 📱 App Configuration

**Current Settings:**
- **App Name:** VarsityHub
- **Bundle ID:** com.lime_prod.varsityhub
- **Version:** 1.0.1
- **Build Number:** 53 (auto-incremented)
- **API URL:** https://api-production-8ac3.up.railway.app
- **Distribution:** TestFlight (via production profile)

---

## 🔧 Dev Code Setup (For Real Device Testing)

Your dev environment is configured with:

### API Configuration
```javascript
// Points to production backend
EXPO_PUBLIC_API_URL: "https://api-production-8ac3.up.railway.app"
EXPO_PUBLIC_FORCE_REMOTE_API: "1"  // Force use of remote API
```

### Google OAuth (Working)
- **iOS Client ID:** `316424843313-n0i9t49uoh2e9038m5b927vrm9cv77qr.apps.googleusercontent.com`
- **Android Client ID:** `316424843313-kte6qvms4kbmsii5o0b0o3jjndhs709s.apps.googleusercontent.com`

### Deep Links
- **App Scheme:** `varsityhubmobile://`
- **Web Base URL:** `https://varsityhub.app`

---

## ✅ Pre-TestFlight Checklist

- [x] Code is clean (all TypeScript errors fixed)
- [x] API endpoints configured (production Railway backend)
- [x] OAuth credentials set (Google sign-in ready)
- [x] Email system hardened (SendGrid templates with tracking suppression)
- [x] CI/CD workflows fixed (GitHub Actions passing)
- [x] Build number auto-incremented (52 → 53)
- [ ] TestFlight submission in progress...
- [ ] Real device testing ready

---

## 📋 Testing on Real Device

Once TestFlight build is ready, follow these steps:

### 1. Access TestFlight
```
Go to: https://testflight.apple.com
Sign in with: sanchezemil82@gmail.com
Select: VarsityHub v1.0.1
Tap: "Install" or "Update"
```

### 2. Test Key Flows
- [ ] **Sign In:** Google OAuth sign-in
- [ ] **Email Verification:** Check inbox for verification email
- [ ] **Create Team:** Create a test team
- [ ] **RSVP Event:** RSVP to an event (check email)
- [ ] **Deep Links:** Test varsityhubmobile:// scheme

### 3. Check Emails
All SendGrid templates are configured:
- ✅ Verification email (no {{tokens}}, links work)
- ✅ Event reminder (dynamic content populated)
- ✅ RSVP confirmed (no click-tracking wrapping)
- ✅ Password reset (deep link works)

### 4. Monitor Logs
```bash
# View app logs via Xcode
# Or check server logs:
railway logs -f
```

---

## 🔗 Important Links

| Resource | URL |
|----------|-----|
| **TestFlight** | https://testflight.apple.com |
| **App Store Connect** | https://appstoreconnect.apple.com |
| **EAS Dashboard** | https://expo.dev/accounts/lime_prod/projects/varsityhub/builds |
| **Railway Backend** | https://api-production-8ac3.up.railway.app |
| **GitHub Repo** | https://github.com/xsantcastx/VarsityHubMobile |

---

## 🚨 Troubleshooting

### Build Fails: "Apple credentials not found"
**Solution:**
```bash
# Log in to Apple account:
eas account:login
# Or use app-specific password (see Step 1 above)
```

### TestFlight Not Showing Build
**Wait Time:** 5-15 minutes after successful build submission  
**Status:** Check App Store Connect → TestFlight → Builds

### Deep Links Not Working
**Check:** Verify `varsityhubmobile://` scheme is configured in provisioning profile

### Emails Not Arriving
**Check:**
1. SendGrid API key configured in Railway
2. Template IDs set in `.env`
3. Server logs for SendGrid errors: `railway logs -f`

---

## 📊 Build Progress

**Status:** IN PROGRESS  
**Build ID:** (Check with `eas build:list`)  
**Expected Time:** 10-15 minutes  
**Next Step:** Auto-submit to TestFlight (if using --auto-submit flag)

---

## 🎯 Next Actions

1. **Monitor build:** `eas build:list`
2. **Wait for TestFlight:** 5-15 minutes after build completes
3. **Install on device:** Open TestFlight app on iPhone
4. **Test real flows:** Follow "Testing on Real Device" section
5. **Report issues:** Check server logs and SendGrid activity

You're all set! TestFlight build is underway. 🚀

