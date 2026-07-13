# Sentry Setup Guide

## Overview

Sentry is configured to work with both iOS and Android builds. The configuration allows Sentry uploads to work properly when the auth token is available, but includes safety nets to prevent build failures.

## Configuration

### 1. EAS Environment Variables

All build profiles in `eas.json` include:

- `SENTRY_ORG`: "varsity-hub"
- `SENTRY_PROJECT`: "varsityhub"
- `SENTRY_ALLOW_FAILURE`: "true" (safety net - allows builds to continue if upload fails)

### 2. Required EAS Secret

**You MUST set the `SENTRY_AUTH_TOKEN` secret in EAS for Sentry uploads to work:**

```bash
eas secret:create --name SENTRY_AUTH_TOKEN --value <your-token> --environment production --visibility sensitive
```

**To get your Sentry auth token:**

1. Go to https://sentry.io/settings/account/api/auth-tokens/
2. Click "Create New Token"
3. Name: "EAS Builds"
4. Scopes: Select `project:read` and `project:write`
5. Copy the token and use it in the command above

### 3. How It Works

**Android:**

- Sentry uploads are enabled when `SENTRY_AUTH_TOKEN` is present
- If `SENTRY_ALLOW_FAILURE=true`, upload failures won't break the build
- Tasks are wrapped to catch errors gracefully

**iOS:**

- Sentry script runs during bundle phase
- If `SENTRY_ALLOW_FAILURE=true`, upload failures won't break the build
- Debug symbols upload also respects this setting

## Verification

Run the build verification script to check Sentry configuration:

```bash
npm run verify:build
```

This will check:

- ✅ Sentry org/project configured in `eas.json`
- ✅ `SENTRY_ALLOW_FAILURE` safety net is set
- ✅ Sentry scripts are properly configured

## Troubleshooting

### "Project not found" Error

This means:

1. `SENTRY_AUTH_TOKEN` is missing or invalid
2. The token doesn't have access to the `lime-productions` organization or `varsityhub` project
3. The org/project names in `eas.json` don't match your Sentry account

**Fix:**

1. Verify your token has the correct permissions
2. Check that org/project names match exactly (case-sensitive)
3. Ensure the token is set in EAS secrets for the correct environment

### Build Fails Even With SENTRY_ALLOW_FAILURE

If builds still fail, check:

1. The `SENTRY_ALLOW_FAILURE=true` is set in `eas.json` for your build profile
2. The build scripts properly handle the environment variable
3. There are no other Sentry-related errors

## Testing

To test Sentry uploads work:

1. Set `SENTRY_AUTH_TOKEN` in EAS secrets
2. Run a build: `eas build --platform android --profile production`
3. Check build logs for Sentry upload success messages
4. Verify source maps appear in Sentry dashboard
