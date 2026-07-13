# GameDetailsScreen.tsx - Priority Lint Fixes

## File Stats

- **Lines:** 2,868
- **Est. Floating Promises:** ~50-60
- **Est. Unused Vars:** ~20-30
- **Console warnings:** ~15

## Strategy

Due to file size, fix in **3 passes**:

1. **Pass 1**: Router navigation (all `router.push`/`router.replace`)
2. **Pass 2**: Async handlers (votes, RSVP, story uploads)
3. **Pass 3**: Unused variables and console cleanup

---

## Pass 1: Router Navigation Fixes

### Pattern: Add `void` to all router calls

**Lines to fix:**

```typescript
// Line ~709
const replaceToCanonicalGame = useCallback(
  (gameIdValue: string) => {
    const routeBase = '/(tabs)/feed/game/[id]';
    void router.replace({ pathname: routeBase, params: { id: gameIdValue } }); // ✅ Add void
  },
  [router],
);

// Line ~949
const createPost = () => {
  void router.push({ pathname: '/create-post', params: { gameId: vm.gameId, type: 'post' } }); // ✅ Add void
};

// Line ~954
const createHighlight = () => {
  void router.push({ pathname: '/create-post', params: { gameId: vm.gameId, type: 'highlight' } }); // ✅ Add void
};

// Line ~1276 (inside Alert)
Alert.alert('Unauthorized', 'Please sign in to vote.', [
  { text: 'OK', style: 'cancel' },
  { text: 'Sign In', onPress: () => void router.push('/sign-in') } // ✅ Add void
]);

// Line ~1307 (inside Alert)
Alert.alert('Unauthorized', 'Please sign in to RSVP.', [
  { text: 'OK' },
  { text: 'Sign In', onPress: () => void router.push('/sign-in') } // ✅ Add void
]);

// Line ~1525
<Pressable onPress={() => void router.push(`/team-profile?id=${homeTeamObj.id}`)}>

// Line ~1531
<Pressable onPress={() => void router.push(`/team-profile?id=${awayTeamObj.id}`)}>

// Line ~1669
onPress={() => void router.push({ pathname: '/team-page', params: { id: team.id, name: team.name } } as any)}

// Line ~1714
onPress={() => void router.push({ pathname: '/team-page', params: { name: teamName } } as any)}

// Line ~1874
void router.push(`/post-detail?id=${post.id}`);
```

**Quick Fix Command:**

```bash
# Find all router.push without void (review before applying!)
grep -n "router.push\|router.replace" app/game-details/GameDetailsScreen.tsx | grep -v "void router"
```

---

## Pass 2: Async Handler Fixes

### Add Story (Camera/Gallery)

**Current (lines ~900-950):**

```typescript
const addStory = async (result: ImagePicker.ImagePickerResult) => {
  console.warn('[story] Processing media selection');

  if (!result.assets?.[0]?.uri) {
    Alert.alert('Error', 'No media selected');
    return;
  }

  const uri = result.assets[0].uri;
  // ... process upload
};
```

**Already awaited:** ✅ No changes needed

---

### Vote Handler

**Current (lines ~1260-1290):**

```typescript
const handleVote = useCallback(
  async (teamId: string) => {
    // ... already uses await
    await Game.vote(vm.gameId, teamId);
    // ...
  },
  [vm.gameId, refreshVotes]
);
```

**Already awaited:** ✅ No changes needed

**Fix Alert handler inside:**

```typescript
} catch (error: any) {
  if (error?.response?.status === 401) {
    Alert.alert('Unauthorized', 'Please sign in to vote.', [
      { text: 'OK', style: 'cancel' },
      { text: 'Sign In', onPress: () => void router.push('/sign-in') } // ✅ Add void
    ]);
```

---

### RSVP Toggle

**Current (lines ~1295-1320):**

```typescript
const toggleRsvp = useCallback(async () => {
  // ... already uses await
  await Event.rsvp(eventId, !rsvped);
  // ...
}, [eventId, rsvped]);
```

**Already awaited:** ✅ No changes needed

**Fix Alert handler inside:**

```typescript
} catch (error: any) {
  if (error?.response?.status === 401) {
    Alert.alert('Unauthorized', 'Please sign in to RSVP.', [
      { text: 'OK' },
      { text: 'Sign In', onPress: () => void router.push('/sign-in') } // ✅ Add void
    ]);
```

---

### User.me() Calls

**Pattern found in multiple places:**

```typescript
// Line ~70 (StoriesViewer)
useEffect(() => {
  if (visible) {
    void User.me() // ✅ Add void
      .then((user: any) => setCurrentUserId(user?.id || null))
      .catch(() => setCurrentUserId(null));
  }
}, [visible]);
```

**Search for all instances:**

```bash
grep -n "User.me()" app/game-details/GameDetailsScreen.tsx
```

---

## Pass 3: Unused Variables & Console

### Unused Variables to Rename

**Pattern: Prefix with `_`**

```typescript
// Example from lint output
} catch (error) { // ❌ 'error' defined but never used
  Alert.alert('Failed');
}

// Fix:
} catch (_error) { // ✅ prefixed
  Alert.alert('Failed');
}
```

**Search command:**

```bash
# Find unused error variables
grep -n "catch (error)" app/game-details/GameDetailsScreen.tsx
grep -n "catch (e)" app/game-details/GameDetailsScreen.tsx
```

---

### Console Cleanup

**Replace console.log with console.warn (or remove):**

```typescript
// Line ~102 (nav logs)
console.log('⬅️ Left navigation triggered'); // ✅ Keep for debug
console.log('➡️ Right navigation triggered'); // ✅ Keep for debug

// Line ~122
console.log('🗑️ DELETE BUTTON PRESSED!'); // Change to console.warn or gate:
if (__DEV__) console.log('🗑️ DELETE BUTTON PRESSED!');

// Line ~126
console.log('Delete aborted:', { hasItem: !!item, hasGameId: !!gameId, deleting });
// Change to:
console.warn('[story] Delete aborted:', { hasItem: !!item, hasGameId: !!gameId, deleting });
```

**Search command:**

```bash
grep -n "console.log" app/game-details/GameDetailsScreen.tsx | wc -l
# Returns count of console.log statements
```

---

## Priority Order

### High Priority (Ship-blocking):

1. ✅ **Line 709:** `router.replace` - canonical game route
2. ✅ **Lines 1276, 1307:** Alert sign-in handlers
3. ✅ **Lines 1525, 1531:** Team profile navigation

### Medium Priority (User-facing):

4. ✅ **Lines 949, 954:** Create post/highlight
5. ✅ **Lines 1669, 1714, 1874:** Team/post navigation
6. **Line 70:** User.me() in StoriesViewer

### Low Priority (Code quality):

7. Unused error variables (rename to `_error`)
8. Console.log → console.warn or gate with `__DEV__`

---

## Testing After Fixes

```bash
# 1. Check syntax
npm run typecheck

# 2. Check lint
npx eslint app/game-details/GameDetailsScreen.tsx

# 3. Run on simulator
npm start
# Navigate to a game detail screen
# Test: Vote, RSVP, Add Story, Share, Team navigation
```

---

## Estimated Impact

**Before:**

```
app/game-details/GameDetailsScreen.tsx
  ❌ 50+ floating promise warnings
  ❌ 20+ unused variable warnings
  ❌ 15 console.log warnings
```

**After Pass 1 (Router fixes):**

```
  ✅ ~15 floating promise warnings fixed
  ❌ 35+ remaining
```

**After Pass 2 (Async handlers):**

```
  ✅ ~40 floating promise warnings fixed
  ❌ 10+ remaining (minor)
```

**After Pass 3 (Cleanup):**

```
  ✅ All warnings fixed or intentionally ignored
```

---

## Manual Fix Template

For each router.push/replace:

1. Find line number
2. Add `void` before the call
3. Test navigation still works

```diff
- router.push('/some-route')
+ void router.push('/some-route')
```

---

## Automation Script

**⚠️ Use with caution - review all changes!**

```bash
# Backup first
cp app/game-details/GameDetailsScreen.tsx app/game-details/GameDetailsScreen.tsx.backup

# Auto-add void to router calls (DRY RUN - shows changes without applying)
sed -n 's/\([^v][^o][^i][^d] \)router\.\(push\|replace\)/void router.\2/p' app/game-details/GameDetailsScreen.tsx

# If output looks good, apply:
sed -i '' 's/\([^v][^o][^i][^d] \)router\.\(push\|replace\)/void router.\2/g' app/game-details/GameDetailsScreen.tsx

# Verify:
git diff app/game-details/GameDetailsScreen.tsx
```

---

## Need Help?

If you want me to:

1. Fix specific sections (provide line range)
2. Review your changes before committing
3. Help debug broken navigation after fixes

Just share the section and I'll provide exact replacements!

---

## Summary

**GameDetailsScreen is the largest file** (2,868 lines). Breaking it into 3 passes makes it manageable:

1. **Router fixes** (15 mins) - highest priority
2. **Async handlers** (10 mins) - already mostly correct
3. **Cleanup** (10 mins) - cosmetic

**Total time:** ~35 minutes for this single file.

Once this is done, the pattern is established and other files will be much faster!
