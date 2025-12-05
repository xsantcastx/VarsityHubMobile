# Lint Cleanup Priority Guide - VarsityHub Mobile
**Status:** 555 warnings + 1 error (critical)  
**Blocking:** App store submission + CI/CD pipeline  
**Priority:** IMMEDIATE FIX REQUIRED

---

## 🔴 CRITICAL (Blocks Build/Deploy)

### 1. React Hook Violation - useCustomColorScheme.tsx
**File:** `hooks/useCustomColorScheme.tsx:91`  
**Issue:** React Hook `useSystemColorScheme` called conditionally  
**Impact:** Component may crash or behave unpredictably  
**Fix:** Ensure hook is called unconditionally at top level

```typescript
// ❌ WRONG (line 91)
if (Platform.OS === 'ios') {
  const systemScheme = useSystemColorScheme();
}

// ✅ RIGHT
const systemScheme = useSystemColorScheme();
const effectiveScheme = Platform.OS === 'ios' ? systemScheme : userScheme;
```

---

## 🟠 HIGH PRIORITY (App Store Rejection Risk)

### Category A: Floating Promises (106 instances) - SECURITY/STABILITY RISK
**Severity:** Critical - Unhandled promises silently fail, hiding errors

**Files with 5+ instances:**
- `components/PostCard.tsx` (6 instances: 46, 51, 60, 66, 291)
- `app/game-details/GameDetailsScreen.tsx` (10+ instances)
- `app/game-details/GameVerticalFeedScreen.tsx` (10+ instances)
- `app/feed.tsx` (6 instances: 378, 385, 390, 392, 431)

**Pattern:** `deleteItem()` instead of `await deleteItem().catch(...)`

**Quick Fix Script - Add to all floating promises:**
```typescript
// ❌ WRONG
deleteLog(logId);

// ✅ RIGHT - Option 1: await + catch
await deleteLog(logId).catch(err => {
  console.error('Operation failed:', err);
  // Handle error appropriately
});

// ✅ RIGHT - Option 2: void operator (fire-and-forget, intentional)
void deleteLog(logId).catch(err => console.error('Delete failed:', err));

// ✅ RIGHT - Option 3: .then() with handler
deleteLog(logId).then(() => {
  // success
}).catch(err => console.error('Failed:', err));
```

**Files to Fix (in order):**
1. `components/PostCard.tsx` - 6 instances
2. `app/admin-activity-log.tsx` - 1 critical (line 70)
3. `app/admin-ads.tsx` - 1 instance (line 40)
4. `app/admin-dashboard.tsx` - 2 instances (lines 73, 77)
5. `app/admin-messages.tsx` - 1 instance (line 30)
6. `app/admin-reports.tsx` - 5 instances (lines 100, 104, 143, 178, 219)
7. `app/admin-teams.tsx` - 1 instance (line 35)
8. `app/admin-user-detail.tsx` - 1 instance (line 33)
9. `app/admin-users.tsx` - 1 instance (line 34)
10. Continue with remaining ~90 instances (see full list below)

---

### Category B: Stale React Hook Dependencies (15+ instances)
**Severity:** High - Causes data staleness, race conditions, bugs

**Examples:**
```typescript
// ❌ WRONG - useEffect with missing dependency
useEffect(() => {
  loadTeamData(teamId);
}, []); // Missing teamId!

// ✅ RIGHT
useEffect(() => {
  loadTeamData(teamId);
}, [teamId]);

// ❌ WRONG - useCallback missing dependency
const handleUpdate = useCallback(() => {
  saveData(isAdmin); // isAdmin used but not in deps
}, []);

// ✅ RIGHT
const handleUpdate = useCallback(() => {
  saveData(isAdmin);
}, [isAdmin]);
```

**Files with Hook Dependency Issues:**
1. `app/admin-activity-log.tsx:67` - useCallback missing 'isAdmin'
2. `app/admin-user-detail.tsx:31` - useCallback missing 'isAdmin'
3. `app/team-profile.tsx:337` - useCallback missing 'error'
4. `app/feed.tsx:676` - useCallback missing 'colorScheme'
5. `components/BannerUpload.tsx:138` - useEffect missing 'hintOpacity'
6. `hooks/useDeviceLocation.ts:142` - useEffect missing 'fetchLocation'
7. `hooks/useGoogleAuth.ts:103` - useMemo unnecessary 'shouldUseProxy'
8. `hooks/useShareLink.ts:38` - useMemo missing 'options'
9. `app/payment-success.tsx:68` - useEffect missing 'router'
10. `app/game-details/GameDetailsScreen.tsx:1405` - useCallback unnecessary '_refreshVotes'
11. `app/game-details/GameDetailsScreen.tsx:1439` - useCallback unnecessary '_voteSummary'

---

### Category C: Console.log Statements (50+ instances) - APP STORE WILL REJECT
**Severity:** High - App Store reviewers flag excessive logging

**Quick Remove All Script:**
```bash
find /Users/varsityhub/Desktop/CODE/VarsityHubMobile -name "*.tsx" -o -name "*.ts" | xargs grep -l "console\." | while read f; do
  sed -i '' '/console\./d' "$f"
done
```

**Or use Smarter Pattern (keep debug-only):**
```typescript
// ❌ WRONG (must remove)
console.log('Creating team...');

// ✅ RIGHT (if needed during development)
if (__DEV__) {
  console.log('Creating team...');
}
```

**Files with console.log (count):**
- `app/create-team.tsx` (4)
- `app/edit-team.tsx` (8)
- `app/edit-profile.tsx` (3)
- `app/game-details/GameDetailsScreen.tsx` (15+)
- `app/game-details/GameVerticalFeedScreen.tsx` (10+)
- `app/verify-email.tsx` (8)
- `app/payment-success.tsx` (8)
- `app/onboarding/index.tsx` (2)
- `app/onboarding/step-10-confirmation.tsx` (2)
- `app/onboarding/step-3-plan.tsx` (3)
- `app/manage-season.tsx` (4)
- `app/manage-teams.tsx` (2)
- `components/QuickAddGameModal.tsx` (2)
- `components/VideoPlayer.tsx` (2)
- `hooks/useAnalytics.ts` (1)
- `hooks/useAppleAuth.ts` (11)
- `hooks/useCustomColorScheme.tsx` (1)
- `hooks/useDeviceLocation.ts` (3)
- `hooks/useGoogleAuth.ts` (1)
- `hooks/useProfileInteractions.ts` (1)
- `hooks/useProfilePosts.ts` (1)
- And more...

---

## 🟡 MEDIUM PRIORITY (Code Quality)

### Category D: Unused Variables (350+ instances)
**Severity:** Medium - Doesn't break functionality, increases debt

**Pattern:**
```typescript
// ❌ WRONG
const [loading, setLoading] = useState(false); // setLoading never used
const { me } = useAuth(); // me never used

// ✅ RIGHT - Prefix with underscore if truly unused
const [_loading, _setLoading] = useState(false);
const { _me } = useAuth();

// OR BETTER - Remove entirely
// (nothing needed if truly unused)
```

**Top Offenders (20+ unused each):**
- `app/game-details/GameDetailsScreen.tsx` (30+ unused)
- `app/game-details/GameVerticalFeedScreen.tsx` (20+ unused)
- `app/manage-season.tsx` (15+ unused)
- `components/MatchBanner.tsx` (10+ unused)
- `hooks/useAppleAuth.ts` (10+ unused)

---

## 🔧 Automated Fix Strategy

### Step 1: Fix Critical Error (2 min)
```bash
# Fix useCustomColorScheme.tsx hook violation
# Manually edit: hooks/useCustomColorScheme.tsx:91
```

### Step 2: Remove Console Logs (5 min)
```bash
# Option A: Remove ALL console statements
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
find app components hooks -type f \( -name "*.tsx" -o -name "*.ts" \) \
  -exec sed -i '' '/console\.\(log\|error\|warn\|info\|debug\)/d' {} \;

# Option B: Keep __DEV__ guarded logs only (safer)
# Manually review files with most console.log first
```

### Step 3: Fix Floating Promises (20 min)
```bash
# Semi-manual: Fix top 50 instances using this pattern
# Search for regex: "^\s*[a-zA-Z_]\w*\(" then add await + .catch()

# Critical files to fix first (largest impact):
# - components/PostCard.tsx (6 instances)
# - app/admin-activity-log.tsx (1 critical)
# - app/game-details/GameDetailsScreen.tsx (10+ instances)
```

### Step 4: Fix Hook Dependencies (15 min)
```bash
# Add missing dependencies to useEffect/useCallback/useMemo:
# 1. Open each file listed in Category B
# 2. Locate dependency array []
# 3. Add missing variables to array
```

### Step 5: Clean Unused Variables (10 min)
```bash
# Low priority but easiest to fix
# Use eslint --fix with specific rule:
npx eslint app components hooks --fix --rule "@typescript-eslint/no-unused-vars: off"

# OR manually prefix with underscore:
const [_unused, _setUnused] = useState(false);
```

---

## 📊 Fix Impact Summary

| Category | Count | Effort | Impact | Priority |
|----------|-------|--------|--------|----------|
| Hook Violation Error | 1 | 5 min | CRITICAL | 🔴 NOW |
| Floating Promises | 106 | 30 min | CRITICAL | 🔴 SOON |
| Console.log | 50+ | 5 min | HIGH | 🟠 BEFORE STORE |
| Hook Dependencies | 15 | 15 min | HIGH | 🟠 BEFORE STORE |
| Unused Variables | 350+ | 30 min | MEDIUM | 🟡 OPTIONAL |

**Total Effort:** ~90 minutes  
**Total Time to <50 warnings:** ~45 minutes  
**App Store Readiness After:** ✅ Likely approval

---

## ⚡ Execution Order (Fastest Path to Clean Build)

```
1. FIX CRITICAL ERROR (useCustomColorScheme.tsx)
   └─ Make unconditional hook call
   └─ Retest: npx eslint hooks/useCustomColorScheme.tsx

2. REMOVE CONSOLE LOGS
   └─ Automatic sed cleanup or manual in 10 highest files
   └─ Retest: npx eslint --format=compact 2>&1 | grep "no-console" | wc -l

3. FIX FLOATING PROMISES (Top 20 files)
   └─ Priority: PostCard, GameDetailsScreen, GameVerticalFeedScreen
   └─ Add: `await X.catch(err => console.error(err))`
   └─ Retest: npx eslint --format=compact 2>&1 | grep "floating-promises" | wc -l

4. FIX HOOK DEPENDENCIES
   └─ 11 specific hooks identified above
   └─ Retest: npx eslint --format=compact 2>&1 | grep "exhaustive-deps"

5. FINAL LINT
   └─ npx eslint . --format=compact 2>&1 | tail -1
   └─ Target: <100 warnings (mostly unused vars)

6. SECURITY SCAN
   └─ snyk code scan
   └─ Should show ZERO new issues introduced
```

---

## 🎯 Success Criteria

✅ **Stage 1 (NOW):** Fix useCustomColorScheme error  
✅ **Stage 2 (5 min):** Remove console.log statements (target: <50 instances)  
✅ **Stage 3 (30 min):** Fix floating promises (target: <50 instances)  
✅ **Stage 4 (15 min):** Fix hook dependencies (target: 0 violations)  
✅ **Stage 5 (FINAL):** Verify with Snyk code scan = 0 new issues  

**Final Target:** 150-200 warnings (only unused vars remaining - acceptable for store submission)

---

## 🔗 Reference

- ESLint Rules: https://eslint.org/docs/latest/rules/
- React Hooks Rules: https://react.dev/reference/rules/rules-of-hooks
- Floating Promises: https://typescript-eslint.io/rules/no-floating-promises/
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
