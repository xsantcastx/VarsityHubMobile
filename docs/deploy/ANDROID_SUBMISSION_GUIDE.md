# Android Build Submission Guide

## Current Status

**Latest Build**: In progress (ID: 9ade4649-b4aa-487c-8946-8e9da17bd5b1)
- Started: 1/27/2026, 11:06:11 AM
- Monitor: https://expo.dev/accounts/varsity-hub/projects/varsityhub/builds/9ade4649-b4aa-487c-8946-8e9da17bd5b1

## Submission Options

### Option 1: Automated Submission (Requires Linked Play Service Account)

**Setup Service Account Key:**
1. Go to Google Play Console: https://play.google.com/console
2. Navigate to: **Setup** → **API access**
3. Create or select a dedicated service account
4. Download the JSON key file
5. Save it as `service-account-key.json` in the project root
6. Run `npm run verify:play-submit-access`

Do not use a default `...-compute@developer.gserviceaccount.com` account. Those commonly fail with `PERMISSION_DENIED` during `eas submit`.

**Then submit:**
```bash
npm run submit:android
# OR
eas submit --platform android --latest --profile production
```

### Option 2: Manual Submission (No Service Account Needed)

**After build completes:**

1. **Download the .aab file:**
   ```bash
   # Get build URL
   eas build:list --platform android --limit 1
   
   # Download the .aab file from the build page
   # Or use the download URL from EAS dashboard
   ```

2. **Upload to Play Console:**
   - Go to: https://play.google.com/console
   - Select your app: **VarsityHub**
   - Navigate to: **Production** (or **Internal testing**)
   - Click: **Create new release**
   - Upload the `.aab` file
   - Add release notes
   - Review and roll out

### Option 3: Wait for Current Build

The current build is in progress. Once it completes:

```bash
# If build succeeds, submit it
eas submit --platform android --latest --profile production

# If you have service account key set up, it will auto-submit
# Otherwise, use manual submission (Option 2)
```

## Service Account Key Setup (Detailed)

1. **Create Service Account:**
   - Go to Google Cloud Console: https://console.cloud.google.com
   - Select your project (or create one)
   - Navigate to: **IAM & Admin** → **Service Accounts**
   - Click: **Create Service Account**
   - Name: `varsityhub-play-store`
   - Use a dedicated account for Play submission, not the default compute account
   - You do not need broad project roles for Expo submission; Play Console app access is what matters

2. **Link to Play Console:**
   - Go to Play Console: https://play.google.com/console
   - **Setup** → **API access**
   - Click: **Link service account**
   - Select the service account you created
   - Grant app access for `com.varsityhub.varsityhub`
   - Recommended role: **Release Manager**

3. **Download Key:**
   - In Google Cloud Console, go to the service account
   - Click: **Keys** tab
   - Click: **Add Key** → **Create new key**
   - Choose: **JSON**
   - Download and save as `service-account-key.json` in project root

4. **Verify:**
   ```bash
   npm run verify:play-submit-access
   ```

## Troubleshooting

**Error: "Service account key not found"**
- Ensure file is named exactly `service-account-key.json`
- Ensure it's in the project root (same directory as `eas.json`)
- Check file permissions (should be readable)

**Error: "Permission denied"**
- Check whether `service-account-key.json` is a default compute account such as `...-compute@developer.gserviceaccount.com`
- Verify the service account is linked in Play Console API access
- Verify it has app access for `com.varsityhub.varsityhub`
- Run `npm run verify:play-submit-access` before trying `eas submit`

**Build still in progress:**
- Wait for build to complete (check EAS dashboard)
- Build typically takes 10-20 minutes
- Monitor at: https://expo.dev/accounts/varsity-hub/projects/varsityhub/builds
