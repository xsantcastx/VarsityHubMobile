#!/bin/bash
cd /workspaces/VarsityHubMobile

# Commit the changes
git commit -m "Fix login-related global references and improve code quality

- Replace deprecated 'global' with 'globalThis' in http.ts and ErrorBoundary.tsx
- Fix TypeScript timer types using ReturnType<typeof setTimeout>
- Remove unsupported CSS properties (backdropFilter) in React Native
- Clean up unused imports and organize import statements
- Update package-lock.json dependencies"

# Push to remote
git push

echo "Login changes have been committed and pushed successfully!"
