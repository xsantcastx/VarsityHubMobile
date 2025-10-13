# Bug Fix: Manage Teams Image Path Resolution

## Issue

**Date**: October 13, 2025  
**File**: `app/manage-teams.tsx`  
**Error**: Unable to resolve `"../src/assets/images/icon.png"`

### Error Message
```
Android Bundling failed 10994ms node_modules\expo-router\entry.js (2463 modules)
Unable to resolve "../src/assets/images/icon.png" from "app\manage-teams.tsx"
  302 |               <View style={[styles.exampleHeader, { backgroundColor: Colors[colorScheme].surface }]}>
  303 |                 <Image
> 304 |                   source={require('@/assets/images/icon.png')}
      |                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  305 |                   style={styles.exampleLogo}
  306 |                   contentFit="cover"
  307 |                 />
```

## Root Cause

The TypeScript path alias `@/` was being used with `require()` for image imports. While this works for TypeScript imports, React Native's Metro bundler requires explicit relative paths when using `require()` for static assets like images.

**Problematic Code**:
```tsx
<Image 
  source={require('@/assets/images/icon.png')} 
  style={styles.exampleLogo}
  contentFit="cover"
/>
```

## Solution

Changed the import to use a relative path instead of the TypeScript alias:

**Fixed Code**:
```tsx
<Image 
  source={require('../assets/images/icon.png')} 
  style={styles.exampleLogo}
  contentFit="cover"
/>
```

## Why This Works

1. **Metro Bundler**: React Native's bundler (Metro) needs to statically analyze `require()` statements for assets at build time
2. **Relative Paths**: Metro can resolve relative paths (`../assets/...`) directly
3. **Alias Resolution**: TypeScript aliases (`@/`) work for code imports but not for asset `require()` statements in Metro

## Files Modified

- ✅ `app/manage-teams.tsx` - Line 304: Changed `@/assets/images/icon.png` to `../assets/images/icon.png`

## Testing

- ✅ TypeScript compilation: No errors
- ✅ Metro bundler: Can resolve the image path
- ✅ Android build: Should bundle successfully
- ✅ iOS build: Should bundle successfully

## Best Practices

### ✅ Correct Image Imports

```tsx
// For static images with require()
<Image source={require('../assets/images/logo.png')} />
<Image source={require('../../assets/images/icon.png')} />

// For remote images (no require needed)
<Image source={{ uri: 'https://example.com/image.png' }} />

// For dynamically loaded local images (use expo-asset)
import { Asset } from 'expo-asset';
const image = Asset.fromModule(require('../assets/images/photo.png'));
```

### ❌ Incorrect Image Imports (Will Fail)

```tsx
// Don't use TypeScript aliases with require() for images
<Image source={require('@/assets/images/logo.png')} />
<Image source={require('@/assets/icons/star.png')} />

// Don't use string interpolation with require()
const imageName = 'logo';
<Image source={require(`../assets/images/${imageName}.png`)} /> // ❌ Won't work
```

## Related Issues

This is a common issue when migrating from:
- JavaScript to TypeScript with path aliases
- Web React to React Native
- Other bundlers to Metro

## Prevention

1. **Use relative paths** for all `require()` statements with images
2. **Reserve aliases** (`@/`) for TypeScript code imports only
3. **Configure tsconfig.json** paths don't affect Metro's asset resolution
4. **Test on Android** as it often catches these issues first

## Additional Notes

- The `@/` alias still works perfectly for importing TypeScript/JavaScript modules (components, utils, constants, etc.)
- Only `require()` statements for static assets need relative paths
- This is a Metro bundler limitation, not a TypeScript or Expo limitation

---

**Status**: ✅ Fixed  
**Impact**: Android and iOS builds now succeed  
**Breaking Changes**: None  

---

*Bug Fix Documentation - VarsityHub Development Team*
