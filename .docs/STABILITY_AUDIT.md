# VarsityHub Mobile — Stability Audit

**Date:** February 22, 2025  
**Scope:** Loading states, empty states, error states, API placement, tab navigation preservation

---

## Executive Summary

This audit covers three stability pillars:
1. **Loading / Empty / Error States** — Every API-backed screen should show loading, empty, and error states
2. **API Call Placement** — All fetch logic should live in hooks or services, not in JSX components
3. **Tab Navigation Preservation** — Scroll position and screen state must persist when switching tabs

---

## 1. Loading, Empty, and Error States Audit

### 1.1 Reusable Components (Already Present)

- `components/ui/LoadingState.tsx` — Spinner + message
- `components/ui/EmptyState.tsx` — Icon, title, subtitle, optional action

### 1.2 Screens With Full Coverage (✓ Loading, ✓ Empty, ✓ Error)

| Screen | Notes |
|--------|-------|
| `feed.tsx` | Loading, empty ("No games found"), error banner with sign-in CTA |
| `highlights.tsx` | Loading, empty ("No highlights available"), error with retry |
| `post-detail.tsx` | Loading skeleton, empty comments, error with retry |
| `team-page.tsx` | Loading, empty posts/replies, error message |
| `team-hub.tsx` | Loading, empty upcoming events, error |
| `manage-teams.tsx` | Loading, empty, error |
| `profile.tsx` | Loading skeleton, empty posts/replies/upvotes, error |
| `create-post.tsx` | Submitting loading, empty events list, submit errors |
| `organization.tsx` | Loading, empty posts/replies/upvotes, error |
| `event-detail.tsx` | Loading, error |
| `game-details/GameDetailsScreen.tsx` | Loading box, error box, empty grid placeholders |
| `public-event.tsx` | Loading, empty posts, error via catch |
| `messages.tsx` | Loading, empty conversations, error |
| `notifications/index.tsx` | Loading, empty ("No notifications"), error |
| `sign-in.tsx`, `sign-up.tsx` | Loading, error |
| `verify.tsx` | Loading, error (no empty state — N/A for verification) |

### 1.3 Screens Missing Error States (Silent Failures)

| Screen | Current Behavior | Recommendation |
|--------|------------------|----------------|
| `my-ads.tsx` | Has loading, empty ("No Ads Yet"), no error UI | Add error state with retry button |
| `highlights.tsx` | ✓ Has error (retry) | — |
| `events-calendar.tsx` | Catches errors silently | Add error banner + retry |
| `league.tsx` | No error UI | Add error state with retry |
| `game-map.tsx` | No error UI | Add error state when location/games fail |
| `event-approvals.tsx` | No error UI | Add error state for API failures |
| `game-details/GameVerticalFeedScreen.tsx` | Toasts only, no full error UI | Add error state with retry |
| `admin-teams.tsx`, `admin-messages.tsx`, `admin-ads.tsx` | No error UI | Add error states |
| `create.tsx` | No loading, no error | Add loading + error for User.me check |
| `onboarding/finish.tsx` | No loading, no error | Add loading for User.me, error on failure |

### 1.4 Screens Missing Empty States

| Screen | Current Behavior | Recommendation |
|--------|------------------|----------------|
| `event-detail.tsx` | No empty state for event content | Add empty state if event has no posts/media |
| `message-thread.tsx` | No empty state for messages | Add "No messages yet" |
| `edit-profile.tsx` | N/A (form screen) | Optional: empty for saved addresses |
| `create-team.tsx` | N/A (form) | — |
| `discover/mobile-community.tsx` | May show blank for empty feeds | Add empty state for empty discover feed |

### 1.5 Screens Missing Loading States

| Screen | Current Behavior | Recommendation |
|--------|------------------|----------------|
| `create.tsx` | Redirects without loading | Show loading while checking auth |
| `onboarding/finish.tsx` | No loading while fetching User.me | Show LoadingState while fetching |

---

## 2. API Calls in UI Components — Refactor Plan

### 2.1 Current State

- **Nearly all screens** perform API calls directly inside the component via `useEffect` / `useCallback`
- API entities (`User`, `Post`, `Game`, `Event`, `Team`, `Highlights`, etc.) are called inline
- Only a few screens use hooks: `useOrganizationSearch`, `useUser` (profile), `useDeviceLocation`

### 2.2 Screens With API Logic in Component (Should Move to Hooks)

| Screen | API Calls to Extract | Suggested Hook Name |
|--------|----------------------|---------------------|
| `feed.tsx` | `User.me`, `Game.list`, `Highlights.fetch`, `Advertisement.forFeed`, `NotificationApi.listPage` | `useFeed`, `useNotificationsModal` |
| `highlights.tsx` | `User.me`, `Highlights.fetch`, `Team.list`, `Event.filter`, `User.listAll`, `Organization.list` | `useHighlights`, `useGlobalSearch` |
| `post-detail.tsx` | `PostApi.get`, `PostApi.comments` | `usePostDetail` |
| `team-hub.tsx` | `Team.get`, `Event.upcoming`, etc. | `useTeamHub` |
| `profile.tsx` | `User.me`, `User.postsForProfile`, `Organization.get`, `Organization.list` | `useProfile` (extend existing useUser) |
| `event-detail.tsx` | `Event.get`, related APIs | `useEventDetail` |
| `organization.tsx` | `Organization.get`, `Post.filter`, etc. | `useOrganization` |
| `game-details/GameDetailsScreen.tsx` | `Game.byId`, `Post.feedForGame`, `Event.rsvpStatus`, etc. | `useGameDetails` |
| `messages.tsx` | Conversation and message APIs | `useMessages` |
| `discover/mobile-community.tsx` | `Post`, `Highlights`, `Team`, etc. | `useDiscover` |
| `manage-teams.tsx` | `Team.managed`, etc. | `useManageTeams` |
| `followers.tsx`, `following.tsx` | User follow APIs | `useFollowers`, `useFollowing` |
| `message-thread.tsx` | Message APIs | `useMessageThread` |
| `edit-profile.tsx` | `User.me`, `User.updateMe` | `useEditProfile` |
| `create-post.tsx` | `Game.list`, `User.me`, `Post.create`, upload | `useCreatePost`, `useGameList` |
| `create-team.tsx` | `Team.create`, etc. | `useCreateTeam` |
| `event-approvals.tsx` | Event approval APIs | `useEventApprovals` |
| `team-contacts.tsx` | Team, message, media APIs | `useTeamContacts` |
| `my-ads.tsx` | Ad APIs | `useMyAds` |

### 2.3 Hook Structure (Recommended Pattern)

```ts
// hooks/useFeed.ts
export function useFeed() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<GameItem[]>([]);
  // ... other state

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    setLoading(!opts?.silent);
    setError(null);
    try {
      const user = await User.me().catch(() => null);
      const gamesData = await Game.list('-date');
      // ... normalize and set state
    } catch (e) {
      setError(e?.isNetworkError ? 'Check your connection' : 'Unable to load games');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return { loading, error, games, load, /* ... */ };
}
```

### 2.4 Components With Inline Fetch (Should Extract)

| Component | API / Fetch | Recommendation |
|-----------|-------------|----------------|
| `feed.tsx` — RSVPBadge | `Event.rsvpStatus`, `Event.rsvp` | Extract to `useRSVPStatus` hook |
| `create-post.tsx` | `fetch(health)`, `User.me`, `Post.create` | Extract to `useCreatePost` |
| `BannerUpload.tsx` | `fetch(asset.uri)` for blob | Move to service or hook |

---

## 3. Tab Navigation — Scroll & State Preservation

### 3.1 Current Setup

- **Expo Router** with `Tabs` from `expo-router`
- Main tabs: Feed, Highlights, Create, Discover, Profile
- React Navigation's default: **screens stay mounted** when switching tabs (no `unmountOnBlur`)
- Default `detachInactiveScreens` is `true` — inactive screens are detached from the view hierarchy, which can reset scroll in some cases

### 3.2 Potential Issues

1. **Scroll reset** — With `detachInactiveScreens: true` (default), FlatList/ScrollView may reset scroll when switching tabs
2. **Feed → Highlights → Feed** — User loses scroll position and list state
3. **Discover** and **Profile** — Same risk if they use ScrollView/FlatList

### 3.3 Recommended Changes

#### Option A: Keep Screens Mounted (Preferred)

In `app/(tabs)/_layout.tsx`, add:

```tsx
<Tabs
  screenOptions={{
    // Keep inactive tab screens mounted to preserve scroll/state
    lazy: false, // Load all tabs immediately (or keep default)
    detachInactiveScreens: false, // Preserve scroll by not detaching
    // ... existing options
  }}
>
```

#### Option B: Manual Scroll Restoration

If `detachInactiveScreens: false` causes performance issues:

1. Store scroll offset in context or ref when tab loses focus
2. Use `onScroll` with `onMomentumScrollEnd` / `onScrollEndDrag` to capture position
3. Restore via `scrollToOffset` or `scrollTo` when tab regains focus
4. Use `FlatList`'s `maintainVisibleContentPosition` for list stability

#### Option C: Cache List Data

- Feed and Highlights already use `useFocusEffect` to refresh on focus
- Consider keeping previous data visible during refresh (no full remount) so scroll is preserved until new data arrives

### 3.4 Specific Tab Screens to Verify

| Tab | Component | Scroll Container | Risk |
|-----|-----------|------------------|------|
| Feed | `feed.tsx` | ScrollView | High — long list, scroll loss annoying |
| Highlights | `highlights.tsx` | FlatList | High — same |
| Discover | `mobile-community.tsx` | Likely ScrollView/FlatList | Medium |
| Profile | `profile.tsx` | ScrollView/FlatList | Medium |

---

## 4. Action Plan (Priority Order)

### Phase 1 — Critical (Prevent Blank/Freeze)

1. Add **error states with retry** to: `my-ads`, `events-calendar`, `league`, `game-map`, `event-approvals`, admin screens
2. Add **loading state** to: `create.tsx`, `onboarding/finish.tsx`
3. Add **empty states** to: `message-thread`, `event-detail` (where applicable), `discover/mobile-community`

### Phase 2 — API Extraction

1. Create `useFeed` and move Feed API logic
2. Create `useHighlights` and move Highlights API logic
3. Create `usePostDetail` for post-detail
4. Create `useRSVPStatus` for RSVPBadge in feed
5. Continue with remaining screens (profile, team-hub, organization, etc.)

### Phase 3 — Tab Preservation

1. Set `detachInactiveScreens: false` in `(tabs)/_layout.tsx`
2. Test Feed ↔ Highlights ↔ Discover ↔ Profile for scroll preservation
3. If performance degrades, implement manual scroll restoration for Feed and Highlights

---

## 5. Files Reference

### Existing UI Components

- `components/ui/LoadingState.tsx` — Use for loading
- `components/ui/EmptyState.tsx` — Use for empty states
- `components/ErrorBoundary.tsx` — Handles React errors

### API Layer

- `api/http.ts` — Base HTTP client
- `api/entities.ts` — User, Post, Game, Event, Team, etc.

### Tab Layout

- `app/(tabs)/_layout.tsx` — Tab configuration

---

## Appendix: Quick Checklist Per Screen

For each new or modified screen, ensure:

- [ ] Loading spinner (or skeleton) during initial fetch
- [ ] Empty state when API returns no data (use `EmptyState` when appropriate)
- [ ] Error state with user-facing message + retry or recovery action
- [ ] No API calls inside JSX — use custom hook or service
- [ ] If tab screen: verify scroll/state preserved when switching away and back
