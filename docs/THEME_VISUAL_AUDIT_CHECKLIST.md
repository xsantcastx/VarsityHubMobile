# Theme Visual Audit Checklist

PDF Note 4/9 — visual confirmation that every user-facing screen is readable in light AND dark mode. Structural grep already passed (zero CLAUDE.md text-color violations app-wide); this catches the cases grep can't (low-contrast text from theme tokens, hard-to-read state colors, missing dark-mode emphasis).

## How to use

For each screen:
1. Open it in the dev client.
2. Toggle device appearance: light, then dark.
3. Tick the box only if BOTH modes are readable AND emphasis (titles, errors, states) pops.
4. If a screen fails, leave the box unchecked and add one bullet under it: `- [element] looks washed out in [mode]`. Specific element + mode is what makes it fixable in one commit.

Screens are grouped by user journey. Skip screens you don't normally visit; this is a finite-time pass.

---

## Auth & Onboarding

- [ ] sign-in.tsx
- [ ] sign-up.tsx
- [ ] reset-password.tsx
- [ ] role-onboarding.tsx
- [ ] onboarding/step-1-role.tsx
- [ ] onboarding/step-2-basic.tsx
- [ ] onboarding/step-3-league.tsx
- [ ] onboarding/coach-agreement.tsx
- [ ] onboarding/pending-approval.tsx
- [ ] onboarding/league-pending-approval.tsx
- [ ] onboarding/index.tsx

## Tabs (most-trafficked)

- [ ] feed.tsx
- [ ] (tabs)/notifications/index.tsx
- [ ] profile.tsx
- [ ] (tabs)/edit-profile.tsx
- [ ] (tabs)/discover/mobile-community.tsx

## Posts & Highlights

- [ ] post-detail.tsx
- [ ] (tabs)/create-post.tsx
- [ ] highlights.tsx

## Teams, Orgs, Events

- [ ] (tabs)/event-detail.tsx
- [ ] (tabs)/team-hub.tsx
- [ ] (tabs)/team-page.tsx
- [ ] (tabs)/my-team.tsx
- [ ] (tabs)/team-contacts.tsx
- [ ] (tabs)/manage-teams.tsx
- [ ] (tabs)/organization.tsx
- [ ] (tabs)/edit-team.tsx
- [ ] (tabs)/edit-event.tsx
- [ ] (tabs)/edit-organization.tsx
- [ ] (tabs)/create-team.tsx
- [ ] create-fan-event.tsx
- [ ] manage-season.tsx
- [ ] organizations/index.tsx
- [ ] organizations/[id].tsx
- [ ] organization-invites.tsx
- [ ] team-invites.tsx
- [ ] request-join-organization.tsx
- [ ] team-page.tsx
- [ ] team-viewer.tsx
- [ ] public-event.tsx

## Approval surfaces (league-owner / coach review)

- [ ] (tabs)/approvals.tsx
- [ ] organization-join-requests.tsx
- [ ] (tabs)/event-approvals.tsx
- [ ] game-reviews.tsx

## Ads & Payments

- [ ] my-ads.tsx
- [ ] submit-ad.tsx
- [ ] edit-ad.tsx
- [ ] ad-calendar.tsx
- [ ] ad-confirmation.tsx
- [ ] payment-success.tsx
- [ ] payment-cancel.tsx
- [ ] subscription-paywall.tsx

## Messages

- [ ] messages.tsx

## Settings

- [ ] settings/index.tsx
- [ ] settings/edit-username.tsx
- [ ] settings/zip-code.tsx
- [ ] settings/manage-subscription.tsx
- [ ] settings/billing-history.tsx
- [ ] settings/followed-teams.tsx
- [ ] settings/data-export.tsx
- [ ] settings/contact.tsx
- [ ] settings/feedback.tsx
- [ ] settings/dmca.tsx
- [ ] settings/privacy-policy.tsx
- [ ] settings/terms-of-service.tsx
- [ ] settings/request-host-event.tsx
- [ ] settings/reset-password.tsx

## Admin (super-admin only)

- [ ] admin-dashboard.tsx
- [ ] admin-users.tsx
- [ ] admin-user-detail.tsx
- [ ] admin-teams.tsx
- [ ] admin-ads.tsx
- [ ] admin-reports.tsx
- [ ] admin-messages.tsx
- [ ] admin-transactions.tsx
- [ ] admin-metrics.tsx
- [ ] admin-activity-log.tsx
- [ ] admin-create-event.tsx

---

## What counts as a failure

- Body text that's noticeably gray-on-gray in either mode
- Card titles that don't pop above card background
- Disabled-state text that's indistinguishable from enabled
- Error/warning copy that looks washed out (red on dark backgrounds usually fine; check anyway)
- Placeholder text in inputs that disappears against the input background
- Empty-state illustrations + copy in dark mode (often left as light-mode-only assets)

## What does NOT count

- Brand colors used as semantic accents (red for delete, green for approve) — those are intentionally the same in both modes
- White text on solid-color buttons — intentional
- Sport-themed accent colors on post detail
- Dashboard tile icon colors (each tile has its own brand color)

## Reporting back

For each unchecked box, paste back to me as:
```
- [screen]: [specific element], [light|dark], [what's wrong]
```

Example:
```
- (tabs)/event-detail.tsx: location subtitle, dark, gray-on-darker-gray, illegible
- ad-confirmation.tsx: "Awaiting payment" badge text, light, white-on-light-yellow, washed out
```

I'll group those into targeted single-element fixes. Each one becomes one or two lines of code touching only the named element.
