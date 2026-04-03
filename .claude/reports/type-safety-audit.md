# Type Safety Audit - VarsityHub Mobile
Generated: 2026-04-01

## 1. any-Typed API Calls

### High-signal instances (fixable with real types)

| File | Lines | Pattern | Notes |
|------|-------|---------|-------|
| api/games.ts | 34, 56 | create/update: (data: any) | Server createGameSchema has known required fields |
| api/events.ts | 23, 42 | create/update: (data: any) | Server createEventSchema/updateEventSchema have full shape |
| api/posts.ts | 28, 98 | create/createCollage: (data: any) | Server createPostSchema shape is known |
| api/user.ts | 11-14 | updateMe/patchMe/updatePreferences/completeOnboarding: (data: any) | All hit strict Zod schemas |
| api/misc.ts | 21, 25 | Advertisement.create/update: (data: any) | Server adCreateSchema has required fields |
| api/organizations.ts | 33 | createWithTeams: (data: any) | No type guard at all |

### Lower-signal / acceptable any usages
- api/http.ts: HTTP plumbing, unavoidable
- api/upload.ts: XHR/FormData interop with native modules
- api/codex.ts: response shape varies per model, intentional
- catch (e: any) with || fallback: acceptable pattern throughout
- api/entities.ts normalizePostItems/normalizePostPage: normalizers for uncertain shapes

---

## 2. Client-Server Field Mismatches

### POST /teams/create
api/teams.ts -> POST /teams/create -> createTeamSchema

Client sends but server does not expect: None. Extra fields stripped by Zod.

Server accepts but client never exposes (all optional, non-breaking):
club_type, extracurricular_category, primary_color, city, state, league,
venue_place_id, venue_lat, venue_lng, venue_address

The client create() type in api/teams.ts:24-36 does not include these, so screens
cannot pass them via the typed helper even though the server accepts them.

---

### POST /games (Risk: Medium)
api/games.ts:34 -> POST /games -> createGameSchema (server games.ts:347)

Game.create typed (data: any). Server REQUIRES:
  location: z.string().trim().min(1, 'Location is required')

All current callers in manage-season.tsx pass location but no compile-time
enforcement prevents a future caller from silently omitting it.

---

### POST /events (Risk: Medium)
api/events.ts:23 -> POST /events -> createEventSchema (server events.ts:483)

Event.create typed (data: any). Server REQUIRES:
  title: z.string().trim().min(1).max(200)
  date: z.string().refine(...) -- must parse as valid date
  location: z.string().trim().min(1, 'Location is required')

No compile-time guarantee that callers pass all three required fields.

---

### POST /posts (Risk: Low)
api/posts.ts:28 -> POST /posts -> createPostSchema (server posts.ts:513)

Post.create typed (data: any). Server requires at least one of content or
media_url via .refine(). Omitting both yields HTTP 400 with content path error.
Post creation UI always passes one; no compile-time guarantee.

---

### PUT /auth/me (Risk: Medium)
api/user.ts:11 -> PUT /auth/me -> updateMeSchema (server auth.ts:941)

User.updateMe typed (data: any). Server strict validations silently return 400:
  username: regex /^[a-z0-9_.]+$/ -- uppercase or spaces fail
  grade_level: enum [Freshman, Sophomore, Junior, Senior]
  dm_policy: enum [everyone, following, no_one]
  comment_permission: enum [everyone, following, none]
  graduation_year: z.number().int().min(2020).max(2040)
  header_image_focus_y: z.number().min(-1).max(1)

No client-side type guards enforce these constraints before the API call.

---

### POST /ads (Risk: Medium -- CONCRETE BUG)
api/misc.ts:21 -> POST /ads -> adCreateSchema (server ads.ts:20)

Advertisement.create typed (data: any). Server REQUIRED: contact_name,
contact_email, business_name, target_url, target_zip_code.

Bug in app/submit-ad.web.tsx:107:
  target_url: normalizeUrl(targetUrl) || undefined

If normalizeUrl() returns falsy, target_url is sent as undefined. Since target_url
is REQUIRED in adCreateSchema (not .optional()), server returns HTTP 400.
UI should block submission if target_url resolves to empty.

Pre-existing known issue (CLAUDE.md): target_lat/target_lng in server ads.ts are
not in Zod schema -- dead fields, already documented.

---

## 3. Missing Error Types in Catch Blocks

### Unsafe -- error.message used directly, no fallback

| File | Line | Context |
|------|------|---------|
| app/settings/manage-subscription.tsx | 153 | Alert.alert('Payment Failed', error.message) -- IAP/Stripe PurchaseError, .message may be undefined |
| app/subscription-paywall.tsx | 184 | Same IAP/Stripe pattern |
| app/ad-calendar.tsx | 585 | Same Stripe PaymentSheet pattern |

All three are in IAP/Stripe SDK callbacks where error is a SDK-specific object,
not necessarily an Error instance. .message may be undefined, causing alert to
show "undefined" to the user.

Fix:
  Alert.alert('Payment Failed', error instanceof Error ? error.message : 'Payment failed');

### Acceptable (have || fallback -- not bugs)
- app/post-detail.tsx lines 576, 600, 621, 643: error.message || 'Failed to...'
- app/message-thread.tsx line 436: error.message || 'Failed to block user'

---

## 4. Unsafe useLocalSearchParams() Access

### Params declared required but actually optional at runtime

| File | Line | Declared type | Runtime guard? |
|------|------|---------------|----------------|
| app/(tabs)/following.tsx | 20 | { id: string } | Yes -- if (!id) return at line 28 |
| app/(tabs)/followers.tsx | 20 | { id: string } | Yes -- if (!id) return at line 28 |
| app/game-details/GameDetailsScreen.tsx | 435 | { id: string; eventId?: string } | Yes -- null check at line 1475 |
| app/organization-join-requests.tsx | 44 | { organization_id: string } | Yes -- if (!params.organization_id) at line 56 |

No active runtime bugs -- all four have guards. But TypeScript types claim non-optional
when useLocalSearchParams can return undefined. Should be typed as id?: string to
match what the hook actually returns.

All other useLocalSearchParams calls are correctly typed as optional or checked before use.

---

## Summary

| Category | Severity | Count | Recommended Action |
|----------|----------|-------|--------------------|
| any-typed create/update API functions | Medium | 6 files | Add typed interfaces matching server Zod schemas |
| Required server fields not enforced at client | Medium | 4 flows | Add typed wrappers with required fields |
| target_url can be undefined on required ads field | Medium | 1 screen | Block submit if URL empty in submit-ad.web.tsx |
| error.message on untyped IAP/Stripe errors | Low-Medium | 3 screens | Add instanceof Error guard with fallback |
| useLocalSearchParams type-lies (runtime-safe) | Low | 4 screens | Change id: string to id?: string |
