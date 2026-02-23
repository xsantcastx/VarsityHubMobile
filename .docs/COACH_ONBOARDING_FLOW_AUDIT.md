# Coach Onboarding Flow — Audit & Fixes

**Date:** February 22, 2025

---

## 1. Step 4 Failure — Root Cause & Fix

### What Happened
Coach onboarding stopped at step 4 (Organization). The `Organization.createOrganization` API call failed with **400 Invalid payload**.

### Root Cause
The step 4 payload sent `location` as a **nested object**:
```javascript
location: {
  address: selectedPlace?.description,
  place_id: selectedPlace?.place_id,
  zip_code: ...,
}
```

The server schema (`createOrganizationSchema`) expects **flat string fields**:
- `location`: string
- `formatted_address`: string
- `place_id`: string
- `zip_code`: string

Zod validation failed because `location` was an object, not a string.

### Fix Applied
Updated `app/onboarding/step-4-organization.tsx` to send flat fields:
```javascript
const payload = {
  name: orgName.trim(),
  description: desc,
  org_type: orgType,
  location: locationLabel || undefined,           // string
  formatted_address: selectedPlace?.description || undefined,
  place_id: selectedPlace?.place_id || undefined,
  zip_code: (selectedPlaceZip || searchZip.trim()) || undefined,
};
```

### API Call Summary
| Field | Endpoint | Method | Expected Response |
|-------|----------|--------|-------------------|
| Create org | `POST /organizations` | `Organization.createOrganization(payload)` | 201 + org object with `id`, `name`, etc. |

---

## 2. Stripe Payment Flow During Onboarding

### Success
1. Coach selects Veteran/Legend in step 3 → `Subscriptions.createCheckout(plan, teamCount)` → `POST /payments/checkout`
2. Server creates Stripe session, returns `{ url, session_id }`
3. App opens `WebBrowser.openBrowserAsync(res.url)` (Stripe Checkout)
4. User pays → Stripe redirects to `varsityhubmobile://payment-success?session_id=XXX&type=subscription`
5. Stripe webhook `checkout.session.completed` fires → `finalizeFromSession()` updates user:
   - `preferences.plan` = veteran/legend
   - `preferences.payment_pending` = false
   - `preferences.role` = coach
6. payment-success screen polls `User.me()` until `plan` and `payment_pending === false`
7. User clicks "Continue to App" → if `onboarding_completed === false`, redirects to **step 4**; else feed

### Failure
- Step 3 catches errors, shows Alert, falls back to **Rookie plan**
- Saves `User.updatePreferences({ plan: 'rookie', payment_pending: false })`
- Navigates to step 4 so onboarding can continue

### User Closes App During Checkout
- Plan is stored only in **local onboarding state** (`ob.plan`, `ob.payment_pending: true`)
- Backend is **never** updated until Stripe webhook fires
- When user returns: app loads from AsyncStorage, `nextIncompleteStep` sends them to step 4
- Org creation uses `resolvePlan(prefs.plan)` — backend still has rookie/undefined, so org creation succeeds
- Plan is only marked active when Stripe webhook confirms payment

**Key rule:** Plan is never marked active until the Stripe webhook confirms payment. The app does not call `User.updatePreferences({ plan })` for paid plans before payment.

---

## 3. Post-Onboarding Coach Dashboard

### Current Flow
- Step 10 completes → `router.replace('/(tabs)')` → tabs index redirects to **Feed**
- Coach lands on Feed tab

### Organization vs Team
- **Step 4** creates an **Organization** (POST /organizations)
- **No team** is created during onboarding
- Coach must create a team separately via Create Team flow after onboarding

### Fix Applied
- payment-success: when subscription payment succeeds and `onboarding_completed === false`, redirect to **step 4** (Organization) instead of Feed, so coach continues onboarding (org → step 6 → profile → etc.)

---

## Summary of Code Changes

| File | Change |
|------|--------|
| `app/onboarding/step-4-organization.tsx` | Fixed create org payload: flat `location`, `formatted_address`, `place_id`, `zip_code` |
| `app/payment-success.tsx` | After subscription payment, redirect to step 4 if onboarding incomplete |
