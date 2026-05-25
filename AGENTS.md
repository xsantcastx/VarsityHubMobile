# VarsityHub — Agent Usage Guide

## Codex Context Model

- In Codex, spawned agents start isolated unless the caller explicitly forks context or includes the needed background in the task prompt.
- `AGENTS.md` is instruction input for the session, not a Claude-style lazy-loaded memory system. Do not assume nested `CLAUDE.md`-style composition by directory.
- If a subagent needs prior audit state, scope boundaries, or decisions already made in the main thread, pass that context directly instead of assuming inheritance.
- Put repo-wide workflow rules here. Put task-specific role instructions in the spawned agent prompt.

## Instruction Ownership

- `AGENTS.md` is the authoritative repo instruction file for Codex and Codex-spawned agents.
- `CLAUDE.md` is maintained for Claude Code and Claude-managed worktrees. It is not the live instruction source for Codex.
- Shared product facts that affect both tools must stay aligned across both files: stack, payments, navigation, server-side invariants, and deploy rules.
- If `AGENTS.md` and `CLAUDE.md` ever disagree, update both files rather than relying on one tool to infer intent from the other.

## Claude Worktree Hygiene

- `.claude/worktrees/` are local Claude worktrees and must never be pushed.
- Treat files under `.claude/` inside a linked worktree as Claude-local tooling unless they are intentionally tracked repo assets.
- Generated local artifacts such as `.snyk-cache/`, `metro.pid`, and Claude-local report output must not be treated as product changes.
- Before concluding a branch is dirty, distinguish tracked source changes from Claude-local worktree noise.

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
- **Don't run `git stash apply` directly** — use `npm run stash:apply`. A bare stash apply leaves conflict markers silently; the script scans and reports them immediately.
- **Don't `git add -A` when the working tree has unresolved conflicts** — always stage files explicitly by path after verifying each one.

## Git Workflow

```bash
# Apply a stash safely (scans for conflict markers after apply)
npm run stash:apply

# Check for unresolved conflict markers across all source files
npm run check:conflicts

# Format all source files with prettier
npm run format

# Pre-push checklist
npm run check:conflicts
npm run format:check
npx tsc --noEmit --project server/tsconfig.json
npm run verify:error-envelope
```
