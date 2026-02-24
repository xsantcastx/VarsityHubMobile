# Apple Team ID Fix - Build Error Resolution

**Error:** `Unable to find a team with the given Team ID 'B5H8F69RW5' to which you belong`

**Date**: January 17, 2025  
**Status**: ⚠️ **Action Required**

---

## 🔴 Problem

The Team ID `B5H8F69RW5` in `eas.json` doesn't match your Apple Developer account, or you don't have access to that team.

---

## ✅ Solution Steps

### Step 1: Find Your Correct Team ID

**Option A: Apple Developer Portal**
1. Go to https://developer.apple.com/account
2. Sign in with your Apple ID
3. Click **Membership** in the sidebar
4. Your **Team ID** is displayed (format: `XXXXXXXXXX` - 10 characters)

**Option B: App Store Connect**
1. Go to https://appstoreconnect.apple.com
2. Sign in with your Apple ID
3. Click **Users and Access** → **Keys**
4. Your **Team ID** is shown at the top

**Option C: EAS CLI**
```bash
# Check if you're logged in
eas whoami

# Try to create a device (will show your Team ID)
eas device:create

# Or check credentials
eas credentials
```

**Option D: Xcode**
1. Open Xcode
2. Xcode → Settings → Accounts
3. Select your Apple ID
4. Your Team ID is shown under your name

---

### Step 2: Update eas.json

Once you have your correct Team ID, update `eas.json`:

```json
{
  "submit": {
    "production": {
      "ios": {
        "appleId": "sanchezemil82@gmail.com",
        "ascAppId": "6754257357",
        "appleTeamId": "YOUR_CORRECT_TEAM_ID"  // ← Update this
      }
    }
  }
}
```

**File Location:** `eas.json` (root directory)

---

### Step 3: Verify Apple ID Access

Make sure:
- ✅ Your Apple ID (`sanchezemil82@gmail.com`) has access to the team
- ✅ You're an **Admin** or **App Manager** (not just Developer)
- ✅ Your Apple Developer Program membership is active
- ✅ The App Store Connect App ID (`6754257357`) belongs to your team

---

### Step 4: Re-authenticate with EAS (if needed)

If credentials are stale:

```bash
# Log out
eas logout

# Log back in
eas login

# This will prompt for Apple ID and password
# Make sure to use the Apple ID that has access to the team
```

---

### Step 5: Verify Credentials

```bash
# Check your EAS account
eas whoami

# Check iOS credentials
eas credentials

# This should show your correct Team ID
```

---

### Step 6: Retry Build

After updating `eas.json`:

```bash
# Build again
eas build --platform ios --profile production
```

---

## 🔍 Common Issues

### Issue 1: Wrong Apple ID

**Symptom:** Team ID doesn't match

**Fix:**
- Make sure `appleId` in `eas.json` matches the Apple ID you use for App Store Connect
- Verify this Apple ID has access to the team

### Issue 2: Team Membership

**Symptom:** "Unable to find a team"

**Fix:**
- Check if your Apple ID is added to the team in App Store Connect
- Verify you have Admin or App Manager role (not just Developer)
- Contact team admin to add you if needed

### Issue 3: Expired Membership

**Symptom:** Access denied

**Fix:**
- Check if Apple Developer Program membership is active
- Renew if expired: https://developer.apple.com/programs/renew/

### Issue 4: Multiple Teams

**Symptom:** Wrong team selected

**Fix:**
- If you belong to multiple teams, make sure you're using the correct Team ID
- The Team ID should match the team that owns App ID `6754257357`

---

## 📋 Verification Checklist

Before retrying build:

- [ ] Found correct Team ID from Apple Developer Portal
- [ ] Updated `eas.json` with correct Team ID
- [ ] Verified Apple ID has access to the team
- [ ] Verified App Store Connect App ID belongs to your team
- [ ] Re-authenticated with EAS (if needed)
- [ ] Verified credentials with `eas credentials`

---

## 🚀 Quick Fix Command

After you find your Team ID, update `eas.json`:

```bash
# Edit eas.json
# Replace "B5H8F69RW5" with your correct Team ID
# Then commit and retry build
```

---

## 📞 Need Help?

If you can't find your Team ID or still have issues:

1. **Check Apple Developer Support:**
   - https://developer.apple.com/support
   - Contact Apple Developer Program Support

2. **Check EAS Documentation:**
   - https://docs.expo.dev/submit/ios/
   - https://docs.expo.dev/app-signing/managed-credentials/

3. **Common Solutions:**
   - Make sure you're using the Apple ID that created the App Store Connect app
   - Verify team membership in App Store Connect
   - Check if you need to accept team invitation

---

**Status**: ⚠️ **Action Required** - Update Team ID in `eas.json`  
**Next Step**: Find your correct Team ID and update `eas.json`
