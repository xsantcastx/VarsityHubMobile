# AGENTS.md

Guidance for coding agents working in this repository.

## Repository at a glance

- Monorepo with:
  - Expo React Native app at repository root
  - Node/Express API in `server/`
- Primary docs entrypoint: `docs/INDEX.md`
- Main quick-start and command reference: `README.md`

## Directory map (high value paths)

- `app/` - Expo Router screens (file-based routes)
- `components/`, `hooks/`, `utils/`, `context/` - app logic and shared UI/state
- `api/` - client-side API helpers
- `server/src/` - backend routes, middleware, services
- `server/prisma/` - schema and migrations
- `scripts/` and `server/scripts/` - operational and validation scripts
- `docs/` - operational guides, release checks, troubleshooting

## Setup and run

From repo root:

```bash
npm install
cd server && npm install && cd ..
```

Start both app + server:

```bash
npm run dev
```

Useful focused commands:

```bash
npm run dev:expo         # Expo only
npm run server:dev       # API only
npm run lint             # Expo lint
npm run typecheck        # TS noEmit
npm test                 # Root tests
npm run test:server      # Backend tests
```

## Agent workflow expectations

1. Read nearby code and docs before editing.
2. Make the smallest safe change that fixes the issue.
3. Prefer TypeScript and existing project patterns.
4. Avoid unrelated refactors unless they are required for correctness.
5. Update docs when behavior or commands change.
6. Run targeted validation for touched areas before finishing.

## Validation guide (choose minimally sufficient checks)

- App/UI changes:
  - `npm run lint`
  - `npm run typecheck`
  - run focused tests when present
- Backend/API changes:
  - `npm run test:server`
  - if applicable: `cd server && npm run test:payments:confidence`
- Cross-cutting changes:
  - `npm run lint && npm run typecheck && npm run test:server`

Do not run heavyweight suites unless needed (for example full smoke/E2E) when a narrower check can validate the change.

## Environment and secrets

- Never commit secrets or `.env` values.
- Frontend public env variables use `EXPO_PUBLIC_*`.
- Backend secrets live in `server/.env`.
- Prefer accessing frontend env via `config/env.ts` helpers (see `docs/03-ENVIRONMENT.md`).

## Code style and conventions

- Follow existing naming and file conventions:
  - Components: `PascalCase.tsx`
  - Hooks/utils: `camelCase.ts`
  - Route files in `app/`: kebab-case
- Reuse existing aliases/import patterns already used in the codebase.
- Keep changes easy to review; add brief comments only when logic is non-obvious.

## Common pitfalls

- This repo excludes generated artifacts; do not commit `node_modules`, build outputs, uploads, or platform-generated files.
- Some historical docs in `docs/archive/` may be outdated; prefer active guides linked from `docs/INDEX.md`.
- iOS-specific flows may require macOS; avoid assuming iOS build tooling is available in Linux CI.

## Definition of done (agent)

- Code compiles/lints/tests at the level appropriate for the change.
- Behavior change is covered by tests or clearly justified if tests are not practical.
- Documentation updated when user-facing behavior, developer workflow, or operational commands changed.
