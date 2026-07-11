# Accessibility (a11y) Audit — VarsityHub Mobile

- **Date:** 2026-07-11
- **Scope:** `app/` and `components/` (281 `.tsx` files; excludes `node_modules`, `__tests__`, `.claude/worktrees`)
- **Theme source:** `constants/Colors.ts`
- **Method:** static analysis of JSX (brace-depth-aware tag parser) + WCAG contrast computation of theme tokens. Line numbers are anchors for review, not guaranteed exhaustive.

## Summary

| #   | Check                                            | Severity | Count / Result                                                     |
| --- | ------------------------------------------------ | -------- | ------------------------------------------------------------------ |
| 1   | Missing accessibility labels (icon-only buttons) | **High** | ~120 icon-only interactive elements without a label                |
| 2   | Small touch targets (<44x44)                     | Medium   | Widespread; only 36 `hitSlop` uses across 879 interactive elements |
| 3   | Missing alt text on images                       | **High** | 97 of 101 `<Image>` have no `accessibilityLabel` (incl. avatars)   |
| 4   | Color contrast (light theme)                     | Medium   | `mutedText`/`tint`/`destructive` on `surface` marginally < 4.5:1   |
| 5   | Focus order / modal focus trap                   | **High** | 35 of 36 `<Modal>` lack `accessibilityViewIsModal`                 |
| 6   | Dynamic content announcements                    | Medium   | 0 uses of `accessibilityLiveRegion` / `announceForAccessibility`   |
| 7   | Dark mode contrast                               | Medium   | `destructive` on `card`/`surface` = 3.89:1 (< 4.5:1)               |

Overall: **242 of 879** interactive elements (Pressable/Touchable\*) carry an `accessibilityLabel` (~27%). 261 use `accessibilityRole`. Screen-reader coverage is partial and inconsistent — newer/feed screens are labeled, admin and detail screens largely are not.

---

## 1. Missing accessibility labels — HIGH

~120 icon-only `Pressable`/`TouchableOpacity` elements (an icon child, no visible text, no `accessibilityLabel`/`aria-label`). These announce as an unnamed "button" (or nothing) to VoiceOver/TalkBack. Header back buttons are the most repeated offender.

Representative locations:

- `app/blocked-users.tsx:100` — header back chevron, no label
- `app/admin-dashboard.tsx:380`, `:894`, `:986` — icon buttons, no label
- `app/admin-teams.tsx:157`, `:248`
- `app/admin-ads.tsx:501`, `:508`, `:661`
- `app/admin-transactions.tsx:119`
- `app/manage-season.tsx:1412`, `:1427`, `:1637`, `:1741`, `:1923`
- `app/my-ads.tsx:566`, `:578`
- `app/post-detail.tsx:1449`, `:1466`, `:1483`
- `app/team-admin.tsx:383`, `:392`
- `app/report-abuse.tsx:187`, `:306`
- `app/organization-join-requests.tsx:259`, `app/rsvp-history.tsx:137`, `app/public-event.tsx:182`, `app/season-stats.tsx:322`, `app/admin-reports.tsx:371`, `app/game-map.tsx:191`, `app/core-values.tsx:72`, `app/admin-create-event.tsx:235`, `app/reset-password.tsx:125`, `app/profile.tsx:817`, `:1802`

Good pattern already present (use as the template): `app/feed.tsx:1318` — `accessibilityRole="button"` + `accessibilityLabel="Dismiss location prompt"`.

**Fix:** add `accessibilityRole="button"` + a descriptive `accessibilityLabel` to every icon-only control. Standardize header back buttons via a shared component so the label ("Go back") is applied once.

## 2. Small touch targets — MEDIUM

Apple HIG / WCAG 2.5.5 want ~44x44pt minimum. Only **36 `hitSlop`** occurrences exist across **879** interactive elements. Many icon buttons render a 24–28px icon inside minimal padding (e.g. `style={{ paddingRight: 8 }}` on the header back buttons at `app/blocked-users.tsx:100`, `app/admin-dashboard.tsx:380`), yielding a tap target well under 44pt in at least one dimension. Explicit `44` sizing appears in only ~50 lines repo-wide.

**Fix:** add `hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}` (or size the container to `minWidth/minHeight: 44`) on small icon buttons — again best done in the shared header-back and icon-button components.

## 3. Missing alt text on images — HIGH

97 of 101 `<Image>` components have no `accessibilityLabel` (and no `accessibilityRole="image"` / `accessible`). User avatars and content images are affected, so screen-reader users get no description (or hear the raw URI on some platforms).

Representative locations:

- Avatars: `app/message-thread.tsx:425`, `:526`, `app/messages.tsx:368`, `app/profile.tsx:708`, `:883`, `:1061`
- Content/team images: `app/team-page.tsx:501`, `:585`, `:1017`, `:1118`, `:1219`, `app/program-page.tsx:254`, `app/feed.tsx:1756`, `:1839`, `:2133`, `:2345`
- Ad creatives: `app/admin-ads.tsx:356`, `:665`, `app/my-ads.tsx:314`
- Misc: `app/index.tsx:54`, `app/game-photos.tsx:28`, `app/report-abuse.tsx:305`, `app/create-fan-event.tsx:1149`, `:1460`, `:1562`

**Fix:** give meaningful images an `accessibilityLabel` (e.g. `` `${user.name} avatar` ``). Mark purely decorative images `accessibilityElementsHidden`/`importantForAccessibility="no-hide-descendants"` so they're skipped rather than announced as URIs.

## 4. Color contrast — light theme — MEDIUM

Computed WCAG contrast for `Colors.light`. Text on the default white `background` mostly passes; on the `surface`/`card` token (`#F3F4F6`) several tokens fall just below 4.5:1 for normal text:

| Foreground              | On surface `#F3F4F6` | WCAG AA normal (4.5:1)        |
| ----------------------- | -------------------- | ----------------------------- |
| `mutedText` `#6B7280`   | 4.39:1               | FAIL (passes large text / UI) |
| `tint` `#0a7ea4`        | 4.21:1               | FAIL (passes large text / UI) |
| `destructive` `#DC2626` | 4.39:1               | FAIL (passes large text / UI) |

`text` `#11181C` passes everywhere. `border` `#D1D5DB` is 1.34–1.47:1 — fine as a hairline, but too low to be a meaningful non-text boundary (WCAG 1.4.11 wants 3:1) — informational.

**Fix:** darken `mutedText` (e.g. `#5B616B`) and `tint` slightly so secondary/link text on `surface` clears 4.5:1, or reserve those tokens for large text.

## 5. Focus order / modal focus trap — HIGH

36 files use `<Modal>`; only **1** (`app/onboarding/step-3-league.tsx`) uses `accessibilityViewIsModal`/`importantForAccessibility`. Without `accessibilityViewIsModal` (iOS) / `importantForAccessibility="yes"` on the modal container (with siblings set to `no-hide-descendants`), the screen reader can wander into content behind the modal — focus is not trapped. Sampled modals (e.g. `components/AddGameModal.tsx:237`) set `onRequestClose` (good for Android back) but no a11y containment.

**Fix:** add `accessibilityViewIsModal={true}` to the modal's root content view, and hide the underlying screen from assistive tech while a modal/overlay is open.

## 6. Dynamic content announcements — MEDIUM

**Zero** uses of `accessibilityLiveRegion` or `AccessibilityInfo.announceForAccessibility`. The only `AccessibilityInfo` usage (`app/game-details/GameDetailsScreen.tsx:317`, `app/components/MatchBanner.tsx:56`) is reduce-motion detection, not announcements. Loading spinners, inline error messages, and success/toast feedback are silent to screen readers — a user doesn't hear that an action succeeded/failed or that content is loading.

**Fix:** wrap status/error/toast text in a View with `accessibilityLiveRegion="polite"` (Android) and/or call `AccessibilityInfo.announceForAccessibility(msg)` (iOS) when loading/error/success state changes.

## 7. Dark mode contrast — MEDIUM

Computed WCAG contrast for `Colors.dark` (bg `#0f172a`, surface/card `#1e293b`):

| Foreground              | On surface/card `#1e293b` | WCAG AA normal (4.5:1)             |
| ----------------------- | ------------------------- | ---------------------------------- |
| `destructive` `#EF4444` | 3.89:1                    | FAIL (passes large text / UI only) |

`text` `#F5F5F5`, `mutedText` `#94a3b8`, `tint` `#60a5fa`, `icon` `#cbd5e1` all pass on dark surfaces. `border` `#334155` is 1.41–1.72:1 (hairline; below 3:1 non-text — informational).

**Fix:** for error/delete _text_ on dark cards use a lighter red (e.g. `#F87171` ≈ 5.0:1). `#EF4444` is acceptable for large text, icons, and button fills.

---

## Notes / non-issues

- CLAUDE.md hardcoded-dark-text guardrail is effectively clean: the only two grep hits are a test file (`app/game-details/__tests__/GameDetailsScreen.vote.test.tsx:129`) and a `Switch` `trackColor` (`app/onboarding/fan-permissions.tsx:285`) — neither is body text.
- `accessibilityRole` coverage (261) is reasonably close to `accessibilityLabel` coverage (282 raw / 242 on interactive), so where labels exist, roles usually do too.
- Counts are from heuristic static analysis; treat line anchors as starting points for manual confirmation.

## Recommended priority order

1. Icon-only button labels + header-back component (Checks 1 & 2 together — one shared component fixes most).
2. Image `accessibilityLabel` for avatars/content; hide decorative images (Check 3).
3. Modal `accessibilityViewIsModal` + background hiding (Check 5).
4. Live-region announcements for loading/error/success (Check 6).
5. Contrast token tweaks: dark `destructive` text, light `mutedText`/`tint` on surface (Checks 4 & 7).
