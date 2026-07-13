# Comprehensive Text Color Fix - Light & Dark Mode Readability

## Problem

Found **885+ instances** of hardcoded text colors that don't adapt to light/dark mode, causing poor readability.

## Solution Pattern

### Replace ALL hardcoded text colors with theme colors:

```tsx
// ❌ WRONG - Hardcoded colors
<Text style={{ color: '#111827' }}>Text</Text>
<Text style={{ color: colorScheme === 'dark' ? '#ECEDEE' : '#11181C' }}>Text</Text>
<Text style={{ color: isDark ? '#ECEDEE' : '#11181C' }}>Text</Text>

// ✅ CORRECT - Theme colors
import { Colors } from '@/constants/Colors';
const colorScheme = useColorScheme();
const palette = Colors[colorScheme ?? 'light'];

<Text style={{ color: palette.text }}>Main text</Text>
<Text style={{ color: palette.mutedText }}>Secondary text</Text>
<Text style={{ color: palette.destructive }}>Error text</Text>
```

## Critical Fixes Applied

### ✅ Profile Page (app/profile.tsx)

- Fixed "Create Your First Post" button: White text (#FFFFFF) on tint background
- Fixed all muted text: Better contrast in light mode (#4B5563)
- All text now uses theme colors

### ✅ Sign-In Page (app/sign-in.tsx)

- Error text uses `palette.destructive`
- Google button uses theme colors
- All text adapts to theme

### 🔄 Settings Pages (app/settings/\*.tsx)

**Need to fix in each file:**

1. Add `import { Colors } from '@/constants/Colors';`
2. Replace `{ color: isDark ? '#ECEDEE' : '#11181C' }` → `{ color: Colors[colorScheme].text }`
3. Replace `{ color: isDark ? '#9CA3AF' : '#6B7280' }` → `{ color: Colors[colorScheme].mutedText }`

**Files to fix:**

- settings/index.tsx (partially fixed)
- settings/contact.tsx (partially fixed)
- settings/request-host-event.tsx
- settings/zip-code.tsx
- settings/manage-subscription.tsx
- settings/followed-teams.tsx
- settings/feedback.tsx
- settings/edit-username.tsx
- settings/reset-password.tsx
- settings/rsvp-history.tsx
- settings/favorites.tsx
- settings/core-values.tsx
- settings/blocked-users.tsx

## Common Replacements

| Hardcoded Pattern                                | Replace With                                                                 |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| `isDark ? '#ECEDEE' : '#11181C'`                 | `Colors[colorScheme].text`                                                   |
| `colorScheme === 'dark' ? '#ECEDEE' : '#11181C'` | `Colors[colorScheme].text`                                                   |
| `isDark ? '#9CA3AF' : '#6B7280'`                 | `Colors[colorScheme].mutedText`                                              |
| `colorScheme === 'dark' ? '#9CA3AF' : '#6B7280'` | `Colors[colorScheme].mutedText`                                              |
| `'#111827'`, `'#11181C'`, `'#374151'`            | `Colors[colorScheme].text`                                                   |
| `'#6B7280'`, `'#9CA3AF'`                         | `Colors[colorScheme].mutedText` (or `'#4B5563'` for light mode if too light) |
| `'#b91c1c'`, `'#DC2626'`                         | `Colors[colorScheme].destructive`                                            |

## Button Text Colors

### Buttons with Tint Background:

```tsx
// Always use white text for good contrast
<Pressable style={{ backgroundColor: Colors[colorScheme].tint }}>
  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Button Text</Text>
</Pressable>
```

### Buttons with Surface Background:

```tsx
// Use theme text color
<Pressable style={{ backgroundColor: Colors[colorScheme].surface }}>
  <Text style={{ color: Colors[colorScheme].text }}>Button Text</Text>
</Pressable>
```

## Files Still Needing Fixes (Priority Order)

### High Priority (User-Facing Screens):

1. ✅ profile.tsx - DONE
2. ✅ sign-in.tsx - DONE
3. sign-up.tsx
4. feed.tsx (partially fixed)
5. highlights.tsx
6. (tabs)/discover/index.tsx
7. (tabs)/create-post.tsx

### Medium Priority (Settings):

8. All app/settings/\*.tsx files (10+ files)

### Lower Priority:

9. Admin screens
10. Onboarding screens
11. Other utility screens

## Verification Checklist

For each file fixed:

- [ ] Added `import { Colors } from '@/constants/Colors';`
- [ ] Replaced all hardcoded text colors with `Colors[colorScheme].text` or `Colors[colorScheme].mutedText`
- [ ] Button text uses appropriate contrast (white on tint, theme text on surface)
- [ ] Tested in both light and dark mode
- [ ] Text is readable with WCAG AA contrast (4.5:1 for normal text)
