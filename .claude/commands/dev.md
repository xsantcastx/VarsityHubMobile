No explanations, no preamble, no summaries. Just the code changes with file paths and line numbers.

Rules from CLAUDE.md:
- Targeted edits only — never rewrite entire files
- Text colors must use useColorScheme() — never hardcode
- Back navigation uses safeGoBack — never hardcoded routes
- Emails go through EmailService — never sgMail.send() directly
- All findMany must have take limits
- All routes accessing req.user must have requireAuth
- Run tsc after backend changes

Output format:
```
[file:line] change description
```

$ARGUMENTS
