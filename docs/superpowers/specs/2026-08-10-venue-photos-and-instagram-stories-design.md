# Venue Photo Coverage + Instagram Stories Share — Design

Date: 2026-08-10
Branch: fix/wwe-events-on-map

## Problem

1. **WWE and WNBA event cards render as blank dark boxes** (see August notes). The
   feed card banner falls back to `venue_photo`, looked up by venue name against
   the fixed 91-venue `VENUE_PHOTOS` map. That map only contains permanent
   major-league stadiums/arenas. WWE is a teamless touring promotion (a different
   arena every show, mostly small venues absent from the map) and 5 of 14 WNBA
   home arenas are missing too — so those cards get no photo and, being teamless
   (WWE), no team-color gradient either → flat black.

2. **No "Share to Instagram Story" system exists.** The app only links to the
   VarsityHub IG profile and uses the generic OS share sheet.

## Part 1 — Venue photo coverage (server + client, OTA-shippable)

### A. Fill the real gaps

Add real Wikimedia Commons photos (URL + CC attribution, sourced via Wikidata P18
→ Commons license metadata, every URL HTTP-200 verified) to
`server/src/lib/proSchedule/venuePhotos.ts` `VENUE_PHOTOS` and the client mirror
`utils/venuePhotoFallback.ts`:

WNBA (5): Gateway Center Arena, College Park Center, Michelob Ultra Arena,
Climate Pledge Arena, Coca-Cola Coliseum.
WWE arenas (4): KeyBank Center, Canada Life Place, SNHU Arena, Scope Arena.

### B. WWE default image (closes the permanent gap)

WWE convention-center stops (e.g. Wicomico Youth & Civic Center, VSU
Multipurpose Center, Majed J. Nesheiwat Convention Center) have no usable Commons
photo. Add `LEAGUE_DEFAULT_PHOTOS: Partial<Record<ProLeague, VenuePhoto>>` with a
`wwe` entry (a generic CC-licensed empty wrestling ring — NOT the trademarked WWE
logo/talent). Add `leagueDefaultPhoto(league)`.

In the three serializers change the lookup to
`venuePhotoFor(location) ?? leagueDefaultPhoto(pro_league)`:

- `server/src/routes/events.ts` (WWE shows serialize here; `pro_league` already computed)
- `server/src/routes/games.ts` (`pro_league` already computed at :1440)
- `server/src/routes/pro-teams.ts` `serializeProEvent` (add `league: true` to the
  `proHomeTeam`/`proAwayTeam` selects, then apply the same fallback)

Every WWE show then gets either its real arena photo or the branded default —
never blank. Pinned by a unit test.

Ships via `eas update` (OTA). No native change.

## Part 2 — Instagram Stories share (native, `eas build` only)

### Scope

A "Share to Instagram Story" action on **game/event share** (GameDetailsScreen
`onShare`). Background = the event's image (its venue photo, or the WWE default
from Part 1 — so there is always a background), overlaid with a bundled
VarsityHub sticker and a link back to the event/game deep link.

### Mechanism

Use `react-native-share`'s `Share.shareSingle({ social: INSTAGRAM_STORIES, ... })`,
which implements the iOS pasteboard (`com.instagram.sharedSticker.*`) and Android
`com.instagram.share.ADD_TO_STORY` intent on both platforms.

- New dependency `react-native-share`, **dynamically imported with try/catch**
  (added after the current App Store binary — OTA-safe pattern), falling back to
  the existing OS share sheet when unavailable or IG isn't installed.
- New helper `utils/shareToInstagramStory.ts`: downloads the background image to
  a local file / base64, resolves the bundled sticker asset, reads the Meta App
  ID, calls `shareSingle`, returns `'shared' | 'unavailable' | 'error'`.
- Native config via a config plugin `plugins/withInstagramStories.js`:
  - iOS `LSApplicationQueriesSchemes += ["instagram-stories","instagram"]`
  - Android `<queries><package android:name="com.instagram.android"/></queries>`
- Meta App ID from `extra.metaAppId` (env `EXPO_PUBLIC_META_APP_ID`). The user
  registers a Meta/Facebook App ID and passes it as `source_application`.
- Sticker asset: reuse `assets/logo.png` (bundled).

### Caveats (must communicate)

1. The IG **link sticker** (tap-through) requires Instagram to approve the account
   for links; background + sticker work universally.
2. Nothing here is live until `eas build` + store submission — not OTA.

## Testing / Verification

- Part 1: `npx tsc --noEmit --project server/tsconfig.json`; new unit test that
  `leagueDefaultPhoto('wwe')` is non-null and that the added venues resolve; the
  existing pro-league suites stay green.
- Part 2: typechecks (client `npx tsc --noEmit`); runtime is NOT verifiable in
  this environment (needs a native build on a device with Instagram installed) —
  called out honestly rather than claimed.
