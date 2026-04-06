Pre-ship checklist. Run ALL checks and output a go/no-go summary.

1. **TypeScript (server)** — `npx tsc --noEmit --project server/tsconfig.json` — must be 0 new errors (known pre-existing errors in ads.ts are OK)
2. **DB integrity** — `npx tsx server/scripts/db-integrity-check.ts` — must pass all checks
3. **Security smoke** — `npx tsx server/scripts/security-smoke-tests.ts` — must pass
4. **No sensitive console.log** — grep routes for console.log that might leak tokens, passwords, emails, or API keys
5. **requireAuth coverage** — every route accessing req.user must have requireAuth middleware
6. **No unbounded findMany** — all findMany calls must have take limits
7. **OTA compatibility** — check that runtimeVersion policy is set (not a hardcoded string) and any new native modules are dynamically imported with try-catch
8. **No TODO/FIXME in routes** — `grep -rn "TODO\|FIXME" server/src/routes/ --include="*.ts"`

Output format:
| # | Check | Status | Details |
|---|-------|--------|---------|

Final line: **GO** or **NO-GO** with blockers listed.

Remember: Railway auto-deploys from main. A bad push is an instant production outage.
