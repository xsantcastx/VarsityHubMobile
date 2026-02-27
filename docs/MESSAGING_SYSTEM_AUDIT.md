# Messaging System Audit

**Date:** February 23, 2026  
**Scope:** Direct messages (DMs) between users

---

## 1. Can Two Users Send Messages to Each Other?

### ✅ Yes
- **API:** `POST /messages` with `{ content, recipient_id | recipient_email | conversation_id }`
- **Conversation ID:** Auto-generated as `dm:{smallerUserId}__{largerUserId}` for consistent threading
- **Lookup:** Recipient can be specified by `recipient_id` (user ID) or `recipient_email`

### Restrictions
- **Blocking:** If either user has blocked the other, messaging returns `403 MESSAGE_BLOCKED`
- **Age policy:** Users under 18 (based on `preferences.dob`) may only message accounts they **follow**. Returns `403 AGE_POLICY_BLOCKED` if minor tries to message a non-followed user.
- **DM restrictions:** Frontend runs `checkDMRestriction()` before send (e.g., school/league rules); can block or warn.

---

## 2. Real-Time vs Refresh

### Message Thread (Conversation View) — Polling
- **Polling interval:** Every **3 seconds** while the conversation is open
- **Implementation:** `message-thread.tsx` lines 91–115 — `setInterval` fetches `MessageApi.threadByConversation()` or `threadWith()`
- **Result:** Near real-time; new messages appear within ~3 seconds without manual refresh

### Messages List (Inbox) — No Polling
- **Load triggers:** On mount and when screen gains focus (`useFocusEffect`)
- **Result:** User must navigate away and back (or pull-to-refresh if implemented) to see new conversations or unread counts. No automatic refresh while viewing the inbox.

### No WebSocket/Push
- No WebSocket or Server-Sent Events for live message delivery
- Push notifications are sent when a message is received (`notifyNewMessage`), but in-app message list does not update until the user refocuses the screen

---

## 3. What Happens If a Message Fails to Send?

### ⚠️ User Loses Message Content
- **Flow:** `setText('')` is called **before** the API request (`message-thread.tsx` line 139)
- **On failure:** `catch` sets `setError('Failed to send message')` but the input is already cleared
- **Result:** The user sees an error toast/state but **cannot retry** — the message text is gone

### No Retry or Draft Persistence
- No optimistic UI with rollback on failure
- No local draft storage for failed messages
- No "Retry" action that reuses the last failed message

---

## 4. Rate Limiting on Messages

### Message-Specific Limiter (Defined but Not Applied)
- **`messageLimiter`** in `rateLimiters.ts`: 60 messages per minute per user (production)
- **Usage:** Exported in `rateLimiters` object but **not applied** to the messages router
- **Current setup:** `app.use('/messages', noStore, apiLimiter, messagesRouter)` — only `apiLimiter` is used

### apiLimiter (What Actually Applies)
- **Limit:** 2000 requests per 15 minutes per IP (production)
- **Scope:** All `/messages` endpoints (GET list, GET thread, POST send, POST mark-read)
- **Result:** Effectively no dedicated message send rate limit. A user could send many messages quickly until they hit the general 2000/15min API cap.

---

## Summary

| Question | Answer |
|----------|--------|
| Can two users send messages? | ✅ Yes, with blocking and age-policy checks |
| Real-time or refresh? | Polling every 3s in thread; inbox requires focus/refresh |
| Failed send handling? | ⚠️ Message text is lost; only generic error shown |
| Rate limiting? | ⚠️ `messageLimiter` (60/min) defined but not applied; only general `apiLimiter` |

---

## Recommendations

1. **Preserve message on send failure:** Move `setText('')` to after a successful send, or use optimistic UI with rollback so the user can retry.
2. **Apply message rate limiter:** Add `messageLimiter` to `POST /messages` (e.g. `messagesRouter.post('/', messageLimiter, ...)`) to enforce 60 messages/min.
3. **Inbox refresh:** Add pull-to-refresh and/or periodic polling on the messages list when it has focus.
4. **Real-time (optional):** Consider WebSockets or SSE for instant message delivery instead of 3s polling.
