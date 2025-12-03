# Button Debugging Quick Reference

## 🚨 Immediate Checks (Do These First)

### 1. Are you on a REAL record?
```
❌ sample-warriors-lakers
❌ sample-*
❌ Preview Event
✅ Navigate from Feed/Team/Events
✅ Real game ID or slug
```

### 2. Watch Metro logs when you tap
Look for these patterns:
```bash
[http] GET /games/123        # Network request started
[story] Camera selected      # Story flow initiated
[share] Generating link      # Share triggered
[http] 401 Unauthorized      # Auth expired → redirect
```

### 3. Check API base on startup
Should see:
```
[http] API base: https://api-production-8ac3.up.railway.app
```

**If you see a LAN IP instead:**
- Simulator can't reach local backend
- All buttons will fail silently
- Fix: Verify EXPO_PUBLIC_API_URL in .env

---

## 🔍 Common Symptoms & Fixes

### Symptom: "Nothing happens when I tap"

**Diagnostic:**
```typescript
// Add to button component temporarily:
onPressIn={() => console.warn('🔴 Touch detected')}
onPress={() => console.warn('🔴 Press fired', { id, screen })}
```

**Possible Causes:**
1. **Overlay capturing touches**
   - Check for Modal/Pressable/View with pointerEvents
   - Add `e.stopPropagation()` in handler

2. **Button disabled**
   ```typescript
   disabled={loading || !authenticated || isDemo}
   ```
   - Check each condition
   - Add logging: `console.log({ loading, authenticated, isDemo })`

3. **Gesture conflict**
   - ScrollView may be preventing press
   - Try `delayPressIn={0}` on TouchableOpacity

---

### Symptom: "Logs show but action doesn't complete"

**Check Metro for:**
```
[http] Request timeout – server did not respond
[http] 401 Unauthorized
[http] 404 Not Found
```

**Fixes:**
- **Timeout**: Railway cold start (wait 15s, retry)
- **401**: Sign out → sign in → retry
- **404**: Using sample ID instead of real record

---

### Symptom: "Vote/RSVP/Story upload fails"

**Verify auth state:**
```bash
# In Metro logs, look for:
[http] POST /auth/login → 200
Authorization: Bearer eyJhbG...
```

**Common issues:**
1. Token expired (idle >1hr) → auto-redirects to `/sign-in`
2. Not signed in → check Settings → Account
3. Demo mode → buttons disabled for sample-* IDs

---

## 📱 Screen-Specific Checks

### Game Details
**Add Story Button:**
- iOS Simulator: Camera won't work (use Gallery)
- Permissions: Check Settings → VarsityHub → Photos
- Logs: `[story] Gallery selected` → `[story] Uploading attempt 1/3`

**Vote A/B:**
- Only works on REAL games (not sample-*)
- Logs: `[http] POST /games/:id/vote`
- If 401: Sign in and retry

**Share:**
- Logs: `[share] Generating link for game/:id`
- Falls back to clipboard if Share API unavailable

---

### Event Detail
**RSVP Badge (bottom-right):**
- Opens RsvpSheet modal
- Logs: `[http] Event RSVP toggle`
- Updates going count optimistically

**Maps Button:**
- Requires `latitude`/`longitude` OR `address`
- Hidden if neither exists
- Prefers coordinates over geocoding

---

### Highlights (Feed)
**Share Post:**
- Logs: `[share] Generating link for post/:id`
- Clipboard fallback enabled

**Like/Comment:**
- Optimistic updates (instant UI feedback)
- Logs: `[http] POST /posts/:id/like`

---

## 🛠️ Debug Workflow

### Step 1: Add Temporary Logging
```typescript
const handleAction = async () => {
  console.warn('🔴 [DEBUG] Action started', { gameId, userId });
  try {
    const result = await apiCall();
    console.warn('🔴 [DEBUG] Success', result);
  } catch (error) {
    console.warn('🔴 [DEBUG] Failed', error);
  }
};
```

### Step 2: Check Button State
```typescript
console.log('Button state:', {
  disabled: loading || !auth,
  loading,
  authenticated: !!auth,
  id: gameId,
  isDemo: gameId?.startsWith('sample-')
});
```

### Step 3: Test Touch Propagation
```typescript
<Pressable
  onPressIn={(e) => {
    console.warn('Touch detected');
    e.stopPropagation(); // Prevent parent capture
  }}
  onPress={() => console.warn('Press fired')}
>
```

---

## 📊 Expected Log Patterns

### Successful Story Upload
```
[story] Camera selected
[story] Uploading attempt 1/3
[http] POST /games/123/stories
[http] 201 Created
[story] Upload complete
```

### Successful RSVP
```
[http] Event RSVP toggle
[http] PUT /events/456/rsvp
[http] 200 OK
RSVP updated: going → true
```

### Failed Auth
```
[http] POST /games/123/vote
[http] 401 Unauthorized
Redirecting to /sign-in?next=/game-details/123
```

---

## 💡 Pro Tips

1. **Test on real data first** – sample routes short-circuit most logic
2. **Watch logs continuously** – Metro shows request/response in real-time
3. **Check auth state** – most actions require valid token
4. **Verify API base** – must be Railway, not LAN IP
5. **Use Sentry** – add DSN to capture errors in production

---

## 🚑 Emergency Fixes

### Everything broken?
```bash
# 1. Clear cache
npx expo start --clear

# 2. Reset dependencies
rm -rf node_modules && npm install

# 3. Check environment
cat .env | grep EXPO_PUBLIC_API_URL

# 4. Test backend
curl https://api-production-8ac3.up.railway.app/health
```

### Still broken?
1. Check package.json – ensure sentry/expo versions match
2. Run diagnostics: `node tools/diagnose-buttons.js`
3. Check docs/BUTTON_DIAGNOSTICS.md for detailed guide
4. Share Metro logs with full context (30s before/after tap)

---

## 📝 Reporting Issues

When asking for help, include:

1. **Screen name**: GameDetails, EventDetail, etc.
2. **Button**: "Add Story", "Vote A/B", "RSVP", etc.
3. **ID/Route**: Real or sample? Numeric or slug?
4. **Metro logs**: 30 seconds around the tap
5. **Auth state**: Signed in? Token present?
6. **API base**: Railway or LAN?

Example:
```
Screen: GameDetails
Button: Vote Team A
ID: 123 (real)
Auth: ✅ Signed in
API: ✅ Railway

Logs:
[http] POST /games/123/vote
[http] Request timeout – server did not respond
```
