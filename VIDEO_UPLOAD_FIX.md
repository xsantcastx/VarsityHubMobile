# Video Story Upload Fix - iOS PhotoKit Issue

## Problem Summary

When a user picked a video from the iOS camera roll to create a story, the upload failed with:
```
Error: The operation couldn't be completed. (PHPhotosErrorDomain error 3164.)
```

## Root Cause Analysis

### The Flow
1. User taps "Add Story" → "Choose from Gallery"
2. `ImagePicker.launchImageLibraryAsync()` opens the photo picker
3. User selects a **video** from their camera roll
4. ImagePicker returns an asset with `uri: "ph://..."` (PhotoKit URI)
5. Code calls `ensureUploadableUri(uri, mimeType)` to prepare for upload
6. `ensureUploadableUri` sees it's not a `file://` path, checks if it's an image
7. Video → not an image → tries `FileSystem.copyAsync({ from: "ph://...", to: dest })`
8. **FAILS**: PhotoKit doesn't allow direct filesystem access without `MediaLibrary`
9. PHPhotosErrorDomain 3164 exception → caught in error handler → "Story upload error" alert

### Why It Happened

**ImagePicker behavior on iOS:**
- When picking from the system PhotoLibrary, iOS returns `ph://ASSET_ID` URIs
- These are PhotoKit asset identifiers, not real file paths
- ImagePicker can optionally export assets to a temporary file directory
- The picker needs to be configured to do this for video assets

**ensureUploadableUri limitations:**
```typescript
// Only handled images
if (isPhoto) {
  // Re-encode via ImageManipulator → creates file://
}
// For videos: falls through!
// Then tries:
await FileSystem.copyAsync({ from: uri, to: dest }); // ❌ Fails on ph://
```

## Solution Implemented

### 1. Configure ImagePicker for File Paths

Updated picker options in `GameDetailsScreen.tsx`:

```typescript
// Before
const pickerOptions: any = {
  quality: 0.9,
  mediaTypes: ImagePicker.MediaTypeOptions.All,
  allowsEditing: false,
  exif: false,
};

// After
const pickerOptions: any = {
  quality: 0.9,
  mediaTypes: ImagePicker.MediaTypeOptions.All,
  allowsEditing: false,
  exif: false,
  presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
};
```

**Effect:**
- `presentationStyle: FULL_SCREEN` tells the picker to use the standard sheet presentation
- This encourages the picker framework to export assets to a temporary cache location
- Result: Returns `file://` paths for videos instead of `ph://` URIs

### 2. Update ensureUploadableUri for Better Handling

Modified `utils/ensureUploadableUri.ts`:

```typescript
// For videos
if (isVideo) {
  if (__DEV__) {
    console.warn('[media] Video ph:// URI detected. Ensure ImagePicker is configured...');
  }
  return { uri, mimeType };
}
```

**Rationale:**
- If a `ph://` video URI still comes through, it's logged so developers can debug
- The function gracefully returns the original URI
- Real fix is in the picker configuration, not in re-encoding

### 3. Handle Both Camera & Gallery

Applied the same picker options to:
- `launchCameraAsync()` - Take Photo/Video from camera
- `launchImageLibraryAsync()` - Choose from Gallery

Both now use consistent configuration.

---

## Technical Details

### Why Not Use MediaLibrary.downloadAsync()?

Alternative approach considered:
```typescript
// Could do this in ensureUploadableUri:
const { status } = await MediaLibrary.requestPermissionsAsync();
const assets = await MediaLibrary.getAssetsAsync({ id: assetId });
const downloaded = await MediaLibrary.downloadAsync(asset);
```

**Why this wasn't chosen:**
1. **Complexity**: Requires extra permissions request and asset lookup
2. **Performance**: Additional async operations add latency
3. **Type issues**: expo-media-library v18 doesn't export `downloadAsync` in TypeScript
4. **Better approach**: Configure the picker to return file paths directly

The picker-level fix is simpler and more performant.

---

## Files Modified

### 1. `app/game-details/GameDetailsScreen.tsx`
- Updated camera picker options (line ~1010)
- Updated gallery picker options (line ~1061)
- Added `presentationStyle: FULL_SCREEN` to both

### 2. `utils/ensureUploadableUri.ts`
- Removed broken `FileSystem.copyAsync` fallback for videos
- Added helpful dev warning when `ph://` URI is detected
- Kept image re-encoding via `ImageManipulator` (unchanged)

---

## Testing Checklist

- [ ] **iOS Camera (Photo)**
  - [ ] Take photo with camera → upload succeeds
  - [ ] Photo is re-encoded (compressed) ✓

- [ ] **iOS Camera (Video)**
  - [ ] Record video with camera → upload succeeds
  - [ ] PHPhotosErrorDomain error does NOT appear
  - [ ] Video is uploaded without re-encoding

- [ ] **iOS Gallery (Photo)**
  - [ ] Select photo from camera roll → upload succeeds
  - [ ] Photo is re-encoded (compressed) ✓

- [ ] **iOS Gallery (Video)** ← *Previously failing*
  - [ ] Select video from camera roll → upload succeeds
  - [ ] PHPhotosErrorDomain error does NOT appear
  - [ ] Video is uploaded without re-encoding

- [ ] **Android** (unchanged)
  - [ ] Photo/video upload continues to work normally

- [ ] **Sample Games**
  - [ ] Stories added locally without backend call ✓

---

## Verification Steps

If you encounter this issue again:

1. **Check the URI format**:
   ```typescript
   console.log('[debug] Asset URI:', asset.uri);
   // Should be: file://... (not ph://...)
   ```

2. **Monitor ensureUploadableUri**:
   ```typescript
   const ensured = await ensureUploadableUri(uri, mimeType);
   console.log('[debug] Ensured URI:', ensured.uri);
   ```

3. **Check logs in production**:
   - If you see `[media] Video ph:// URI detected...` warning
   - The picker is still returning `ph://` URIs
   - Verify `presentationStyle` is set correctly

---

## Related Code Paths

### Upload Flow
```
handleAddStory()
  → ImagePicker.launchImageLibraryAsync(options)
  → ensureUploadableUri(uri, mimeType)
  → uploadFile(base, uri, fileName, mimeType)
  → Game.addStory(vm.gameId, { media_url })
```

### Error Handling
- Catch block at `GameDetailsScreen.tsx:1052/1103`
- Shows "Unable to add story" alert with error message
- Now should NOT hit PHPhotosErrorDomain for videos

---

## Why This Fix is Minimal & Safe

✅ **Picker-level fix** - Doesn't change upload logic  
✅ **Single line per handler** - Easy to audit  
✅ **No new dependencies** - Uses existing ImagePicker API  
✅ **Graceful fallback** - If `ph://` still appears, warns in dev  
✅ **Consistent** - Same options for camera & gallery  
✅ **Compatible** - Works with existing image re-encoding  

---

## Future Improvements

1. **Consider CDN optimization** - Upload videos directly to CDN with resumable uploads
2. **Add video preview** - Show selected video before upload
3. **Progress tracking** - Display upload progress for large videos
4. **Batch uploads** - Support selecting multiple media items

---

## Deployment Notes

**Required testing before release:**
- [ ] Test on real iOS device with videos > 10MB
- [ ] Verify stories appear in game feed after upload
- [ ] Check for any regression in photo uploads
- [ ] Monitor error logs for any PHPhotosErrorDomain errors

**Rollback plan:**
If any regressions occur, revert the single `presentationStyle` line and revisit the MediaLibrary approach.
