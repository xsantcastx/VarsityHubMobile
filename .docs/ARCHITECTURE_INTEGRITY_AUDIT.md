# Architecture Integrity Audit

**Date:** February 22, 2025  
**Scope:** Architecture rules, duplicated logic, custom hooks

---

## Part 1: Architecture Rules Compliance

Rules (from `.docs/ARCHITECTURE_AUDIT_REPORT.md`, `.docs/STABILITY_AUDIT.md`, `.docs/SECURITY_AUDIT.md`):

- TypeScript everywhere
- API calls only in hooks/services, never in components
- Consistent file naming
- No hardcoded secrets

### 1.1 TypeScript Everywhere

| Status | Location | Notes |
|--------|----------|-------|
| ✅ | `app/`, `components/`, `hooks/` | Primary app code is `.ts` / `.tsx` |
| ⚠️ | **30 .js files** | Config, scripts, shims, patches, server scripts |

**Non-TypeScript files (acceptable):**

- `jest.config.js`, `babel.config.js`, `metro.config.js`, `webpack.config.js`, `eslint.config.js` — config
- `server/jest.config.js`, `server/scripts/*.js` — server tooling
- `shims/*.js`, `tools/patches/*.js` — polyfills
- `components/__tests__/OfflineBanner.test.js` — legacy test

**Verdict:** Acceptable. Config and infra use JS; app logic is TypeScript.

---

### 1.2 API Calls in Components (Violations)

Rule: **API calls must live in hooks or services, not in components.**

| File | API Call(s) | Recommendation |
|------|-------------|----------------|
| `app/feed.tsx` | `User.me`, `Game.list`, `Highlights.fetch`, `Advertisement.forFeed`, `NotificationApi.listPage` | Extract to `useFeed`, `useNotificationsModal` |
| `app/highlights.tsx` | `User.me`, `Highlights.fetch`, `Team.list`, `Event.filter`, `User.listAll`, `Organization.list` | Extract to `useHighlights`, `useGlobalSearch` |
| `app/(tabs)/post-detail.tsx` | `PostApi.get`, `PostApi.comments`, `User.me` | Extract to `usePostDetail` |
| `app/(tabs)/team-hub.tsx` | `Team.get`, `Event.upcoming` | Extract to `useTeamHub` |
| `app/profile.tsx` | `User.me`, `User.postsForProfile`, `Team.list` | Use/extend `useProfileData`, `useProfilePosts`, `useProfileOrganizations` |
| `app/(tabs)/event-detail.tsx` | `Event.get`, `User.me` | Extract to `useEventDetail` |
| `app/(tabs)/organization.tsx` | `Organization.get`, `Post.filter`, `Team.list`, `Game.list`, `User.me` | Extract to `useOrganization` |
| `app/game-details/GameDetailsScreen.tsx` | `Game.byId`, `Post.feedForGame`, `Event.rsvpStatus`, `Team.list`, `User.me` | Extract to `useGameDetails` |
| `app/(tabs)/create-post.tsx` | `User.me`, `Game.list`, `Post.create`, `fetch(health)` | Extract to `useCreatePost`, `useGameList` |
| `app/game-map.tsx` | `Game.list`, `httpGet('/events')` | Extract to `useGameMap` |
| `app/events-calendar.tsx` | `User.me`, `Game.list` | Extract to `useEventsCalendar` |
| `app/(tabs)/discover/mobile-community.tsx` | `Game.list`, `User.me`, multiple APIs | Extract to `useDiscover` |
| `app/(tabs)/manage-teams.tsx` | `User.me`, `TeamApi.managed` | Extract to `useManageTeams` |
| `app/(tabs)/event-approvals.tsx` | `User.me`, `httpGet('/events/pending')` | Extract to `useEventApprovals` |
| `app/create.tsx` | `User.me` | Use `useUser` |
| `app/(tabs)/create-fan-event.tsx` | `User.me`, `httpGet('/follows/teams')`, `Game.create` | Use `useUser`; extract to `useFollowedTeams`, `useCreateEvent` |
| `app/settings/index.tsx` | `User.me`, `Event.filter` | Use `useUser`; extract to `usePendingHostRequests` |
| `app/team-page.tsx` | `User.me`, `Game.list`, `Team.list` | Extract to `useTeamPage` |
| `app/ad-calendar.tsx` | `httpGet`, `httpPost` (multiple) | Extract to `useAdCalendar` |
| `app/admin-reports.tsx` | `httpGet`, `httpPost` | Extract to `useAdminReports` |
| `app/admin-dashboard.tsx` | `httpGet` | Extract to `useAdminDashboard` |
| `app/admin-activity-log.tsx` | `httpGet` | Extract to `useAdminActivityLog` |
| `app/subscription-paywall.tsx` | `httpPost` | Extract to `useSubscriptionPaywall` |
| `components/PostCard.tsx` | `User.me` | Pass user as prop or use `useUser` |
| `components/BannerUpload.tsx` | `fetch(asset.uri)` | Move to `api/upload.ts` or service |

**Direct `fetch()` usage (bypasses api/http):**

| File | Line | Issue |
|------|------|-------|
| `app/(tabs)/create-post.tsx` | 511 | `fetch(getApiBaseUrl() + '/health')` — use `httpGet('/health')` |
| `components/BannerUpload.tsx` | 114 | `fetch(asset.uri)` for blob — acceptable for local URI; consider service |

**Verdict:** ~40+ screens/components perform API calls directly. Only a few use hooks (`useOrganizationSearch`, `useUser`, `useDeviceLocation`, `useProfileData`, `useProfilePosts`, `useProfileOrganizations`, `useProfileInteractions`, `useTeamOptions`).

---

### 1.3 File Naming

| Pattern | Count | Location | Notes |
|---------|-------|----------|-------|
| kebab-case | Most | `app/`, routes | `create-fan-event`, `event-detail`, `reset-password` |
| PascalCase | Some | Components | `GameDetailsScreen`, `MatchBanner` |
| camelCase | Few | Hooks, utils | `useUser`, `useProfileData` |

**Inconsistencies:**

- `useCustomColorScheme.tsx` — hook as `.tsx` (no JSX)
- `useColorScheme.web.ts` vs `useColorScheme.ts` — platform variants
- `app/(tabs)/` — Expo file-based routing uses parentheses

**Verdict:** Generally consistent. Minor: `useCustomColorScheme.tsx` could be `.ts`.

---

### 1.4 Hardcoded Secrets

| Location | Issue | Severity |
|----------|-------|----------|
| `app.json` | `googleMapsApiKey`: `AIzaSyDKZL34B2z-qVvfWKfLUVsAL7I_jCXbGFA` | CRITICAL |
| `server/scripts/stripe/create_stripe_prices.js` | `sk_test_51S5t0k...` hardcoded | CRITICAL |
| `.docs/architecture/VETERAN_BILLING_*.md` | Production Stripe keys (`sk_live_51RtgdG...`) | CRITICAL — rotate |
| `server/src/lib/jwt.ts` | Fallback `dev-secret-change-me` (dev only) | LOW |
| `server/prisma/seed.ts` | Uses `process.env.SEED_PASSWORD` with fallback | LOW |

**Verdict:** Google Maps key and Stripe keys must be moved to env / EAS Secrets.

---

## Part 2: Duplicated Logic

### 2.1 User.me() — 50+ Call Sites

| Consolidation | Current | Recommendation |
|---------------|---------|----------------|
| **useUser** | `useUser`, `useUserProfile`, `useProfileData` all call `User.me()` | Keep `useUser` as canonical; have others delegate or share |
| **Component calls** | 40+ screens call `User.me()` in `useEffect` | Use `useUser()` or `useAuth().user` instead |

**Files with inline User.me():**

- `app/create.tsx`, `app/(tabs)/create-fan-event.tsx`, `app/payment-success.tsx`, `app/onboarding/*`, `app/settings/index.tsx`, `app/profile.tsx`, `app/feed.tsx`, `app/(tabs)/post-detail.tsx`, `app/(tabs)/message-thread.tsx`, `app/(tabs)/event-detail.tsx`, `app/game-details/GameDetailsScreen.tsx`, `app/team-page.tsx`, `app/(tabs)/discover/mobile-community.tsx`, `app/(tabs)/create-post.tsx`, `app/(tabs)/organization.tsx`, `app/(tabs)/edit-profile.tsx`, `app/(tabs)/manage-teams.tsx`, `app/(tabs)/event-approvals.tsx`, `app/verify-identity.tsx`, `app/submit-ad*.tsx`, `app/settings/*`, `app/role-onboarding.tsx`, `app/report-abuse.tsx`, `app/messages.tsx`, `app/manage-season.tsx`, `app/highlights.tsx`, `app/game-details/GameVerticalFeedScreen.tsx`, `app/events-calendar.tsx`, `app/admin-*.tsx`, `components/PostCard.tsx`

**Action:** Replace with `useUser()` or `useAuth().user` where appropriate.

---

### 2.2 Game.list()

| File | Call | Consolidation |
|------|------|---------------|
| `app/feed.tsx` | `Game.list('-date')` | `useFeed` |
| `app/game-map.tsx` | `Game.list('-date', {})` | `useGameMap` |
| `app/team-page.tsx` | `Game.list('-date')` | `useTeamPage` |
| `app/(tabs)/discover/mobile-community.tsx` | `Game.list('-date')` | `useDiscover` |
| `app/(tabs)/create-post.tsx` | `Game.list('-date', options)` | `useGameList` |
| `app/(tabs)/organization.tsx` | `Game.list('-date')` | `useOrganization` |
| `app/events-calendar.tsx` | `Game.list()` | `useEventsCalendar` |

**Action:** Add `useGameList(sort?, options?)` and reuse across screens.

---

### 2.3 Team.list()

| File | Call | Consolidation |
|------|------|---------------|
| `app/profile.tsx` | `Team.list('', true)` | Use `useProfileOrganizations` or shared hook |
| `app/game-details/GameDetailsScreen.tsx` | `Team.list()` | `useGameDetails` |
| `app/team-page.tsx` | `Team.list()` | `useTeamPage` |
| `app/(tabs)/organization.tsx` | `Team.list()` | `useOrganization` |
| `app/league.tsx` | `Team.list()` | `useLeague` |
| `app/highlights.tsx` | `Team.list(query, false, { limit: 5 })` | `useHighlights` |

**Action:** `useTeamOptions` already exists; use it where only a list is needed. For filtered/context-specific lists, add `useTeamList(query?, options?)`.

---

### 2.4 httpGet('/follows/teams?user_id=me')

| File | Call |
|------|------|
| `app/(tabs)/create-fan-event.tsx` | `httpGet('/follows/teams?user_id=me')` |
| `app/settings/followed-teams.tsx` | `httpGet('/follows/teams?user_id=me')` |

**Action:** Add `useFollowedTeams()` and reuse.

---

### 2.5 Pagination / Load-More Pattern

`useProfilePosts` and `useProfileInteractions` share:

- `requestInFlight` guard
- `refresh` / `loadMore`
- `cursor`, `hasMore`, `loading`

**Action:** Extract `usePaginatedQuery<T>(fetchFn, options)` for shared pagination logic.

---

## Part 3: Custom Hooks Audit

Rule: **Each hook does one thing.**

### 3.1 Single-Responsibility ✅

| Hook | Responsibility | Status |
|------|----------------|--------|
| `useUser` | Current user from User.me | ✅ |
| `useUserProfile` | User profile (displayName, email, zipCode) | ✅ |
| `useProfileData` | Profile + theme color + loadProfile | ⚠️ Multiple concerns |
| `useProfilePosts` | Paginated posts for profile | ✅ |
| `useProfileInteractions` | Paginated interactions (likes, comments) | ✅ |
| `useProfileOrganizations` | User's organizations via teams | ✅ |
| `useTeamOptions` | Team list for dropdowns | ✅ |
| `useOrganizationSearch` | Org search | ✅ |
| `useDeviceLocation` | Device location | ✅ |
| `useNetworkStatus` | Network connectivity | ✅ |
| `useGoogleAuth` | Google OAuth flow | ✅ |
| `useAppleAuth` | Apple OAuth flow | ✅ |
| `useThemeColor` | Theme color extraction | ✅ |
| `useColorScheme` | Light/dark mode | ✅ |
| `useCustomColorScheme` | Custom color scheme logic | ✅ |
| `useShareLink` | Share URL | ✅ |
| `useTeamInvites` | Team invites | ✅ |
| `useRequireAdmin` | Admin gate | ✅ |
| `useAnalytics` | Telemetry | ✅ |
| `useUploadProgress` | Upload progress | ✅ |

### 3.2 Multi-Responsibility (Split Recommended)

| Hook | Responsibilities | Recommendation |
|------|------------------|----------------|
| **useProfileData** | 1) Load User.me, 2) Theme color, 3) updateAvatar | Split into `useProfileData` (me, loading, error, loadProfile) and `useThemeColor` (or use existing) for theme; keep updateAvatar in profile data |
| **useUser** | User + loading + refresh | OK as-is (one concern: current user) |
| **useUserProfile** | Subset of user + zipCode + refresh | Overlaps with useUser/useProfileData — consider merging or clearly documenting usage |

### 3.3 Overlapping Hooks

| Hooks | Overlap | Recommendation |
|-------|---------|----------------|
| `useUser`, `useUserProfile`, `useProfileData` | All call `User.me()` | Standardize: `useUser` for minimal user; `useProfileData` for profile screen (me, themeColor, loadProfile); `useUserProfile` for displayName/email/zipCode only — or merge into `useUser` with options |
| `useProfilePosts`, `useProfileInteractions` | Same pagination pattern | Extract `usePaginatedProfileData` base |

---

## Summary

| Category | Violations | Priority |
|----------|------------|----------|
| API calls in components | 40+ screens | HIGH |
| Hardcoded secrets | 3 critical | CRITICAL |
| User.me() duplication | 50+ sites | HIGH |
| Game.list() duplication | 7 files | MEDIUM |
| Team.list() duplication | 6 files | MEDIUM |
| Hook overlap | 3 hook groups | MEDIUM |
| useProfileData multi-job | 3 concerns | LOW |
