# Ad IAP Verification Checklist

Use this before spending build credits to confirm ad IAP is correctly configured.

## 1. App Store Connect (Required)

- [ ] **Products created** in App Store Connect → Your App → In-App Purchases:
  - `ad_weekday_vhub` — Consumable, $5.00 (500¢)
  - `ad_weekend_vhub` — Consumable, $8.00 (800¢)
- [ ] Products are **Ready to Submit** (not Missing Metadata)
- [ ] Products are in the correct app and region

## 2. Server (Railway / Production)

- [ ] `APPLE_IAP_SHARED_SECRET` is set (from App Store Connect → App → App Information → App-Specific Shared Secret)
- [ ] Server returns 200 for `/payments/config` and `stripe_configured: true` (Stripe still required for product)

## 3. Build Type

- [ ] **EAS build** or **dev client** — IAP does NOT work in Expo Go
- [ ] Test on a physical device or TestFlight (simulator IAP is limited)

## 4. Testing

- [ ] Use a **Sandbox Apple ID** (Settings → App Store → Sandbox Account)
- [ ] Ad must be **approved** before payment (status `approved` or `active`)
- [ ] Select dates → Pay → IAP sheet appears (not Stripe)
- [ ] After purchase, navigate to ad confirmation

## 5. Code Verification (Already Done)

| Component | Status |
|-----------|--------|
| `hooks/useAdIAP.ts` | Product IDs `ad_weekday_vhub`, `ad_weekend_vhub`; lazy-loads react-native-iap |
| `app/ad-calendar.tsx` | iOS → IAP; Android → Stripe; UTC date math matches server |
| `server/routes/payments.ts` | `POST /payments/apple/verify-ad-receipt` verifies receipts, creates reservations |

## 6. Common Failures

| Symptom | Cause |
|---------|-------|
| "IAP disabled in Expo Go" | Must use EAS build, not Expo Go |
| "Products not found" | Products not Ready in App Store Connect, or wrong product IDs |
| "Receipt verification failed" | `APPLE_IAP_SHARED_SECRET` missing or wrong |
| "Receipt total does not match" | Client/server date math mismatch — fixed by using UTC in both |
