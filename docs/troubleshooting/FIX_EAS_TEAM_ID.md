# URGENT: Fix EAS Team ID Error - Clear Stored Credentials

## The Problem

EAS is using **cached credentials** with Team ID `B5H8F69RW5` that you don't have access to. This is stored on EAS servers, not in your project files.

## The Solution - Run These Commands:

### Step 1: Clear EAS Credentials

```bash
eas credentials
```

**Then follow these steps:**

1. Select **"iOS"** platform
2. Select your project
3. Choose **"Clear all credentials"** or find and delete the stored Team ID
4. Confirm deletion

### Step 2: Re-authenticate (if needed)

```bash
eas logout
eas login
```

**Important**: Use the Apple ID (`sanchezemil82@gmail.com`) that has access to your Developer Team.

### Step 3: Build Again

```bash
eas build --platform ios --profile production
```

EAS will now:

- ✅ Auto-detect your Team ID from your Apple Developer account
- ✅ Use the Team ID you have access to
- ✅ NOT use the old cached Team ID `B5H8F69RW5`

## Alternative: If You Know Your Correct Team ID

If you know your correct Team ID, you can specify it explicitly:

### Find Your Team ID:

1. Go to https://developer.apple.com/account
2. Click "Membership" in the sidebar
3. Copy your Team ID (10 characters)

### Add to eas.json:

```json
{
  "build": {
    "production": {
      "ios": {
        "resourceClass": "m-medium",
        "appleTeamId": "YOUR_CORRECT_TEAM_ID_HERE"
      }
    }
  }
}
```

## What Was Already Fixed:

✅ Removed hardcoded Team ID from `ios/VarsityHub.xcodeproj/project.pbxproj`  
✅ Removed `appleTeamId: null` from `eas.json` (now auto-detects)  
✅ Project is configured to let EAS auto-detect Team ID

## The Issue:

The Team ID `B5H8F69RW5` is **stored in EAS credentials cache** on Expo's servers. You need to clear it using the `eas credentials` command above.

## After Clearing Credentials:

The next build will use your Apple Developer account's Team ID automatically, which should be the one you have access to.
