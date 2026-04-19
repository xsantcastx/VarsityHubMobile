# VarsityHub — Context

> The authoritative context file is **CLAUDE.md** in this directory.
> Claude Code loads it automatically at the start of every conversation.
> Edit CLAUDE.md directly to change project instructions.

## What CLAUDE.md Contains
- Tech stack (Expo SDK 55, Express/Prisma/Railway, EAS)
- Hard rules (no eas build, no Expo Go, no Railway env changes)
- Debugging approach (trace real data flows, test against real API)
- Production must-not-break list (live iOS app)
- Security constraints already enforced server-side
- Navigation architecture (safeGoBack, hiddenTab pattern)
- Plan tiers (Rookie / Veteran / Legend)
- Known quirks (iOS bundle ID typo, Cloudinary creds, TS pre-existing errors)
- Working style (surgical changes only, no speculative abstractions)

## How Context Loads
1. `CLAUDE.md` — auto-loaded from project root by Claude Code
2. `memory/MEMORY.md` — auto-loaded from `~/.claude/projects/.../memory/`
3. `AGENTS.md` — reference file, read on demand
4. `SKILLS.md` — reference file, read on demand

## When to Update CLAUDE.md
- After a major architectural change (new state provider, new auth flow)
- After a production incident that produces a new hard rule
- After a security fix that changes what's safe to bypass
- Run `/revise-claude-md` (claude-md-management plugin) after big feature releases
