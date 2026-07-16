# Cloudflare Turnstile on Auth Forms — Design

**Date:** 2026-07-16
**Status:** Approved (design), pending implementation plan
**Author:** Security-audit follow-up (@thedslabs pre-launch checklist, Section 05)

## Problem

The pre-launch security audit flagged that VarsityHub's unauthenticated,
paid-API-triggering auth endpoints have no bot/abuse protection beyond IP and
per-email rate limiting:

- `POST /auth/register` — unauth, fires a SendGrid verification email per call.
  Per-email cap is tight (5/15min) but per-IP is only 30/15min (prod-only), so
  an attacker rotating source IPs + emails can sustain metered SendGrid sends.
- `POST /auth/password/forgot` — unauth, fires a SendGrid reset email (only when
  the account exists, but still an unauth paid trigger).

The audit's real threat is **scripted direct-API abuse** (`curl`/botnet hitting
the endpoint), not a bot filling out the web form. This constrains the design:
Turnstile only closes the vector if the **server requires a valid token**, which
means every legitimate client — web _and_ native — must produce one.

## Non-Goals

- Login is **out of scope** for v1. It already has account lockout
  (5 fails → 15-min 429) plus per-email and per-IP limits, so Turnstile there is
  low-value and adds friction to the most-used form. Adaptive
  "Turnstile-after-N-failed-logins" is a clean later addition, not part of this
  work.
- No change to the existing rate limiters — Turnstile is defense-in-depth on top
  of them, not a replacement.
- The `/register` user-enumeration tell (`EMAIL_ALREADY_REGISTERED`) is a
  separate, larger flow-redesign item (register auto-logs-in with tokens); it is
  tracked separately and only _mitigated_ by this work (Turnstile blocks the
  automated enumeration that makes the tell useful).

## Decisions (settled during brainstorming)

1. **Coverage: full, server-enforced.** The server rejects register/forgot calls
   without a valid Turnstile token (when enforcement is on). Native produces a
   token via a WebView bridge. Web-only enforcement was rejected — it provides
   ~zero protection against a direct-API attacker who simply omits the token.
2. **Rollout: env-flag gated.** Server enforcement is gated behind
   `TURNSTILE_ENFORCED` (default off = monitor mode). Client token code ships
   first; the flag is flipped on only once capable clients are live. This avoids
   breaking signups on older app runtimes (1.0.4 is still in production
   alongside 1.0.5). Instantly reversible.
3. **Widget mode: managed.** Cloudflare decides whether to challenge; invisible
   for the vast majority of users, interactive only when suspicious.
4. **Scope: `register` + `password/forgot` only.**

## Architecture

### Server (`server/src/`)

**`lib/turnstile.ts`** — verification helper.

- `verifyTurnstile(token: string, remoteIp?: string): Promise<{ ok: boolean; reason?: string; unreachable?: boolean }>`
- POSTs `secret` + `response` (+ `remoteip`) to
  `https://challenges.cloudflare.com/turnstile/v0/siteverify`.
- 5s timeout. `siteverify` is free — no wallet concern.
- Distinguishes three outcomes: **valid**, **invalid/expired token**, and
  **siteverify unreachable** (network/timeout). The last is surfaced via
  `unreachable: true` so the middleware can fail open.
- Reads `TURNSTILE_SECRET_KEY` from env via the existing `lib/env.ts` validation
  (required only when `TURNSTILE_ENFORCED` is true; optional otherwise so dev and
  monitor mode work without a secret).

**`middleware/requireTurnstile.ts`** — enforcement middleware.

- Reads the token from the request body field `captcha_token`.
- Behavior gated by `TURNSTILE_ENFORCED` (parsed once at boot):
  - **off (monitor, default):** if a token is present, verify and log the result
    (pass/fail/unreachable) for observability; **never block**. If absent, pass
    through silently.
  - **on (enforced):** require a valid token.
    - missing token → `403 { errorCode: 'TURNSTILE_REQUIRED' }`
    - invalid/expired token → `403 { errorCode: 'TURNSTILE_FAILED' }`
    - siteverify unreachable → **fail open**, log + emit an alert breadcrumb, and
      pass through. Rationale: a forged token is rejected, but a Cloudflare
      outage must not lock legitimate users out of signup/reset.
- Mounted specifically on `POST /auth/register` and `POST /auth/password/forgot`
  (per-route, not the whole auth router).

**`routes/auth.ts`** — wiring.

- Add optional `captcha_token: z.string().optional()` to `registerSchema` and the
  forgot-password schema, so the field validates in every mode and older clients
  that omit it never fail schema validation.
- Insert `requireTurnstile` in the middleware chain for the two routes, before
  the existing handler, after the existing per-email rate-limit checks.

### Client

**`lib/turnstile/getTurnstileToken.ts`** — unified entry point.

- `getTurnstileToken(): Promise<string | null>` — called immediately before
  submit in `app/sign-up.tsx` and `app/forgot-password.tsx`. Returns `null` if
  the site key is unset (monitor mode / misconfig) so the caller still submits;
  the server decides whether that's acceptable.
- Platform-split implementation:
  - **Web** (`Platform.OS === 'web'`): loads Cloudflare `api.js`, renders the
    managed widget (invisible container), resolves the token from the callback.
    Fetches a fresh token per submit (tokens are single-use, 300s TTL).
  - **Native**: renders `components/TurnstileWebView.tsx`
    (react-native-webview@13.15.0, already a dependency) hosting a minimal inline
    HTML page with the managed widget; the page `postMessage`s the token back to
    RN. Invisible unless Turnstile escalates to a visible challenge, which is then
    shown modally.

**Config**

- `EXPO_PUBLIC_TURNSTILE_SITE_KEY` in `app.config.js` `extra` — public/publishable
  site key, correct to ship in the client bundle (consistent with the audit's
  public-vs-secret-key finding).

## Data Flow

1. User submits Sign Up (or Forgot Password).
2. Client calls `getTurnstileToken()` → obtains token (web widget or native
   WebView), attaches it as `captcha_token` in the POST body.
3. Server `requireTurnstile` middleware:
   - monitor mode → verify (if present) + log, always continue.
   - enforced → verify; block on missing/invalid, fail-open on unreachable.
4. On pass, the existing register/forgot handler runs unchanged.
5. On block (enforced), client receives `403 TURNSTILE_REQUIRED|TURNSTILE_FAILED`,
   resets the widget, and lets the user retry.

## Error Handling

| Condition                      | Monitor mode           | Enforced mode                     |
| ------------------------------ | ---------------------- | --------------------------------- |
| No token                       | pass through           | `403 TURNSTILE_REQUIRED`          |
| Invalid / expired token        | log fail, pass through | `403 TURNSTILE_FAILED`            |
| siteverify unreachable/timeout | log, pass through      | log + alert, **fail open** (pass) |
| Valid token                    | log pass, continue     | continue                          |

- Turnstile tokens are single-use and expire in ~300s; the client always fetches
  a fresh token per submit and resets the widget after a rejected attempt.
- No token value is logged; only pass/fail/unreachable outcome + reason code.

## Testing

- **Server unit** (`requireTurnstile`, `verifyTurnstile`) using Cloudflare's
  official test keys: always-pass site key `1x00000000000000000000AA`,
  always-fail `2x00000000000000000000AB`, dummy secret
  `1x0000000000000000000000000000000AA` (and always-fail secret variant).
  Assert: monitor passes through in all cases; enforced blocks missing + invalid,
  allows valid; unreachable fails open (mock the fetch to throw/timeout).
- **Client unit:** `getTurnstileToken` with a mocked widget/WebView bridge.
- **E2E:** register against local `:4000` with the always-pass test site key,
  `TURNSTILE_ENFORCED=true`, asserting a tokenless call is 403 and a
  test-token call succeeds.

## Rollout Sequence

1. Merge server (deploys in **monitor mode** — verifies but never blocks) + client
   token code.
2. OTA both runtimes (1.0.4 + 1.0.5) and confirm capable clients are live.
3. Set `TURNSTILE_ENFORCED=true` on Railway → hard enforcement. Reversible
   instantly by flipping the flag back to off.

## Owner-Provided Prerequisites (cannot be automated here)

Cloudflare dashboard → Turnstile → create a widget:

- Add the web domains (`varsityhub.app`, any staging) and a mobile hostname entry.
- Widget mode: **Managed**.
- Produces a **site key** (public → `app.config.js` extra
  `EXPO_PUBLIC_TURNSTILE_SITE_KEY`) and a **secret key**
  (→ Railway env `TURNSTILE_SECRET_KEY`).
- Also set Railway `TURNSTILE_ENFORCED=false` initially.

## Files Touched

**New**

- `server/src/lib/turnstile.ts`
- `server/src/middleware/requireTurnstile.ts`
- `server/src/__tests__/turnstile-middleware.test.ts`
- `lib/turnstile/getTurnstileToken.ts` (+ `.web` / native split)
- `components/TurnstileWebView.tsx`

**Edited**

- `server/src/routes/auth.ts` — optional `captcha_token` in schemas; mount
  middleware on the two routes.
- `server/src/lib/env.ts` — `TURNSTILE_SECRET_KEY` (conditionally required),
  `TURNSTILE_ENFORCED` (boolean, default false).
- `app/sign-up.tsx` — call `getTurnstileToken()` before submit.
- `app/forgot-password.tsx` — call `getTurnstileToken()` before submit.
- `app.config.js` — `EXPO_PUBLIC_TURNSTILE_SITE_KEY` in `extra`.
