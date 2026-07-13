# Apple Team ID Fix Instructions

## Problem

The build is failing with:

```
Apple 403 detected - Access forbidden.
Unable to find a team with the given Team ID 'B5H8F69RW5' to which you belong.
```

## Solution Applied

1. ✅ Removed hardcoded Team ID `B5H8F69RW5` from `ios/VarsityHub.xcodeproj/project.pbxproj`
2. ✅ Updated `eas.json` to not force a specific Team ID (let EAS auto-detect)

## Next Steps - Choose ONE Option:

### Option 1: Let EAS Auto-Detect (Recommended)

EAS will automatically use the Team ID from your Apple Developer account credentials.

**Verify your EAS credentials:**

```bash
eas build:configure
eas credentials
```

**If you need to re-authenticate:**

```bash
eas login
eas credentials
```

### Option 2: Use Your Correct Team ID

If you know your correct Apple Developer Team ID:

1. **Find your Team ID:**
   - Go to https://developer.apple.com/account
   - Click "Membership" in the sidebar
   - Your Team ID is listed there

2. **Update eas.json:**
   ```json
   {
     "build": {
       "production": {
         "ios": {
           "resourceClass": "m-medium",
           "appleTeamId": "YOUR_TEAM_ID_HERE"
         }
       }
     }
   }
   ```

### Option 3: Fix Access to Existing Team ID

If `B5H8F69RW5` is correct but you don't have access:

1. **Verify you're logged in with the correct Apple ID:**

   ```bash
   eas logout
   eas login
   ```

   Use the Apple ID that has access to Team ID `B5H8F69RW5`

2. **Check App Store Connect:**
   - Go to https://appstoreconnect.apple.com
   - Verify App ID `6754257357` belongs to Team ID `B5H8F69RW5`
   - If not, you may need to transfer the app or use a different Team ID

## After Making Changes

1. **Rebuild:**

   ```bash
   eas build --platform ios --profile production
   ```

2. **Monitor the build logs** to see which Team ID is being used

## Verification

After the build starts, check the logs. You should see either:

- EAS auto-detecting your Team ID successfully
- Or using the Team ID you specified in `eas.json`

If you still get errors, the issue is with your Apple Developer account credentials or permissions.
