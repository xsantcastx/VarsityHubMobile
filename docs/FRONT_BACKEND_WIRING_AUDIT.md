# Frontend–Backend Wiring Audit

**Date:** 2026-03-18  
**Scope:** Verify every logic pipeline and API wiring between the VarsityHub mobile app (Expo/React Native) and the Node/Express API server.

---

## 1. Summary

| Area | Status | Notes |
|------|--------|------|
| Auth (login, register, OAuth, /me, refresh, password) | ✅ Wired | Client uses `/me`; server mounts `/me` and `/auth`; `auth_provider` in /me used by reset-password |
| User (PATCH /me, preferences, onboarding, deleteAccount) | ✅ Wired | updateMe → PUT /auth/me; patchMe → PATCH /me; deleteAccount sends body `{ password }` |
| Events (list, pending, approve, reject, RSVP, my-rsvps) | ✅ Wired | event-approvals uses GET /events/pending, PUT approve/reject; Event API matches server |
| Teams (list, create, invites, accept/decline, members) | ✅ Wired | Team.* and TeamMemberships.* map to server routes |
| Organizations (join-requests/me, approve, deny) | ✅ Wired | Organization.* and event-approvals load; approve/deny in organization-join-requests |
| Posts, Games, Notifications, Messages | ✅ Wired | api/posts, games, notifications, messages match server route surface |
| Ads (create, reserve, submit-for-approval, for-feed) | ✅ Wired | App-level POST /ads/:id/submit-for-approval before ads router; Advertisement.* in misc.ts |
| Payments (config, checkout, finalize-session, webhook, IAP verify) | ✅ Wired | Stripe webhook raw body; useIAP/useAdIAP call verify-receipt, verify-ad-receipt, verify-purchase |
| Promos (preview, redeem) | ✅ Wired | ad-calendar and billing use httpPost /promos/preview and /promos/redeem |
| Uploads (Cloudinary signature, avatar, files) | ✅ Wired | api/upload.ts and server uploads router |
| Admin (dashboard, reports, bulk-update, bulk-delete) | ✅ Wired | admin-dashboard, admin-reports use httpGet/httpPost /admin/* |
| Geocoding, Search, Reports, Support, Highlights | ✅ Wired | api/geocoding, misc (Search, Report, Support, Highlights) |
| Group-chats | ✅ Wired | Client `api/groupChats.ts` (GroupChat.list, getMessages, sendMessage, markRead, create); UI can use when feature is built |
| Standalone GET /rsvps | ℹ️ Optional | Frontend uses GET /events/my-rsvps for “my RSVPs”; GET /rsvps exists for other use (e.g. admin) |

---

## 2. Auth Pipeline

- **Client:** `api/auth.ts` — `register`, `login`, `loginWithGoogle`, `loginWithApple` → POST `/auth/register`, `/auth/login`, `/auth/google`, `/auth/apple`. Tokens stored via SecureStore/localStorage; `me()` → GET `/me`; `refreshToken()` → POST `/auth/refresh` (direct fetch).
- **Server:** `app.use('/auth', authRouter)`; `app.get('/me', ...)` forwards to authRouter so GET `/me` and GET `/auth/me` both hit same handler. Response includes `auth_provider` (`'apple' | 'google' | 'apple,google'`).
- **Reset password / linked accounts:** `app/settings/reset-password.tsx` uses `auth_provider` (or derives from `apple_id`/`google_id`) to show correct copy for OAuth/linked accounts.

---

## 3. Critical Paths Verified

- **DELETE /users/me (delete account):** Client `User.deleteAccount(password)` → `httpDelete('/users/me', { password })`. Server expects `req.body.password`; schema and bcrypt check confirm; body sent via `httpDelete` in api/http.ts.
- **Event approvals:** `event-approvals.tsx` → GET `/events/pending`, PUT `/events/:id/approve`, PUT `/events/:id/reject`. Server has `eventsRouter.get('/pending')`, `put('/:id/approve')`, `put('/:id/reject')`.
- **Ad submit-for-approval:** Client `Advertisement.submitForApproval(id, dates)` → POST `/ads/:id/submit-for-approval` with `{ dates }`. Server registers this route on `app` before `app.use('/ads', adsRouter)` so it is hit correctly.
- **Stripe webhook:** `/payments/webhook` uses raw body parser (registered before `express.json()`) for signature verification; rest of app uses JSON.

---

## 4. Environment & Startup

- **Server:** `server/src/lib/env.ts` validates required vars (e.g. `DATABASE_URL`, `JWT_SECRET`); optional services (Cloudinary, SMTP, Google OAuth, etc.) checked in config-validator. Apple IAP uses `process.env.APPLE_IAP_SHARED_SECRET` in payments.ts (not in env schema; optional for iOS IAP).
- **Client:** `api/http.ts` `getApiBaseUrl()` uses `EXPO_PUBLIC_API_URL` or app config; defaults to production Railway URL when not localhost.

---

## 5. Gaps / Follow-ups (resolved)

1. **Group-chats:** ✅ Added `api/groupChats.ts` with `GroupChat.list`, `getMessages`, `sendMessage`, `markRead`, `create`; exported from `api/entities.ts`. UI can call when feature is built.
2. **APPLE_IAP_SHARED_SECRET:** ✅ Added to server `lib/env.ts` as optional env var (with comment); deployers see it in schema and docs.
3. **Wiring smoke:** ✅ Added to `server/scripts/load/p0-load-smoke.ts`: scenarios `wiring/me`, `wiring/events-pending`, `wiring/payments-config` (GET /me, GET /events/pending, GET /payments/config). Run with `LOAD_TEST_TOKEN` for 200s or without for 401s.

---

## 6. Quick Reference: Client → Server Paths

| Client (api/* or screen) | Method + Path | Server route |
|-------------------------|---------------|--------------|
| auth.me() | GET /me | app.get('/me') → authRouter |
| User.updateMe | PUT /auth/me | authRouter.put('/me') |
| User.patchMe | PATCH /me | app.patch('/me') → authRouter |
| User.deleteAccount | DELETE /users/me (body: { password }) | usersRouter.delete('/me') |
| Event.filter, .get, .rsvp, .myRsvps | GET/POST /events/* | eventsRouter |
| event-approvals | GET /events/pending, PUT .../approve, .../reject | eventsRouter |
| Team.acceptInvite, declineInvite | POST /teams/invites/:id/accept, decline | teamsRouter |
| Organization.approveJoinRequest, rejectJoinRequest | POST /organizations/join-requests/:id/approve, deny | organizationsRouter |
| Subscriptions.finalizeSession | POST /payments/finalize-session | paymentsRouter |
| useIAP (iOS) | POST /payments/apple/verify-receipt | paymentsRouter |
| useIAP (Android) | POST /payments/google/verify-purchase | paymentsRouter |
| useAdIAP | POST /payments/apple/verify-ad-receipt | paymentsRouter |
| Advertisement.submitForApproval | POST /ads/:id/submit-for-approval | app.post (before ads router) |
| GroupChat.list, getMessages, sendMessage, markRead, create | GET/POST /group-chats/* | groupChatsRouter |

All verified paths match; no critical wiring issues found.
