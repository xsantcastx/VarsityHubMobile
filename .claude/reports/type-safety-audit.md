# Type Safety Audit - VarsityHub Mobile
Date: 2026-04-10
Scope: api/*.ts, create flows, catch blocks, useLocalSearchParams

---

## Status vs Previous Audit (2026-04-06)

Confirmed fixed since last run:
- CreateEventPayload.location is now required (matches server)
- CreateAdPayload required fields now correctly required in client type
- CreatePostPayload now includes event_id?
- following.tsx and followers.tsx now declare id? (optional)

---

## 1. any-typed API calls in api/*.ts

Still outstanding (unchanged from last audit):

| File | Line | Pattern | Suggested fix |
|------|------|---------|---------------|
| api/games.ts | 34 | create: (data: any) | Use CreateGamePayload |
| api/games.ts | 56 | update: (id, data: any) | Use Partial<CreateGamePayload> |
| api/auth.ts | 172-173 | (res as any)?.access_token | Add AuthResponse interface |
| api/entities.ts | 317 | Message.filter(_where: any) | Narrow to { conversation_id? } |
| api/entities.ts | 369 | createWithTeams(data: any) | Add inline type |
| api/entities.ts | 484 | available_plans: any[] | Add PlanConfig interface |
| api/geocoding.ts | 64 | const res: any | Inline prediction array type |

Acceptable (unchanged): api/http.ts body, api/upload.ts FormData/XHR, normalizePost* helpers.

---

## 2. Client-Server field mismatches

### POST /teams/create - Team.create() vs createTeamSchema

NEW FINDING: Incomplete client type

Team.create() in api/entities.ts:414 declares:
  name, description?, sport?, season?, season_start?, season_end?,
  organization_id?, organization_name?, logo_url?, authorized_users?

create-team.tsx:517-528 also sends: club_type, extracurricular_category, primary_color.

All three accepted by createTeamSchema on the server but absent from the TS type.
Works at runtime (payload built as Record<string, any>) but TypeScript cannot catch
typos in these field names.

Action: Add club_type?, extracurricular_category?, primary_color? to Team.create() params.

Server also accepts city, state, league, venue_place_id, venue_lat/lng/address, onboarding
which the client never sends. No required-field gap.

---

### POST /games - CreateGamePayload vs server schema

CARRIES OVER: Missing optional fields

CreateGamePayload (api/types.ts:70) is missing server-accepted fields:

| Field | Server type | Impact |
|-------|-------------|--------|
| watch_location_lat | z.number().optional | Watch party GPS silently unsendable |
| watch_location_lng | z.number().optional | Watch party GPS silently unsendable |
| watch_location_place_id | z.string().optional | Watch party place ID silently unsendable |
| latitude | z.number().optional | Event coordinates silently unsendable |
| longitude | z.number().optional | Event coordinates silently unsendable |
| autoGeocode | z.boolean().optional | Server geocode trigger silently unsendable |

Action: Add missing optional fields to CreateGamePayload in api/types.ts.

---

### POST /posts - create-post.tsx payload vs createPostSchema

NEW FINDING: Client sends field server silently drops

app/(tabs)/create-post.tsx:684 sends preview_url: finalThumbnailUrl.

Server createPostSchema does NOT include preview_url. Zod strips unknown fields,
so the value is silently dropped. Server auto-derives preview_url from media_url via
getVideoPreviewUrl() on read (posts.ts:337,452,789,1024).

Risk: If a video thumbnail URL differs from what getVideoPreviewUrl() generates, the
client-supplied value is permanently lost. No current functional impact, but misleading.

Note: CreatePostPayload type correctly excludes preview_url (consistent with server schema)
but the actual UI payload sends it via Record<string, any> so no TypeScript error surfaces.

Action: Either add preview_url to createPostSchema and store it, OR remove it from the
create-post payload and rely on server derivation.

---

### PUT /users/me - UpdateMePayload vs updateMeSchema

No mismatches. display_name?, username?, avatar_url?, bio? match on both sides.

### POST /ads - CreateAdPayload vs adCreateSchema

No mismatches. Required/optional fields align on both sides.

---

## 3. Missing error types in catch blocks

No unsafe patterns found (consistent with previous audit).

catch (error) blocks that only log or show static messages: safe.
manage-season.tsx:211,978 explicitly use instanceof Error before .message - correct.
(tabs)/manage-teams.tsx:255 uses error instanceof Error ternary - correct.

Stripe patterns (manage-subscription.tsx:151, create-team.tsx:395, ad-calendar.tsx:583,
subscription-paywall.tsx:182): error is StripeError from presentPaymentSheet().
.code and .message access matches Stripe SDK shape - not runtime-unsafe.

All other error.message accesses use catch (error: any) - explicitly typed, safe.

---

## 4. Unsafe useLocalSearchParams access

No unsafe patterns found. All previously flagged issues resolved.

| File | Param | Guard |
|------|-------|-------|
| game-photos.tsx | game_id | if (!game_id) return |
| game-highlights.tsx | game_id | if (!game_id) return |
| admin-user-detail.tsx | id | if (!isAdmin or !id) return |
| edit-ad.tsx | id | canSave = !!id |
| manage-season.tsx | teamId | guarded before API call |
| post-detail.tsx | id, postIds | nullish coalesce + fallback |
| reset-password.tsx | email, code | typeof guard on init |
| following.tsx | id? | if (!id) return (fixed since last audit) |
| followers.tsx | id? | if (!id) return (fixed since last audit) |

---

## Summary by priority

| Priority | Finding | Location |
|----------|---------|----------|
| Medium | create-post.tsx sends preview_url server silently drops | app/(tabs)/create-post.tsx:684 |
| Medium | Team.create() type missing club_type/extracurricular_category/primary_color | api/entities.ts:414 |
| Medium | CreateGamePayload missing 6 optional server fields | api/types.ts:70 |
| Low | api/games.ts create/update still typed data: any | api/games.ts:34,56 |
| Low | api/auth.ts (res as any) on register response | api/auth.ts:172 |
| Low | api/entities.ts Message.filter/createWithTeams/available_plans: any | api/entities.ts |
| Resolved | All 4 high-priority issues from 2026-04-06 audit fixed | - |
