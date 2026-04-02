# SKELETON_PLAN.md
## VarsityHub — Strip to Verified Skeleton Baseline

Safety tag: `pre-skeleton-20250402`

---

## KEEP (must work in skeleton)

These files power: sign in, sign up, email verify, password reset, feed (view only), profile (view only).

### Navigation
- `app/_layout.tsx` — Root Stack (will be MODIFIED to remove gated screen registrations)
- `app/(tabs)/_layout.tsx` — Tab bar (will be MODIFIED to hide gated tabs)
- `app/index.tsx` — Entry/redirect
- `app/(tabs)/index.tsx` — Tab redirect

### Auth Screens
- `app/sign-in.tsx`
- `app/sign-up.tsx`
- `app/verify-email.tsx`
- `app/verify.tsx`
- `app/forgot-password.tsx`
- `app/reset-password.tsx`
- `app/reset.tsx`

### Onboarding (steps 1-2 only — role + basic info)
- `app/onboarding/_layout.tsx`
- `app/onboarding/index.tsx`
- `app/onboarding/step-1-role.tsx`
- `app/onboarding/step-2-basic.tsx`
- `app/onboarding/components/OnboardingLayout.tsx`

### Feed (view only)
- `app/(tabs)/feed/index.tsx`
- `app/feed.tsx`
- `app/post-detail.tsx`
- `app/(tabs)/feed/game/index.tsx`
- `app/(tabs)/feed/game/[id].tsx`

### Profile (view only)
- `app/(tabs)/profile/index.tsx`
- `app/profile.tsx`
- `app/user-profile.tsx`
- `app/followers.tsx`
- `app/following.tsx`
- `app/(tabs)/followers.tsx`
- `app/(tabs)/following.tsx`

### Settings (core only)
- `app/settings/_layout.tsx`
- `app/settings/index.tsx`
- `app/settings/edit-username.tsx`
- `app/settings/reset-password.tsx`
- `app/settings/privacy-policy.tsx`
- `app/settings/terms-of-service.tsx`
- `app/settings/contact.tsx`
- `app/settings/feedback.tsx`
- `app/settings/zip-code.tsx`
- `app/settings/core-values.tsx`
- `app/settings/dmca.tsx`

### Error/Misc
- `app/+not-found.tsx`
- `app/_error.tsx`
- `app/help.tsx`
- `app/core-values.tsx`
- `app/debug.tsx`
- `app/env-debug.tsx`

---

## GATE (hide but do not delete)

These screens/tabs get a `// GATED` comment and are disabled via one of the three approved methods.

### Coach Onboarding (step 3+)
- `app/onboarding/step-3-league.tsx` — GATED: COACH ONBOARDING
- `app/onboarding/coach-agreement.tsx` — GATED: COACH ONBOARDING
- `app/onboarding/pending-approval.tsx` — GATED: COACH ONBOARDING
- `app/onboarding/league-pending-approval.tsx` — GATED: COACH ONBOARDING
- `app/role-onboarding.tsx` — GATED: COACH ONBOARDING

### Approvals
- `app/approvals.tsx` — GATED: APPROVALS
- `app/(tabs)/approvals.tsx` — GATED: APPROVALS
- `app/event-approvals.tsx` — GATED: APPROVALS
- `app/(tabs)/event-approvals.tsx` — GATED: APPROVALS

### Team/Org Creation & Management
- `app/create-team.tsx` — GATED: TEAMS
- `app/(tabs)/create-team.tsx` — GATED: TEAMS
- `app/edit-team.tsx` — GATED: TEAMS
- `app/(tabs)/edit-team.tsx` — GATED: TEAMS
- `app/manage-teams.tsx` — GATED: TEAMS
- `app/(tabs)/manage-teams.tsx` — GATED: TEAMS
- `app/my-team.tsx` — GATED: TEAMS
- `app/(tabs)/my-team.tsx` — GATED: TEAMS
- `app/team-hub.tsx` — GATED: TEAMS
- `app/(tabs)/team-hub.tsx` — GATED: TEAMS
- `app/team-contacts.tsx` — GATED: TEAMS
- `app/(tabs)/team-contacts.tsx` — GATED: TEAMS
- `app/team-profile.tsx` — GATED: TEAMS
- `app/(tabs)/team-profile.tsx` — GATED: TEAMS
- `app/team-page.tsx` — GATED: TEAMS
- `app/(tabs)/team-page.tsx` — GATED: TEAMS
- `app/team-invites.tsx` — GATED: TEAMS
- `app/team-viewer.tsx` — GATED: TEAMS
- `app/manage-season.tsx` — GATED: TEAMS
- `app/manage-users.tsx` — GATED: TEAMS
- `app/season-stats.tsx` — GATED: TEAMS
- `app/organization.tsx` — GATED: ORGANIZATIONS
- `app/(tabs)/organization.tsx` — GATED: ORGANIZATIONS
- `app/edit-organization.tsx` — GATED: ORGANIZATIONS
- `app/(tabs)/edit-organization.tsx` — GATED: ORGANIZATIONS
- `app/organizations/[id].tsx` — GATED: ORGANIZATIONS
- `app/organizations/index.tsx` — GATED: ORGANIZATIONS
- `app/request-join-organization.tsx` — GATED: ORGANIZATIONS
- `app/organization-join-requests.tsx` — GATED: ORGANIZATIONS
- `app/league.tsx` — GATED: ORGANIZATIONS

### Ad Hosting
- `app/submit-ad.tsx` — GATED: ADS
- `app/submit-ad.web.tsx` — GATED: ADS
- `app/(tabs)/submit-ad.tsx` — GATED: ADS
- `app/(tabs)/submit-ad.web.tsx` — GATED: ADS
- `app/ad-calendar.tsx` — GATED: ADS
- `app/(tabs)/ad-calendar.tsx` — GATED: ADS
- `app/ad-confirmation.tsx` — GATED: ADS
- `app/edit-ad.tsx` — GATED: ADS
- `app/edit-ad.web.tsx` — GATED: ADS
- `app/(tabs)/edit-ad.tsx` — GATED: ADS
- `app/(tabs)/edit-ad.web.tsx` — GATED: ADS
- `app/my-ads.tsx` — GATED: ADS
- `app/(tabs)/my-ads.tsx` — GATED: ADS

### Admin Dashboard
- `app/admin-dashboard.tsx` — GATED: ADMIN
- `app/admin-users.tsx` — GATED: ADMIN
- `app/(tabs)/admin-users.tsx` — GATED: ADMIN
- `app/admin-user-detail.tsx` — GATED: ADMIN
- `app/(tabs)/admin-user-detail.tsx` — GATED: ADMIN
- `app/admin-teams.tsx` — GATED: ADMIN
- `app/(tabs)/admin-teams.tsx` — GATED: ADMIN
- `app/admin-ads.tsx` — GATED: ADMIN
- `app/(tabs)/admin-ads.tsx` — GATED: ADMIN
- `app/admin-reports.tsx` — GATED: ADMIN
- `app/admin-messages.tsx` — GATED: ADMIN
- `app/(tabs)/admin-messages.tsx` — GATED: ADMIN
- `app/admin-activity-log.tsx` — GATED: ADMIN
- `app/admin-create-event.tsx` — GATED: ADMIN
- `app/admin-transactions.tsx` — GATED: ADMIN
- `app/admin-metrics.tsx` — GATED: ADMIN

### Messaging
- `app/messages.tsx` — GATED: MESSAGING
- `app/(tabs)/messages/index.tsx` — GATED: MESSAGING
- `app/message-thread.tsx` — GATED: MESSAGING
- `app/dm-restrictions.tsx` — GATED: MESSAGING
- `app/blocked-users.tsx` — GATED: MESSAGING
- `app/settings/blocked-users.tsx` — GATED: MESSAGING

### Payments
- `app/payment-success.tsx` — GATED: PAYMENTS
- `app/payment-cancel.tsx` — GATED: PAYMENTS
- `app/billing.tsx` — GATED: PAYMENTS
- `app/subscription-paywall.tsx` — GATED: PAYMENTS
- `app/settings/manage-subscription.tsx` — GATED: PAYMENTS

### Notifications
- `app/(tabs)/notifications/index.tsx` — GATED: NOTIFICATIONS

### Events
- `app/event-detail.tsx` — GATED: EVENTS
- `app/(tabs)/event-detail.tsx` — GATED: EVENTS
- `app/edit-event.tsx` — GATED: EVENTS
- `app/(tabs)/edit-event.tsx` — GATED: EVENTS
- `app/create-fan-event.tsx` — GATED: EVENTS
- `app/public-event.tsx` — GATED: EVENTS
- `app/rsvp-history.tsx` — GATED: EVENTS
- `app/settings/rsvp-history.tsx` — GATED: EVENTS
- `app/settings/request-host-event.tsx` — GATED: EVENTS

### Games (detail screens — feed game cards still show)
- `app/game-detail.tsx` — GATED: GAMES
- `app/(tabs)/game-detail.tsx` — GATED: GAMES
- `app/game-highlights.tsx` — GATED: GAMES
- `app/(tabs)/game-highlights.tsx` — GATED: GAMES
- `app/game-photos.tsx` — GATED: GAMES
- `app/(tabs)/game-photos.tsx` — GATED: GAMES
- `app/game-reviews.tsx` — GATED: GAMES
- `app/(tabs)/game-reviews.tsx` — GATED: GAMES
- `app/game-map.tsx` — GATED: GAMES
- `app/game/[id].tsx` — GATED: GAMES
- `app/game/index.tsx` — GATED: GAMES
- `app/game-details/GameDetailsScreen.tsx` — GATED: GAMES
- `app/game-details/GameVerticalFeedScreen.tsx` — GATED: GAMES

### Highlights
- `app/highlights.tsx` — GATED: HIGHLIGHTS
- `app/(tabs)/highlights/index.tsx` — GATED: HIGHLIGHTS

### Discover
- `app/(tabs)/discover/index.tsx` — GATED: DISCOVER
- `app/(tabs)/discover/game/index.tsx` — GATED: DISCOVER
- `app/(tabs)/discover/game/[id].tsx` — GATED: DISCOVER
- `app/(tabs)/discover/mobile-community.tsx` — GATED: DISCOVER

### Content Creation
- `app/create-post.tsx` — GATED: CONTENT CREATION
- `app/(tabs)/create-post.tsx` — GATED: CONTENT CREATION
- `app/create.tsx` — GATED: CONTENT CREATION
- `app/(tabs)/create.tsx` — GATED: CONTENT CREATION

### Profile Editing
- `app/edit-profile.tsx` — GATED: PROFILE EDIT
- `app/(tabs)/edit-profile.tsx` — GATED: PROFILE EDIT

### Other Gated Settings
- `app/settings/favorites.tsx` — GATED: FAVORITES
- `app/settings/followed-teams.tsx` — GATED: FOLLOWED TEAMS
- `app/favorites.tsx` — GATED: FAVORITES

### Safety (keep report-abuse, gate the rest)
- `app/verify-identity.tsx` — GATED: VERIFICATION

---

## BACKEND — KEEP

**Do not touch any backend files.** These are listed for reference only.

Server routes that support skeleton features:
- `POST /register` — sign up
- `POST /login` — sign in
- `POST /login/google` — Google OAuth
- `POST /login/apple` — Apple OAuth
- `POST /logout` — sign out
- `POST /refresh` — token refresh
- `POST /request-verification` — email verify request
- `POST /verify-email` — email verify confirm
- `POST /request-password-reset` — password reset request
- `POST /reset-password` — password reset confirm
- `GET /me` — current user profile
- `GET /users/:id` — public profile
- `GET /users/:id/posts` — user's posts
- `GET /users/:id/followers` — followers list
- `GET /users/:id/following` — following list
- `POST /users/:id/follow` — follow
- `POST /users/:id/unfollow` — unfollow
- `GET /posts` — feed listing
- `GET /posts/:id` — post detail
- `POST /posts/:id/like` — upvote
- `POST /posts/:id/unlike` — un-upvote
- `GET /posts/:id/comments` — comments
- `PATCH /me` — update profile
- `GET /username-available` — username check
- `GET /settings/*` — settings reads

## BACKEND — GATE

**Do not touch.** Listed for reference.

Everything else: teams CRUD, org CRUD, events CRUD, games CRUD, ads CRUD, admin routes, payments/checkout, notifications, messaging, geofencing, highlights, discover search, story uploads, approvals.

---

## SHARED (do not touch under any circumstances)

These files are used by BOTH skeleton and gated features. Modifying them risks breaking gated features when we re-enable them.

### Context Providers
- `context/AuthProvider.tsx`
- `context/NavigationHistoryContext.tsx`
- `context/OnboardingContext.tsx`
- `context/PostCacheContext.tsx`
- `context/onboardingReducer.ts`

### API Layer (entire directory)
- `api/auth.ts`
- `api/base44Client.js`
- `api/codex.ts`
- `api/entities.ts`
- `api/events.ts`
- `api/games.ts`
- `api/geocoding.ts`
- `api/groupChats.ts`
- `api/http.ts`
- `api/integrations.js`
- `api/messages.ts`
- `api/misc.ts`
- `api/notifications.ts`
- `api/organizations.ts`
- `api/payments.ts`
- `api/posts.ts`
- `api/settings.ts`
- `api/teams.ts`
- `api/types.ts`
- `api/upload.ts`
- `api/user.ts`

### All Components
- `components/*` — every component file (shared UI building blocks)
- `components/ui/*` — entire UI library
- `components/onboarding/*`

### All Hooks
- `hooks/*` — every hook file

### All Utils
- `utils/*` — every utility file
- `lib/*` — every lib file

### Constants & Config
- `constants/Accessibility.ts`
- `constants/Colors.ts`
- `constants/Theme.ts`
- `constants/layout.ts`
- `constants/plans.ts`
- `config/api.ts`
- `config/env.ts`

### Assets
- `assets/*` — all images, fonts, animations

### Config Files
- `app.config.js`
- `app.json`
- `babel.config.js`
- `App.tsx`
- `ReactotronConfig.ts`

### Backend (entire server directory)
- `server/*` — everything

### Data
- `data/seedOrganizations.ts`

---

## EXECUTION PLAN

### Phase 1: Navigation files (highest impact)
1. `app/(tabs)/_layout.tsx` — Remove Highlights, Create, Discover tabs. Keep only Feed + Profile. Remove all hidden tab entries for gated features.
2. `app/_layout.tsx` — Comment out Stack.Screen entries for all gated screens (they'll return ComingSoon if deep-linked).

### Phase 2: Gated screen files (one at a time)
For each file in the GATE list above:
- Add `// GATED — restore when [FEATURE NAME] is ready to test` at line 1
- Replace the default export with a simple `<ComingSoon feature="[name]" />` component
- Keep all original code below the ComingSoon export (commented out or unreachable)

### Phase 3: Verify
- No deleted files
- No modified SHARED files
- No backend changes
- Every gated file has the comment
- No skeleton file imports a gated file's removed export

---

## ComingSoon Component (create once, reuse everywhere)

```tsx
// components/ComingSoon.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';

export default function ComingSoon({ feature = 'This feature' }: { feature?: string }) {
  const textColor = useThemeColor({}, 'text');
  const bgColor = useThemeColor({}, 'background');
  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <Text style={[styles.text, { color: textColor }]}>
        {feature} is coming soon
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 18, fontWeight: '600' },
});
```
