Stop patching symptoms. Find the root cause.

Follow CLAUDE.md rules:
- Be surgical — only change what's needed
- Fix real bugs, not theoretical issues
- When the fix is in one file, don't touch five

Steps:
1. Read the error or unexpected behavior described
2. Trace backward from the symptom to the origin — what called this with bad data? What called THAT?
3. Keep tracing until you find the SOURCE, not an intermediate handler
4. Explain the root cause in 2-3 sentences with exact file:line references
5. Propose the minimal fix at the source — not at the symptom

If the root cause is a contract mismatch between client types and server Zod schemas, say so. They compile independently and can silently diverge.

$ARGUMENTS
