# Expo Router Routing Audit

Verified against the current repo tree on 2026-04-20.

This file supersedes the earlier routing audit draft. That draft overstated
route duplication as a bug and misclassified several bridge files. The actual
pattern is more deliberate: root-stack bridge files make tab-owned screens
reachable from deep links, notifications, and modal/root navigation.

## Scope

Reviewed:

- `app/**/*.tsx`
- route registration in `app/_layout.tsx`
- tab registration in `app/(tabs)/_layout.tsx`
- route bridge files at app root and under `app/(tabs)/`
- representative navigation call sites in `app/`, `components/`, `hooks/`,
  `context/`, and `api/`

Not covered:

- runtime navigation behavior on device
- deep-link payload generation outside the checked call sites
- visual layout or UX correctness

## Executive summary

The headline finding is not "duplicate routes are broken." The headline finding
is "duplicate basenames are a load-bearing bridge pattern, but the pattern is
underdocumented and easy to misread."

Verified state:

- There are **35 duplicate basename pairs** between `app/*.tsx` and
  `app/(tabs)/*.tsx`.
- The split is **not** "tabs files are all stubs."
- The actual breakdown is:
  - **17** root implementation + tabs bridge to root
  - **17** root bridge to tabs implementation
  - **1** special case where both sides are real: `index.tsx`
- The two suspicious cases called out during review are **not broken**:
  - `game-detail` resolves to one real implementation:
    `app/game-details/GameDetailsScreen.tsx`
  - `team-profile` resolves to one real implementation:
    `app/team-page.tsx`
- The earlier `/profile` parameter-mismatch claim was **false**.
  `app/profile.tsx` reads `id` from `useLocalSearchParams`, not `username`.

Real risk areas:

1. The bridge pattern is inconsistent in direction across features, so it is
   easy to delete the wrong side during refactors.
2. Team-related screens overlap semantically:
   `team-page`, `team-profile`, `team-hub`, `team-viewer`, `team-contacts`.
   That is a naming/documentation risk even though the bridges themselves work.
3. Auth/role guards are implemented inside screen components and hooks, not in
   route declarations. That is normal for Expo Router here, but it means a
   future refactor can accidentally remove access control by editing the screen
   body, not the layout.

## Verified corrections to the previous draft

| Previous claim | Status | Correction |
|---|---|---|
| "All `(tabs)` duplicates are 1-2 line stubs" | False | Only 17 of 35 duplicate pairs have tabs-side bridges. The other 17 are inverted: the real implementation lives in `app/(tabs)/` and the root file is the bridge. |
| "Delete the `(tabs)` stubs" | Unsafe | Many root files are the stubs. Blind deletion would break root-stack navigation for screens like `edit-event`, `team-contacts`, and `create-post`. |
| "`/profile` expects `username` and callers omit it" | False | `app/profile.tsx` reads only `id` from route params. `username` references in that file are data fields, not route params. |
| "No route-level auth is an inconsistency" | Misframed | Guards live in screen hooks/components (`useAuth`, `useRequireCoach`, `useRequireAdmin`). That is the current app pattern. Stack declarations in Expo Router are not where this app enforces auth. |
| "`game-detail` and `team-profile` are broken because both sides are stubs" | False | Both are bridge chains to a single implementation file. |

## How routing is actually structured

### Root stack

`app/_layout.tsx` owns the root `Stack`. It registers:

- auth screens
- onboarding
- root-level content/detail pages
- admin screens
- settings
- the `(tabs)` group itself

This is the navigation layer used for:

- deep links
- notification taps
- modal-like pushes from outside the tab context
- auth/onboarding redirects

### Tabs group

`app/(tabs)/_layout.tsx` owns the bottom-tab navigator. It registers:

- visible tabs such as feed, highlights, discover, profile
- many hidden tab screens with `href: null`

Those hidden tab screens are important: they allow tab-context navigation to
push screens that still live under the tab navigator.

### Bridge pattern

The repo uses both of these patterns:

1. **Root bridge -> tabs implementation**
   Example:
   - `app/edit-event.tsx`
   - `app/(tabs)/edit-event.tsx`

   Root exists so the route is reachable from the root stack.
   Tabs file contains the real screen.

2. **Tabs bridge -> root implementation**
   Example:
   - `app/admin-ads.tsx`
   - `app/(tabs)/admin-ads.tsx`

   Root contains the real screen.
   Tabs file exists so the same URL/screen can be reached from tab navigation.

This means the presence of both `app/X.tsx` and `app/(tabs)/X.tsx` is not
enough to conclude duplication debt. You have to check which side is the real
implementation.

## Duplicate route inventory

### Summary counts

| Pattern | Count |
|---|---:|
| Root implementation, tabs bridge to root | 17 |
| Root bridge to tabs implementation | 17 |
| Both real implementations | 1 |

### Full duplicate-pair table

| Route basename | Root side | Tabs side | Notes |
|---|---|---|---|
| `ad-calendar` | real implementation | bridge to root | Safe pattern |
| `admin-ads` | real implementation | bridge to root | Safe pattern |
| `admin-messages` | real implementation | bridge to root | Safe pattern |
| `admin-teams` | real implementation | bridge to root | Safe pattern |
| `admin-user-detail` | real implementation | bridge to root | Safe pattern |
| `admin-users` | real implementation | bridge to root | Safe pattern |
| `approvals` | bridge to tabs | real implementation | Safe pattern |
| `create-post` | bridge to tabs | real implementation | Safe pattern |
| `create-team` | bridge to tabs | real implementation | Safe pattern |
| `create` | real implementation | bridge to root | Safe pattern |
| `edit-ad` | real implementation | bridge to root | Safe pattern |
| `edit-ad.web` | real implementation | bridge to root | Web-specific bridge |
| `edit-event` | bridge to tabs | real implementation | Root file comment explicitly documents bridge intent |
| `edit-organization` | bridge to tabs | real implementation | Safe pattern |
| `edit-profile` | bridge to tabs | real implementation | Safe pattern |
| `edit-team` | bridge to tabs | real implementation | Safe pattern |
| `event-approvals` | bridge to tabs | real implementation | Safe pattern |
| `event-detail` | bridge to tabs | real implementation | Safe pattern |
| `followers` | bridge to tabs | real implementation | Safe pattern |
| `following` | bridge to tabs | real implementation | Safe pattern |
| `game-detail` | bridge to `game-details/GameDetailsScreen` | bridge to root | Same final implementation |
| `game-highlights` | real implementation | bridge to root | Safe pattern |
| `game-photos` | real implementation | bridge to root | Safe pattern |
| `game-reviews` | real implementation | bridge to root | Safe pattern |
| `index` | real implementation | real implementation | Special case: root splash/redirect vs tabs index redirect |
| `manage-teams` | bridge to tabs | real implementation | Safe pattern |
| `my-ads` | real implementation | bridge to root | Safe pattern |
| `my-team` | bridge to tabs | real implementation | Safe pattern |
| `organization` | bridge to tabs | real implementation | Safe pattern |
| `submit-ad` | real implementation | bridge to root | Safe pattern |
| `submit-ad.web` | real implementation | bridge to root | Web-specific bridge |
| `team-contacts` | bridge to tabs | real implementation | Safe pattern |
| `team-hub` | bridge to tabs | real implementation | Safe pattern |
| `team-profile` | bridge to `team-page` | bridge to root | Same final implementation |
| `verify-email` | bridge to tabs | real implementation | Safe pattern |

### Special cases worth knowing

#### `game-detail`

Route chain:

- `app/game-detail.tsx` -> `app/game-details/GameDetailsScreen.tsx`
- `app/(tabs)/game-detail.tsx` -> `app/game-detail.tsx`

This is not a split implementation. Both paths land on the same real screen.

#### `team-profile`

Route chain:

- `app/team-profile.tsx` -> `app/team-page.tsx`
- `app/(tabs)/team-profile.tsx` -> `app/team-page.tsx`

Again, not split. The real question here is naming overlap, not broken routing.

#### `index`

This is the only duplicate pair where both sides are real:

- `app/index.tsx` is the root splash/redirect screen
- `app/(tabs)/index.tsx` redirects tab-index traffic to `/(tabs)/feed`

That is intentional and not a duplication bug.

## Navigation findings

### Verified good call sites

Representative examples that line up with the bridge design:

- `components/NotificationTapHandler.tsx`
  pushes `/event-detail` and `/team-page` from outside the tab context.
- `app/(tabs)/organization.tsx`
  pushes `/team-profile` with params.
- `app/(tabs)/team-hub.tsx`
  pushes `/team-page`.
- `app/(tabs)/event-approvals.tsx`
  pushes `/team-hub`.

These are exactly the flows that benefit from root/tab bridge files.

### `/profile` parameter claim: false

`app/profile.tsx` uses:

- `const params = useLocalSearchParams<{ id?: string }>()`
- `const viewingUserId = params.id`

So `/profile` does **not** require `username` as a route param.

The `username` strings found in that file are for:

- post author data
- display text
- following/followers header labels

not route parsing.

### Mixed param style: true but low severity

The app mixes:

- object pushes with `pathname` + `params`
- string pushes with query strings

Expo Router tolerates both. This is a consistency issue, not a proven bug from
static review alone.

## Guard model

The app does not use route-declaration-level guards in the layouts.
Instead, access control is enforced inside screens and hooks such as:

- `useAuth`
- `useRequireCoach`
- `useRequireAdmin`

Examples:

- `app/admin-ads.tsx` uses `useRequireAdmin`
- `app/(tabs)/team-hub.tsx` uses `useRequireCoach`
- onboarding screens use `useAuth`

This is important because the previous draft framed it as a routing defect. It
is not a defect by itself. It is simply the chosen enforcement model.

Actual risk:

- if a future refactor removes a hook from a guarded screen,
  access control disappears silently
- layout declarations alone will not catch that

Recommendation:

- keep component/hook guards, but document guard expectations per screen family
- add smoke coverage for admin and coach-only screens reached through both root
  and tab paths

## Shared-module hotspots

Measured by import fan-in across `app/`, `api/`, `hooks/`, `components/`, and
`context/`:

| Module | Approx. import count | Why it matters |
|---|---:|---|
| `@/constants/Colors` | 155 | Theme changes have app-wide blast radius |
| `@/hooks/useColorScheme` | 117 | Shared visual/runtime behavior |
| `@/api/entities` | 104 | Entity contract drift affects most screens |
| `@/utils/navigation` | 80 | Navigation helpers influence back-stack behavior broadly |
| `@/context/AuthProvider` | 37 | Auth, role, onboarding, and guard state fan out widely |
| `@/api/http` | 30 | Base URL and transport changes hit the whole app |
| `@/hooks/useRequireAdmin` | 11 | Admin guard regression affects multiple screens |
| `@/hooks/useRequireCoach` | 10 | Coach-only routing depends on it |
| `@/context/OnboardingContext` | 10 | Onboarding continuity across screens |

These are the modules to review first when routing/regression issues affect many
screens at once.

## Real risks and recommendations

### 1. Document the bridge convention

Current risk: a future cleanup can delete a "duplicate" file that is actually a
required bridge.

Recommendation:

- add a short routing-conventions doc or section in `AGENTS.md`
- standardize one comment format for bridge files, similar to the existing
  comment in `app/edit-event.tsx`

### 2. Reduce semantic overlap in team screens

Current team routes:

- `team-page`
- `team-profile`
- `team-hub`
- `team-viewer`
- `team-contacts`

These are not all duplicates, but the naming is easy to confuse during product
and code review.

Recommendation:

- decide which names are user-facing destinations vs management surfaces
- document owner/coach/fan entry points
- avoid introducing another team detail alias without a clear reason

### 3. Standardize navigation param style

This is not a proven bug, but it does make audits harder.

Recommendation:

- prefer `router.push({ pathname, params })`
- keep query-string pushes only where needed for external/deep-link parity

### 4. Add route-smoke tests for bridge paths

High-value coverage would be:

- notification tap -> root stack -> bridged detail screen
- tab screen -> bridged root route
- coach-only hidden tab route via both root and tab entry points
- admin route via both root and hidden-tab bridge

## Bottom line

The routing layer is not suffering from blanket duplicate-route bugs.

What exists is an intentional but underdocumented bridge architecture:

- root stack for global reachability
- tabs group for in-tab navigation
- thin bridge files so one screen can be reached from both contexts

The earlier draft’s recommendation to delete duplicate files would be unsafe.
The real maintenance issue is convention drift and naming ambiguity, not simple
duplication.
