# Day 2: Quality Sweep & Lint Reduction Plan

**Goal:** Reduce lint errors from 455 → <100 (78% reduction)

**Timeline:** 4-5 hours focused work

**Success Metric:** All critical screens error-free, total warnings <100

---

## 📊 Lint Analysis: Day 0-1 Baseline

**Total Issues:** 455 warnings, 0 errors

### Top Issue Categories (from baseline)

1. **Unused Variables/Arguments** (⚠️ ~180 issues)
   - Pattern: `const unused = getValue()` without use
   - Fix: Prefix with underscore: `const _unused = getValue()`
   - Files affected: Most app screens

2. **Floating Promises** (⚠️ ~150 issues)
   - Pattern: `handleClick(() => apiCall())` without await/void
   - Fix: Add `void` operator: `void apiCall()`
   - Files affected: Button handlers, async operations

3. **Console.log Statements** (⚠️ ~30 issues)
   - Pattern: `console.log("debug")`
   - Fix: Remove for production or wrap in debug conditional
   - Files affected: Video, Audio, Modal components

4. **Unused Imports** (⚠️ ~50 issues)
   - Pattern: `import { unused } from 'lib'`
   - Fix: Remove unused import
   - Files affected: Throughout

5. **Other Warnings** (⚠️ ~45 issues)
   - Array.map index, implicit any, etc.
   - Fix: Context-specific (see patterns below)

---

## 🎯 Checkpoint 2.1: Onboarding Flow (90 mins)

### Files to Clean
```
app/onboarding/index.tsx
app/onboarding/step-1-role.tsx
app/onboarding/step-2-basic.tsx
app/onboarding/step-3-plan.tsx
app/onboarding/step-4-organization.tsx
app/onboarding/step-10-confirmation.tsx
```

### Common Patterns to Fix

#### Pattern 1: Unused Router Navigation
```typescript
// ❌ Before
onPress={() => router.push('/next-step')}

// ✅ After
onPress={() => void router.push('/next-step')}
```

#### Pattern 2: Async Save Handlers
```typescript
// ❌ Before
const handleSave = async () => {
  try {
    await API.saveProfile(data);
  } catch (error) {
    Alert.alert('Failed');
  }
};

// ✅ After
const handleSave = async () => {
  try {
    await API.saveProfile(data);
  } catch (_error) {
    Alert.alert('Failed');
  }
};
```

#### Pattern 3: Unused Destructured Props
```typescript
// ❌ Before
const { id, name, email } = user;
// Only use id

// ✅ After
const { id, name: _name, email: _email } = user;
// Or just destructure what you need
const { id } = user;
```

### Verification
```bash
npx eslint app/onboarding/*.tsx --max-warnings 10
```

### Time Estimate
- Review + fix: 90 minutes (6 files × 15 mins each)

### ✅ Success Criteria
- All onboarding files: <5 warnings each
- No floating promises
- No unused imports

---

## 🎯 Checkpoint 2.2: Profile & Settings (60 mins)

### Files to Clean
```
app/profile.tsx
app/edit-profile.tsx
app/settings/index.tsx
app/settings/manage-subscription.tsx
```

### Common Issues in These Files
1. **Media upload states:** Remove if not used
2. **Router push in dismissal:** Add void operator
3. **Console.log in payment:** Remove or add debug wrapper
4. **Unused form states:** Clean up unused field states

### Verification
```bash
npx eslint app/profile.tsx app/edit-profile.tsx app/settings/*.tsx --max-warnings 15
```

### Time Estimate
- 60 minutes total

### ✅ Success Criteria
- All profile/settings files: <3 warnings each
- No floating promises in async handlers

---

## 🎯 Checkpoint 2.3: Team Management (90 mins)

### Files to Clean
```
app/team-hub.tsx
app/team-profile.tsx
app/team-page.tsx
app/manage-teams.tsx
```

### Common Issues
1. **Team navigation:** Wrap in void operators
2. **Admin permission checks:** Use proper error handling
3. **Unused team variables:** Prefix with underscore
4. **Missing error handlers:** Add empty catch blocks

### Verification
```bash
npx eslint app/team-*.tsx app/manage-teams.tsx --max-warnings 15
```

### Time Estimate
- 90 minutes total

### ✅ Success Criteria
- All team files: <5 warnings each
- Admin permission checks: Proper error handling

---

## 🎯 Checkpoint 2.4: Admin Screens (60 mins - OPTIONAL)

### Decision Point
**Include only if:**
- Shipping admin features in v1.0
- Have time after critical screens clean

**Skip if:**
- Admin screens are internal only
- Time is running short
- Features deferred to v1.1

### Files to Clean (if including)
```
app/admin-dashboard.tsx
app/admin-users.tsx
app/admin-reports.tsx
```

### Time Estimate
- 60 minutes (or skip)

---

## 🔧 Components Cleanup (Parallel with screens)

### High-Priority Component Files
These have the most warnings and affect multiple screens:

```
components/PostCard.tsx              → 6-8 warnings
components/QuickAddGameModal.tsx    → 8-10 warnings
components/ImageEditor.tsx          → 2-3 warnings
components/LocationPicker.tsx       → 3-4 warnings
components/VideoPlayer.tsx          → 2-3 warnings
components/ui/CenterTabButton.tsx  → 2-3 warnings
components/ui/MentionInput.tsx      → 1-2 warnings
components/OfflineBanner.tsx        → 1 warning
```

### Batch Component Cleanup
```bash
# Run this to see top offenders
npx eslint components/*.tsx --max-warnings 5 | grep -E "components/[^/]+\.tsx" | sort | uniq -c | sort -rn | head -10
```

### Time Estimate
- **If parallel:** Can be done alongside screen cleanup
- **If sequential:** 2 hours for top 10 components

---

## 📋 Full Day 2 Schedule

### ⏰ Morning (2-3 hours)
```
09:00 AM - Start Checkpoint 2.1 (Onboarding)
10:30 AM - Checkpoint 2.2 (Profile/Settings)
11:30 AM - Coffee break
```

### ⏰ Lunch (1 hour)
```
12:00 PM - Lunch break
```

### ⏰ Afternoon (2 hours)
```
01:00 PM - Start Checkpoint 2.3 (Team Management)
02:30 PM - Checkpoint 2.4 (Admin - optional)
```

### ⏰ Evening (1 hour)
```
04:00 PM - Run full quality check
04:30 PM - Commit and push to main
```

---

## ✅ Full Quality Check (Checkpoint 2.5)

```bash
# Step 1: TypeCheck
npm run typecheck
# Expected: 0 errors

# Step 2: Lint with reduced max-warnings
npm run lint:strict 2>&1 | tail -5
# Expected: <100 warnings (target: <60 critical)

# Step 3: Doctor
npm run doctor
# Expected: 15+ checks passed, 2-3 acceptable warnings

# Step 4: Test
npm test -- --runInBand --no-watchman
# Expected: Passes or skipped gracefully

# Step 5: Git status
git status
# Expected: All changes staged
```

---

## 📈 Expected Progress

| Time | Checkpoint | Warnings | Target |
|------|-----------|----------|--------|
| 9:00 AM | Start (baseline) | 455 | → <400 |
| 10:30 AM | 2.1 + 2.2 done | ~350 | → <300 |
| 02:00 PM | 2.3 + 2.4 done | ~200 | → <150 |
| 04:00 PM | Final check | <150 | → <100 ✅ |

---

## 🚀 Commit & Push

Once Day 2 quality check passes:

```bash
git add .
git commit -m "Day 2: Quality sweep complete, lint reduced 455→<100

✅ Onboarding flow: error-free
✅ Profile & Settings: error-free
✅ Team Management: error-free
✅ Admin screens: cleaned (optional)
✅ Components: top offenders fixed
✅ TypeScript: 0 errors
✅ Tests: passing/skipped
✅ All critical screens ready for production

Next: Day 3 real-data validation"

git push origin main
```

**Expected CI Result:** ✅ Green

---

## 🎓 Pro Tips for Day 2

1. **Use IDE bulk operations:**
   - Use VS Code Find/Replace for common patterns
   - Regex replace: `(.*?)` patterns across files

2. **Prioritize by impact:**
   - Focus on files used in critical flows first
   - Defer low-traffic screens (admin, settings)

3. **Batch similar fixes:**
   - Do all "unused imports" at once
   - Then all "floating promises"
   - Then all "unused variables"

4. **Test after each checkpoint:**
   - Run `npm run lint:strict` after each 30 mins
   - Verify you're on track for <100 target

5. **Don't over-optimize:**
   - Goal is <100 warnings, not perfect code
   - Defer code style improvements to v1.1

---

## ⚠️ If Running Behind Schedule

**If lint is still >200 after 3 hours:**

**Option 1:** Extend Day 2
- Push Day 3 validation to next day
- Finish all critical screens clean

**Option 2:** Ship with warnings
- Focus only on critical screens
- Document known issues
- Fix post-launch in v1.0.1

**Option 3:** Reduce scope
- Skip admin screens (deferred)
- Focus on auth/game/event/payment critical paths
- Accept ~150-200 warnings in non-critical screens

---

## 📞 Getting Help

If stuck on a specific lint issue:

```bash
# See rule documentation
npx eslint --print-config <file>

# Get info about specific rule
# https://typescript-eslint.io/rules/<rule-name>

# Ask for auto-fix suggestions
npx eslint --fix <file>
```

---

**Ready to start Day 2? Use this schedule and these patterns to cut lint by 78%! 🚀**
