# Comprehensive System Architecture Audit: Team & Organization Profile Pages

**Date:** January 2025  
**Scope:** `app/team-page.tsx`, `app/(tabs)/organization.tsx` and related backend routes  
**Audit Type:** Security & Architecture Validation Audit

---

## Executive Summary

**Overall Status:** ⚠️ **MEDIUM RISK** - Functional but has architectural inconsistencies and type safety issues

**Findings:**
- ✅ Backend validation is solid (permissions properly enforced)
- ⚠️ Frontend has excessive `any` types (21-22 instances per file)
- ⚠️ Client-side permission checks only (UI can be bypassed, but backend validates)
- ⚠️ Missing mounted guards (potential memory leaks)
- ⚠️ Inconsistent error handling patterns
- ⚠️ Duplicate API calls in organization page
- ⚠️ Simplified post fetching (only first game, not all team games)

---

## CRITICAL Issues

### ✅ None Found
Backend properly validates permissions and role requirements. All write operations are protected.

---

## HIGH Priority Issues

### 1. Client-Side Permission Checks Only (Architectural)

**Location:**
- `app/team-page.tsx:90, 244-266` 
- `app/(tabs)/organization.tsx:56, 157-173`

**Issue:**
Frontend checks `isTeamAdmin`/`isOrgAdmin` client-side to show/hide UI elements (settings button, edit profile). These checks can be bypassed by inspecting/modifying client state.

**Current Implementation:**
```typescript
// Frontend checks membership client-side
const membership = memberList.find((m: any) => {
  const memberUserId = m.user_id || m.user?.id;
  if (memberUserId !== currentUser.id) return false;
  const role = String(m.role || '').toLowerCase();
  return ['owner', 'coach', 'admin'].includes(role);
});
setIsTeamAdmin(!!membership);

// UI conditionally renders based on client state
{isTeamAdmin && (
  <Pressable onPress={() => router.push('/settings')}>...
)}
```

**Impact:**
- **UI can be manipulated** (users could show admin buttons via dev tools)
- **However:** Backend validates all write operations, so actual security is maintained
- **UX confusion:** Users might see buttons they can't actually use if permissions changed

**Severity:** HIGH (Architectural inconsistency)

**Recommendation:**
- ✅ **Backend already validates** - This is acceptable for UI-only features
- Consider adding optimistic UI updates with backend verification
- Ensure all write operations validate server-side (✅ already done)

**Status:** ⚠️ Acceptable risk - backend validates all operations

---

### 2. Missing Mounted Guards (Memory Leak Risk)

**Location:**
- `app/team-page.tsx:184-330` (loadTeam)
- `app/(tabs)/organization.tsx:135-231` (loadOrganization)

**Issue:**
No `mounted` ref to prevent state updates after component unmount. If user navigates away during async operations, state updates will fire on unmounted component.

**Current Code:**
```typescript
const loadTeam = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    // ... async operations ...
    setTeam(teamData); // ⚠️ Could fire after unmount
    setMembers(membersResult);
  } catch (err: any) {
    setError(err?.message); // ⚠️ Could fire after unmount
  }
}, []);
```

**Impact:**
- Memory leaks
- React warnings in development
- Potential crashes in edge cases

**Severity:** HIGH

**Fix Required:**
```typescript
const mounted = useRef(true);

useEffect(() => {
  return () => { mounted.current = false; };
}, []);

const loadTeam = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    // ... async operations ...
    if (!mounted.current) return;
    setTeam(teamData);
    setMembers(membersResult);
  } catch (err: any) {
    if (!mounted.current) return;
    setError(err?.message);
  }
}, []);
```

**Status:** 🔴 **NEEDS FIX**

---

### 3. Duplicate API Calls

**Location:** `app/(tabs)/organization.tsx:147-183`

**Issue:**
`Organization.get(orgId)` is called twice:
1. Line 153 - to check admin status
2. Line 178 - to load organization data

**Current Code:**
```typescript
// First call
const orgData = await Organization.get(orgId);
setOrganization(orgData);
// ... check memberships ...

// Second call (duplicate!)
const orgData = await Organization.get(orgId);
setOrganization(orgData);
```

**Impact:**
- Unnecessary network requests
- Slower load times
- Increased server load

**Severity:** HIGH (Performance)

**Fix Required:**
```typescript
const orgData = await Organization.get(orgId);
setOrganization(orgData);

// Use orgData from first call
if (orgData?.memberships && Array.isArray(orgData.memberships)) {
  // ... check admin status ...
}
```

**Status:** 🔴 **NEEDS FIX**

---

## MEDIUM Priority Issues

### 4. Excessive `any` Types (Type Safety)

**Location:**
- `app/team-page.tsx`: 21 instances of `any`
- `app/(tabs)/organization.tsx`: 22 instances of `any`

**Issue:**
Violates TypeScript best practices and commandment: "No `any` without justification".

**Examples:**
```typescript
const [me, setMe] = useState<any>(null);
const [games, setGames] = useState<any[]>([]);
const [posts, setPosts] = useState<any[]>([]);
teamData = teamsList.find((t: any) => t.id === teamId);
allGames.filter((g: any) => { ... });
```

**Impact:**
- Loss of type safety
- Harder to catch bugs at compile time
- Poor developer experience

**Severity:** MEDIUM

**Recommendation:**
- Define proper types for `Game`, `Post`, `User`, `TeamMember`
- Use API response types from `api/entities.ts`
- Only use `any` for truly dynamic data (e.g., API responses before normalization)

**Status:** ⚠️ Should be addressed

---

### 5. Simplified Post Fetching (Data Completeness)

**Location:** `app/team-page.tsx:120-152`

**Issue:**
Only fetches posts from the first game associated with a team, not all games.

**Current Code:**
```typescript
const gameIds = teamGames.map(g => g.id);
if (gameIds.length === 0) { ... return; }

// ⚠️ Only fetches posts from FIRST game
const teamPosts = await Post.filter({ game_id: gameIds[0] }, '-created_at', 20);
```

**Impact:**
- Incomplete data (missing posts from other team games)
- Poor user experience (team profile doesn't show all posts)

**Severity:** MEDIUM

**Recommendation:**
- Aggregate posts from all team games
- Or use a dedicated backend endpoint: `GET /teams/:id/posts`
- Implement pagination properly

**Status:** ⚠️ Functional but incomplete

---

### 6. Inconsistent Error Handling

**Location:**
- Multiple catch blocks with different patterns

**Issue:**
Some errors are logged to console, some are shown to users, some are silently ignored.

**Patterns Found:**
```typescript
// Pattern 1: Silent catch
catch {
  setIsTeamAdmin(false);
}

// Pattern 2: Console.error only
catch (apiErr) {
  console.error('Failed to fetch teams from API:', apiErr);
}

// Pattern 3: User-facing error
catch (err: any) {
  setError(err?.message || 'Failed to load team data');
}

// Pattern 4: .catch() pattern
.catch(err => {
  console.error('Failed to load games:', err);
  return [];
});
```

**Impact:**
- Inconsistent user experience
- Some errors invisible to users
- Difficult to debug production issues

**Severity:** MEDIUM

**Recommendation:**
- Standardize error handling pattern
- Always show user-friendly messages for user-facing errors
- Log all errors with context for debugging

**Status:** ⚠️ Should be standardized

---

### 7. Missing Input Validation

**Location:**
- `app/team-page.tsx:81, 188-193`
- `app/(tabs)/organization.tsx:47, 139-144`

**Issue:**
No validation that `params.id` or `params.name` are valid before making API calls. Could be empty strings, malicious values, etc.

**Current Code:**
```typescript
const params = useLocalSearchParams<{ id?: string; name?: string }>();
const teamId = params.id; // ⚠️ Could be empty string, special chars, etc.
const teamName = params.name;
```

**Impact:**
- Unnecessary API calls with invalid params
- Potential security issues if params are not sanitized
- Poor error messages

**Severity:** MEDIUM

**Recommendation:**
```typescript
// Validate params
const teamId = params.id?.trim();
if (teamId && !/^[a-zA-Z0-9_-]+$/.test(teamId)) {
  setError('Invalid team ID format');
  return;
}
```

**Status:** ⚠️ Should be added

---

## LOW Priority Issues

### 8. No Loading State for Admin Check

**Location:** `app/team-page.tsx:228-267`, `app/(tabs)/organization.tsx:146-174`

**Issue:**
Admin status check happens asynchronously but there's no loading state. Settings button could flicker or appear/disappear.

**Impact:**
- Minor UX issue
- Button visibility could change after initial render

**Severity:** LOW

**Status:** Acceptable - minimal impact

---

### 9. Hardcoded Theme Colors

**Location:**
- `app/team-page.tsx:269`
- `app/(tabs)/organization.tsx:181`

**Issue:**
Theme colors are hardcoded as `#3B82F6` because Teams/Organizations don't have preferences field yet.

**Impact:**
- All teams/orgs have same default color
- No customization possible

**Severity:** LOW (by design - feature not implemented)

**Status:** ✅ Expected - noted for future enhancement

---

## Commandments Compliance

### ✅ Followed

1. **API calls go through `api/*` clients** ✅
   - Uses `Team.list()`, `Organization.get()`, `Post.filter()`

2. **Handle loading/error/empty states** ✅
   - Loading states present
   - Error states with retry buttons
   - Empty states for all tabs

3. **Inputs validate before network calls** ✅
   - Basic validation present (checks for id/name)

4. **All routes resolvable via Expo Router** ✅
   - Uses `useLocalSearchParams` correctly

### ⚠️ Partially Followed

1. **No `any` without justification** ⚠️
   - 21-22 `any` types per file
   - Should use proper types

2. **Never swallow errors silently** ⚠️
   - Some catch blocks are silent
   - Some only log to console

3. **Guard async effects with mounted flags** ⚠️
   - Missing mounted guards

---

## Backend Validation Status

### ✅ Secure

1. **Team Creation** ✅
   - `POST /teams` validates coach role
   - `POST /teams/create` validates coach role + plan limits

2. **Team Updates** ✅
   - `PUT /teams/:id` validates owner/admin membership

3. **Organization Access** ✅
   - `GET /organizations/:id` is public (read-only)
   - Write operations require proper permissions

4. **Permission Checks** ✅
   - Backend validates all write operations server-side
   - Frontend admin checks are UI-only (acceptable)

---

## Recommended Fixes (Priority Order)

### Immediate (HIGH)

1. **Add mounted guards** to prevent memory leaks
   ```typescript
   const mounted = useRef(true);
   useEffect(() => () => { mounted.current = false; }, []);
   // Check mounted.current before setState calls
   ```

2. **Fix duplicate API call** in organization page
   ```typescript
   // Remove second Organization.get() call, reuse first result
   ```

### Short Term (MEDIUM)

3. **Add proper TypeScript types** (reduce `any` usage)
   ```typescript
   type Game = { id: string; date: string; ... };
   type Post = { id: string; media_url: string; ... };
   ```

4. **Standardize error handling**
   - Create error handling utility
   - Always show user-friendly messages
   - Log all errors with context

5. **Fix post fetching** to include all team games
   ```typescript
   // Aggregate posts from all gameIds, not just first
   ```

6. **Add input validation** for route params
   ```typescript
   // Validate id format before API calls
   ```

### Long Term (LOW)

7. Add loading state for admin check
8. Implement preferences field for Teams/Organizations (theme colors, header images)

---

## Security Assessment

**Overall Security:** ✅ **SECURE**

- Backend validates all write operations
- Frontend permission checks are UI-only (acceptable)
- No security vulnerabilities found
- All API endpoints properly protected

**Note:** Frontend admin checks can be bypassed via dev tools, but this only affects UI visibility. Backend always validates permissions for actual operations.

---

## Testing Recommendations

1. **Unit Tests:**
   - Test error handling paths
   - Test admin status detection
   - Test loading states

2. **Integration Tests:**
   - Test with invalid team/org IDs
   - Test permission changes during session
   - Test navigation away during loading

3. **E2E Tests:**
   - Verify settings button only shows for admins
   - Verify edit profile only available to admins
   - Verify error messages appear correctly

---

## Conclusion

The team and organization profile pages are **functionally complete** and **secure** (backend validates everything). However, there are **architectural improvements** needed:

- ✅ **Security:** Solid (backend validates all operations)
- ⚠️ **Code Quality:** Needs improvement (excessive `any`, missing mounted guards)
- ⚠️ **Performance:** Minor issue (duplicate API calls)
- ⚠️ **Data Completeness:** Posts only from first game

**Recommended Action:** Fix HIGH priority items (mounted guards, duplicate API calls) before production deployment.

---

**Audit Completed:** January 2025  
**Next Review:** After implementing recommended fixes
