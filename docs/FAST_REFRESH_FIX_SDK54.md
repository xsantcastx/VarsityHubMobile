# Fast Refresh Fix for Expo SDK 54

## Problem

Fast Refresh was not working in Expo SDK 54 with React Native Reanimated v4.

## Root Cause

In Expo SDK 54, React Native Reanimated v4 requires using `react-native-worklets/plugin` instead of `react-native-reanimated/plugin` in the Babel configuration. Using the wrong plugin breaks Fast Refresh.

## Solution Applied

### 1. Updated Babel Configuration

**File:** `babel.config.js`

**Changed:**

```javascript
// ❌ OLD (breaks Fast Refresh in SDK 54)
'react-native-reanimated/plugin',

// ✅ NEW (correct for SDK 54)
'react-native-worklets/plugin',
```

**Why:** In SDK 54, Reanimated v4 moved the Babel plugin to the `react-native-worklets` package. The plugin MUST be the last item in the plugins array.

### 2. Updated Metro Configuration

**File:** `metro.config.js`

**Added:**

```javascript
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false, // Disable to avoid Fast Refresh issues
      inlineRequires: true,
    },
  }),
};
```

**Why:** `experimentalImportSupport` in SDK 54 can cause Fast Refresh issues. Disabling it ensures Fast Refresh works reliably.

## Verification Steps

1. **Clear Metro cache:**

   ```bash
   npx expo start --dev-client --clear
   ```

2. **Test Fast Refresh:**
   - Open any component (e.g., `app/sign-up.tsx`)
   - Make a change (e.g., change text color or label)
   - Save the file (`Cmd+S`)
   - **Fast Refresh should update instantly** without full reload

3. **Check for errors:**
   - No "Duplicate plugin/preset detected" errors
   - No Reanimated worklet errors
   - Fast Refresh works on component changes

## Files Modified

1. `babel.config.js` - Changed Reanimated plugin to worklets plugin
2. `metro.config.js` - Disabled experimentalImportSupport for Fast Refresh stability

## Additional Notes

- The `react-native-worklets` package (v0.5.1) is already installed
- The plugin MUST be last in the Babel plugins array
- Fast Refresh only works in development mode
- Syntax errors will cause Fast Refresh to fall back to full reload (this is normal)

## If Fast Refresh Still Doesn't Work

1. **Kill all Metro/Node processes:**

   ```bash
   pkill -9 node expo metro
   ```

2. **Clear all caches:**

   ```bash
   rm -rf node_modules/.cache
   rm -rf .expo
   watchman watch-del-all  # if you have watchman
   ```

3. **Restart Metro:**

   ```bash
   npx expo start --dev-client --clear
   ```

4. **Rebuild native app (if needed):**
   ```bash
   npx expo run:ios
   ```

## References

- [Expo SDK 54 Upgrade Guide](https://expo.dev/blog/expo-sdk-upgrade-guide)
- [React Native Reanimated Troubleshooting](https://docs.swmansion.com/react-native-reanimated/docs/guides/troubleshooting/)
- [Expo SDK 54 Common Issues](https://diko-dev99.medium.com/upgrading-to-expo-sdk-54-common-issues-and-how-to-fix-them-1b78ac6b19d3)
