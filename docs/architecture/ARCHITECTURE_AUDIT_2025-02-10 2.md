# System Architecture Snapshot (2025-02-10)

## Feature Boundaries (Expo Router)
- **app/** delegates to feature screens where migrated:
  - `app/profile.tsx`, `app/edit-profile.tsx`, `app/user-profile.tsx`, `app/story-viewer.tsx` → `src/features/profile/screens/*`
  - `app/feed.tsx`, `app/post-detail.tsx`, `app/create-post.tsx` → `src/features/posts/screens/*`
  - Auth entry screens point to `src/features/auth/screens/*`
- **Not yet migrated (still in app/)**: events, teams, discover, settings, pitches/approvals, create flows. These should move under `src/features/{events,teams,discover,settings,...}` with `app/*` acting only as thin routers.

## Shared Layers
- **Design system**: `components/` (legacy), `components/ui/` and design tokens. Needs consolidation into a single import path (e.g., `@/shared/ui`).
- **Hooks**: Mixed between `hooks/` and feature-local hooks. Plan: shared hooks → `src/shared/hooks`; feature-specific hooks → `src/features/<feature>/hooks`.
- **API**: REST client in `api/` and entity helpers in `api/entities.ts`. Some screens call `httpGet/httpPut` directly. Standardize through `api/client.ts` + typed service modules per feature.

## Navigation
- Tabs layout in `app/(tabs)/_layout.tsx`.
- Many screens live directly under `app/` (legacy). When migrating, keep route names stable by exporting from `app/<route>.tsx` and implementing in `src/features/<feature>/screens/<Screen>.tsx`.

## Immediate Fixes Applied This Pass
- Added this snapshot to document current boundaries and the migration targets so new work stays organized and thin-routing remains the pattern.

## Next Small Tasks (pick-and-run)
1) **Events feature migration**: move `app/event-approvals.tsx`, `app/fan-pitch.tsx`, `app/pitches.tsx`, `app/create-fan-event.tsx`, `app/event-detail.tsx` into `src/features/events/screens/` with `app/*` re-export stubs. Centralize API calls through `api/entities` (or a new `api/events.ts`) instead of inline `httpGet/httpPut`.
2) **Shared UI consolidation**: create `src/shared/ui` alias that re-exports the canonical button/input/text components; update 2–3 high-traffic screens to use it to reduce mixed imports.
3) **HTTP usage audit**: replace direct `httpGet/httpPut` calls in feature screens with typed service wrappers in `api/*` (start with posts + events).
4) **Hook placement**: move common hooks from `hooks/` into `src/shared/hooks/` and feature-specific hooks into their feature folders.
5) **Docs alignment**: refresh `REPO_STRUCTURE.md` after each migration so the tree matches reality and new contributors don’t add to `app/` by default.
