---
name: trust-and-safety
description: Product/UX and client-side trust & safety for VarsityHub — a platform with real minors on it. Use when building or reviewing anything touching minors, DMs/messaging, follows, blocking, reporting/flagging, content moderation, user-generated media, privacy of profiles/teams, account deletion, or age-gating. Reinforces the server-enforced safety invariants already in the codebase (userAge, privacyUtils, moderation, AbuseReport) so new UI never bypasses them. Fails closed.
---

# Trust & Safety (VarsityHub)

VarsityHub has **real minors** on it. Safety here is not a feature — it is a constraint on every feature that touches users, messaging, or user-generated content. The server already enforces the hard invariants; this skill is the **product/UX and client side** so a new screen, API call, or flow never quietly routes around them.

**Golden rule: safety decisions are server-authoritative and fail closed.** The client's job is to _reflect_ server state and _not create_ paths that dodge a server gate — never to _decide_ safety itself. If a check can't be answered, treat the answer as "no."

## Where the server truth lives (reuse — never re-derive)

| Concern                | Server source of truth                                                                                                     | Client rule                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Age / minor status     | `server/src/lib/userAge.ts` — `isMinor()`, `isVerifiedAdult()`, `getUserAge()`. **Null DOB = treated as minor / blocked.** | Never infer age client-side; never gate on `getUserAge() !== null`.                                                                 |
| Blocking               | `server/src/lib/privacyUtils.ts` — `getBlockedUserIds`; applied to posts, DM history, game posts, profiles                 | Every content list you render must already be block-filtered server-side; don't build a client list that re-includes blocked users. |
| Private teams/profiles | `privacyUtils.ts` — `isTeamHiddenFromViewer`, `getExcludedPrivateTeamIds`                                                  | Don't surface a team/profile the API omitted; don't reconstruct it from a cached copy.                                              |
| Media hosts            | `isAllowedPostMediaUrl` (in `routes/posts.ts`) — platform hosts + R2 + data:/relative only                                 | Don't render or upload off-allowlist media URLs; off-platform URLs are a moderation-bypass + tracking-pixel vector.                 |
| Moderation actions     | `server/src/lib/moderation.ts` — `issueWarning`, `autoEscalate`, `suspendUser`, `checkReportSpike`                         | Client shows outcomes; it never sets warning/suspension state.                                                                      |
| Reports & warnings     | Prisma models `AbuseReport`, `UserWarning`, `BlockedUser`                                                                  | Report writes go through the API; every report is auditable.                                                                        |

When you add a **parallel path** (a new endpoint, a bulk variant, a new screen that lists content), the recurring failure mode is _bypassing the single safe pipeline without re-implementing its checks_. Reuse the helper above — don't copy the query and drop the filter.

## Minor protection — the non-negotiables

These mirror server invariants; keep the UI consistent with them so users never see a control that the server will (correctly) reject.

- **Adult ↔ minor DM requires an _accepted_ follow.** A pending follow grants nothing. Don't show a "Message" affordance between an adult and a minor unless the follow is `status: 'accepted'`. The server enforces this via `isMinor()`/`isVerifiedAdult()`; the UI should not dangle a button that 403s.
- **Null date-of-birth = minor.** Any UI that unlocks adult-only capability must treat unknown age as _not_ an adult. Fail closed.
- **No adult-discovery of minors by default.** Search, suggestions, and "people you may know" must respect the same visibility filters — don't build a discovery surface that skips them.
- **Age-appropriate defaults.** New user-facing toggles that widen exposure (public profile, discoverability, DMs open) default to the _safer_ state for minors.

## Blocking & reporting — every user-content surface needs both

If a screen shows another user's content (posts, comments, DMs, profiles, ads, team pages), it must offer:

1. **Report / flag** — routed to the API (creates an `AbuseReport`), with a short reason list. The feed's ad report flow (`submitAdReport` in `app/feed.tsx`, reasons: spam / false_information / other) is the shape to mirror for other content types.
2. **Block** — and once blocked, the block must take effect everywhere, because the server merges block filters into every content read. Don't leave a surface where a blocked user's content still appears.
3. **Idempotent, honest feedback** — "Already reported" when a dup, "Report sent" on success (again, see the feed ad-report Alerts). Never silently swallow a failed report.

**Blocking is not just hiding.** It must sever interaction: no DMs, no new follows, no comment visibility. The server's `getBlockedUserIds` merge (`{ equals }` semantics, never clobbering a scoped query into a global one) is what guarantees this — don't defeat it client-side by re-querying without the filter.

## User-generated media

- **Only render/upload allowlisted media hosts.** `media_url`/`poster_url` must pass `isAllowedPostMediaUrl` server-side; the client should upload via the signed Cloudinary/R2 path, not accept arbitrary URLs.
- **Assume every upload is public-ish.** Design captions/prompts so a user isn't tricked into oversharing (location, school, full name of a minor).
- **Report path on every piece of media**, including highlights and ad creatives.

## Privacy of profiles & teams

- **Private = excluded from every public surface.** Highlights, feed, `?team_id=`, org serialization, and share landings all filter private/hidden teams (`isTeamHiddenFromViewer`). A new public list you add inherits this responsibility.
- **Share landings mirror the in-app gates** — approved / non-cancelled / non-private / non-deleted only; a private profile never leaks bio/avatar. If you touch a share/deep-link surface, keep it behind the same gate. (And per project rule: **no new screens/landings without explicit approval.**)
- **Deep-link params are allowlisted** via `buildRouteParams()` — don't pass raw params into a route; fail closed for privileged actions, degrade gracefully for public nav.

## Account lifecycle & "no ownerless resources"

- **A sole team owner / sole org authority cannot self-delete** (`assertCanSelfDeleteUser`) — surface _why_ (transfer ownership first) rather than a dead error.
- **Removing staff syncs downstream access** — losing a team role also removes group-chat access (`removeUserFromTeamGroupChats`). If you build a remove/demote UI, don't leave the ex-member with lingering chat or content access.

## The safe-feature checklist (run for anything user-facing)

- [ ] Does this surface another user's content or identity? → it has **report + block**, both wired to the API.
- [ ] Could an **adult reach a minor** through it (DM, follow, discovery, comment)? → gated on an **accepted** follow + `isMinor`/`isVerifiedAdult`; **null DOB = minor**.
- [ ] Is there a **new query/endpoint** listing content? → it reuses `getBlockedUserIds` + private-team filters, not a copy that drops them.
- [ ] Any **media**? → allowlisted host only; upload via signed path.
- [ ] Any **new default** that widens exposure? → defaults to the safer state, especially for minors.
- [ ] Does it **fail closed**? → an unknown/erroring safety check denies, never allows.
- [ ] Is the safety-relevant state **server-authoritative**? → the client reflects it, never decides it.
- [ ] Any **moderation/admin action**? → it writes an audit row (`AbuseReport` / `UserWarning` / `AdminActivityLog`) and can't be triggered by a non-privileged client.
- [ ] **No silent catch** in a safety path → failures are logged with a `[context]` prefix and surfaced to the user.

## Anti-patterns (do not ship)

- A client flag that decides who can DM/see/contact whom (it must come from the server).
- A "Message" / "Follow" button shown before the server confirms it's allowed → it 403s and reads as broken.
- A new content list that copies an existing query but omits the block / private-team filter.
- Rendering media from an arbitrary URL "just this once."
- A report/flag action that swallows its error, or that isn't offered on some content surfaces but is on others.
- Treating missing age data as "adult." Missing = minor = restricted.

When in doubt, prefer the **more restrictive** behavior and reuse the **existing server helper** — the safe path already exists; the risk is a sibling path that skips it.
