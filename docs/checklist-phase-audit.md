# Checklist Phase Audit

Status legend:
- `Verified complete`: strong code/test evidence in the current repo
- `Partial`: implemented or guarded in code, but not proven end to end or still contradicted by checklist/user notes
- `Not complete`: missing, still broken, or current code conflicts with the checklist requirement

Audit basis:
- `Checklist.pdf`
- current app/server code
- existing Jest and integration tests in `__tests__/` and `server/src/__tests__/`

## Phase 1 — Auth, Account, Onboarding

### Verified complete
- Email verification flow has server coverage:
  - `server/src/__tests__/email-verification.test.ts`
  - `server/src/__tests__/api-auth.test.ts`
  - `server/src/__tests__/auth-flow.test.ts`
- OAuth linking exists and is covered:
  - `api/auth.ts`
  - `server/src/__tests__/oauth-account-linking.test.ts`
- Account deletion supports both password and OAuth-only users:
  - `app/settings/index.tsx`
  - `server/src/__tests__/account-deletion.test.ts`
- Settings only shows Google/Apple rows when those providers are actually linked:
  - `app/settings/index.tsx`
- Coach upgrade state transition is covered:
  - `server/src/__tests__/coach-upgrade-e2e.test.ts`
  - `server/src/__tests__/coach-upgrade-paid-plan-guard.test.ts`
- Onboarding route guards and no-skip protections are covered:
  - `__tests__/onboarding-no-skip.test.ts`
  - `__tests__/postAuthRouting.test.ts`
  - `__tests__/roleChecks.test.ts`
- Privacy/comment preference controls exist in settings and are backed server-side:
  - `app/settings/index.tsx`
  - `server/src/routes/auth.ts`

### Partial
- Session persistence and sign-out clearing have strong structural coverage, but not a real device re-launch proof:
  - `__tests__/session-flow-invariants.test.ts`
- Private profile gating and blocked-user visibility have backend logic, but not enough UI-level evidence to mark fully done:
  - `server/src/routes/users.ts`
  - `server/src/routes/search.ts`
  - `server/src/__tests__/team-privacy.test.ts`
- Minor/parental consent exists in tests, but your checklist changed the product rule to “deny under 13, no parental consent”, so this area is functionally in flux:
  - `server/src/__tests__/parental-consent.test.ts`
  - `server/src/__tests__/parental-consent-verify-allowlist.test.ts`

### Not complete
- Coach downgrade to fan, with forced team/ownership transfer first, is not implemented as a first-class flow.
- The checklist’s “deny all users under 13, no parental consent” requirement is not yet reflected as the authoritative contract.
- Some settings/profile cleanup notes are still open:
  - remove top-left image edit entry point
  - keep all profile editing inside Edit Profile

## Phase 2 — Coach, Organization, Team Workflows

### Verified complete
- Org ownership and org/team management logic now use shared permission helpers instead of duplicated local checks:
  - `utils/roleChecks.ts`
  - `server/src/lib/organizationAuthorization.ts`
  - `server/src/lib/teamAuthorization.ts`
- Owner-only org edit and org join-request review are enforced in current code:
  - `app/(tabs)/organization.tsx`
  - `app/(tabs)/edit-organization.tsx`
  - `app/organization-join-requests.tsx`
  - `server/src/routes/organizations.ts`
- Team management authorization has solid server coverage:
  - `server/src/__tests__/team-membership-authorization.test.ts`
  - `server/src/__tests__/team-transfer-authorization.test.ts`
  - `server/src/__tests__/team-entitlements.test.ts`
  - `server/src/__tests__/team-creation.test.ts`
- Coach approval, rejection, and owner review routes have strong server coverage:
  - `server/src/__tests__/coach-approval.test.ts`
  - `server/src/__tests__/league-review-routes.test.ts`
  - `server/src/__tests__/coach-join-email-review.test.ts`
  - `server/src/__tests__/coach-ui-approval-guards.test.ts`

### Partial
- Team page settings now route to team edit, and org owners can reach edit-team without the extra coach-only client gate:
  - `app/team-page.tsx`
  - `app/(tabs)/edit-team.tsx`
  - but the broader team hub / contacts / public team page experience is still not fully proven end to end.
- Manage Teams, Manage Organization, Approvals, and related coach quick actions still look fragmented across multiple screens.
- Back navigation is broadly migrated to `safeGoBack`, but the checklist’s “every click returns to feed” complaint needs runtime verification across the actual screen graph.

### Not complete
- “Revert organization page back to the previous simple one” is not done.
- The public team/org page quality issues called out in the PDF are not fully resolved from this audit alone.
- The checklist expectation “organization leader controls the organization, coaches only their own teams” is now much closer in code, but the whole UX path is still not fully device-verified.
- Several team checklist bullets remain unproven:
  - team hub opens
  - team contacts opens
  - roster/schedule/media loads
  - invite/accept/decline/remove/change-role flows
  - bulk schedule

## Phase 3 — Feed, Search, Posts, Games, Events

### Verified complete
- Feed/post duplicate protections and post-detail behavior have test coverage:
  - `server/src/__tests__/api-feed-bundle.test.ts`
  - `server/src/__tests__/api-posts.test.ts`
  - `server/src/__tests__/post-upvote-reconciliation.test.ts`
  - `__tests__/post-detail.integration.test.tsx`
- Poll eligibility for non-competitive games is explicitly enforced:
  - `server/src/__tests__/game-poll-eligibility.test.ts`
- Game map date filtering has a client test:
  - `__tests__/game-map-date-filter.test.ts`
- Event creation and event approval race handling have coverage:
  - `server/src/__tests__/event-creation.test.ts`
  - `server/src/__tests__/event-approval-race.test.ts`
  - `server/src/__tests__/event-review-notifications.test.ts`

### Partial
- Search has code paths, but the checklist notes say user/team/org/event search does not work, and there is no strong direct search E2E evidence in the current suite.
- Geofencing has regression coverage:
  - `server/src/__tests__/geofencing-post-grace-window.test.ts`
  - but your checklist note says “audit geofencing because it is not working,” so it stays partial.
- Game/event approval and cancellation logic exist, but a full UI flow is not yet proven by this audit.

### Not complete
- The checklist says polls should only be available inside event/game contexts, but the server still exposes post poll endpoints:
  - `server/src/routes/posts.ts` has `POST /:id/poll` and `POST /:id/poll/vote`
- Search users/teams/orgs/events should be treated as not complete until the spinner issue and result routing are verified on device.
- The “event page active until end of day with a two-hour live window” rule is not fully audited as complete here.
- Several games/events bullets remain unproven:
  - create/edit game
  - score update
  - upload game photos/highlights
  - full event map/filter/edit/cancel/RSVP story

## Phase 4 — Ads, Payments, Admin

### Verified complete
- Ads have substantial state and security coverage:
  - `server/src/__tests__/ad-lifecycle-matrix.test.ts`
  - `server/src/__tests__/ad-state-invariants.test.ts`
  - `server/src/__tests__/ad-approval-race.test.ts`
  - `server/src/__tests__/ad-approval-security.test.ts`
  - `server/src/__tests__/ads-route-gating.test.ts`
  - `server/src/__tests__/ads.test.ts`
- Payment invariants and transaction behavior have coverage:
  - `server/src/__tests__/payment-flow.test.ts`
  - `server/src/__tests__/payments.test.ts`
  - `server/src/__tests__/payments-invariants.test.ts`
  - `server/src/__tests__/payments-finalization.test.ts`
- Admin surface contracts exist for users/teams:
  - `server/src/__tests__/admin-surface-contracts.test.ts`

### Partial
- Ad booking / approval / payment still has major recent churn. The repo has strong invariants, but your checklist notes and recent bug reports show the real workflow is not yet trustworthy end to end.
- Admin ads/reports/messages/metrics screens exist, but this audit does not prove the full operator workflow on device.
- iOS IAP / Android Stripe split has code/tests around billing, but this pass did not fully verify all platform-specific runtime paths.

### Not complete
- Treat the full ad-hosting workflow as not complete until all of this is device-verified together:
  - submit media for approval before booking dates
  - admin review queue and review email
  - booking availability calendar
  - payment confirmation/failure
  - approved ad goes live without stuck pending state
  - no duplicate charges / duplicate reservations
- The checklist’s full Ads section is still not closed.

## Phase 5 — Messaging, Notifications, Uploads, Moderation, Recovery, Accessibility

### Verified complete
- Upload infrastructure and guardrails have coverage:
  - `server/src/__tests__/api-uploads.test.ts`
  - `__tests__/notification-upload-guardrails.test.ts`
  - `__tests__/event-banner-upload.regression.test.ts`
- Report/admin-report server coverage exists:
  - `server/src/__tests__/adminReports.test.ts`
  - `server/src/__tests__/adminReports-email-review.test.ts`
- Notifications message formatting exists:
  - `server/src/__tests__/notifications-messages.test.ts`

### Partial
- Messaging screens/routes exist, but this audit does not prove full conversation send/receive/read-state behavior end to end.
- Push notifications have server-side tests and message helpers, but actual push delivery/opening is still a device/runtime concern.
- Moderation and block flows exist in code, but not all checklist bullets are proven by current tests.

### Not complete
- Offline & recovery section is largely unverified.
- Dark mode & accessibility section is largely unverified.
- Large-text / VoiceOver / TalkBack coverage is not present as a strong verified layer.

## Additional Checklist Notes — Current Audit Verdict

### Verified complete
- OAuth-only account deletion is handled correctly.
- Google/Apple linked-provider rows are conditional, not universal.
- Owner-only org controls are now centralized instead of duplicated.

### Not complete
- Coach downgrade to fan is still missing.
- Search spinner / endless loading issue is still unresolved from this audit.
- “Manage teams” vs “Manage organization” UX simplification is not complete.
- The requested expandable/ripple text button for post copy is not implemented.

## Recommended Execution Order

1. Phase 2 finish: organization/team UX and authority cleanup
2. Phase 3 finish: search, game/event gating, poll contract cleanup
3. Phase 4 finish: ad hosting end-to-end booking and payment
4. Phase 1 cleanup: under-13 rule and coach downgrade path
5. Phase 5 cleanup: messaging/push/offline/accessibility verification
