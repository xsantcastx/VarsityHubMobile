# VarsityHub — Agent Usage Guide

## Available Agent Types

### Explore
**When to use:** Finding files by pattern, searching code for keywords, answering "how does X work" questions.
**Example tasks:**
- "Where are all the places we call `sendPushNotification`?"
- "How does the refresh token flow work end to end?"
- "Find all screens that use `useLocalSearchParams`"

### Plan
**When to use:** Before any non-trivial feature or refactor. Use this to design the approach before touching code.
**Example tasks:**
- "Plan how to add a game scheduling feature"
- "How should I restructure the onboarding flow to support a new role type?"
- "What's the safest way to migrate the ad booking logic?"

### general-purpose (default)
**When to use:** Multi-step tasks that involve reading, editing, and running commands together.
**Example tasks:**
- "Fix the coach approval flow end to end"
- "Debug why push notifications aren't arriving"
- "Audit the admin dashboard for security gaps"

### claude-code-guide
**When to use:** Questions about Claude Code itself — hooks, slash commands, MCP servers, plugins, settings.

---

## VarsityHub-Specific Agent Patterns

### Debugging a server issue
1. Start with Explore to find the relevant route (`server/src/routes/`)
2. Trace the full data flow: client call → middleware → handler → Prisma → response
3. Check Railway logs for the relevant log prefix (`[org-get]`, `[notif]`, etc.)
4. Test with a real API payload — don't rely on static analysis

### Adding a new screen
1. Use Plan agent first to decide: tab screen or sub-screen? root Stack or hiddenTab?
2. Register in `app/_layout.tsx` (root Stack) AND `app/(tabs)/_layout.tsx` (hiddenTab) if it's a sub-screen
3. Use `safeGoBack` for back navigation, never raw `router.back()`
4. Add `headerShown: false` and implement your own back button

### Touching the server (Express routes)
- Server is at `server/src/routes/`
- Middleware: `authMiddleware` (JWT + DB lookup), `requireAuth`, `requireVerified`, `requireOnboarded`
- Business rules are enforced server-side — don't bypass with client flags
- Railway auto-deploys from `main` — test locally first with `railway run npm run dev`

### Touching the email system
- Required templates (server exits if missing): VERIFICATION, PASSWORD_RESET, TEAM_INVITE, ORG_INVITE, BILLING_NOTICE
- All other templates degrade silently — always add a plain-text fallback
- Email functions are in `server/src/lib/email.ts`
- BullMQ queue with concurrency 5, max 20/sec

### Payment changes
- iOS: Apple IAP only — never add Stripe links on iOS paths
- Android: Stripe PaymentSheet only
- Server enforces plan limits inside `$transaction` — race-condition safe
- Ad booking horizon is 56 days max — enforced server-side

### Push notification changes
- `sendPushNotification(userId, title, body, data)` in `server/src/lib/notifications.ts`
- Always `.catch(() => {})` — push failure must never block the main response
- Check `[notif]` log prefix in Railway for delivery confirmation

---

## Anti-Patterns (Don't Do These)

- Don't use Expo Go — always `npx expo run:ios` / `npx expo run:android`
- Don't run `eas build` or `eas submit` — costs credits, let the user run those
- Don't add client-side workarounds that bypass server-enforced rules
- Don't push to `main` without testing — Railway auto-deploys immediately
- Don't change Railway env vars (JWT_SECRET, OAuth keys) without understanding blast radius
