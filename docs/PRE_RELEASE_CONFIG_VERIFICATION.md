# Pre-Release Config Verification Report

**Date:** March 15, 2026  
**Purpose:** Confirm codebase is correctly wired for all checklist items.  
**Note:** This verifies _code usage_ — actual Railway values must be confirmed separately.

---

## 1. External Config (Railway) — Code Wiring ✅

### Email

| Variable                            | Used In                                                                        | Validation                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `SENDGRID_API_KEY`                  | `server/src/lib/email.ts`, `server/src/services/email/`                        | `isSendGridConfigured()` checks `Boolean(SENDGRID_API_KEY)`                    |
| `FROM_EMAIL`                        | `server/src/lib/email.ts` (fallback: `EMAIL_FROM` or `noreply@varsityhub.app`) | Used as sender                                                                 |
| `SENDGRID_VERIFICATION_TEMPLATE_ID` | `server/src/lib/email.ts` → `TEMPLATE_IDS.VERIFICATION`                        | Required for `getMissingEmailTemplates()`; verification emails fail without it |

**Status:** ✅ Correctly wired. SendGrid is "ready" only when API key + required templates (including VERIFICATION) are set.

---

### Uploads (Cloudinary)

| Variable                | Used In                                                        | Validation                                |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| `CLOUDINARY_CLOUD_NAME` | `server/src/lib/cloudinary.ts`, `server/src/routes/uploads.ts` | `isCloudinaryConfigured()` requires all 3 |
| `CLOUDINARY_API_KEY`    | Same                                                           | Same                                      |
| `CLOUDINARY_API_SECRET` | Same                                                           | Same                                      |

**Status:** ✅ Correctly wired. Production server logs error if not configured. Client uses `/uploads/cloudinary-signature` for direct uploads.

---

### IAP (iOS)

| Variable                  | Used In                                                           | Validation                                                                                        |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `APPLE_BUNDLE_ID`         | `server/src/lib/env.ts`, `server/src/routes/payments.ts`          | Production now hard-fails if missing; signed Apple transaction verification depends on it         |
| `APPLE_IAP_SHARED_SECRET` | `server/src/routes/payments.ts` (legacy Apple receipt validation) | Optional fallback for older receipt flows; signed transaction verification still works without it |

**Product IDs (must match App Store Connect):**

| ID        | Location                                           |
| --------- | -------------------------------------------------- |
| `MIDTIER` | `hooks/useIAP.ts`, `server/src/routes/payments.ts` |
| `TOPTIER` | Same                                               |

**Status:** ✅ Correctly wired. Product IDs are consistent across client and server, and production now fail-fast checks that `APPLE_BUNDLE_ID` is present before boot.

---

### Google

| Variable                  | Used In                                                                                  | Validation                                    |
| ------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------- |
| `GOOGLE_OAUTH_CLIENT_IDS` | `server/src/routes/auth.ts` (Google token validation), `server/src/routes/health.ts`     | Comma-separated; used for audience validation |
| `GOOGLE_MAPS_API_KEY`     | `server/src/routes/geocoding.ts`, `server/src/lib/geocoding.ts`, `server/src/lib/geo.ts` | Server geocoding; health check                |

**Client (app.json):** `ios.config.googleMapsApiKey` and `android.config.googleMaps.apiKey` are set for Maps SDK.

**Status:** ✅ Correctly wired. Server and client both use Google config.

---

### Stripe

| Variable                  | Used In                                  | Validation                                        |
| ------------------------- | ---------------------------------------- | ------------------------------------------------- |
| `STRIPE_SECRET_KEY`       | `server/src/routes/payments.ts`          | Required for checkout; server warns if missing    |
| `STRIPE_WEBHOOK_SECRET`   | Same (webhook handler)                   | Server warns if missing                           |
| `STRIPE_PRICE_VETERAN`    | `server/src/lib/planLimits.ts`, payments | Required for Veteran checkout                     |
| `STRIPE_PRICE_LEGEND`     | Same                                     | Required for Legend checkout                      |
| `STRIPE_PRICE_AD_WEEKDAY` | `server/src/routes/payments.ts`          | Ad checkout (optional if using inline price_data) |
| `STRIPE_PRICE_AD_WEEKEND` | Same                                     | Ad checkout                                       |

**Status:** ✅ Correctly wired. `RAILWAY_ENV_SETUP.md` shows production has these set.

---

## 2. App Store Connect — Code Config ✅

### IAP Products

| Item      | Code Reference                                     |
| --------- | -------------------------------------------------- |
| `MIDTIER` | `hooks/useIAP.ts`, `server/src/routes/payments.ts` |
| `TOPTIER` | Same                                               |

**Status:** ✅ Product IDs match across codebase. Must match App Store Connect exactly.

---

### App-Specific Shared Secret

| Item                      | Code Reference                                           |
| ------------------------- | -------------------------------------------------------- |
| `APPLE_BUNDLE_ID`         | `server/src/lib/env.ts`, `server/src/routes/payments.ts` |
| `APPLE_IAP_SHARED_SECRET` | `server/src/routes/payments.ts`                          |

**Status:** ✅ Server reads both env vars. `APPLE_BUNDLE_ID` is required for signed StoreKit verification; `APPLE_IAP_SHARED_SECRET` is optional legacy fallback.

---

### Privacy Policy URL

| Item                 | Location                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `NSPrivacyPolicyURL` | `app.json` → `ios.infoPlist.NSPrivacyPolicyURL` = `https://varsityhub.app/privacy-policy` |

**Status:** ✅ Set in app.json.

---

### Screenshots, Description, Metadata

**Status:** Configured in App Store Connect (not in code). No code changes needed.

---

## 3. Health Check

The `/health` endpoint returns detailed `integrations` **only when the request is authenticated as an admin**. Unauthenticated requests get `{ status: 'ok', timestamp }` only.

To verify integrations (as admin):

```bash
# Get token from sign-in, then:
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "https://api-production-8ac3.up.railway.app/health" | jq .integrations
```

**Integrations reported:**

| Key           | Env Var(s)                                                           |
| ------------- | -------------------------------------------------------------------- |
| `database`    | DATABASE_URL                                                         |
| `jwt`         | JWT_SECRET                                                           |
| `cloudinary`  | CLOUDINARY\_\* (all 3)                                               |
| `stripe`      | STRIPE_SECRET_KEY                                                    |
| `sendgrid`    | SENDGRID_API_KEY + required templates (VERIFICATION, PASSWORD_RESET) |
| `googleOAuth` | GOOGLE_OAUTH_CLIENT_IDS                                              |
| `googleMaps`  | GOOGLE_MAPS_API_KEY                                                  |

**Note:** `/health` now reports Apple IAP readiness from `APPLE_BUNDLE_ID`, plus a separate legacy-receipt flag for `APPLE_IAP_SHARED_SECRET`.

---

## 4. Summary

| Category        | Code Wiring         | Railway Values                                                                                                 |
| --------------- | ------------------- | -------------------------------------------------------------------------------------------------------------- |
| Email           | ✅                  | Confirm in Railway dashboard                                                                                   |
| Cloudinary      | ✅                  | RAILWAY_ENV_SETUP.md shows ✅                                                                                  |
| IAP             | ✅                  | Confirm `APPLE_BUNDLE_ID` in Railway; optionally confirm `APPLE_IAP_SHARED_SECRET` for legacy receipt fallback |
| Google          | ✅                  | RAILWAY_ENV_SETUP.md shows ✅                                                                                  |
| Stripe          | ✅                  | RAILWAY_ENV_SETUP.md shows ✅                                                                                  |
| Privacy Policy  | ✅ In app.json      | —                                                                                                              |
| IAP Product IDs | ✅ MIDTIER, TOPTIER | Must match App Store Connect                                                                                   |

**Verdict:** The codebase is correctly configured for all checklist items. Variable names, fallbacks, and validation logic are consistent. To confirm production values, run the health check as admin or verify in Railway dashboard.
