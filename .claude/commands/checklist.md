Generate a pre-commit checklist of every file changed in the current working tree.

For each changed file:
1. File path and what was modified (one line)
2. What could break as a side effect
3. Whether it needs manual testing or can be verified with tsc/tests

Then run these automated checks (from CLAUDE.md Quick Checks):
- `npx tsc --noEmit --project server/tsconfig.json 2>&1 | tail -20` (if server files changed)
- `grep -rn "req.user" server/src/routes/ --include="*.ts" | grep -v requireAuth` (if routes changed)
- `grep -rn "findMany" server/src/ --include="*.ts" | grep -v "take"` (if DB queries changed)

Output a go/no-go summary. Remember: Railway auto-deploys from main — a bad push is an instant production outage.
