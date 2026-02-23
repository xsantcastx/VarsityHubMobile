# Xcode Cloud Setup for VarsityHub

Xcode Cloud builds your app in the cloud and can deliver to TestFlight automatically. This guide walks through configuring it for the Expo/React Native project.

## Prerequisites

- **Apple Developer account** (paid) – Xcode Cloud requires an active membership
- **GitHub repo** connected to the project
- **Xcode 15+** locally to configure the workflow

## 1. Enable Xcode Cloud

1. Open the project in Xcode: `ios/VarsityHub.xcworkspace` or `ios/VarsityHub.xcodeproj`
2. In the top toolbar, click the **VarsityHub** scheme and select **Manage Workflows...** (or use **Product → Xcode Cloud → Manage Workflows**)
3. Click **Create Workflow**
4. Choose **Connect** to link your repository (GitHub)

## 2. Configure the Workflow

1. **Name**: e.g. `Production` or `TestFlight`
2. **Start condition**: e.g. on push to `main` or `chore/deploy-checklist`
3. **Actions**:
   - Archive (default)
   - Add **Post-build action** → **Distribute App** → App Store Connect (TestFlight)

## 3. Environment Variables (optional)

If the app needs env vars at build time (e.g. API URL, Sentry DSN), add them in:

**Workflow** → **Environment** → **Add variable**

Common vars:

- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SENTRY_DSN`
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `EXPO_PUBLIC_EXPO_PROJECT_FULL_NAME` (for Google OAuth proxy)

## 4. CI Script (already set up)

The project includes `ios/ci_scripts/ci_post_clone.sh`, which Xcode Cloud runs after cloning. It:

1. Installs Node.js and CocoaPods (if missing)
2. Runs `npm ci`
3. Runs `expo prebuild --platform ios --clean` (with `CI="true"` to avoid Xcode Cloud’s `CI=TRUE` issue)

**Important:** `expo prebuild --clean` replaces the `ios/` folder. The `ci_scripts` folder is removed during prebuild, which is expected. The script finishes before the build, so Xcode Cloud uses the new native project.

## 5. Credentials

Xcode Cloud uses **Automatically manage signing** by default. Ensure your Apple Team and provisioning profiles are correctly configured for the app. If you use manual signing, configure it in the Xcode project before enabling Xcode Cloud.

## 6. First Build

1. Save the workflow
2. Push a commit to the branch configured in the start condition, or
3. Use **Product → Xcode Cloud → Create Workflow** and run it manually

Monitor builds at [App Store Connect](https://appstoreconnect.apple.com) → Your App → TestFlight → Builds (or the Xcode Cloud section).

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `GetEnv.NoBoolean: TRUE is not a boolean` | The script already sets `CI="true"` before `expo prebuild` |
| `pod: command not found` | The script runs `brew install cocoapods` when needed |
| `npm: command not found` | The script runs `brew install node` when needed |
| Build fails on Metro/JS bundle | Ensure `npm ci` and `expo prebuild` complete without errors in the post-clone logs |
| Missing env vars in app | Add them in the workflow’s Environment settings |

## Resources

- [Apple: Writing custom build scripts](https://developer.apple.com/documentation/xcode/writing-custom-build-scripts)
- [Expo prebuild in Xcode Cloud](https://www.richinfante.com/2024/11/18/running-expo-prebuild-in-xcode-cloud)
- EAS Build is an alternative if Xcode Cloud does not fit your workflow.
