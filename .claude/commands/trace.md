Trace the actual execution path for the described issue. Do NOT guess or do surface-level code review.

Follow the CLAUDE.md debugging approach:
1. Trace the real data flow: button tap -> API call -> middleware -> handler -> DB -> response -> client state
2. Check contract mismatches between client TypeScript types and server Zod schemas
3. Check env vars, Railway logs, and build configs — not just source code

For each step in the trace:
- Show the exact file and line number
- Show what data enters and exits
- Identify WHERE the expected behavior diverges from actual behavior

Do not propose fixes until the root cause is identified. Show evidence, not speculation.

$ARGUMENTS
