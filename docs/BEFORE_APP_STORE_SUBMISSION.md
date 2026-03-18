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

| Item | Where to check | Notes |
|------|----------------|-------|
| **Production API URL** | EAS production env / `.env` | Should be `https://api-production-8ac3.up.railway.app` (or your live API). |
| **Stripe publishable key** | `eas.json` production env | Must be `pk_live_...` for real payments. Already in eas.json production profile. |
| **Sentry DSN** | `eas.json` production env | Optional but recommended; production profile has it. |
| **App Store Connect App ID** | `eas.json` → submit.production.ios.ascAppId | Must match the app in App Store Connect (`6758405187` in eas.json). |
| **Apple ID for submit** | `eas.json` → submit.production.ios.appleId | Used for `eas submit`. |

---

## 3. Legal & App Store requirements (already in place)

- **Privacy Policy URL**: `https://varsityhub.app/privacy-policy` (in app.json `NSPrivacyPolicyURL`).
- **Terms**: In-app screens at Settings → Privacy Policy / Terms of Service; docs in `docs/release/`.
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

## 7. Reference checklists (existing)

- **TestFlight / config**: `docs/TESTFLIGHT_PRE_SUBMISSION_CHECKLIST.md`
- **Go-live gate (P0)**: `docs/GO_LIVE_CHECKLIST.md`
- **Known issues**: `docs/CODEBASE_MAP.md` → Section 8 (KNOWN ISSUES)
- **Audit confirmation**: `docs/CODEBASE_MAP.md` → AUDIT CONFIRMATION (2026-03-18)

---

## Summary

- **Must do**: Run `validate:pre-launch` and `verify:release`; fix errors; confirm production API URL and Stripe key; ensure `ascAppId` in eas.json matches App Store Connect.
- **Should do**: Add accessibility labels to primary flows; run `verify:p0:foundation`; smoke-test on a real device after upload.
- **Already in place**: Privacy/Terms URLs, usage strings, encryption declaration, Apple Sign In, EAS production env (Stripe, Sentry).
