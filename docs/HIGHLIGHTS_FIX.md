# Highlights Display & Error Fixes

**Date:** January 12, 2025  
**Status:** ✅ **COMPLETE**

---

## Issues Fixed

### 1. ❌ Highlights Showing Non-Visual Content

**Problem:**

- Highlights API was returning ALL posts, including text-only posts
- Bible verse and other non-sports content appearing in highlights
- Highlights should only show posts with media (videos/images)

**Fix:**

- Added `media_url: { not: null }` filter to all highlights queries
- Ensures only posts with visual content appear in highlights
- Applied to:
  - National top posts
  - Global fill posts
  - Local posts (legacy)
  - Ranked pool (v2)

**Files Modified:**

- `server/src/routes/highlights.ts` - Added media_url filter to all queries

---

### 2. ❌ "Missing game id" Error

**Problem:**

- `GameVerticalFeedScreen` showed error when opened from "Watch Highlights" card
- Error check happened before component could load general highlights
- Component already had logic to handle missing gameId (loads general highlights)

**Fix:**

- Removed early error return that blocked highlights loading
- Component now gracefully handles missing gameId by loading general highlights
- Error check was redundant - component already handles this case

**Files Modified:**

- `app/game-details/GameVerticalFeedScreen.tsx` - Removed blocking error check

---

## Changes Made

### Backend (`server/src/routes/highlights.ts`)

**Before:**

```typescript
let nationalTop = await prisma.post.findMany({
  where: { country_code: country, created_at: { gte: since } },
  // ... no media filter
});
```

**After:**

```typescript
let nationalTop = await prisma.post.findMany({
  where: {
    country_code: country,
    created_at: { gte: since },
    media_url: { not: null }, // Only posts with media
  },
  // ...
});
```

Applied to all 5 query locations:

1. National top posts
2. Global fill posts
3. Local posts (with location)
4. Local posts (without location)
5. Ranked pool (v2)

### Frontend (`app/game-details/GameVerticalFeedScreen.tsx`)

**Before:**

```typescript
if (!gameId && !usingInitial) {
  return (
    <View>
      <Text>Missing game id</Text>
      <Pressable onPress={handleBack}>Go back</Pressable>
    </View>
  );
}
```

**After:**

```typescript
// Note: We allow missing gameId - the component will load general highlights instead
// The loadFeed function handles this case gracefully (lines 612-642)
```

---

## Result

✅ **Highlights now only show posts with media** (videos/images)  
✅ **"Watch Highlights" card works without gameId** - loads general highlights  
✅ **No more "Missing game id" error** when opening highlights from feed  
✅ **Better content quality** - no text-only posts in highlights

---

## Testing

1. **Highlights Filter:**
   - Verify highlights only show posts with media_url
   - Text-only posts should not appear
   - All highlights should have videos/images

2. **Watch Highlights Card:**
   - Tap "Watch Highlights" card in feed
   - Should open highlights reel without error
   - Should load general highlights (not game-specific)

3. **Game-Specific Highlights:**
   - Open highlights from a specific game
   - Should still work with gameId provided
   - Should show game-specific posts

---

**Status:** ✅ All fixes complete. Highlights now properly filtered and error-free.
