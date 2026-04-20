# Borders & Workflow Boundaries

Clear visual borders help users understand where one workflow ends and another begins.

## Design tokens

- **`Colors[scheme].border`** — Use for all borders (light: `#D1D5DB`, dark: `#334155`). Never hardcode `#D1D5DB` in components.
- **`Theme.borderWidth`** — `thin` (1px) for list/section dividers, `medium` (2px) for major section or card boundaries.

## When to use what

| Need | Component / pattern |
|------|----------------------|
| Separate two sections of content | `<Divider />` or `<SectionHeader showBorder />` (default) |
| Wrap a logical block (e.g. settings group, form step) | `<Card variant="outlined">` or `<Card variant="strong">` for emphasis |
| Separate list rows | `borderBottomWidth: 1` + `Colors[scheme].border` (e.g. `SettingItem`, list rows) |
| Modal/sheet header from body | `borderBottomWidth: 1` on header with theme border |
| Major workflow boundary (e.g. payment step, approval block) | `<Card variant="strong">` or `<Divider weight="medium" />` |

## Components

- **`Divider`** — Horizontal line. `weight="thin"` (default) or `"medium"`. Use between sections or after a section title.
- **`SectionHeader`** — Section title + optional subtitle/action. **`showBorder={true}`** (default) adds a bottom border so the section is clearly separated from content below.
- **`Card`** — `variant="outlined"` (default): 1px border. `variant="strong"`: 2px border for major boundaries. `variant="default"`: no border (flat). `variant="elevated"`: shadow only.

## Root layout

Main app content is wrapped in `maxWidth: MAX_CONTENT_WIDTH` in `_layout.tsx` so wide screens get a centered column; this is a **width** boundary, not a visible border. Auth and onboarding screens are full-bleed by design.
