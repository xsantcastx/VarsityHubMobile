# VarsityHubMobile — Surgical Fixes for Broken Features

**Date:** 2026-04-02
**Status:** Approved
**Scope:** 5 isolated end-to-end fixes for features that were built but never fully wired up

## Context

The app is live in the App Store. Core features (feed, teams, highlights, profiles) work. Five features are broken because the client-server integration was never completed end-to-end. Each fix below targets the exact broken link in the chain.

---

## Fix 1: Push Notification Token Registration

**Problem:** Server sends push notifications for messages, approvals, comments, join requests, etc. — but the user's Expo push token is never saved to the database. Every push notification silently fails.

**Root Cause:** No endpoint to persist the device's Expo push token, and no client-side call to register it.

**Changes:**

- **Server:** Add `POST /auth/register-push-token` endpoint
  - Accepts `{ pushToken: string }` in request body
  - Validates it looks like an Expo push token (`ExponentPushToken[...]`)
  - Saves to `user.preferences.push_token` in the database
  - Requires authentication (JWT)
- **Client:** After successful login/app launch in `AuthProvider`, request notification permissions via `expo-notifications`, get the Expo push token, and call the new endpoint
- **Effect:** Unlocks ALL existing push notification sends across the entire app — no other notification code needs to change

---

## Fix 2: Stripe Price IDs in Production

**Problem:** Stripe checkout fails because `STRIPE_PRICE_VETERAN` and `STRIPE_PRICE_LEGEND` environment variables are not set in Railway. The server logs "Stripe price ID not configured" and the checkout session creation fails.

**Root Cause:** Placeholder/missing env vars in production.

**Changes:**

- **Railway:** Set `STRIPE_PRICE_VETERAN` to the real Stripe price ID for the Veteran plan ($1/mo recurring)
- **Railway:** Set `STRIPE_PRICE_LEGEND` to the real Stripe price ID for the Legend plan ($20/yr recurring)
- **Verification:** Confirm checkout flow creates valid Stripe sessions on Android
- **Note:** iOS uses Apple IAP (separate flow) — this fix is Android-only

---

## Fix 3: Ungate Admin Dashboard

**Problem:** The admin dashboard screen (`admin-dashboard.tsx`) is gated behind a `ComingSoon` component. This means admins cannot access the UI to approve leagues/organizations.

**Root Cause:** The screen was intentionally gated pre-launch and never ungated.

**Changes:**

- **Client:** Remove the `ComingSoon` re-export from `admin-dashboard.tsx` so the actual dashboard renders
- **Verification:** Confirm admin users can see and interact with the league approval UI
- **Guard:** Ensure the screen still has proper admin role checks (it does — server enforces admin-only on the endpoints)

---

## Fix 4: Admin Coach Approval — Create Org Membership

**Problem:** When a platform admin approves a coach via `POST /admin/coaches/:id/approve`, it sets `user.approval_status = 'APPROVED'` but does NOT create an organization membership. The coach is "approved" but has no team affiliation — they're stuck.

**Root Cause:** The admin approval path (`server/src/routes/admin.ts:173-233`) was written separately from the org-owner approval path (`server/src/routes/organizations.ts:1689-1838`) and doesn't create the membership record.

**Changes:**

- **Server:** In the admin coach approval handler, after setting `approval_status = APPROVED`:
  - Look up the coach's pending join request (if one exists)
  - Create the organization membership record
  - Mark the join request as approved
- **Fallback:** If no join request exists (coach was added directly by admin), create membership with the organization specified in the approval context
- **Verification:** After admin approval, coach should appear in the org's member list and have team access

---

## Fix 5: Messaging Conversation Threading

**Problem:** Message sending works (`POST /messages`), but the conversation UI may not properly create or retrieve conversation threads, leading to messages that appear to vanish.

**Root Cause:** Needs end-to-end audit — the server has conversation support but the client may not be creating conversations before sending messages, or not fetching them correctly.

**Changes:**

- **Audit:** Trace the full flow: open chat → create/fetch conversation → send message → display in thread
- **Client:** Ensure conversation is created (or fetched) before first message send
- **Client:** Ensure message list queries by `conversation_id` and displays in order
- **Verification:** Send a message between two users and confirm both see it in the conversation

---

## Out of Scope

- No refactoring of working features
- No new features
- No TypeScript strict mode
- No test coverage additions
- No UI redesigns

## Risk Assessment

All fixes are isolated. None affect each other or existing working features. The highest-risk fix is #4 (coach approval membership creation) since it modifies a write path — but it's additive (creates a record that was missing), not destructive.
