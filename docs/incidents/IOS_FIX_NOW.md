# iOS Submission Fix - DO THIS NOW

## The Problem
App Store Connect app `6758399345` does NOT have bundle ID `com.varsithub.varsityhub` registered. Apple rejects the upload because the bundle IDs don't match.

## The Fix (Choose ONE)

### Option A: Create BRAND NEW App (Recommended - Clean Start)
1. Go to [App Store Connect](https://appstoreconnect.apple.com)
2. **My Apps** → **+** → **New App**
3. Fill in:
   - **Platform**: iOS
   - **Name**: VarsityHub
   - **Primary Language**: English (U.S.)
   - **Bundle ID**: **MUST SELECT `com.varsithub.varsityhub`** from dropdown
     - If it's NOT in dropdown → **STOP** → Go to Apple Developer first (see below)
   - **SKU**: `varsityhub-ios-new` (or any unique value)
4. **Create**
5. Copy the **NEW Apple ID** (number from URL or App Information)
6. **Paste it here** and I'll update `eas.json`

### Option B: Fix Existing App `6758399345` (If Possible)
1. Go to app `6758399345` in App Store Connect
2. **App Information** → **General Information**
3. Check **Bundle ID** field
4. If it shows something OTHER than `com.varsithub.varsityhub`:
   - **You CANNOT change bundle ID** after app creation
   - **You MUST create a new app** (go to Option A)

## CRITICAL: Verify App ID Exists First

Before creating the app, verify the App ID exists:

1. Go to [developer.apple.com](https://developer.apple.com)
2. **Certificates, Identifiers & Profiles** → **Identifiers**
3. Search for: `com.varsithub.varsityhub`
4. **If NOT found**:
   - Click **+** → **App IDs** → **App**
   - Description: `VarsityHub Mobile`
   - Bundle ID: **Explicit** → `com.varsithub.varsityhub`
   - Capabilities: Enable **Sign in with Apple**
   - **Register**
5. **Then** go back to App Store Connect and create the app

## What I Just Did
- ✅ Removed `ascAppId: "6758399345"` from `eas.json` (so it won't keep failing)
- ✅ Next submit will prompt you to select the correct app

## After You Create New App
1. **Paste the new Apple ID here**
2. I'll add it to `eas.json`
3. Run: `eas submit --platform ios --latest`
4. **It will work**
