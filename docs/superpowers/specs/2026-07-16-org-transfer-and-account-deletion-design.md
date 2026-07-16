# Design: Accept-based org ownership transfer + permanent account deletion

**Date:** 2026-07-16
**Status:** Approved (design) — Feature A builds now; Feature B deferred to post-fest.
**Owner decisions captured:** transfer must be accepted by the recipient before it
takes effect; account deletion must be immediate + permanent ("deleted for good");
deletion ships **after** the Fanatics Fest weekend (live event, prod blast radius).

## Problem

1. **Ownership transfer is instant today.** `POST /organizations/:id/transfer-ownership`
   moves ownership atomically the moment the current owner calls it — the recipient has
   no say. The owner wants the recipient to have to _accept_ first. Until they accept,
   the initiator remains the owner (and therefore stays blocked from deleting their
   account by the sole-owner guard).
2. **Account deletion is not permanent.** `softDeleteUserAccount` soft-deletes +
   anonymizes; a 30-day `hardDeleteAnonymizedUsers` purge exists but its cron
   (`startAnonymizedUserPurge`) was never registered in `app.ts`, and even the purge
   relies on DB cascade — DMs (`Message` SetNull) and external media (Cloudinary + R2)
   survive. The owner wants deletion to be immediate and total.

Non-goal (explicitly rejected in brainstorming): an org-deletion feature. Orgs remain
non-deletable; transfer is the only exit for a sole owner.

## Feature A — Accept-based ownership transfer (BUILD NOW)

### Data model

New additive table, mirroring the existing `OrganizationInvite` pattern:

```prisma
model OrganizationOwnershipTransfer {
  id              String                 @id @default(cuid())
  organization_id String
  from_user_id    String
  to_user_id      String
  status          OwnershipTransferStatus @default(pending) // pending|accepted|declined|cancelled
  created_at      DateTime               @default(now())
  responded_at    DateTime?

  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  from_user    User @relation("TransferFrom", fields: [from_user_id], references: [id], onDelete: Cascade)
  to_user      User @relation("TransferTo",   fields: [to_user_id],   references: [id], onDelete: Cascade)

  @@index([organization_id, status])
  @@index([to_user_id, status])
}
```

At most one `pending` transfer per org — enforced in a transaction (initiating a new
transfer cancels any existing pending one for that org). Migration is purely additive
(new table + new enum), safe to apply during the live fest.

### Endpoints (thin routes → existing `$transaction` helper)

- `POST /organizations/:id/transfer-ownership` — **CHANGED from immediate to pending.**
  Guards: caller is current owner (`isOrganizationOwnerScoped`), `new_owner_id` is an
  active org member, not self. Cancels any existing pending transfer, creates a new
  `pending` row, writes an in-app `Notification` to the recipient. **Ownership does not
  move.** Returns the pending transfer.
- `POST /organizations/:id/transfer-ownership/accept` — recipient-only (caller ==
  `to_user_id`). Re-validates recipient is still an active member, then runs the
  **existing** atomic transfer `$transaction` (move `Organization.league_owner_id`,
  demote old owner → `manager`, promote recipient → `owner`), marks row `accepted` +
  `responded_at`, notifies the old owner, emits `AdminActivityLog` (`TRANSFER_ORG_OWNERSHIP`).
- `POST /organizations/:id/transfer-ownership/decline` — recipient marks `declined`,
  notifies initiator.
- `POST /organizations/:id/transfer-ownership/cancel` — initiator (current owner)
  cancels a pending transfer.
- Pending transfer is surfaced on the org detail GET (both sides can see state:
  initiator sees "pending acceptance", recipient sees "you have an ownership offer").

### Guard interplay (the point of the feature)

`assertCanSelfDeleteUser` is **unchanged**. While a transfer is only `pending`, the
initiator is still the owner → still throws `SOLE_ORG_OWNER` → still blocked from
account deletion. The block releases only after `accept` actually moves ownership.

### Edge cases

- Recipient left the org before accepting → `accept` fails (re-validate active member).
- New transfer initiated while one is pending → old one auto-cancelled (one pending/org).
- Accept/decline on a non-pending row → 409 (idempotent, already processed).
- Recipient == current owner / non-member / self → 400 at initiate.

### Client (OTA)

- Manage-org screen: after initiating, shows "Transfer pending — waiting for <name> to
  accept", with a Cancel action.
- Recipient: in-app notification + accept/decline prompt on the org page.
- All four states (loading/error/success/empty) on the new surfaces.

### Verification

Extend the existing e2e harness pattern (`server/scripts/e2e/`): seed org + two members,
drive initiate → recipient still-not-owner → initiator still blocked from self-delete →
accept → ownership moved → initiator now unblocked; plus decline, cancel, supersede, and
"recipient left before accepting" paths. Seed→assert→revert against local Postgres.

## Feature B — Immediate permanent account deletion (DESIGN NOW, BUILD POST-FEST)

At delete-confirm time, after `assertCanSelfDeleteUser` passes, replace the
soft-delete+anonymize path with a single hard-delete flow:

1. Destroy DMs: `Message`, `GroupChatMessage`, `GroupChatMember` for the user.
2. Destroy external media best-effort via `runWithBreaker`: avatar, post
   `media_url`/`poster_url` (Cloudinary + R2 via the existing `deleteR2ObjectByUrl` /
   Cloudinary destroy used in `posts.ts`), event banners, coach-application ID docs.
   Media-destroy failures are logged/captured but do not block row deletion; a sweep
   backstop reconciles orphans.
3. `prisma.user.delete` — cascades memberships, comments, votes, follows, tokens.

No soft-delete, no anonymize, no 30-day window, no recovery. The purge cron
(`startAnonymizedUserPurge`) becomes moot and is left unwired (or removed).

**Sequencing:** implement + verify with the seed→delete→probe e2e harness, then deploy
as a deliberate, isolated change **after** the fest weekend (do not co-deploy with
Feature A). This is the only irreversible-in-prod change and must not land during the
live event.

## Rollout / risk

- Feature A migration is additive (new table + enum) → safe under `prisma migrate deploy`
  on the live fest deploy. Server change via push to main; client via `eas update` to
  BOTH runtimes (1.0.5 + 1.0.4 override).
- Feature B is held until post-fest and shipped alone.
