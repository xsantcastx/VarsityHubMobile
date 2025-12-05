# 🧹 Catch-Block Cleanup Roadmap

57 empty catch blocks identified overnight. Strategic cleanup plan for Day 3+ execution.

---

## Priority Breakdown

### 🔴 CRITICAL (High-Impact Files) — Fix Tomorrow
These are core files used frequently; fixing them improves reliability significantly.

**Count:** ~15-20 blocks
**Effort:** ~2-3 hours
**Impact:** High (frequently used code paths)

High-priority files from overnight scan:
- `app/create.tsx` — Core user creation
- `app/settings/*.tsx` — User settings flows
- `utils/events.ts` — Event system
- `api/http.ts` — HTTP client (error handling critical here)
- `api/settings.ts` — Settings persistence
- `server/src/routes/payments.ts` — Payment processing (high-value)

**Action:** Add error parameter + logging to catch blocks in these files

---

### 🟡 MEDIUM (Important Files) — Fix This Week
Less critical but still important for reliability.

**Count:** ~25-30 blocks
**Effort:** ~4-5 hours spread across week
**Impact:** Medium (supporting features)

Examples:
- Component lifecycle handlers
- Navigation/routing try-catch blocks
- Data validation/parsing
- Browser API calls

**Action:** Batch fixes by file category

---

### 🟢 LOW (Nice-to-Have) — Post-Launch Cleanup
Can wait until after production launch; mainly UI/UX edge cases.

**Count:** ~10-15 blocks
**Effort:** ~2-3 hours post-launch
**Impact:** Low (edge cases, user feedback dependent)

Examples:
- Lottie animation error handling
- Browser feature detection
- Optional feature toggles
- Analytics/logging try-catches

**Action:** Create GitHub issues for post-launch sprint

---

## Systematic Approach

### Today (Day 3 QA) — No Changes
- ✅ Document any catch-block errors found during QA
- ✅ Note which ones affect user flows
- ✅ Prioritize based on QA findings

### Tomorrow (Dec 5, Evening) — Critical Fixes
1. Pick 3-5 CRITICAL files from list below
2. Add error parameters: `catch (error)` instead of `catch {}`
3. Add basic logging: `console.error('Context:', error)`
4. Test affected flows
5. Commit: "fix: add error parameters to critical catch blocks"

### This Week — Medium Fixes
1. Group by file category
2. Batch fix similar patterns
3. Run tests after each batch
4. Commit per category

### Post-Launch — Nice-to-Have Cleanup
1. Create GitHub issues for each low-priority block
2. Plan for next sprint
3. Address based on production incidents/feedback

---

## Quick Reference: Files to Fix Tomorrow

All from `catch-scan-20251204-022523.log`

### Payment Processing (CRITICAL)
```
server/src/routes/payments.ts:794
```
**Issue:** Silent failure on date parsing  
**Fix:** `catch (error) { logger.error('Payment date parse:', error); throw error; }`

### User Data (CRITICAL)
```
app/create.tsx:14
app/settings/request-host-event.tsx:18
app/settings/contact.tsx:18
app/settings/feedback.tsx:17
app/settings/zip-code.tsx:20
```
**Pattern:** User.me() fetch silently failing  
**Fix:** `catch (error) { console.error('User fetch failed:', error); return null; }`

### HTTP/API Layer (CRITICAL)
```
api/http.ts:108
api/http.ts:110
```
**Issue:** Auth error handling swallowed  
**Fix:** Add proper error chain with context

### Settings Storage (CRITICAL)
```
api/settings.ts:41
```
**Issue:** JSON parse failure silently returns fallback  
**Fix:** `catch (error) { logger.warn('Settings parse failed:', error); return fallback; }`

### Event System (MEDIUM)
```
utils/events.ts:18
```
**Issue:** Event handler errors ignored  
**Fix:** `catch (error) { logger.error('Event handler error:', error); }`

### UI Components (LOW)
```
app/components/MatchBannerLottie.tsx:21
app/components/MatchBannerLottie.tsx:32
app/components/MatchBannerLottie.tsx:35
app/admin-user-detail.tsx:38
```
**Pattern:** Animation/browser API failures  
**Fix:** `catch (error) { console.warn('UI fallback:', error.message); }`

---

## Template for Fixes

### Before
```typescript
try {
  // operation
} catch {
  // silently fail or return default
}
```

### After (Level 1 — Minimal)
```typescript
try {
  // operation
} catch (error) {
  console.error('Context:', error);
}
```

### After (Level 2 — Logging)
```typescript
try {
  // operation
} catch (error) {
  logger.error('Operation context', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });
}
```

### After (Level 3 — Recovery)
```typescript
try {
  // operation
} catch (error) {
  logger.error('Operation failed, using fallback:', error);
  return fallbackValue; // or rethrow
}
```

Use Level 1-2 for most; Level 3 for known-fallback cases.

---

## Daily Progress Tracker

### Dec 5 (Today) — QA Day
- [ ] Document catch-block errors found during QA
- [ ] Identify which blocks are user-facing

### Dec 5 (Evening) — Critical Batch
- [ ] Fix CRITICAL files (5-7 files, ~2-3 hours)
- [ ] Test affected flows
- [ ] Commit

### Dec 6 (Day 4 onwards)
- [ ] Fix MEDIUM files (daily batches, ~1 hour each)
- [ ] Create GitHub issues for LOW priority
- [ ] Monitor production for actual errors

---

## Success Metrics

✅ **Today (QA):** Identify real catch-block errors  
✅ **Tomorrow (Critical):** 15-20 blocks fixed  
✅ **This Week (Medium):** 25-30 blocks fixed  
✅ **Post-Launch (Low):** Issues created, prioritized  

**Goal:** 90% of user-facing catch blocks with proper error handling before end of week.

---

## Commands for Tomorrow Morning

```bash
# View full catch-block list
cat overnight-results/catch-scan-20251204-022523.log

# Get count by file
cat overnight-results/catch-scan-20251204-022523.log | cut -d: -f1 | sort | uniq -c | sort -rn

# Filter by file (e.g., api/http.ts)
grep "api/http.ts" overnight-results/catch-scan-20251204-022523.log

# Find all catch blocks in a file
grep -n "catch" app/create.tsx
```

---

## Post-QA Assessment

After Day 3 QA, update this with:
- [ ] Which catch-block errors affected user flows?
- [ ] Did any cause test failures?
- [ ] Which files showed the worst errors?
- [ ] Revised priority based on QA findings

This will guide tomorrow's fixing strategy.

---

**Ready to tackle these tomorrow?** 57 blocks → ~90% coverage this week is achievable. 🚀
