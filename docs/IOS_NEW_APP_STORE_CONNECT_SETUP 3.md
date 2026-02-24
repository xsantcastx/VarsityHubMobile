# iOS: Setting Up a Brand New App Store Connect App

## Current Configuration

- **Bundle ID**: `com.varsithub.varsityhub` (set in `app.json` and iOS project)
- **Current ASC App ID**: `6754257357` (in `eas.json` - this is the OLD app)

## Steps to Create New App in App Store Connect

### 1. Go to App Store Connect

Visit: https://appstoreconnect.apple.com

### 2. Create New App

1. Click **"My Apps"** → **"+"** → **"New App"**
2. Fill in:
   - **Platform**: iOS
   - **Name**: VarsityHub (or your preferred name)
   - **Primary Language**: English (or your choice)
   - **Bundle ID**: Select **`com.varsithub.varsityhub`**
     - If this bundle ID doesn't exist, you'll need to create it first:
       - Go to **Certificates, Identifiers & Profiles** → **Identifiers** → **"+"**
       - Select **App IDs** → **Continue**
       - Select **App**
       - Description: VarsityHub
       - Bundle ID: **`com.varsithub.varsityhub`** (use "Explicit")
       - Enable capabilities as needed (Sign in with Apple, Push Notifications, etc.)
       - **Register**
   - **SKU**: `varsityhub-ios` (or any unique identifier)
   - **User Access**: Full Access (or as needed)

3. Click **"Create"**

### 3. Get the New App's ASC App ID

After creating the app:
1. In App Store Connect, open your new app
2. Look at the URL - it will be something like:
   ```
   https://appstoreconnect.apple.com/apps/1234567890/appstore
   ```
   The number (`1234567890`) is your **ASC App ID**
3. Or go to **App Information** → The App ID is shown at the top

### 4. Update eas.json

Once you have the new ASC App ID, update `eas.json`:

```json
"submit": {
  "production": {
    "ios": {
      "appleId": "sanchezemil82@gmail.com",
      "ascAppId": "YOUR_NEW_ASC_APP_ID_HERE"  // ← Replace this
    }
  }
}
```

### 5. Verify Bundle ID Matches

Make sure your bundle ID is consistent everywhere:

- ✅ `app.json` → `ios.bundleIdentifier`: `com.varsithub.varsityhub`
- ✅ `ios/VarsityHub.xcodeproj/project.pbxproj`: `PRODUCT_BUNDLE_IDENTIFIER = com.varsithub.varsityhub`
- ✅ App Store Connect app: Bundle ID = `com.varsithub.varsityhub`

### 6. Build and Submit

After updating `eas.json`:

```bash
# Build iOS
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios --profile production
```

## Troubleshooting

**"No suitable application records were found"**
- Bundle ID mismatch: Verify the bundle ID in App Store Connect matches `com.varsithub.varsityhub`
- Wrong ASC App ID: Make sure `ascAppId` in `eas.json` matches the new app

**"Bundle ID already exists"**
- The bundle ID `com.varsithub.varsityhub` might already be registered
- Check **Certificates, Identifiers & Profiles** → **Identifiers**
- If it exists, you can use it - just make sure your app in App Store Connect uses this bundle ID

**"App not found"**
- Double-check the ASC App ID in the URL
- Make sure you're using the correct Apple ID account
- Verify the app was created successfully in App Store Connect

## Quick Checklist

- [ ] Bundle ID `com.varsithub.varsityhub` exists in Apple Developer Portal
- [ ] New app created in App Store Connect with bundle ID `com.varsithub.varsityhub`
- [ ] New ASC App ID copied from App Store Connect
- [ ] `eas.json` updated with new `ascAppId`
- [ ] `app.json` has `ios.bundleIdentifier: "com.varsithub.varsityhub"`
- [ ] iOS project has `PRODUCT_BUNDLE_IDENTIFIER = com.varsithub.varsityhub`
- [ ] Ready to build and submit!
