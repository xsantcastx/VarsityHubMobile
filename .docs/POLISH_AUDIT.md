# VarsityHub Mobile — Polish Audit

**Date:** February 22, 2025  
**Scope:** Error messages, network connectivity, button loading states

---

## 1. Error Messages Audit

### 1.1 Raw API / Technical Messages (Should Replace)

| Location | Current | Recommended |
|----------|---------|-------------|
| `onboarding/step-4-organization.tsx` | `error?.data?.error \|\| error?.message \|\| 'Failed to send join request'` | "We couldn't send your join request. Check your connection and try again." |
| `onboarding/step-4-organization.tsx` | `e?.message \|\| 'Please verify your email and try again'` | "We couldn't create your page. Please verify your email first, then try again." |
| `team-page.tsx` | `err?.message \|\| 'Failed to load team data'` | "We couldn't load this team. Pull to refresh or try again later." |
| `post-detail.tsx` | `e?.message \|\| 'Failed to load post'` | "We couldn't load this post. It may have been removed—go back and try another." |
| `post-detail.tsx` | `'No post ID provided'` | "We couldn't find this post. Go back and try opening it again." |
| `verify.tsx` | `e?.message \|\| e?.data?.error \|\| 'Failed to fetch dev code'` | "We couldn't load the verification code. Try again in a moment." |
| `profile.tsx` | `e?.message ? \`Unable to load profile: ${e.message}\` : ...` | Never expose raw `e.message`; use "We couldn't load this profile. Pull to refresh." |
| `BannerUpload.tsx` | `Failed to pick image: ${error?.message}` | "We couldn't use that image. Try a different photo or check storage permissions." |
| `sign-in.tsx` | `setError(msg)` where msg can be raw API error | Map common API errors to friendly messages (already partially done) |
| `GameDetailsScreen.tsx` | `'Missing game or event id.'` | "We couldn't find this game. Go back and try again." |

### 1.2 Generic "Error" / "Failed" (Should Be More Specific)

| Location | Current | Recommended |
|----------|---------|-------------|
| `event-detail.tsx` | `Alert.alert('Error', 'Unable to update RSVP...')` | `Alert.alert('RSVP', 'We couldn't update your RSVP. Try again in a moment.')` |
| `my-ads.tsx` | `Alert.alert('Error', 'Failed to delete ad...')` | `Alert.alert('Delete Ad', 'We couldn't remove this ad. Try again or check your connection.')` |
| `GameDetailsScreen.tsx` | `Alert.alert('Error', 'Unable to delete story...')` | `Alert.alert('Delete Story', 'We couldn't remove this story. Try again.')` |
| `post-detail.tsx` | `Alert.alert('Error', error.message \|\| 'Failed to delete comment')` | `Alert.alert('Delete Comment', 'We couldn't delete this comment. Try again.')` |
| `feed.tsx` | `Alert.alert('Error', 'Failed to update RSVP...')` | `Alert.alert('RSVP', 'We couldn't update your RSVP. Try again.')` |
| `BannerAd.tsx` | `Alert.alert('Error', 'Failed to open link...')` | `Alert.alert('Link', 'We couldn't open that link. Check your connection and try again.')` |

### 1.3 Already Good (No Change Needed)

- `sign-in.tsx`: "Invalid email or password", "Network error. Please check your connection", "This account has been suspended"
- `sign-up.tsx`: "This email is already registered. Sign in instead.", "Network error. Please check your connection"
- `verify.tsx`: Expired code, invalid code, wait 30 seconds—already friendly
- `feed.tsx`: "Unable to connect to server", "Please sign in to view games"

---

## 2. Global Network Connectivity

### 2.1 Current State

- **OfflineBanner** exists and is shown in `_layout.tsx`
- It uses **AuthProvider** `healthOk` / `healthError`, which comes from a one-time `checkHealth()` (GET /health) at startup
- No continuous network monitoring (NetInfo)
- No auto-retry of last failed request on reconnect

### 2.2 Gaps

1. **No real-time offline detection** — Health check runs once; if user loses internet later, banner won't show until next health check or app restart.
2. **No auto-retry on reconnect** — User must tap "Retry" manually; no automatic retry when internet returns.

### 2.3 Recommended Implementation

1. Add `@react-native-community/netinfo` and listen for `connectivityChange`.
2. When `isConnected === false` → show "You're offline" banner.
3. When `isConnected === true` after being offline → call `checkHealth()` and, if ok, optionally trigger a global "retry last action" (requires a small failed-request queue in the HTTP layer or a context that stores last failed action + retry callback).

---

## 3. Button Loading / Disabled States

### 3.1 Buttons With Network Requests — Already Protected

Most submit/action buttons already have `disabled={loading}` or `disabled={submitting}` and show "Saving…", "Verifying…", etc.:

- `sign-up.tsx`, `sign-in.tsx` — `disabled={loading || oauthLoading}` ✓
- `verify.tsx` — `disabled={loading}` ✓
- `create-post.tsx` — `disabled={!canPost || submitting}` ✓
- `edit-profile.tsx` — `disabled={saving}` ✓
- `message-thread.tsx` — `disabled={!text.trim()}` (no loading for send—see below)
- `event-approvals.tsx` — `disabled={isProcessing}` ✓

### 3.2 Potential Gaps

| Location | Issue | Recommendation |
|----------|-------|----------------|
| `app/(tabs)/message-thread.tsx` | Send button `disabled={!text.trim()}` — no `sending` state; user can double-tap while request in flight | Add `sending` state, `disabled={!text.trim() \|\| sending}`, and show spinner when sending |
| `event-detail.tsx` | RSVP button — verify it's disabled while RSVP request in flight | Check `rsvpBusy` or equivalent |
| `team-page.tsx` | "Join" / action buttons — verify disabled during request | Audit |
| `request-join-organization.tsx` | ✓ Already has `submitting` and `canSubmit` includes `!submitting`; button disabled during submit | No change |

### 3.3 RSVP Badge in Feed

- `RSVPBadge` in `feed.tsx` has `opacity: isLoading ? 0.6 : 1` but is still tappable; consider `pointerEvents={isLoading ? 'none' : 'auto'}` or equivalent to prevent double-tap.

---

## 4. Summary of Actions

### Error Messages ✓ DONE
- Replaced ~15 raw or generic error strings with friendly, specific messages.
- No longer surfacing `e?.message` or `error?.data?.error` directly to users.

### Network Connectivity ✓ DONE
- Added `@react-native-community/netinfo` and `hooks/useNetworkStatus.ts`.
- OfflineBanner shows "You're offline" when NetInfo reports disconnected.
- On reconnect, OfflineBanner automatically calls `checkAuth()` to retry health check.
- Retry button hidden when device is offline (only shown when server unreachable).

### Button States ✓ DONE
- Added `sending` state to `message-thread.tsx` send button: disabled + spinner while request in flight.
- Added `pointerEvents={isLoading ? 'none' : 'auto'}` to RSVPBadge in `feed.tsx` to prevent double-tap.
- Added `rsvpBusy` state to `event-detail.tsx` RSVP button and RsvpSheet: disabled + spinner when request in flight.
- `request-join-organization.tsx` already had `submitting` and `disabled` ✓
