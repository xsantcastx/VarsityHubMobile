Run a full quick audit across the codebase. Output a single summary table with pass/fail for each check.

Checks to run:

1. **TypeScript (server)** — `npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -5`
2. **Hardcoded dark colors** — `grep -rn "'#000\|'#333\|'#374151\|'#111\|black" app/ --include="*.tsx" | grep -v backgroundColor | grep -v overlay` (should be 0 for text colors)
3. **Unbounded queries** — `grep -rn "findMany" server/src/ --include="*.ts" | grep -v "take"` (every findMany needs a take limit)
4. **Missing requireAuth** — `grep -rn "req.user" server/src/routes/ --include="*.ts"` cross-referenced with requireAuth middleware (all routes accessing req.user must have it)
5. **Direct sgMail usage** — `grep -rn "sgMail.send" server/src/ --include="*.ts"` (should only be in email.ts, all others must use EmailService)
6. **Console.log in routes** — `grep -rn "console.log" server/src/routes/ --include="*.ts" | wc -l` (should be minimal, stripped in production but clutters dev)
7. **DB integrity** — `npx tsx server/scripts/db-integrity-check.ts 2>&1 | tail -10`

After running all checks, output:
| Check | Status | Issues |
