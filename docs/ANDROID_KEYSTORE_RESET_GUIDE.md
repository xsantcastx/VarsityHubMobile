# Android Upload Key Reset Guide

## Current Issue

The Android keystore SHA-1 fingerprint in EAS doesn't match the expected fingerprint in Google Play Console:

**Expected (in Play Console):**  
`FD:A8:46:D4:02:0D:4F:6C:85:04:00:59:BB:1E:10:DF:50:FE:BE:AF`

**Current (in EAS):**  
Different fingerprint (causing upload errors)

## Solution: Request Upload Key Reset

### Steps to Reset Upload Key in Google Play Console:

1. **Navigate to Google Play Console**
   - Go to https://play.google.com/console
   - Select "VarsityHub" app

2. **Access App Integrity Settings**
   - In the left sidebar, go to: **Release** → **Setup** → **App integrity**

3. **Request Upload Key Reset**
   - Scroll to the **"App signing"** section
   - Look for **"Upload key certificate"**
   - Click the **"Request upload key reset"** button
   - Follow the prompts to complete the request

4. **Wait for Google Approval**
   - Google will review your request (usually takes 1-2 business days)
   - You'll receive an email notification when approved

5. **After Approval**
   - Google will accept builds signed with the new EAS keystore
   - Run: `eas build --platform android --profile production`
   - Then: `eas submit --platform android --latest`

## Alternative: Restore Original Keystore

If you have access to the original keystore file with the correct fingerprint, you can:

1. Place it in `credentials/android/keystore.jks`
2. Update `credentials.json` with the correct passwords
3. Build immediately without waiting for Google approval

## Next Steps After Fix

```bash
# Build Android production app
eas build --platform android --profile production

# Submit to Google Play (internal track)
eas submit --platform android --latest
```

## Related Files

- `credentials/android/keystore.jks` - Current EAS-generated keystore
- `credentials.json` - Keystore configuration
- `android/app/build.gradle` - Android build configuration
