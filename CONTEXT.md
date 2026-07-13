# VarsityHub — Context

> There are two maintained instruction files in this repo.
> `CLAUDE.md` is the authoritative context file for Claude Code.
> `AGENTS.md` is the authoritative repo instruction file for Codex.
> Shared product facts must stay aligned across both files.

## What The Instruction Files Contain

- `CLAUDE.md`: Claude-specific workflow rules plus shared project facts
- `AGENTS.md`: Codex/subagent usage rules plus shared project facts
- Shared facts include the tech stack, deploy rules, payments, navigation, and server-enforced invariants
- Tool-specific behavior belongs in the tool-specific file, not in ad-hoc conversation memory

## What CLAUDE.md Contains

- Tech stack (Expo SDK 54, Express/Prisma/Railway, EAS)
- Hard rules (no eas build, no Expo Go, no Railway env changes)
- Debugging approach (trace real data flows, test against real API)
- Production must-not-break list (live iOS app)
- Security constraints already enforced server-side
- Navigation architecture (safeGoBack, hiddenTab pattern)
- Plan tiers (Rookie / Veteran / Legend)
- Known quirks (iOS bundle ID typo, Cloudinary creds, TS pre-existing errors)
- Working style (surgical changes only, no speculative abstractions)

## How Context Loads

1. Claude Code: `CLAUDE.md` is the primary repo instruction file
2. Codex: `AGENTS.md` is the primary repo instruction file
3. `memory/MEMORY.md` is Claude-local memory, not a cross-tool source of truth
4. `SKILLS.md` is supporting reference material, not the primary repo policy file

## When to Update CLAUDE.md

- After a major architectural change (new state provider, new auth flow)
- After a production incident that produces a new hard rule
- After a security fix that changes what's safe to bypass
- Run `/revise-claude-md` (claude-md-management plugin) after big feature releases, then sync any shared fact changes into `AGENTS.md`

## When To Update AGENTS.md

- After Codex agent workflow changes or new subagent expectations
- After repo-wide engineering rules change for code search, delegation, verification, or safety
- Whenever a shared product invariant changes and `CLAUDE.md` was updated too
