# iOS Submission - API Key / App ID Mismatch Fix

## The Problem
Everything looks correct in App Store Connect UI, but Apple's API rejects it with "No suitable application records were found."

This means: **The App ID `com.varsithub.varsityhub` exists in App Store Connect dropdown, but Apple's API can't find it.** This happens when:

1. **App ID isn't fully registered in Apple Developer Portal**
2. **API key is from different team than the app**
3. **App ID exists but provisioning profile/certificate mismatch**

## The Fix (Do This Now)

### Step 1: Verify App ID in Apple Developer Portal
1. Go to [developer.apple.com](https://developer.apple.com)
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. **Search**: `com.varsithub.varsityhub`
4. **If NOT found**:
   - Click **+** → **App IDs** → **App**
   - Description: `VarsityHub Mobile`
   - Bundle ID: **Explicit** → `com.varsithub.varsityhub`
   - Capabilities: Enable **Sign in with Apple** (if needed)
   - **Register**
   - **Wait 5-10 minutes** for Apple to sync

### Step 2: Verify API Key Team Matches App Team
The API key `J67WW7D8NX` must be from the **same team** (`B5H8F69RW5`) as the app.

1. Go to [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access** → **Keys**
2. Find key `[Expo] EAS Submit 7OJCFT4BUb` (ID: `J67WW7D8NX`)
3. Verify it's under **Team ID**: `B5H8F69RW5`
4. If it's under a different team → **Create new API key** under correct team

### Step 3: Try Submit Again
After App ID is registered and API key matches:

```bash
eas submit --platform ios --latest
```

## Alternative: Submit Without ascAppId (Let EAS Find It)
I've already removed `ascAppId` from `eas.json`. EAS will try to find the app by bundle ID automatically. If it still fails, the App ID definitely isn't registered in Apple Developer.

## What I've Done
- ✅ Removed `ascAppId` from `eas.json` (so EAS searches by bundle ID)
- ✅ Set `credentialsSource: "remote"` (EAS manages credentials)

## Next Step
**Check if App ID `com.varsithub.varsityhub` exists in Apple Developer Portal.** If it doesn't, create it and wait 10 minutes, then try again.
