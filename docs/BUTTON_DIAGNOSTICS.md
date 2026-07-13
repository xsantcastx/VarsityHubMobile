# Button Diagnostics Guide

## Quick Diagnostic Checklist

When buttons aren't responding, work through these checks in order:

### 1. Verify You're on a Real Record

**Demo/Sample Routes (buttons disabled):**

- Game: `sample-warriors-lakers`, `sample-*`
- Event: "Preview Event" or any with `demoEvent` in route
- Posts: Local-only demo posts

**Real Routes (buttons active):**

- Navigate via Feed → tap a game/event card
- Team Hub → Games tab → tap a game
- Events Calendar → tap an event
- Profile → Posts tab → tap a post

**How to confirm:**

- Check the URL/route params in Metro logs
- Real games have numeric IDs or slug format: `warriors-vs-lakers-2024-12-03`
- Sample games always start with `sample-`

---

### 2. Watch Metro Logs for Button Press

**What to look for when you tap:**

```
[story] Camera/Gallery selected
[http] POST /games/123/stories
[http] RSVP toggle for event 456
[share] Generating link for game/789
```

**If you see NOTHING when tapping:**

- Touch event isn't reaching the handler
- Possible causes:
  - Overlay/modal capturing touches
  - Button in `disabled` state
  - ScrollView preventing press
  - Gesture handler conflict

**If you see logs but "Request timeout":**

- Backend issue (Railway may be cold-starting)
- Check Sentry for captured exception
- Try again in 10-15 seconds

---

### 3. Check Auth State

**Signs you need to re-authenticate:**

- 401 errors in Metro logs: `[http] 401 Unauthorized`
- Auto-redirect to `/sign-in?next=...`
- Token expired (silent after idle session)

**How to verify:**

1. Watch for: `[http] API base: https://api-production-8ac3.up.railway.app`
2. After sign-in, should see: `[http] POST /auth/login → 200`
3. Subsequent requests include: `Authorization: Bearer ...`

**Quick fix:**

- Sign out (Settings → Sign Out)
- Sign back in
- Retry the button action

---

### 4. Verify Railway Connection

**On app startup, you MUST see:**

```
[http] API base: https://api-production-8ac3.up.railway.app
```

**If you see a LAN IP (e.g., `http://192.168.x.x:8080`):**

- Simulator cannot reach local backend
- All network requests will fail silently
- Fix: Check `EXPO_PUBLIC_API_URL` in `.env`

**Test backend connectivity:**

```bash
curl -s https://api-production-8ac3.up.railway.app/health
# Should return: {"status":"ok"}
```

---

## Common Button Issues by Screen

### Game Details Screen

**Add Story (Camera/Gallery):**

- ✅ Logs: `[story] Camera selected`, `[story] Uploading attempt 1/3`
- ❌ Silent: Check camera permissions, iOS simulator camera limitations
- ❌ Timeout: Backend `/games/:id/stories` endpoint may be slow

**Vote (Team A/B):**

- ✅ Logs: `[http] POST /games/:id/vote`
- ❌ 401: Token expired, redirect to sign-in
- ❌ 404: Game doesn't exist or is a sample

**Share:**

- ✅ Logs: `[share] Generating link for game/:id`
- ❌ Silent: Check Share API availability

**RSVP Badge (if present):**

- Triggers RSVP sheet modal
- Should show going count, capacity, Confirm/Cancel buttons

---

### Event Detail Screen

**RSVP Badge (bottom-right):**

- ✅ Logs: `[http] Event RSVP toggle`
- Opens RsvpSheet modal with going/capacity
- Confirm → updates count, closes sheet

**Share:**

- ✅ Logs: `[share] Generating link for event/:id`
- Uses AppLinks.event with web + deep link

**Open in Maps:**

- Prefers `latitude`/`longitude` over geocoded address
- If neither exists, button may be hidden

---

### Highlights (Feed) Screen

**Share Post:**

- ✅ Logs: `[share] Generating link for post/:id`
- Fallback: Copies link to clipboard if Share API fails

**Like/Comment:**

- ✅ Logs: `[http] POST /posts/:id/like`
- Updates local state optimistically

---

## Debugging Steps

### Step 1: Enable Verbose Logging

Open the screen with the broken button, then in Metro:

1. Press `j` to open debugger
2. Check Console for any React errors
3. Look for component render logs

### Step 2: Add Temporary Debug Logs

Find the button's `onPress` handler and add:

```typescript
onPress={() => {
  console.warn('[DEBUG] Button pressed:', { id: gameId, screen: 'GameDetails' });
  // existing handler code
}}
```

### Step 3: Check Button Props

Verify the button isn't disabled:

```typescript
<Button
  disabled={loading || !isAuthenticated} // Check these
  onPress={handleAction}
>
```

### Step 4: Inspect Touch Event Propagation

If button is inside ScrollView/Pressable/Modal:

```typescript
<TouchableOpacity
  onPress={(e) => {
    e.stopPropagation(); // Prevent parent from capturing
    handleAction();
  }}
>
```

---

## Getting Help

When reporting button issues, include:

1. **Screen name**: GameDetails, EventDetail, Highlights, etc.
2. **Button label**: "Add Story", "RSVP", "Share", "Vote A/B"
3. **Metro logs** (30 seconds before/after tap):
   ```
   Copy from terminal and paste here
   ```
4. **Route/ID**: Is it a sample or real record?
5. **Auth state**: Logged in? Token present?
6. **Network**: Railway URL logged on startup?

---

## Quick Fixes

**Nothing logs when I tap:**

```typescript
// In the component, add onPressIn to test touch:
<Pressable
  onPressIn={() => console.warn('Touch detected')}
  onPress={() => console.warn('Press fired')}
>
```

**Logs show error but no alert:**

- Check `utils/sentry.ts` is capturing exceptions
- Add manual alert in catch block:

```typescript
catch (error) {
  console.error('[DEBUG]', error);
  Alert.alert('Debug', JSON.stringify(error));
}
```

**Button visually disabled:**

- Check conditional rendering: `{isEnabled && <Button />}`
- Check disabled prop: `disabled={someCondition}`
- Check opacity/style: `style={{ opacity: loading ? 0.5 : 1 }}`
