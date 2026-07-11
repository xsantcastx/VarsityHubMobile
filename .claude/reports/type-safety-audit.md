# Type Safety Audit — VarsityHub Mobile

Generated: 2026-07-11
Scope: client/server type-safety per `.claude/scheduled-tasks/type-safety-audit/SKILL.md`
Repo: `/Users/varsityhub/Code/VarsityHubMobile`

## Summary

| Step | Area                                              | Findings                                                         |
| ---- | ------------------------------------------------- | ---------------------------------------------------------------- |
| 1    | `any`-typed API calls                             | 6 worth replacing (rest are pragmatic RN error/transport idioms) |
| 2    | Client↔server field mismatches (5 critical flows) | 0 mismatches — 1 soft schema note                                |
| 3    | Unsafe `error.message` in catch blocks            | 4 sites (1 unmitigated, 3 fallback-mitigated)                    |
| 4    | Unsafe `useLocalSearchParams()` access            | 3 sites (misleading required types; runtime-guarded)             |

Overall the API surface is well-typed and the client/server payload contracts for the
five audited POST/PUT flows are fully aligned. Findings below are mostly low-severity
hardening, not live bugs.

---

## Step 1 — `any`-typed API calls

Most `: any` / `as any` hits in `api/*.ts` are pragmatic React Native idioms and are
**acceptable**: `const err: any = new Error(...)` to attach `.status`/`.code` props
(throughout `api/upload.ts`, `api/http.ts`), `form as any` for `FormData` in RN fetch,
`catch (error: any)` boilerplate, and the generic transport signatures
`httpPost/Put/Patch/Delete(path, body?: any)` (`api/http.ts:722-777`) which are
intentionally generic.

**Worth replacing with a concrete type:**

- `api/auth.ts:24` — `let _meCacheData: any = null;` — this caches the `/me` response
  which already has a validator (`validateAuthenticatedUser`). Type it as the
  authenticated-user response type instead of `any`.
- `api/geocoding.ts:66` — `const res: any = await httpGet(...)` — the autocomplete
  response has a known shape (predictions/status); a typed interface removes the `any`.
- `api/entities.ts:655` — `createWithTeams: (data: any) => httpPost('/organizations/create', data)`
  — the sibling `create` fn directly above takes a typed object; give this the same
  organization-with-teams payload type.
- `api/entities.ts:700` — `update: (id, data: Record<string, any>)` (organizations) —
  narrow to a `Partial<UpdateOrganizationPayload>` shape.
- `api/entities.ts:882` — `available_plans: any[];` — the plan objects are structured;
  type the array element.
- `api/entities.ts:570` — `filter: (_where: any = {}, sort: string = '-created_at')` —
  the filter argument could be a typed `Record<string, string | number | boolean>`.

Lower value (could be `unknown` rather than `any`, but low payoff):
`api/settings.ts:52` `setJson(key, value: any)`.

---

## Step 2 — Client ↔ server field mismatches

Compared each client payload type/builder against the server Zod schema. **No field
mismatches found** — every field the client sends is accepted, and every required
server field is supplied by the client type.

| Flow                 | Client                                                 | Server schema                                            | Result                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POST `/teams/create` | `Teams.create` payload builder (`api/entities.ts:764`) | `createTeamSchema` (`server/src/routes/teams.ts:2121`)   | Client sends name, description, sport, season, season_start/end, organization_id, organization_name, logo_url, authorized_users — all accepted. Server has extra optional fields. OK |
| POST `/events`       | `CreateEventPayload` (`api/types.ts:132`)              | `createEventSchema` (`server/src/routes/events.ts:1041`) | All client fields accepted (title/date/location required on both). Server adds optional host-request fields. OK                                                                      |
| POST `/posts`        | `CreatePostPayload` (`api/types.ts:103`)               | `createPostSchema` (`server/src/routes/posts.ts:637`)    | Fields incl. nested `location` object match one-for-one. OK                                                                                                                          |
| PUT `/auth/me`       | `UpdateMePayload` (`api/types.ts:9`)                   | `updateMeSchema` (`server/src/routes/auth.ts:2700`)      | Exact match: display_name, username, avatar_url, bio. OK                                                                                                                             |
| POST `/ads`          | `CreateAdPayload` (`api/types.ts:153`)                 | `adCreateSchema` (`server/src/routes/ads.ts:55`)         | Exact match: contact_name, contact_email, business_name, banner_url, banner_fit_mode, target_url, target_zip_code, radius, description. OK                                           |

Note: the SKILL referenced `api/teams.ts`, `api/games.ts`, `api/posts.ts`,
`api/misc.ts`, `server/src/routes/ads.ts` — the client API is consolidated into
`api/entities.ts` + `api/types.ts` + `api/schemas/`; the audited routes above are the
real equivalents. The client user-update flow is PUT `/auth/me` (not `/users/me`).

**Soft note (not a type mismatch):** `createTeamSchema` marks `organization_id` as
`.optional()`, while CLAUDE.md states "Teams MUST have `organization_id`". The
requirement is enforced in handler logic (org resolved from `organization_name` when
id is absent), not in the schema — intentional, but the schema alone doesn't encode
the invariant.

---

## Step 3 — Unsafe `error.message` in catch blocks

Most catch blocks in `app/` correctly guard with `error instanceof Error` (e.g.
`app/team-invites.tsx:54`, `app/team-admin.tsx:245`, `app/manage-season.tsx:1142`) or
`typeof e?.message === 'string'` (e.g. `app/admin-dashboard.tsx:121`,
`app/onboarding/step-3-league.tsx:1011`, `app/settings/index.tsx:506`). The Stripe
`const { error } = await presentPaymentSheet()` sites (`app/ad-calendar.tsx:747`,
`app/subscription-paywall.tsx:304`, `app/settings/manage-subscription.tsx:290`) read a
typed Stripe error object, not a caught value — not findings.

Genuine unguarded accesses of `.message` on an `any`-typed caught value:

- **`app/profile.tsx:447`** — `Unable to load profile: ${e.message}` inside
  `catch (e: any)` with no `instanceof` guard and no fallback. A thrown non-Error
  renders "undefined"; a thrown `null`/`undefined` crashes the render. _(highest of the four)_
- `app/message-thread.tsx:733` — `error.message || 'Failed to block user'` on
  `catch (error: any)`. Fallback covers non-Error values; only a thrown `null`/`undefined`
  would crash. Low.
- `app/post-detail.tsx:869, 893, 918` — same `error.message || '...'` pattern on
  `catch (error: any)` (delete comment / delete post / update comment). Low.

Recommended fix: route these through a shared `getErrorMessage(err: unknown): string`
helper that does the `instanceof Error` check once.

---

## Step 4 — Unsafe `useLocalSearchParams()` access

No fully-untyped `useLocalSearchParams()` calls remain — the common pattern is a
generic with **optional** fields (`useLocalSearchParams<{ id?: string }>()`), which is
correct. Three sites instead declare params as **required** `string`, which is a type
lie: Expo Router params are `string | string[] | undefined` at runtime.

- `app/organizations/[id].tsx:59` — `useLocalSearchParams<{ id: string }>()`. The very
  next line (`:61`) does `Array.isArray(params.id) ? params.id[0] : params.id`, which
  proves the declared `id: string` type is inaccurate (it can be `string[]`). Runtime is
  guarded; only the type is wrong.
- `app/game-details/GameDetailsScreen.tsx:203` — `useLocalSearchParams<{ id: string; ... }>()`.
  Downstream is guarded (`const gameIdValue = id ? String(id) : null` at `:1365`), so no
  live crash; the `id: string` type is still misleading.
- `app/team-join-requests.tsx:38` — `useLocalSearchParams<{ teamId: string; ... }>()`.
  All usage guards (`teamId ?? ''`, `enabled: !!teamId`, `teamId as string` only inside
  an `enabled`-gated query). Type lie only.

Recommended fix: mark these generic fields optional (`id?: string`, `teamId?: string`)
so the compiler forces the null handling that these files already perform, and so
future call sites don't assume a guaranteed value.

---

## Verification notes

- Client/server schema comparison done by reading each Zod schema and the matching
  client payload type/builder directly (not inferred).
- Step 3/4 accesses were checked against their surrounding guard context, not just grep
  hits, to separate real risks from already-guarded usages.
