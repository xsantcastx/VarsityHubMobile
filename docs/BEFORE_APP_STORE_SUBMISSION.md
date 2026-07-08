# Before App Store Submission

**Use this list right before you submit to the App Store.** It ties together existing checklists and known gaps. For gap status (silent catches, server TS, accessibility), see **docs/SUBMISSION_READINESS_AUDIT.md** — gaps 1–6 are resolved as of 2026-03-18.

---

## 0. After any code changes — verify nothing is broken

- **Frontend:** `npm run typecheck` (from repo root). Fix any TypeScript errors before building.
- **Lint:** `npm run lint` (optional; fix critical issues only).
- **Backend:** `npm --prefix server run typecheck` or `cd server && npx tsc --noEmit`. Resolve any errors before deploying the API.
- **Behavior:** Accessibility and doc/script updates are additive; only intentional behavior change is Create screen showing coach options only when `approval_status === 'APPROVED'`.

---

## 1. Run validation scripts

```bash
# Pre-launch validation (config, assets, legal docs, env)
npm run validate:pre-launch

# Release readiness (roles, onboarding, subscriptions, coach flows)
npm run verify:release

# P0 foundation (audit, rate limits, payment confidence)
npm run verify:p0:foundation
```

Fix any **errors** from these before building. Warnings are acceptable if you’ve reviewed them.

---

## 2. Confirm production config

| Item                         | Where to check                              | Notes                                                                                                                                 |
| ---------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Production API URL**       | EAS production env / `.env`                 | Should be `https://api-production-8ac3.up.railway.app` (or your live API).                                                            |
| **Stripe publishable key**   | `eas.json` production env                   | Must be `pk_live_...` for real payments. Already in eas.json production profile.                                                      |
| **Sentry DSN**               | `eas.json` production env                   | Optional but recommended; production profile has it.                                                                                  |
| **App Store Connect App ID** | `eas.json` → submit.production.ios.ascAppId | Must match the app in App Store Connect (`6758405187` in eas.json).                                                                   |
| **Apple ID for submit**      | `eas.json` → submit.production.ios.appleId  | Used for `eas submit`.                                                                                                                |
| **Apple bundle ID**          | Railway env `APPLE_BUNDLE_ID`               | Must be `com.varsithub.varsityhub-ios`. Required for Apple signed-transaction verification in App Review, TestFlight, and production. |
| **Apple IAP shared secret**  | Railway env `APPLE_IAP_SHARED_SECRET`       | Optional legacy fallback for older Apple receipt flows. Current production builds use signed transactions first.                      |

---

## 3. Legal & App Store requirements (already in place)

- **Privacy Policy URL**: `https://varsityhub.app/privacy-policy` (in app.json `NSPrivacyPolicyURL`).
- **Privacy policy**: In-app screen at Settings → Privacy Policy and public URL `https://varsityhub.app/privacy-policy`.
- **Encryption**: `ITSAppUsesNonExemptEncryption: false` in app.json.
- **Usage descriptions**: Camera, microphone, photo library, location present in app.json.
- **Apple Sign In**: `usesAppleSignIn: true`.

---

## 4. Known gap: accessibility (medium priority)

From **CODEBASE_MAP.md → Known Issues**:

- Many `Pressable` / list / form elements lack `accessibilityLabel` and `accessibilityHint`.
- VoiceOver will announce them generically (“button”, “image”).
- **Recommendation**: Add labels to main flows (sign-in, onboarding, Create menu, tab bar, primary buttons). Full coverage can follow in a later update.

---

## 5. Build and submit

```bash
# Production iOS build
eas build --platform ios --profile production

# After build completes, submit to App Store Connect
eas submit --platform ios --profile production
# Or: npm run submit:ios
```

---

## 6. After upload: quick smoke test

On a **physical device** (required for store review):

1. **Auth**: Sign up or sign in (email or Apple/Google).
2. **Onboarding**: Complete as fan or coach; confirm you land on the main app.
3. **Payments** (if you have IAP/subscriptions): One successful purchase; confirm receipt/entitlement.
4. **No crash** on cold start and after backgrounding.

---

## 7. Store & backend configuration (your action items)

Code is ready. The items below are **store/backend config** (not code changes). The codebase already has the following wired:

### Already set in code (verified)

| Item                       | Where                                                                  | Notes                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **IAP product IDs**        | `hooks/useIAP.ts` (`IAP_PRODUCT_IDS`), `server/src/routes/payments.ts` | App and server use **MIDTIER** and **TOPTIER**; no code change needed.                                            |
| **ADMIN_EMAILS fallback**  | `server` (payments, ads, email, auth, games, etc.)                     | If `ADMIN_EMAILS` is unset, server uses **support@varsityhub.app**.                                               |
| **Client admin email**     | `app.json` → `EXPO_PUBLIC_ADMIN_EMAILS`                                | Set to **support@varsityhub.app** for in-app use (e.g. request-host-event).                                       |
| **SendGrid template keys** | `server/src/lib/email.ts`                                              | All template IDs read from env (e.g. `SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID`); see `.env.example` for full list. |

You only need to create products in the stores and set env vars on Railway (below).

### App Store Connect — In-App Purchases

1. App Store Connect → Your App → **In-App Purchases**.
2. Create (if missing) and submit for review products that **match the IDs in code**:
   - **MIDTIER** — Auto-Renewable Subscription, Veteran plan.
   - **TOPTIER** — Auto-Renewable Subscription, Legend plan.
3. SKUs must be **Ready to Submit** before they work in sandbox.

### Google Play Console

1. **Monetization → Subscriptions**: Create the same product IDs: **MIDTIER**, **TOPTIER**.

### Railway (production API)

Add or verify on your Railway production service:

| Variable                                   | Purpose                                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADMIN_EMAILS**                           | Comma-separated admin emails. Optional: code fallback is support@varsityhub.app; set this to override (e.g. production list).               |
| **SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID** | SendGrid dynamic template for ad pending-review. Create in SendGrid, paste ID.                                                              |
| **SENDGRID\_\*** (others)                  | All keys in `server/src/lib/email.ts` and `server/.env.example`. Create templates in SendGrid and set IDs on Railway for each flow you use. |

### Summary

- **Code**: IAP IDs, admin fallback, and SendGrid env keys are already set. No code changes required.
- **Your config**: Create **MIDTIER** / **TOPTIER** in App Store Connect and Google Play; set SendGrid template IDs (and optionally ADMIN_EMAILS) on Railway.

---

## 8. Reference checklists (existing)

- **TestFlight / config**: `docs/TESTFLIGHT_PRE_SUBMISSION_CHECKLIST.md`
- **Go-live gate (P0)**: `docs/GO_LIVE_CHECKLIST.md`
- **Known issues**: `docs/CODEBASE_MAP.md` → Section 8 (KNOWN ISSUES)
- **Audit confirmation**: `docs/CODEBASE_MAP.md` → AUDIT CONFIRMATION (2026-03-18)

---

## Summary

- **Must do**: Run `validate:pre-launch` and `verify:release`; fix errors; confirm production API URL and Stripe key; ensure `ascAppId` in eas.json matches App Store Connect; complete **§7** (IAP SKUs, Railway/SendGrid config).
- **Should do**: Add accessibility labels to primary flows; run `verify:p0:foundation`; smoke-test on a real device after upload.
- **Already in place**: Privacy/Terms URLs, usage strings, encryption declaration, Apple Sign In, EAS production env (Stripe, Sentry). Coach badge colors and follow-button feedback are in code; single “Options” (no duplicate “More”) confirmed.
