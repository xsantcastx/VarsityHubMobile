# VarsityHub Mobile - Testing Guide

**Last Updated:** October 13, 2025  
**Purpose:** Step-by-step testing instructions for newly implemented features

---

## 🔥 PRIORITY 1: Test Subscription Payment Flow (NEW!)

**Status:** ⚡ Just implemented - needs immediate testing  
**Time Required:** 15 minutes  
**Impact:** Verifies Stories #4, #5, #6 (Subscriptions)

### Prerequisites
- ✅ Stripe test keys configured in `.env`
- ✅ Backend running on Railway or localhost:4000
- ✅ App running on device/emulator
- ✅ Stripe CLI webhook forwarding (for local testing)

### Local Testing Setup
```powershell
# Terminal 1: Start backend server
cd server
npm run dev

# Terminal 2: Forward Stripe webhooks
stripe listen --forward-to http://localhost:4000/payments/webhook
```

### Testing Steps

#### 1. Navigate to Subscription Paywall
```
1. Launch app
2. Sign in (or skip if already signed in)
3. Navigate to Settings → Subscription (or wherever subscription screen is accessible)
4. Should see 3 tier options: Rookie (free), Veteran ($70/year), Legend ($150/year)
```

#### 2. Select a Paid Tier
```
1. Tap "Veteran" or "Legend" tier pill
2. Should highlight selected tier
3. Should see tier benefits displayed below
4. Should see "Subscribe" button at bottom
```

#### 3. Start Checkout
```
1. Tap "Subscribe" button
2. Should show loading indicator
3. Should open Stripe checkout in browser/webview
4. Should display tier pricing (Veteran: $70, Legend: $150)
```

#### 4. Complete Payment
```
Use Stripe test card:
- Card: 4242 4242 4242 4242
- Expiry: Any future date (e.g., 12/25)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any 5 digits (e.g., 12345)

1. Enter test card details
2. Click "Subscribe" in Stripe checkout
3. Wait for payment processing
```

#### 5. Verify Success Redirect
```
1. After payment, should automatically close browser
2. Should redirect to payment-success screen
3. Should show green checkmark icon
4. Should display: "Payment Successful!"
5. Should display: "Your subscription has been activated. You can now access all premium features."
6. Should show "Continue to App" button
```

#### 6. Verify Navigation
```
1. Click "Continue to App" button
2. Should navigate to feed (/(tabs)/feed)
3. Should NOT stay on subscription paywall
```

#### 7. Verify Subscription Status
```
1. Navigate to Settings → Profile (or wherever user preferences shown)
2. User preferences should show new plan (veteran or legend)
3. Should display tier badge next to username (if implemented)
```

### Expected Console Logs
```
[payments] Plan upgrade: rookie → veteran for user <user_id>
[webhook] Processing checkout.session.completed
[webhook] Subscription checkout completed for user <user_id>
[payment-success] handleContinue called { isAdPayment: false, type: 'subscription' }
[payment-success] Redirecting to /(tabs)/feed
```

### Troubleshooting

#### Issue: "Checkout Coming Soon" Alert
- **Cause:** Old cached version of app
- **Fix:** Reload app (shake device → Reload)

#### Issue: Checkout URL not opening
- **Cause:** Backend not returning URL
- **Check:** Backend logs for errors
- **Verify:** `.env` has STRIPE_SECRET_KEY

#### Issue: Payment doesn't redirect
- **Cause:** Deep link not configured
- **Check:** `app.json` has `varsityhubmobile://` scheme
- **Verify:** Deep link handling in App.tsx

#### Issue: Webhook not firing
- **Cause:** Stripe CLI not running or wrong endpoint
- **Fix:** Restart Stripe CLI with correct endpoint
- **Command:** `stripe listen --forward-to http://localhost:4000/payments/webhook`

---

## 🔐 PRIORITY 2: Test Google OAuth

**Status:** ⏳ Configured, needs testing  
**Time Required:** 30 minutes  
**Impact:** Verifies Story #3 (Google Sign-In)

### Prerequisites
- ✅ Google Cloud Console access
- ✅ OAuth consent screen configured
- ⚠️ Test users added OR app published

### Setup Steps

#### 1. Check OAuth Consent Screen Status
```
1. Go to: https://console.cloud.google.com/apis/credentials/consent
2. Check "Publishing status"
3. If "Testing":
   - Click "Add Users" under Test Users
   - Add your test email addresses
4. If "In Production":
   - No action needed, anyone can sign in
```

#### 2. Verify Redirect URIs
```
1. Go to: https://console.cloud.google.com/apis/credentials
2. Find Web OAuth client
3. Verify Authorized redirect URIs include:
   - http://localhost:4000/auth/google/callback
   - https://<your-railway-url>/auth/google/callback
   - com.googleusercontent.apps.<client-id>:/oauth2redirect (for mobile)
```

### Testing Steps

#### 1. Test Sign-In Flow
```
1. Launch app (not signed in)
2. On sign-in screen, tap "Continue with Google"
3. Should open Google OAuth consent screen
4. Select Google account (must be test user if app is in Testing mode)
5. Review permissions requested
6. Click "Allow" or "Continue"
```

#### 2. Verify Account Creation (New User)
```
For NEW users:
1. After OAuth, should create account in database
2. Should save google_id in user record
3. Should generate JWT token
4. Should redirect to onboarding (role selection screen)
```

#### 3. Verify Account Linking (Existing User)
```
For EXISTING users (signed up with email):
1. If email matches, should link google_id to existing account
2. Should NOT create duplicate account
3. Should redirect to feed (skip onboarding)
```

#### 4. Verify Subsequent Sign-Ins
```
1. Sign out
2. Click "Continue with Google" again
3. Should auto-select previously used account
4. Should sign in without showing consent screen
5. Should go directly to feed (skip onboarding for existing users)
```

### Expected Console Logs
```
[auth] Google OAuth initiated
[auth] Received ID token from Google
[auth] Verified Google ID token for user: <email>
[auth] User <user_id> signed in via Google
```

### Troubleshooting

#### Issue: "Access blocked: This app's request is invalid"
- **Cause:** OAuth consent screen not configured properly
- **Fix:** Verify OAuth consent screen has app name, support email, developer email

#### Issue: "Error 400: redirect_uri_mismatch"
- **Cause:** Redirect URI not in allowed list
- **Fix:** Add correct redirect URI to OAuth client

#### Issue: "Sign in cancelled" or no response
- **Cause:** User cancelled OAuth flow
- **Not an error:** Expected behavior

#### Issue: "Unable to verify ID token"
- **Cause:** Wrong client ID or secret
- **Check:** `.env` has correct EXPO_PUBLIC_GOOGLE_*_CLIENT_ID values

---

## 💼 PRIORITY 3: Re-test Ad Payment Flow

**Status:** ✅ Previously tested, re-verify after Railway deploy  
**Time Required:** 15 minutes  
**Impact:** Verifies Stories #18-22 (Ads)

### Testing Steps

#### 1. Create or Edit Ad
```
1. Navigate to "Submit Ad" or "My Ads" → Edit
2. Fill in business details:
   - Business name
   - Contact info
   - Zip code
3. Upload banner image (1200x628 recommended)
4. Add description
5. Click "Save" or "Continue"
```

#### 2. Select Calendar Dates
```
1. On ad-calendar screen, tap dates to reserve
2. Should see pricing:
   - Mon-Thu: $10/day
   - Fri-Sun: $17.50/day
3. Can select multiple dates
4. Should see total price at bottom
5. (Optional) Enter promo code and tap "Apply"
```

#### 3. Complete Payment
```
1. Tap "Proceed to Checkout" button
2. Should open Stripe checkout in browser
3. Enter test card: 4242 4242 4242 4242
4. Complete payment
```

#### 4. Verify Success
```
1. Should close browser and redirect to payment-success screen
2. Should show: "Your ad payment has been processed successfully"
3. Should show "View My Ads" button
4. Click button → should navigate to /(tabs)/my-ads
```

#### 5. Verify Ad Status
```
1. On My Ads screen, find the ad you just paid for
2. Should show "ACTIVE" badge (green)
3. Should show "PAID" badge (blue)
4. Should display scheduled dates
5. Should ONLY show YOUR ads (not other users' ads)
```

### Expected Console Logs
```
[payments] Creating checkout session for ad <ad_id>
[webhook] Processing checkout.session.completed
[webhook] Ad reservation updated: status=active, payment_status=paid
[ads] GET /ads?mine=1 for user <user_id>
[ads] Returning <count> ads for user
[payment-success] handleContinue called { isAdPayment: true, type: 'ad' }
[payment-success] Redirecting to /(tabs)/my-ads
```

---

## 🗺️ PRIORITY 4: Verify Event Discovery Map

**Status:** ⚠️ Unclear if implemented  
**Time Required:** 15 minutes  
**Impact:** Verifies Story #7

### Investigation Steps

#### 1. Navigate to Discover Tab
```
1. Launch app
2. Tap "Discover" tab (bottom navigation)
3. Look for:
   - Map view with event markers
   - Toggle between map/list view
   - Location-based filtering
```

#### 2. Check for Map Features
```
If map exists:
- [ ] Shows user's current location
- [ ] Shows event markers on map
- [ ] Markers are tappable (show event details)
- [ ] Can zoom in/out
- [ ] Can search by location
- [ ] Can filter by date, sport, team

If no map found:
- [ ] Only list view exists
- [ ] Need to implement map view (see roadmap)
```

#### 3. Test Event Discovery
```
1. Search for events near a specific location
2. Filter by sport (basketball, football, etc.)
3. Filter by date range
4. Tap on event → should navigate to event detail screen
```

### Expected Functionality
- Map view with markers for each event
- List view with event cards
- Toggle between map and list
- Distance calculation from user location
- Search and filtering

---

## 📋 Test Results Template

Copy this template and fill in results after testing:

```markdown
## Test Results - [Date]

### Subscription Payment Flow
- [ ] PASS / [ ] FAIL - Navigate to subscription paywall
- [ ] PASS / [ ] FAIL - Select paid tier
- [ ] PASS / [ ] FAIL - Stripe checkout opens
- [ ] PASS / [ ] FAIL - Payment completes
- [ ] PASS / [ ] FAIL - Redirects to payment-success
- [ ] PASS / [ ] FAIL - Shows subscription activated message
- [ ] PASS / [ ] FAIL - Navigates to feed
- [ ] PASS / [ ] FAIL - User preferences updated

**Issues Found:**
- [List any issues or bugs]

**Notes:**
- [Any additional observations]

---

### Google OAuth
- [ ] PASS / [ ] FAIL - "Continue with Google" button works
- [ ] PASS / [ ] FAIL - OAuth consent screen appears
- [ ] PASS / [ ] FAIL - Account creation (new user)
- [ ] PASS / [ ] FAIL - Account linking (existing user)
- [ ] PASS / [ ] FAIL - Subsequent sign-ins

**Issues Found:**
- [List any issues or bugs]

**Notes:**
- [Any additional observations]

---

### Ad Payment Flow
- [ ] PASS / [ ] FAIL - Create/edit ad
- [ ] PASS / [ ] FAIL - Select calendar dates
- [ ] PASS / [ ] FAIL - Stripe checkout opens
- [ ] PASS / [ ] FAIL - Payment completes
- [ ] PASS / [ ] FAIL - Redirects to payment-success
- [ ] PASS / [ ] FAIL - Shows ad payment message
- [ ] PASS / [ ] FAIL - Navigates to My Ads
- [ ] PASS / [ ] FAIL - Ad shows ACTIVE badge
- [ ] PASS / [ ] FAIL - Ad shows PAID badge
- [ ] PASS / [ ] FAIL - Only user's ads visible

**Issues Found:**
- [List any issues or bugs]

**Notes:**
- [Any additional observations]

---

### Event Discovery Map
- [ ] PASS / [ ] FAIL - Map view exists
- [ ] PASS / [ ] FAIL - Event markers displayed
- [ ] PASS / [ ] FAIL - Markers are tappable
- [ ] PASS / [ ] FAIL - Map/list toggle
- [ ] PASS / [ ] FAIL - Location filtering
- [ ] PASS / [ ] FAIL / [ ] N/A - Map not implemented

**Issues Found:**
- [List any issues or bugs]

**Notes:**
- [Any additional observations]
```

---

## 🚀 Ready to Test?

**Quick Start:**
1. **Subscription payments** (15 min) - Start here!
2. **Google OAuth** (30 min) - Do this second
3. **Ad payments** (15 min) - Re-verify existing flow
4. **Event discovery** (15 min) - Check if map exists

**Total Time:** ~75 minutes for all priority testing

---

**Questions or Issues?**
- Check Railway logs for backend errors
- Check app console logs for frontend errors
- Review `docs/IMPLEMENTATION_ROADMAP.md` for known issues
- Contact: customerservice@varsityhub.app
