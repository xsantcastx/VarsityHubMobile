# Dead Code Audit - VarsityHub Mobile
Date: 2026-04-06 | Branch: main / ca8c2ae5 | Scope: api/, components/, hooks/, app/, server/src/routes/

---

## 1. Unused API Exports

### api/codex.ts - Entire file dead
invokeCodex and invokeCodexStream have 0 callers outside the file.
Wraps InvokeLLM from api/integrations.js (Base44 LLM stub). Safe to delete.

### api/messages.ts - Entire file dead
Never imported by any client file. Duplicates Message export from api/entities.ts. Safe to delete.

### api/games.ts - Entire file dead
Exports a Game object identical to Game in api/entities.ts. Zero imports from client. Safe to delete.

### api/groupChats.ts - Entire file dead
GroupChat.list/getMessages/sendMessage/markRead/create all have 0 callers in app code.
Server-side /group-chats route is mounted but client never calls it. Safe to delete.

### api/entities.ts - Unused methods

  User.lookupByEmail       0 callers
  User.exportMyData        0 callers  (GDPR, not in UI)
  User.teams               0 callers
  Post.restore             0 callers  (soft-delete restore, no UI)
  Post.createPoll          0 callers  (creation UI missing)
  Post.createCollage       0 callers
  Post.filterPage          0 callers  (filter/listPage used instead)
  Post.count               0 callers
  TeamMemberships.create   0 callers  (dup of Team.invite)
  TeamMemberships.update   0 callers  (dup of Team.updateMember)
  TeamMemberships.delete   0 callers  (dup of Team.removeMember)
  TeamInvites.create       0 callers  (entire export unused)

### api/geocoding.ts - clearGeocodeCache unused
clearGeocodeCache has 0 callers. geocodeLocation and autocompleteLocations are active.


---

## 2. Orphaned Screens

Screens that exist but are never navigated to via router.push/replace/href.

  app/reset.tsx            /reset           _layout.tsx line 158  (probable dup of forgot-password.tsx)
  app/game-highlights.tsx  /game-highlights _layout.tsx line 213  (0 navigation calls)
  app/game-photos.tsx      /game-photos     _layout.tsx line 214  (0 navigation calls)
  app/game-reviews.tsx     /game-reviews    _layout.tsx line 215  (0 navigation calls)
  app/env-debug.tsx        /env-debug       NOT IN _layout.tsx    (0 navigation calls)
  app/debug.tsx            /debug           NOT IN _layout.tsx    (0 navigation calls)

When deleting the first four, also remove matching Stack.Screen entries from
app/_layout.tsx lines 158, 213, 214, 215.

Confirmed NOT orphaned:
  app/billing.tsx         navigated from create-fan-event.tsx
  app/game-detail.tsx     re-export shim; registered in both layouts
  app/reset-password.tsx  navigated from forgot-password.tsx
  app/verify.tsx          navigated from index.tsx, sign-up.tsx, onboarding steps


---

## 3. Unused Components

  components/HelloWave.tsx               HelloWave                 0 callers  (Expo starter remnant)
  components/ParallaxScrollView.tsx      ParallaxScrollView        0 callers  (Expo starter remnant)
  components/Collapsible.tsx             Collapsible               0 callers  (Expo starter remnant)
  components/ExternalLink.tsx            ExternalLink              0 callers  (Expo starter remnant)
  components/EventMergeSuggestionModal.tsx EventMergeSuggestionModal 0 callers (no app file imports it)
  components/ui/AccessibleButton.tsx     AccessibleButton          0 callers  (no importers found)
  app/components/AppearancePicker.tsx    AppearancePicker          0 callers  (dup of components/ version)
  app/components/MatchBannerCapture.tsx  MatchBannerCapture        0 callers  (other MatchBanner variants used)

Flagged - verify before deleting:
  components/EmailPreview.tsx           0 React imports in app. Server uses string template refs, not this file.
  components/ReportResolutionEmail.tsx  Same pattern as EmailPreview.

---

## 4. Unused Hooks

No unused hooks. All 19 hooks in hooks/ are imported by at least one screen or component.

---

## 5. Dead Server Routes

Files in server/src/routes/ never mounted in server/src/app.ts:

  server/src/routes/plays.ts        playsRouter     - never imported or mounted
  server/src/routes/tournaments.ts  tournamentsRouter - never imported or mounted

Both have 0 client API wrappers in api/. Safe to delete.

Mounted but with no direct api/ client wrapper (NOT dead):
  promos.ts   Called directly via httpPost in billing.tsx and ad-calendar.tsx. Not dead.
  rsvps.ts    Mounted at /rsvps but client uses /events/{id}/rsvp. Verify before removing.

---

## Complete Delete List (high confidence)

Entire files to delete:
  /Users/varsityhub/VarsityHubMobile/api/codex.ts
  /Users/varsityhub/VarsityHubMobile/api/messages.ts
  /Users/varsityhub/VarsityHubMobile/api/games.ts
  /Users/varsityhub/VarsityHubMobile/api/groupChats.ts
  /Users/varsityhub/VarsityHubMobile/components/HelloWave.tsx
  /Users/varsityhub/VarsityHubMobile/components/ParallaxScrollView.tsx
  /Users/varsityhub/VarsityHubMobile/components/Collapsible.tsx
  /Users/varsityhub/VarsityHubMobile/components/ExternalLink.tsx
  /Users/varsityhub/VarsityHubMobile/components/EventMergeSuggestionModal.tsx
  /Users/varsityhub/VarsityHubMobile/components/ui/AccessibleButton.tsx
  /Users/varsityhub/VarsityHubMobile/app/components/AppearancePicker.tsx
  /Users/varsityhub/VarsityHubMobile/app/components/MatchBannerCapture.tsx
  /Users/varsityhub/VarsityHubMobile/app/reset.tsx
  /Users/varsityhub/VarsityHubMobile/app/game-highlights.tsx
  /Users/varsityhub/VarsityHubMobile/app/game-photos.tsx
  /Users/varsityhub/VarsityHubMobile/app/game-reviews.tsx
  /Users/varsityhub/VarsityHubMobile/app/env-debug.tsx
  /Users/varsityhub/VarsityHubMobile/app/debug.tsx
  /Users/varsityhub/VarsityHubMobile/server/src/routes/plays.ts
  /Users/varsityhub/VarsityHubMobile/server/src/routes/tournaments.ts

Methods/exports to remove from api/entities.ts:
  User.lookupByEmail, User.exportMyData, User.teams
  Post.restore, Post.createPoll, Post.createCollage, Post.filterPage, Post.count
  TeamMemberships (entire export block)
  TeamInvites (entire export block)

Function to remove from api/geocoding.ts:
  clearGeocodeCache

Stack.Screen entries to remove from app/_layout.tsx:
  line 158: name="reset"
  line 213: name="game-highlights"
  line 214: name="game-photos"
  line 215: name="game-reviews"

---

## Verify Before Removing

  components/EmailPreview.tsx           Server uses string template refs; confirm no React import in app
  components/ReportResolutionEmail.tsx  Same as EmailPreview
  server/src/routes/rsvps.ts            Mounted, 0 direct client calls; may serve admin tooling or webhooks
  app/game-detail.tsx (re-export shim)  Check if push notifications or deep-links target /game-detail directly
