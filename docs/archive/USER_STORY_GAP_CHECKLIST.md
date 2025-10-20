# User Story Gap Checklist

This checklist tracks the remaining user stories and cross-cutting requirements that are not yet implemented. Source references are from `Next_implementation.md` for story definitions and `FINAL_IMPLEMENTATION_STATUS.md` for current coverage.

## High-Priority Functional Gaps

| Epic | Story / Requirement | Status | Notes |
|------|---------------------|--------|-------|
| Subscriptions, Pricing & Billing | Plan tiers (Rookie/Veteran/Legend) | Not started | Stripe products/proration logic still outstanding (server work). |
| Subscriptions, Pricing & Billing | Ad hosting checkout (weekday/weekend/single-day pricing) | Not started | Checkout session + charge logging not wired up yet. |
| Subscriptions, Pricing & Billing | Promo codes with global caps | Not started | Requires DB schema + redemption enforcement. |
| Maps & Calendar | Google Calendar sync for schools | Not started | OAuth + daily sync job and dedupe logic pending. |
| Infrastructure & Data | Transaction logging for Stripe charges | Not started | Needs persistence layer for totals/tax/fees/promo usage. |
| Infrastructure & Data | Media storage policy (retention + at-rest encryption toggle) | Not started | Documented toggle + CDN validation still required. |

## Experience Polish & Platform Compliance

| Area | Detail | Status | Notes |
|------|--------|--------|-------|
| Safe-area & layout polish | Ensure every screen respects top/bottom insets on iOS/Android | In progress | Core feeds, highlights, create post, ad scheduling, and submit ad now include dynamic padding. Remaining screens need audit. |
| Authentication UX | “Use floor for login credentials” layout adjustment | Blocked on design | Awaiting clarified design assets before implementing. |
| Email verification | Fans must verify email during onboarding | ✅ Complete | Implemented gating in `step-2-basic` (Oct 2025). |

## Tracking Tips

1. When closing a story above, update both `Next_implementation.md` (status) and this checklist.
2. For backend items, include commit references or ticket IDs when available.
3. Use the checklist during sprint planning to surface blocked items or required approvals (e.g., Stripe dashboard setup).

