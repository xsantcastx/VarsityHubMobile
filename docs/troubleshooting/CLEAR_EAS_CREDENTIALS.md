# Clear EAS Credentials to Fix Team ID Issue

## Problem
EAS is still trying to use Team ID `B5H8F69RW5` that you don't have access to. This is likely stored in EAS credentials cache.

## Solution: Clear and Reset EAS Credentials

### Step 1: Clear Existing iOS Credentials

Run this command to clear stored credentials:
```bash
eas credentials
```

Then:
1. Select "iOS" platform
2. Select your project
3. Choose "Clear all credentials" or manually delete the stored Team ID

### Step 2: Re-authenticate with Correct Apple ID

Make sure you're logged in with the Apple ID that has access to your Developer Team:
```bash
eas logout
eas login
```

**Important**: Use the Apple ID that has access to the Team ID you want to use.

### Step 3: Let EAS Auto-Detect Team ID

The project is now configured to NOT specify a Team ID. EAS will auto-detect it from:
- Your Apple Developer account credentials
- The bundle identifier `com.varsithub.varsityhub` 
- Your App Store Connect account

### Step 4: Build Again

```bash
eas build --platform ios --profile production
```

EAS will now:
1. Check your Apple Developer account
2. Find the Team ID associated with your account
3. Use that Team ID automatically

## Alternative: Specify Correct Team ID Explicitly

If you know your correct Team ID and want to use it:

1. **Find your Team ID:**
   - Go to https://developer.apple.com/account
   - Click "Membership" in the sidebar
   - Copy your Team ID

2. **Add to eas.json:**
   ```json
   {
     "build": {
       "production": {
         "ios": {
           "resourceClass": "m-medium",
           "appleTeamId": "YOUR_CORRECT_TEAM_ID"
         }
       }
     }
   }
   ```

## Verification

After clearing credentials and building, check the build logs. You should see:
- ✅ EAS auto-detecting your Team ID successfully
- ✅ No more "403 Access forbidden" errors
- ✅ Build proceeding with correct Team ID

## If Still Failing

If you still get errors after clearing credentials:

1. **Verify App Store Connect Access:**
   - Go to https://appstoreconnect.apple.com
   - Make sure you can see the app with ID `6754257357`
   - Check that it's under the correct Team ID

2. **Check Bundle Identifier:**
   - Current: `com.varsithub.varsityhub`
   - Make sure this bundle ID exists in your Apple Developer account
   - Make sure it's under the Team ID you have access to

3. **Contact Apple Developer Support:**
   - If Team ID `B5H8F69RW5` was transferred or changed
   - You may need to update App Store Connect settings
