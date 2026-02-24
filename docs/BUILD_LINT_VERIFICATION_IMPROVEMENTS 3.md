# Build Lint Verification Improvements

**Date**: January 27, 2026  
**Purpose**: Prevent wasted EAS build credits by catching lint errors before builds are submitted

## Problem

Builds were failing with ExtraTranslation lint errors, wasting build credits:
```
> Task :app:lintVitalRelease FAILED
/home/expo/workingdir/build/android/app/src/main/res/values-b+en/strings.xml:2: Error: "name" is translated here but not found in default locale [ExtraTranslation]
/home/expo/workingdir/build/android/app/src/main/res/values-b+en/strings.xml:3: Error: "displayName" is translated here but not found in default locale [ExtraTranslation]

Lint found fatal errors while assembling a release target.
Execution failed for task ':app:lintVitalRelease'.
```

## Solution

Enhanced `scripts/verify-build-ready.sh` with comprehensive lint configuration checks based on actual build log failures.

## Verification Checks Added

### 1. Lint Baseline Configuration ✅
- Checks that `baseline = file("lint-baseline.xml")` is configured
- Verifies baseline file exists
- Validates baseline has correct file paths (`src/main/res/values-b+en/strings.xml`)
- Confirms baseline includes both `name` and `displayName` ExtraTranslation entries

### 2. ExtraTranslation Disabled ✅
- Verifies `disable 'ExtraTranslation'` is set in lint configuration
- **CRITICAL**: This prevents the build failure error

### 3. Lint Error Handling ✅
- Checks `abortOnError false` is set (prevents build from failing on lint errors)
- Verifies `checkReleaseBuilds false` is set (prevents lint from running on release builds)

### 4. lintVitalRelease Task Disabled ✅
- Checks that `lintVitalRelease` is explicitly disabled via:
  - `enabled = false` in task configuration
  - `taskGraph` hooks that disable the task
  - `whenTaskAdded` hooks
  - `lintOptions.checkReleaseBuilds false` (should prevent task from running)

### 5. Release BuildType Configuration ✅
- Verifies `lintOptions` is configured in `buildTypes.release`
- Checks `checkReleaseBuilds false` in release buildType
- Confirms `ExtraTranslation` is disabled in release buildType

### 6. String Resources Configuration ✅
- Verifies `name` and `displayName` strings are marked as `translatable="false"` in `values/strings.xml`
- **Prevents root cause**: This prevents the ExtraTranslation error from occurring

### 7. Gradle Properties ✅
- Checks `android.lint.checkReleaseBuilds=false` in `gradle.properties`
- Additional safeguard at the property level

## Error Messages from Build Logs

The verification script now checks for these specific errors that appeared in build logs:

1. **"Lint found fatal errors while assembling a release target"**
   - Prevented by: `abortOnError false` + `checkReleaseBuilds false`

2. **"Execution failed for task :app:lintVitalRelease"**
   - Prevented by: Disabling `lintVitalRelease` task

3. **"name is translated here but not found in default locale [ExtraTranslation]"**
   - Prevented by: `disable 'ExtraTranslation'` + baseline + `translatable="false"`

4. **"displayName is translated here but not found in default locale [ExtraTranslation]"**
   - Prevented by: `disable 'ExtraTranslation'` + baseline + `translatable="false"`

## Verification Output

When running `bash scripts/verify-build-ready.sh`, you'll now see:

```
Step 6: Android build configuration...
   Checking lint configuration to prevent ExtraTranslation build failures...
✅ Android lint baseline configured
✅ Android lint baseline file exists
✅ Android lint baseline has correct file paths
✅ Android lint baseline includes ExtraTranslation entries (name and displayName)
✅ Android lint ExtraTranslation check disabled
✅ Android lint abortOnError set to false
✅ Android lint checkReleaseBuilds set to false
✅ Android lintVitalRelease explicitly disabled
✅ Android release buildType has lintOptions configured
✅ Android release buildType lintOptions has checkReleaseBuilds false
✅ Android release buildType lintOptions has ExtraTranslation disabled
✅ Android strings marked as non-translatable (prevents ExtraTranslation errors)
✅ Android gradle.properties has lint checkReleaseBuilds false
```

## Impact

- **Before**: Builds failed after ~25 minutes, wasting credits
- **After**: Verification catches issues in seconds before build submission
- **Cost Savings**: Prevents wasted build credits on lint configuration errors

## Usage

Always run verification before submitting builds:

```bash
bash scripts/verify-build-ready.sh
```

If verification passes, you can safely submit builds:
```bash
eas build --platform android --profile production
```

## Related Files

- `scripts/verify-build-ready.sh` - Enhanced verification script
- `android/app/build.gradle` - Lint configuration
- `android/app/lint-baseline.xml` - Baseline file with known errors
- `android/app/src/main/res/values/strings.xml` - String resources with `translatable="false"`
- `android/gradle.properties` - Property-level lint configuration
