Run a full quick audit across the codebase. Output a single summary table with pass/fail for each check.

Checks to run:

**TypeScript**
1. **TypeScript (server)** — `npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5`
2. **TypeScript (client)** — `npx tsc --noEmit 2>&1 | tail -5`

**Security**
3. **Missing requireAuth** — `grep -rn "req.user" server/src/routes/ --include="*.ts" | grep -v "requireAuth\|authMiddleware\|optional\|//"` (every route accessing req.user must be guarded)
4. **NODE_ENV used as auth gate** — `grep -rn "NODE_ENV.*production\|process.env.NODE_ENV" server/src/routes/ --include="*.ts"` (should be 0 — use requireAdmin middleware, not env checks)
5. **Local debugLog wrappers in routes** — `grep -rn "function debugLog\|const debugLog\s*=" server/src/routes/ --include="*.ts"` (should be 0 — import shared lib only)

**Data Integrity**
6. **Unbounded queries** — `grep -rn "findMany" server/src/ --include="*.ts" | grep -v "take"` (every findMany needs a take limit)
7. **DB integrity** — `npx tsx server/scripts/db-integrity-check.ts 2>&1 | tail -10`

**Architecture**
8. **Direct sgMail usage** — `grep -rn "sgMail.send" server/src/ --include="*.ts" | grep -v "providers/"` (should be 0 — use EmailService)
9. **Direct fetch in app screens** — `grep -rn "fetch(" app/ --include="*.tsx" | grep -v "prefetch\|useFetch\|// safe"` (screens must use API clients, not raw fetch)
10. **Error envelope violations** — `npm run verify:error-envelope 2>&1 | tail -5` (no raw res.status().json() in routes)

**Code Quality**
11. **Console.log in routes** — `grep -rn "console.log" server/src/routes/ --include="*.ts" | wc -l` (should be 0 — use debugLog or console.warn for audit events)
12. **Hardcoded dark text colors** — `grep -rn "'#000\|'#333\|'#374151\|'#111\|black" app/ --include="*.tsx" | grep -v backgroundColor | grep -v overlay | grep -v shadowColor` (should be 0 — use theme constants)

After running all checks, output a single table:

| # | Check | Status | Issues |
|---|-------|--------|--------|

Status must be one of: ✅ PASS | ⚠️ WARN | ❌ FAIL

Rules:
- FAIL = must fix before shipping (broken types, missing auth, unbounded queries, sgMail bypass, error envelope violations)
- WARN = should fix soon (console.log count > 0, NODE_ENV gates, local debugLog wrappers, direct fetch in screens)
- PASS = clean
