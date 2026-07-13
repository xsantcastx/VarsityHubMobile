# iOS New App Store Connect Setup - Quick Checklist

## ✅ Current Configuration (All Set!)

Your project is configured with:

- **Bundle ID**: `com.varsithub.varsityhub` ✅
- **Team ID**: `B5H8F69RW5` ✅
- **Apple ID Email**: `sanchezemil82@gmail.com` ✅

## Steps to Create New App Store Connect App

### 1. Verify App ID Exists in Apple Developer

- Go to [developer.apple.com](https://developer.apple.com) → **Certificates, Identifiers & Profiles**
- **Identifiers** → Check if `com.varsithub.varsityhub` exists
- If **NOT**, create it:
  - Click **+** → **App IDs** → **App**
  - Description: `VarsityHub Mobile`
  - Bundle ID: **Explicit** → `com.varsithub.varsityhub`
  - Capabilities: Enable **Sign in with Apple** (if needed)
  - Register

### 2. Create New App in App Store Connect

- Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
- **My Apps** → **+** → **New App**
- Fill in:
  - **Platform**: iOS
  - **Name**: `VarsityHub` (or your preferred name)
  - **Primary Language**: English (U.S.)
  - **Bundle ID**: Select **`com.varsithub.varsityhub`** (from dropdown)
  - **SKU**: `varsityhub-ios` (must be unique)
- Click **Create**

### 3. Get the New Apple ID

- After creating, you'll be on the app's page
- The **Apple ID** is the **numeric ID** shown:
  - In the URL: `.../apps/APPLE_ID_HERE/appstore/...`
  - Or in **App Information** → **General Information** → **Apple ID**
- **Copy this number** (e.g., `1234567890`)

### 4. Update eas.json (After You Get Apple ID)

Once you have the new Apple ID, paste it here and I'll add it to `eas.json`:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "sanchezemil82@gmail.com",
      "ascAppId": "YOUR_NEW_APPLE_ID_HERE"
    }
  }
}
```

### 5. Build & Submit

```bash
# Build
eas build --platform ios --profile production

# Submit (after build completes)
eas submit --platform ios --latest
```

## Current Status

- ✅ Xcode project opened
- ✅ Development team set: `B5H8F69RW5`
- ✅ Bundle ID consistent: `com.varsithub.varsityhub`
- ✅ `eas.json` ready (no stale `ascAppId`)
- ⏳ **Waiting for**: New App Store Connect app creation + Apple ID

## Next Step

**Create the new app in App Store Connect** (steps 1-3 above), then **paste the new Apple ID here** and I'll configure `eas.json` immediately.
