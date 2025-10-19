# Image Compatibility Fix - Cross-Platform Image Display

## Problem
- **iPhone users**: Cannot see images uploaded from Android devices
- **Android users**: Cannot see images uploaded from iPhone users
- **Root cause**: iPhone uses HEIC/HEIF format by default, which Android doesn't support natively

## Solution
Configure `expo-image-picker` to ensure cross-platform compatibility by:

1. **Add `exif: false`** - Strips EXIF data that can cause issues
2. **Set `quality: 0.8-0.9`** - Forces JPEG compression (converts HEIC to JPEG)
3. **Add `allowsEditing: false`** - Prevents iOS from using unsupported formats

## Changes Applied

### All ImagePicker Configurations Updated:
```typescript
// ✅ CORRECT - Cross-platform compatible
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: false,  // Prevent iOS format issues
  quality: 0.85,         // Force JPEG compression (0-1)
  exif: false,          // Strip EXIF data
});

// ❌ WRONG - Can cause compatibility issues
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  // Missing quality, exif, allowsEditing
});
```

## Files Modified
1. `app/create-post.tsx` - Post image uploads
2. `app/edit-profile.tsx` - Profile/banner image uploads
3. `app/create-team.tsx` - Team logo uploads
4. `app/edit-team.tsx` - Team logo edits
5. `app/game-details/GameDetailsScreen.tsx` - Story uploads
6. `components/QuickAddGameModal.tsx` - Game banner uploads
7. `components/BannerUpload.tsx` - Banner uploads
8. `components/StoryCameraButton.tsx` - Camera captures
9. `app/profile.tsx` - Profile picture uploads

## Testing Checklist
- [ ] iPhone user uploads image → Android user can see it
- [ ] Android user uploads image → iPhone user can see it
- [ ] Profile pictures display on both platforms
- [ ] Post images display on both platforms
- [ ] Team logos display on both platforms
- [ ] Game banners display on both platforms
- [ ] Story images display on both platforms

## Technical Details

### Why This Works
- **`quality` parameter**: When set, `expo-image-picker` converts any image format (including HEIC) to JPEG
- **JPEG format**: Universally supported on iOS, Android, and web
- **`exif: false`**: Removes metadata that can cause parsing issues on some devices
- **`allowsEditing: false`**: Prevents iOS from applying edits that might save in HEIC format

### Format Support Matrix
| Format | iOS Support | Android Support | Solution |
|--------|-------------|-----------------|----------|
| JPEG   | ✅ Yes      | ✅ Yes          | Use this |
| PNG    | ✅ Yes      | ✅ Yes          | OK      |
| HEIC   | ✅ Yes      | ❌ No           | Convert to JPEG |
| WebP   | ✅ Yes      | ✅ Yes          | OK      |

## Additional Notes
- Server-side: Consider adding image conversion on upload if needed
- Caching: Clear app cache after update to refresh existing images
- Network: Ensure images are served with correct MIME types

## References
- [expo-image-picker docs](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [HEIC compatibility issues](https://github.com/expo/expo/issues/16526)
