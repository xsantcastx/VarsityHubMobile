# VarsityHub Client Cross-Feature Inconsistencies Audit

**Audit Date:** 2026-04-20  
**Scope:** `app/`, `components/`, `hooks/`, `api/`, `context/`, `utils/` (excludes tests, node_modules, server)  
**Finding:** 12 drift items affecting bug prevention and maintainability.

---

## HIGH Severity

### 1. Date Formatting Drift Across Screens

**Category:** Duplicate logic  
**Locations:**
- `app/manage-season.tsx:199-202` — `.toISOString().split('T')[0]` for ISO dates
- `app/manage-season.tsx:1880, 2040, 2156` — `.toLocaleDateString()` for display
- `app/team-viewer.tsx:110-111` — mixed `.toISOString().split('T')[0]` and `.toLocaleTimeString()`
- `utils/format.ts:19-28` — `timeAgo()` helper exists but unused in date displays

**Bug Risk:** Different screens render the same date differently, creating UX inconsistency. Worse: `.toLocaleDateString()` is locale-aware and may vary across devices, breaking timestamp comparisons in feeds.

**Canonical Recommendation:**  
Create `utils/dateFormat.ts` with three canonical functions:
- `formatDateISO(date: Date | string): string` → `YYYY-MM-DD` for form inputs / comparisons
- `formatDateDisplay(date: Date | string): string` → localized display (e.g., "Mar 20, 2026")
- `formatTimeDisplay(date: Date | string): string` → localized time (e.g., "2:30 PM")

Use these consistently everywhere. This prevents locale bugs and centralizes formatting logic.

**Effort:** `S` (2 hours: add 3 helpers, grep-replace 150+ call sites)

---

### 2. API Error Handling Variations

**Category:** API call drift  
**Locations:**
- `app/verify-identity.tsx:245-250` — Checks `error?.status ?? error?.response?.status`, uses `error?.message || error?.data?.error`
- `app/game-photos.tsx:34-35` — Generic `setError(true)`, no error message extraction
- `app/team-viewer.tsx:73-74` — Uses `error?.message || 'Failed to load team data'`
- `app/settings/data-export.tsx:145-157` — Checks status codes (401, 403) vs. generic catch

**Bug Risk:** Silent failures in game-photos (user sees loading then error state but no message). verify-identity over-defensively checks both `.status` and `.response?.status` (only `.status` exists on our errors). Inconsistent error extraction leads to blank error messages in some flows.

**Canonical Recommendation:**  
Create `utils/apiErrors.ts` with helper:
```typescript
function extractErrorMessage(err: any, fallback: string = 'Request failed'): string {
  return err?.message || err?.data?.error || fallback;
}
```

Replace all error extraction with this. Document that our http.ts errors always have `.status` (no `.response?.status` nesting).

**Effort:** `S` (1 hour: add helper, update 8 call sites)

---

### 3. Mixed Hook Patterns for Data Fetching (useUser vs. useTeamOptions vs. Direct API)

**Category:** State management drift  
**Locations:**
- `hooks/useUser.ts` — Custom hook wrapping `User.me()`, returns `{ user, loading, error, refresh }`
- `hooks/useTeamOptions.ts` — Custom hook wrapping `Team.list()`, same pattern
- `hooks/useOrganizationSearch.ts` — Custom hook, different return shape: `{ organizations, loading, error, search, clear }`
- `app/settings/followed-teams.tsx:20-28` — Direct `Team.list()` call with local useState for loading/error
- `app/blocked-users.tsx:23-32` — Direct `User.blockedUsers()` with local useState

**Bug Risk:** Code duplication across 5+ fetch hooks. New screens don't know whether to use `useTeamOptions` or call `Team.list()` directly. Inconsistent return shapes make composability fragile. If one hook fixes a bug (e.g., race condition handling), others don't benefit.

**Canonical Recommendation:**  
Create a generic `useAsyncData<T>` hook wrapping standard loading/error/refresh pattern. Replace `useUser`, `useTeamOptions`, etc. with calls to `useAsyncData()`. Keeps hooks DRY and consistent.

**Effort:** `M` (3-4 hours: add generic hook, migrate 5 existing hooks, update callers)

---

### 4. Coach Access Guards Scattered Across Multiple Hooks

**Category:** Duplicate logic  
**Locations:**
- `hooks/useRequireCoach.ts:15-37` — Checks `user?.approval_status === 'APPROVED'`, reads `coach_agreement_version`
- `context/AuthProvider.tsx` — Also reads `approval_status` and `required_coach_agreement_version`
- Multiple screens in `app/coach-*` — Inline role checks like `user?.preferences?.role === 'coach'`

**Bug Risk:** If coach approval logic changes, three places need updates. Easy to miss one. Inconsistent null-coalescing (`?? 1`) vs. fallback logic.

**Canonical Recommendation:**  
Create `utils/roleChecks.ts` with canonical functions:
```typescript
export function isCoach(user: AuthUser | null): boolean { ... }
export function isApprovedCoach(user: AuthUser | null): boolean { ... }
export function hasValidCoachAgreement(user: AuthUser | null): boolean { ... }
export function canAccessCoachTools(user: AuthUser | null): boolean { ... }
```

Use these everywhere instead of inline checks. Single source of truth.

**Effort:** `S` (1.5 hours: add 4 helpers, update 3-4 call sites)

---

## MEDIUM Severity

### 5. Button Component Duplication

**Category:** Styling / component drift  
**Locations:**
- `components/ui/AccessibleButton.tsx:29` — Standalone button with a11y props
- `components/ui/PrimaryButton.tsx:13` — Wraps `Button` with color override
- `components/ui/button.tsx:25` — Base `Button`, exported as default
- Usage: screens use `PrimaryButton` or `Button` inconsistently

**Bug Risk:** Three implementations for nearly the same thing. Unclear which to use. If styling changes, hard to know which file to edit.

**Canonical Recommendation:**  
Keep only `components/ui/button.tsx` as canonical. Remove `AccessibleButton.tsx` and `PrimaryButton.tsx`. Create preset wrappers in the same file if needed.

**Effort:** `S` (30 minutes: delete 2 files, consolidate 1 file, update 5-10 imports)

---

### 6. Modal Implementation Fragmentation

**Category:** Component drift  
**Locations:**
- `components/AddGameModal.tsx` — Custom modal with form fields
- `components/BulkScheduleModal.tsx` — Custom modal with table
- `components/ZipAlternativesModal.tsx` — Custom modal with list
- `components/CustomActionModal.tsx` — Generic action modal
- `components/EventMergeSuggestionModal.tsx` — Specialized modal
- No shared `ModalContainer` or `BaseModal` wrapper

**Bug Risk:** Each modal re-implements dismiss logic, padding, header close button. If a11y requirement changes, 5 modals need updates separately. Inconsistent styling.

**Canonical Recommendation:**  
Create `components/ui/ModalBase.tsx` with common structure. Refactor the 5 modals to extend or use it as a wrapper. Centralizes a11y and styling.

**Effort:** `M` (4-5 hours: create base component, refactor 5 modals)

---

### 7. Inconsistent Error Message Display in Forms

**Category:** Duplicate logic  
**Locations:**
- `app/verify-identity.tsx:118-135` — Displays `error` state as `<Text>{error}</Text>`
- `app/settings/request-host-event.tsx:156-162` — Uses `errors` object with per-field display
- `app/team-viewer.tsx:90-95` — Uses `<ErrorAlert>{error}</ErrorAlert>` (custom component)
- `app/game-photos.tsx:35` — Sets error to boolean `true`, no message display

**Bug Risk:** Inconsistent patterns make form UX jarring. No canonical "error alert" component means styling varies.

**Canonical Recommendation:**  
Create `components/ui/ErrorAlert.tsx` with consistent styling. Use in all forms/screens.

**Effort:** `S` (2 hours: add component, update 4-5 screens)

---

### 8. Role/Permission Checks Scattered Across Screens

**Category:** Duplicate logic  
**Locations:**
- `app/manage-season.tsx` — Checks `user?.preferences?.role === 'coach'` inline
- `app/team-viewer.tsx` — Checks `user?.is_admin` inline
- `hooks/useRequireAdmin.ts` — Reads `isAdmin` from `useAuth()`
- `hooks/useRequireCoach.ts` — Computes `isCoach`, `canAccessCoachTools`
- Multiple onboarding screens — Inline role comparisons

**Bug Risk:** Same check duplicated in 3+ places. If a bug is found, fixes scatter.

**Canonical Recommendation:**  
Consolidate in `utils/roleChecks.ts` (see finding #4). All screens should import helpers rather than inline checks.

**Effort:** `S` (1 hour: add helpers, update 5-8 screens)

---

## LOW Severity

### 9. Inconsistent Null/Undefined Handling in API Responses

**Category:** Type drift  
**Locations:**
- `api/entities.ts:Post.listPage()` — Returns `{ items: [], nextCursor: null }`
- `api/entities.ts:Notification.listPage()` — Returns `{ items: [], cursor: null, nextCursor: null }` (both `cursor` and `nextCursor`)
- `api/entities.ts:Message.filter()` — Returns raw response (unclear structure)

**Bug Risk:** Callers checking `response.nextCursor` might fail if a new endpoint returns `response.cursor` instead. Indicates schema inconsistency.

**Canonical Recommendation:**  
Standardize paginated response shape: `{ items: T[], nextCursor: string | null }`. Document in `api/types.ts`.

**Effort:** `M` (2-3 hours: audit all list endpoints, add Zod schemas, update callers)

---

### 10. Timezone Handling Ambiguity

**Category:** Duplicate logic  
**Locations:**
- `app/manage-season.tsx:767` — `new Date(Date.UTC(...))` explicitly uses UTC
- `app/team-viewer.tsx:111` — `.toLocaleTimeString()` uses device timezone
- No consolidated timezone documentation

**Bug Risk:** Some code assumes UTC, others assume device timezone. Coach in PST sees UTC noon as 5 AM, creating confusion.

**Canonical Recommendation:**  
Document timezone handling: all timestamps in DB are UTC. Create `utils/timezone.ts` with helpers:
- `formatEventTime(utcDateString): string` — Always display device timezone

**Effort:** `M` (2-3 hours: audit all time-related code, add helpers, update ~10-15 call sites)

---

### 11. Missing Event Schema Validation

**Category:** Type drift  
**Locations:**
- `api/schemas/team.ts` — Has Zod schema and validators
- `api/schemas/organization.ts` — Same pattern
- **No** `api/schemas/event.ts` — Event responses not validated

**Bug Risk:** Event API changes won't be caught until runtime crash.

**Canonical Recommendation:**  
Create `api/schemas/event.ts` with Zod schema matching server's `serializeEvent`. Use validators in `Event.get()`, `Event.filter()`, etc.

**Effort:** `S` (1 hour: inspect server schema, add Zod schema, update 3-4 Event calls)

---

### 12. Post Type Ambiguity

**Category:** Type drift  
**Locations:**
- `api/types.ts:CreatePostPayload` — Defines what can be created
- `api/entities.ts:Post.listPage()` — Uses `PostPage<T = any>`
- **No canonical Post type** — No validation of returned posts

**Bug Risk:** Without a canonical Post type, different screens may expect different fields. One expects `post.game_id`, another `post.event_id`. Silent failures.

**Canonical Recommendation:**  
Create `api/schemas/post.ts` with Zod schema. Update `PostPage<T = Post>` and validate in `Post.get()`, `Post.listPage()`, etc.

**Effort:** `M` (2-3 hours: inspect server schema, add Zod schema, update callers)

---

## Summary

**Total Findings:** 12 (HIGH: 4, MEDIUM: 5, LOW: 3)

### Quick Wins (S-effort, HIGH severity)

1. **Date Formatting** — Add canonical date helpers, prevents locale bugs
2. **API Error Handling** — Extract error message helper, prevents silent failures
3. **Coach Access Guards** — Move checks to utils, single source of truth

**Estimated effort for all three:** 4.5 hours. **Impact:** Prevents 3 bug categories.

### Medium Priority (M-effort)

- #3 (useAsyncData hook): Consolidates 5 data-fetching patterns. 3-4 hours.
- #6 (ModalBase component): Centralizes a11y/styling for 5 modals. 4-5 hours.
- #9, #10, #12 (Schema/type consolidation): Each 2-3 hours. Prevents silent API failures.

---

**Note:** Team/Organization server-to-client contracts pinned via Zod schemas. Post and Event schemas are **missing** (findings #11, #12).
