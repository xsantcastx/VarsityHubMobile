# Profile Layout Parity Audit

Date: 2025-02-14  
Screens Reviewed:
1. User Profile (`app/profile.tsx`)
2. Team Profile (`app/team-profile.tsx`)
3. Organization Overview (`app/organization.tsx`)

## 1. User vs. Team profile

| Area | Team Profile (reference) | User Profile (current) | Gap / Recommendation |
| --- | --- | --- | --- |
| Header container | Single card (`styles.teamOverviewCard`) with avatar, name, sport, stats | New `profileOverviewCard` matches the card look | ✅ Already aligned |
| Avatar | Static gradient fallback, online badge | User uses background color fallback; no status badge | Optional: add status indicator component if we want parity |
| Metadata row | Sport + season inline `teamMeta` | Role tag + bio text, no metadata row | Consider adding location / sport metadata row if product wants parity |
| Quick actions under card | Invite player, manage season `styles.quickActionsCard` | No quick/action module | Decide whether fans need quick shortcuts (e.g., Share profile, Copy link, QR) |
| Stats block | Inside overview card with thin separators | Separate `statsCard` below | Could embed stats into overview card for true parity, but current spacing is acceptable |

### Quick Wins
1. Add an optional `profileMeta` row (location, favorite sport) to mirror `teamMeta`.
2. Consider a small status/verified badge on the avatar (team uses `statusIndicator`).
3. If we need quick actions, repurpose `quickActionsCard` into profile actions (Share, Copy link, settings shortcut).

## 2. Organization page vs. simplified cards
The organization screen still uses the older hero-gradient layout with floating stats and tabs. Compared to the new card-based profiles it feels out of place.

| Area | Organization (`app/organization.tsx`) | Issue | Recommendation |
| --- | --- | --- | --- |
| Hero header | Full-width gradient with large icon, follow button | Doesn’t match the new minimal card aesthetic | Replace hero with `profileOverviewCard`-style component: avatar/logo on left, info on right, follow button as secondary action |
| Floating stats | Semi-transparent cards over hero | Hard to read on light backgrounds | Move stats into a solid card similar to user/team stats |
| Tabs | Pill tabs with icons on gradient background | Colors tied to hero gradient | After header refactor, move tabs below cards with neutral background to match other screens |
| Content padding | ScrollView begins with hero, little spacing | Feels different from Profiles | Add `16px` horizontal padding like other cards |

### Suggested Plan
1. Create shared `ProfileOverviewCard` component that accepts avatar, title, subtitle, role badge, CTA slots.
2. Reuse it in `app/profile.tsx` and `app/organization.tsx` to ensure identical spacing/typography.
3. Move organization stats into a reusable `StatsRow` component (same one user profile now uses).

## Next Steps
1. Build shared components (`ProfileOverviewCard`, `StatsRow`, optional `QuickActionsRow`) under `components/profile/`.
2. Update organization screen to consume the shared pieces.
3. Evaluate if team profile should also switch to shared components for full consistency.
4. Capture screenshots after each migration step for design review.
