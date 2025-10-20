# Payment Redirect & Settings "My Ads" Fixes

## Issue 1: After payment, user stays on Stripe screen / doesn't navigate to My Ads

**File:** `app/payment-success.tsx`

**Problem:** Using `router.replace()` which doesn't properly navigate in the tab navigator.

**Fix:** Change line 51 from `router.replace('/(tabs)/my-ads')` to `router.push('/(tabs)/my-ads')`

### Before (Line 48-52):
```typescript
  const handleContinue = () => {
    // Navigate to the appropriate next step based on payment type
    console.log('[payment-success] handleContinue called', { isAdPayment, type: params.type });
    if (isAdPayment) {
      console.log('[payment-success] Redirecting to /(tabs)/my-ads');
      router.replace('/(tabs)/my-ads'); // ❌ CHANGE THIS
    } else {
```

### After (Lines 48-52):
```typescript
  const handleContinue = () => {
    // Navigate to the appropriate next step based on payment type
    console.log('[payment-success] handleContinue called', { isAdPayment, type: params.type });
    if (isAdPayment) {
      console.log('[payment-success] Redirecting to /(tabs)/my-ads');
      router.push('/(tabs)/my-ads'); // ✅ FIXED: Use push instead of replace
    } else {
```

---

## Issue 2: Can't find "My Ads" screen in settings

**File:** `app/settings/index.tsx`

**Problem:** No link to My Ads screen in Settings.

**Fix:** Add a new NavRow for "My Ads" in the "My Content" section.

### Before (Lines 305-308):
```typescript
                    {/* My Content */}
                    <SectionCard title="My Content">
                      <NavRow title="View Favorites" subtitle="Posts you've saved" onPress={() => router.push('/settings/favorites')} />
                    </SectionCard>
```

### After (Lines 305-309):
```typescript
                    {/* My Content */}
                    <SectionCard title="My Content">
                      <NavRow title="View Favorites" subtitle="Posts you've saved" onPress={() => router.push('/settings/favorites')} />
                      <NavRow title="My Ads" subtitle="Manage your banner ads" onPress={() => router.push('/(tabs)/my-ads')} />
                    </SectionCard>
```

---

## Issue 3: "My Ads" shows every ad / titles missing

**File:** `app/my-ads2.tsx`

**Problems:**
- Server responses without `user_id` safeguards were still being merged with local drafts, so every ad was displayed.
- Ads created before business_name existed rendered without a title.
- Reservation dates were raw ISO strings (hard to read).

**Fixes Applied:**
- Load the authenticated user (`User.me()`) and ignore any server ad that doesn't match the current `user_id` or `contact_email`.
- Provide a friendly fallback title (`"Untitled Ad"`) when the server returns an empty business name.
- Format scheduled dates with `toLocaleDateString` for clarity.
- Store draft ads in a user-scoped SecureStore key (`LOCAL_ADS_<userId>`) so switching accounts on the same device no longer shows another user’s drafts.

### Key Snippet
```typescript
const [userId, setUserId] = useState<string | null>(null);
const [userEmail, setUserEmail] = useState<string | null>(null);
const [userLoaded, setUserLoaded] = useState(false);

useEffect(() => {
  let mounted = true;
  (async () => {
    try {
      const me = await User.me();
      if (!mounted) return;
      setUserId(me?.id ? String(me.id) : null);
      setUserEmail(typeof me?.email === 'string' ? me.email.trim().toLowerCase() : null);
    } finally {
      if (mounted) setUserLoaded(true);
    }
  })();
  return () => { mounted = false; };
}, []);

const add = (source: any, isLocal: boolean) => {
  if (!isLocal) {
    let belongs = false;
    if (userId && source.user_id) belongs = String(source.user_id) === userId;
    if (!belongs && userEmail && source.contact_email) {
      belongs = source.contact_email.trim().toLowerCase() === userEmail;
    }
    if (!belongs) return;
  }

  const businessName = String(source.business_name || source.name || '').trim();
  combined.push({
    id: String(source.id),
    business_name: businessName.length ? businessName : 'Untitled Ad',
    contact_email: (source.contact_email || '').trim().toLowerCase(),
    owner_id: source.user_id ? String(source.user_id) : null,
    isLocal,
    ...
  });
};
```

Dates are now formatted just before rendering:
```typescript
const label = new Date(d + 'T00:00:00').toLocaleDateString(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
```

---

## Issue 4: Stripe checkout returns to browser instead of the app

**File:** `app/ad-calendar.tsx`

**Problem:** `WebBrowser.openBrowserAsync` opens Stripe checkout, but the deep link back to the app is never captured, leaving the user stuck on the Stripe confirmation page.

**Fix:** Swap to `WebBrowser.openAuthSessionAsync` with a generated redirect URL from `expo-linking`. When Stripe redirects to `varsityhubmobile://payment-success`, the hook parses the returned URL and manually routes to `/payment-success`.

### Before (Lines 220-225):
```typescript
} else if (data?.url) {
  await WebBrowser.openBrowserAsync(String(data.url));
  // Don't redirect here - let the Stripe callback handle the redirect
}
```

### After:
```typescript
} else if (data?.url) {
  await launchCheckout(String(data.url));
}
```
Where `launchCheckout` wraps `openAuthSessionAsync`, parses the redirect, and pushes the Expo Router screen.

---

## Manual Steps:

1. **Open `app/payment-success.tsx`**
2. Go to **line 51**
3. Change `router.replace('/(tabs)/my-ads');` to `router.push('/(tabs)/my-ads');`
4. Save file

5. **Open `app/settings/index.tsx`**
6. Go to **line 307** (inside the "My Content" section)
7. After the "View Favorites" NavRow, add a new line:
   ```typescript
   <NavRow title="My Ads" subtitle="Manage your banner ads" onPress={() => router.push('/(tabs)/my-ads')} />
   ```
8. Save file

9. **Open `app/my-ads2.tsx`**
   - Load the user profile and filter server ads by `user_id` / `contact_email`.
   - Provide fallback title and formatted dates as shown above.

10. **Open `app/ad-calendar.tsx`**
    - Import `expo-linking` and use `openAuthSessionAsync` via the new `launchCheckout` helper.

---

## Test After Fixing:

1. **Payment Redirect:**
   - Pay for an ad
   - Complete Stripe checkout
   - Click "View My Ads" button
   - ✅ Should navigate to My Ads tab (with bottom tabs visible)

2. **Settings Link:**
   - Open Settings (gear icon)
   - Scroll to "My Content" section
   - ✅ Should see "My Ads" option
   - Click it – should navigate to My Ads screen

3. **My Ads Safeguard:**
   - Create an ad while logged in.
   - Open “My Ads” — only ads you created (or drafted on this device) should be visible and titled.
   - Reserved dates display as human-readable strings.

4. **Stripe Checkout:**
   - From the ad calendar, choose dates and start checkout.
   - Complete Stripe payment in the in-app browser flow.
   - The app should return to `/payment-success` automatically; tapping “View My Ads” lands in the updated My Ads tab.
