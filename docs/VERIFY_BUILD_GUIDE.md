# How to Verify Your Build Will Work Correctly

This guide shows you how to verify that your build will work and that you're using the most recent version of the app.

## Quick Verification Commands

### 1. Check if you're using the latest code
```bash
npm run verify:version
```
This checks:
- ✅ Git status (uncommitted changes, behind/ahead of remote)
- ✅ App version consistency
- ✅ Dev client matches current code
- ✅ Dependencies are installed
- ✅ iOS Pods are up to date

### 2. Verify build readiness
```bash
npm run verify:build
```
This checks:
- ✅ TypeScript compilation
- ✅ Critical files present
- ✅ Configuration files valid
- ✅ Sentry configuration
- ✅ Babel plugins in dependencies
- ✅ Android/iOS setup

### 3. Comprehensive app audit
```bash
npm run audit:app
```
This checks:
- ✅ All critical features implemented
- ✅ Sample event posting
- ✅ Coach onboarding
- ✅ Upload functionality
- ✅ Build dependencies

## Step-by-Step Verification Process

### Step 1: Ensure Latest Code

1. **Check git status:**
   ```bash
   git status
   ```

2. **Pull latest changes:**
   ```bash
   git pull origin main
   ```

3. **Verify you're up to date:**
   ```bash
   npm run verify:version
   ```

### Step 2: Update Dependencies

1. **Install/update npm packages:**
   ```bash
   npm install
   ```

2. **Update iOS Pods (if on macOS):**
   ```bash
   cd ios
   pod install
   cd ..
   ```

### Step 3: Rebuild Dev Client (if needed)

If you've made code changes or pulled new code, rebuild your dev client:

```bash
npm run dev:rebuild
```

This ensures your device is running the latest code.

### Step 4: Verify Build Configuration

```bash
npm run verify:build
```

This will catch issues like:
- Missing Babel plugins
- TypeScript errors
- Invalid configuration
- Missing files

### Step 5: Run Comprehensive Audit

```bash
npm run audit:app
```

This verifies all critical features are working.

## How to Know if Dev Client Needs Rebuild

The `verify:version` script checks if your dev client matches your current code by comparing:
- Current git commit
- Last build commit (stored in `.last-build-commit`)

**Signs you need to rebuild:**
- ✅ Script says "Dev client may be outdated"
- ✅ You just pulled new code
- ✅ You made code changes
- ✅ App behavior doesn't match expected code

**Rebuild command:**
```bash
npm run dev:rebuild
```

## Pre-Build Checklist

Before running any build (EAS or local), run:

```bash
# 1. Verify version
npm run verify:version

# 2. Verify build readiness
npm run verify:build

# 3. Comprehensive audit
npm run audit:app
```

All three should pass with ✅ before building.

## Troubleshooting

### "Dev client may be outdated"
**Solution:** Run `npm run dev:rebuild`

### "Behind remote"
**Solution:** Run `git pull origin main` then rebuild

### "Dependencies are not installed correctly"
**Solution:** Run `npm install` and `cd ios && pod install`

### "TypeScript errors found"
**Solution:** Fix TypeScript errors before building

### "Babel plugins missing"
**Solution:** Already fixed - plugins are in dependencies. If you see this, run `npm install`

## Version Tracking

The app tracks versions in:
- `app.json` - `version` and `runtimeVersion` (must match)
- `.last-build-commit` - Last git commit when dev client was built

## Best Practices

1. **Always verify before building:**
   ```bash
   npm run verify:version && npm run verify:build
   ```

2. **Rebuild dev client after pulling code:**
   ```bash
   git pull && npm run dev:rebuild
   ```

3. **Check git status before major changes:**
   ```bash
   git status
   ```

4. **Run full audit before release:**
   ```bash
   npm run audit:app
   ```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `npm run verify:version` | Check if using latest code |
| `npm run verify:build` | Verify build will work |
| `npm run audit:app` | Comprehensive feature audit |
| `npm run dev:rebuild` | Rebuild dev client with latest code |
| `git pull` | Get latest code from remote |
| `npm install` | Update dependencies |
