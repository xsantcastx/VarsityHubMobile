# Xcode Cloud Setup

This project includes Xcode Cloud CI/CD for iOS builds.

## Prerequisites

- Apple Developer account (required for Xcode Cloud)
- Repository connected to GitHub/GitLab/Bitbucket

## Configuration

The post-clone script is at **`ios/ci_scripts/ci_post_clone.sh`** (same directory as the workspace, per Apple requirements). It:

1. Sets UTF-8 locale (fixes CocoaPods on Ruby 3.4+)
2. Installs Node.js and CocoaPods via Homebrew if missing
3. Runs `npm ci` or `npm install`
4. Runs `pod install` in `ios/`

## Setup in Xcode

1. Open the workspace in Xcode:

   ```bash
   open ios/VarsityHub.xcworkspace
   ```

2. In Xcode: **Product → Xcode Cloud → Create Workflow**

3. Connect your repository (GitHub/GitLab/Bitbucket) if not already connected.

4. Configure the workflow:
   - **Start condition**: Choose when to run (e.g. on PR, on push to main)
   - **Build**: Ensure the scheme is `VarsityHub` and the destination is iOS
   - The `ci_post_clone.sh` script runs automatically before the build

5. (Optional) Add a **TestFlight** or **Archive** action to deliver builds.

## Environment Variables

If your app needs env vars (e.g. API keys), add them in the workflow’s **Environment** section as custom environment variables. Mark sensitive values as **Secret** so they’re hidden in logs.

## Troubleshooting

| Issue                                     | Fix                                                                             |
| ----------------------------------------- | ------------------------------------------------------------------------------- |
| CocoaPods UTF-8 error                     | Already handled in `ci_post_clone.sh`                                           |
| `GetEnv.NoBoolean: TRUE is not a boolean` | Script sets `CI="true"`; if issues persist, consider a `getenv` patch           |
| Build fails on `pod install`              | Ensure `ios/Podfile` and `ios/Podfile.lock` are committed (Pods/ is gitignored) |
