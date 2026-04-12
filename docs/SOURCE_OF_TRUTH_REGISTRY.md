# Source of Truth Registry

This registry defines which layer owns each critical state, who may write it, who reads it, and which invariants must always hold. If a change touches one of these fields, review against this file before merge.

| Domain | Owner | Writers | Readers | Backstop | Invariants |
| --- | --- | --- | --- | --- | --- |
| `approval_status` | Server moderation state | Admin moderation actions, organization approval flows | Team creation, game creation, profile badge, coach agreement, pending approval screens, notifications | Server-side role and approval checks | Only trusted server writers may change it. Client never sets it. Valid transitions are `PENDING -> APPROVED` or `PENDING -> REJECTED`. |
| `payment_status` | Server payment state | Stripe webhook finalization, trusted server-side payment finalizers | Ads feed, admin ads, checkout status, analytics | Server ignores client-supplied payment fields | Client must never set `payment_status`. Ad creation starts as `unpaid`. Only verified payment completion may move `unpaid -> paid`. |
| `status` on ads | Server ad lifecycle state | Trusted admin review actions, verified payment finalization | Feed delivery, admin ads, creator ads list | Review endpoints and finalizers validate transitions | New ads start as `draft`. Paid ads only become `active` after verified payment and approval. Rejected ads do not silently revert to payable states. |
| `plan` | Server billing state | Free plan selection, verified subscription checkout/finalization, admin/manual support actions | Onboarding, team limits, subscription UI, billing screens | Billing endpoints verify current state before mutation | Paid plans are not persisted before confirmed checkout. On iOS, paid upgrade entry points must not bypass App Store restrictions. |
| `team_count_total` / effective team quantity | Server billing and entitlement state | Team creation flow, subscription quantity update flow | Team creation limits, billing summary | Team limit endpoints and subscription updates reconcile quantity | Rookie gets first two teams free. Veteran bills per additional team. Legend remains unlimited. |
| `role` | Server identity state | Auth/signup flows, trusted admin actions | Protected routes, onboarding, UI gating | Protected routes re-check on server | Client UI may hide/show options, but authorization must not rely on client role alone. |
| `email_verified` | Server auth state | Email verification endpoints | Checkout, protected onboarding actions, verify screens | Protected endpoints enforce verification | Users cannot perform email-verified-only actions until the server marks verification complete. |
| `session_version` | Server auth session state | Auth/session invalidation paths | Auth middleware, token validation | Auth middleware cache invalidation | Session changes must invalidate stale auth cache and old tokens. |
| `push_token` | Server device state | Auth/device registration flows | Notification delivery jobs | Validation and null-safe delivery checks | Missing tokens must degrade safely. Notification delivery must not assume every user has a valid token. |
| `organization membership` | Server membership state | Invite acceptance, join request approval, admin actions | Organization screens, permissions, coach approval sync | Membership role/status checks on server | Membership acceptance and approval must not drift from `approval_status` for coach flows. |

## Review Rules

- If a field is not listed here and it affects auth, billing, moderation, or entitlements, add it before merging the feature.
- If frontend and backend validations intentionally diverge, document the reason in code and reference the product decision.
- If a writer changes, update this registry in the same PR.
