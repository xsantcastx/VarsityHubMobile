# Fix: "No suitable application records were found" (iOS Submit)

## What’s wrong

Your build uses bundle ID **`com.varsithub.varsityhub`**, but the App Store Connect app you’re submitting to (**6758399345**) is not set up for that bundle ID. Apple requires an exact match.

## Fix (choose one path)

### Path A: App 6758399345 has the wrong bundle ID

1. **Check the app’s bundle ID**
   - Go to [App Store Connect](https://appstoreconnect.apple.com) → **My Apps** → open the app (the one with Apple ID **6758399345**).
   - Go to **App Information** (under General).
   - Look at **Bundle ID**.
     - If it shows something other than **`com.varsithub.varsityhub`** (e.g. `com.varsityhubmobile.app`), that’s the cause.

2. **You cannot change a bundle ID** for an existing app. So you have two options:
   - **Option 1 – Use this app:** Change your project to match that app’s bundle ID (not recommended if you want to keep `com.varsithub.varsityhub`).
   - **Option 2 – Keep your bundle ID (recommended):** Create a **new** app in App Store Connect and, when asked for **Bundle ID**, choose the identifier that is **`com.varsithub.varsityhub`** (the one named like “varsityhubVarsityHubMobile …”). Then in `eas.json` set `submit.production.ios.ascAppId` to the **new** app’s Apple ID (from the URL or App Information).

### Path B: App ID `com.varsithub.varsityhub` doesn’t exist in your account

1. **Create the App ID**
   - Go to [Apple Developer](https://developer.apple.com) → **Certificates, Identifiers & Profiles** → **Identifiers**.
   - Click **+** to add an identifier.
   - Choose **App IDs** → **App**.
   - **Description:** e.g. `VarsityHub Mobile`.
   - **Bundle ID:** **Explicit** → **`com.varsithub.varsityhub`** (exactly, no typos).
   - Register the identifier.

2. **Create the app in App Store Connect**
   - In App Store Connect → **My Apps** → **+** → **New App**.
   - **Platform:** iOS.
   - **Name:** e.g. VarsityHub.
   - **Primary language:** your choice.
   - **Bundle ID:** select **`com.varsithub.varsityhub`** (it will appear now that the App ID exists).
   - **SKU:** e.g. `varsityhub-ios`.
   - Create the app.

3. **Point EAS to the new app**
   - In the new app’s page, copy its **Apple ID** (numeric, from the URL or App Information).
   - In the project, open **`eas.json`** and set:
     - `submit.production.ios.ascAppId` = that Apple ID (e.g. `"6758399345"` → new value).

4. **Submit again**
   - Run: `eas submit --platform ios --latest`  
     or re-run your build with `--auto-submit`.

## Quick checklist

- [ ] In **Developer** → **Identifiers**: there is an App ID with bundle ID **`com.varsithub.varsityhub`**.
- [ ] In **App Store Connect** → the app you submit to: **App Information** → **Bundle ID** is **`com.varsithub.varsityhub`**.
- [ ] In **eas.json**: `ascAppId` is the Apple ID of that same app.

Your project is already correct: `app.json` and Xcode use **`com.varsithub.varsityhub`**. The fix is only on the Apple side (App ID + App Store Connect app + `ascAppId`).
