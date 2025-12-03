# Lint Cleanup Guide - Fixing no-floating-promises & no-unused-vars

## Quick Reference

The new strict linting rules catch **484 issues** across the codebase. Nothing is broken—it's legacy code that needs to meet the new standards. Here's how to fix each type systematically.

---

## 1. No-Floating-Promises (@typescript-eslint/no-floating-promises)

**Rule:** Every async call must be `await`ed, `.catch()`'d, or explicitly marked with `void`.

### Pattern A: Awaited Promises (Preferred)

**Before:**
```typescript
const handleSave = () => {
  saveToDB(data); // ❌ floating promise
};
```

**After:**
```typescript
const handleSave = async () => {
  await saveToDB(data); // ✅ awaited
};
```

---

### Pattern B: Fire-and-Forget with `void` (For Side Effects)

Use when you intentionally don't care about the result (e.g., navigation, tracking).

**Before:**
```typescript
Alert.alert('Success', 'Saved!', [
  { text: 'OK', onPress: () => router.push('/home') } // ❌ floating
]);
```

**After:**
```typescript
Alert.alert('Success', 'Saved!', [
  { text: 'OK', onPress: () => void router.push('/home') } // ✅ explicit void
]);
```

**Explanation:** `void` tells TypeScript "I know this is a promise, I'm ignoring it on purpose."

---

### Pattern C: Catch Errors (For Background Tasks)

**Before:**
```typescript
useEffect(() => {
  fetchData(); // ❌ floating
}, []);
```

**After:**
```typescript
useEffect(() => {
  void fetchData().catch(console.error); // ✅ handled
}, []);
```

Or with an async IIFE:
```typescript
useEffect(() => {
  (async () => {
    try {
      await fetchData();
    } catch (error) {
      console.error('[fetchData]', error);
    }
  })();
}, []);
```

---

### Pattern D: Router Calls in Event Handlers

**Before:**
```typescript
<Pressable onPress={() => router.push('/profile')}>
```

**After:**
```typescript
<Pressable onPress={() => void router.push('/profile')}>
```

**Common locations:**
- Alert button handlers
- Navigation links
- Redirect after API calls

---

## 2. No-Unused-Vars (@typescript-eslint/no-unused-vars)

**Rule:** Variables must be used or prefixed with `_` to indicate intentional ignore.

### Pattern A: Rename Ignored Variables

**Before:**
```typescript
try {
  await apiCall();
} catch (error) { // ❌ 'error' defined but never used
  Alert.alert('Failed');
}
```

**After:**
```typescript
try {
  await apiCall();
} catch (_error) { // ✅ prefixed with _
  Alert.alert('Failed');
}
```

---

### Pattern B: Delete Dead Code

**Before:**
```typescript
const [loading, setLoading] = useState(false); // ❌ 'loading' never used
const [data, setData] = useState(null);
```

**After:**
```typescript
const [data, setData] = useState(null); // ✅ removed unused state
```

---

### Pattern C: Destructure Only What You Need

**Before:**
```typescript
const { id, title, author } = post; // ❌ 'title' and 'author' unused
return <Text>{id}</Text>;
```

**After:**
```typescript
const { id } = post; // ✅ only used properties
return <Text>{id}</Text>;
```

Or rename:
```typescript
const { id, title: _title, author: _author } = post;
```

---

## 3. No-Console (Warnings)

**Rule:** Only `console.warn` and `console.error` are allowed. Gate debug logs with `__DEV__`.

### Pattern A: Replace console.log

**Before:**
```typescript
console.log('User signed in:', user); // ❌ warning
```

**After (Production):**
```typescript
console.warn('[auth] User signed in:', user); // ✅ allowed
```

**After (Dev-Only):**
```typescript
if (__DEV__) {
  console.log('[auth] User signed in:', user); // ✅ gated
}
```

---

### Pattern B: Remove Debug Logs

**Before:**
```typescript
console.log('data:', data);
console.log('loading:', loading);
```

**After:**
```typescript
// Removed debug logs
```

---

## 4. React Hooks Warnings (exhaustive-deps)

**Rule:** Include all referenced values in dependency arrays OR remove the array.

### Pattern A: Add Missing Dependencies

**Before:**
```typescript
useEffect(() => {
  fetchUser(userId);
}, []); // ❌ missing 'userId'
```

**After:**
```typescript
useEffect(() => {
  void fetchUser(userId).catch(console.error);
}, [userId]); // ✅ dependency added
```

---

### Pattern B: Remove Stale Dependencies

**Before:**
```typescript
useCallback(() => {
  return data;
}, [data, extraDep]); // ❌ 'extraDep' not used
```

**After:**
```typescript
useCallback(() => {
  return data;
}, [data]); // ✅ only necessary deps
```

---

## File-by-File Strategy

### Priority 1: Active Shipping Screens (Fix First)
- ✅ `app/event-detail.tsx` - **DONE**
- `app/game-details/GameDetailsScreen.tsx`
- `app/highlights.tsx`
- `app/feed.tsx`
- `app/messages.tsx`

### Priority 2: Auth & Settings
- `app/sign-in.tsx`
- `app/sign-up.tsx`
- `app/settings/index.tsx`

### Priority 3: Admin & Secondary Features
- `app/admin-*.tsx`
- `app/onboarding/*.tsx`
- `app/team-*.tsx`

---

## Example: Cleaning app/event-detail.tsx

### Changes Made:

**1. Router calls in Alert handlers:**
```diff
- { text: 'Sign In', onPress: () => router.push('/sign-in') }
+ { text: 'Sign In', onPress: () => void router.push('/sign-in') }
```

**Result:** All floating promises fixed, file now passes lint.

---

## Common Patterns in VarsityHub Codebase

### API Calls
```typescript
// ❌ Before
const handleVote = () => {
  Game.vote(gameId, teamId);
};

// ✅ After
const handleVote = async () => {
  try {
    await Game.vote(gameId, teamId);
    Alert.alert('Success', 'Vote recorded');
  } catch (error) {
    console.error('[vote]', error);
    Alert.alert('Error', 'Failed to vote');
  }
};
```

### Story Uploads
```typescript
// ❌ Before
const addStory = () => {
  uploadFile(uri, { gameId });
};

// ✅ After
const addStory = async () => {
  console.warn('[story] Starting upload');
  try {
    await uploadFile(uri, { gameId });
    console.warn('[story] Upload complete');
  } catch (error) {
    console.error('[story] Upload failed', error);
  }
};
```

### RSVP Toggles
```typescript
// ❌ Before
const toggleRsvp = () => {
  Event.rsvp(eventId, !isGoing);
};

// ✅ After
const toggleRsvp = async () => {
  try {
    const result = await Event.rsvp(eventId, !isGoing);
    setIsGoing(result.attending);
  } catch (error) {
    if (error.response?.status === 401) {
      void router.push('/sign-in');
    }
  }
};
```

---

## Quick Wins (Easy Fixes)

### 1. Alert Handlers - Add `void` to router.push
```bash
# Find all instances:
grep -r "onPress.*router.push\|onPress.*router.replace" app/
```

### 2. useEffect Promises - Add .catch()
```bash
# Find all instances:
grep -r "useEffect.*=>" app/ | grep -v "await"
```

### 3. Unused Variables - Prefix with _
```bash
# Common patterns:
catch (error) → catch (_error)
const { data, meta } → const { data, meta: _meta }
```

---

## Testing After Cleanup

```bash
# Check single file
npx eslint app/event-detail.tsx

# Check all app files
npm run lint:strict

# Verify TypeScript
npm run typecheck
```

---

## Expected Results

### Before Cleanup:
```
✖ 484 problems (156 errors, 328 warnings)
```

### After Priority 1 Cleanup (~10 files):
```
✖ ~300 problems (mostly warnings)
```

### After Full Cleanup:
```
✔ No problems found
```

---

## Need Help?

1. **Pattern unclear?** Check this guide or ask
2. **Complex async flow?** Share the code snippet
3. **Breaking change?** Test the screen after fixing
4. **Unsure about void?** When in doubt, await it

---

## Automation Ideas

### Bulk Find-Replace (Use with caution!)

```bash
# Replace console.log with console.warn
find app/ -name "*.tsx" -exec sed -i '' 's/console\.log(/console.warn(/g' {} +

# Add void to common router patterns (review changes!)
find app/ -name "*.tsx" -exec sed -i '' 's/onPress={() => router\.push/onPress={() => void router.push/g' {} +
```

**⚠️ Always review auto-replacements before committing!**

---

## Summary Checklist

For each file:
- [ ] Add `await` to async calls in handlers
- [ ] Add `void` to fire-and-forget router calls
- [ ] Rename unused error vars to `_error`
- [ ] Replace `console.log` with `console.warn` or gate with `__DEV__`
- [ ] Add missing deps to hook arrays
- [ ] Delete dead code (unused state, imports, functions)
- [ ] Test the screen after changes

---

## Next File: GameDetailsScreen.tsx

Let me know when you're ready and I'll tackle that one to show the full pattern!
