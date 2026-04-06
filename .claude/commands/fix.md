When fixing a bug:

1. Read the relevant file(s) first — don't guess from memory
2. Trace the real data flow: button tap -> API call -> middleware -> handler -> DB -> response -> client state
3. Explain the root cause in 2-3 sentences before touching any code
4. Make the minimal targeted edit — never rewrite entire files, never change code outside the scope of the bug
5. If the fix touches a backend route, verify requireAuth middleware is present
6. If the fix touches frontend colors/text, verify useColorScheme() is used (no hardcoded #000, #111827, etc.)
7. Run `npx tsc --noEmit --project server/tsconfig.json` after any backend changes
8. Check for client/server contract mismatches — TypeScript types and Zod schemas compile independently

$ARGUMENTS
