# Dark Mode Text Readability Fixes

## Summary
Found **885 instances** of hardcoded colors across app screens. Focused on fixing text readability for both light and dark modes.

## Pattern to Follow

### ✅ Correct Pattern:
```tsx
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const colorScheme = useColorScheme() ?? 'light';
const palette = Colors[colorScheme];

// For text colors
<Text style={{ color: palette.text }}>Main text</Text>
<Text style={{ color: palette.mutedText }}>Secondary text</Text>
<Text style={{ color: palette.destructive }}>Error text</Text>

// For backgrounds
<View style={{ backgroundColor: palette.background }} />
<View style={{ backgroundColor: palette.card }} />
<View style={{ backgroundColor: palette.surface }} />

// For borders
<View style={{ borderColor: palette.border }} />
```

### ❌ Avoid:
```tsx
// Hardcoded colors - won't adapt to dark mode
<Text style={{ color: '#111827' }}>Text</Text>
<Text style={{ color: '#6B7280' }}>Text</Text>
<View style={{ backgroundColor: '#FFFFFF' }} />
```

## Theme Colors Available

From `constants/Colors.ts`:

**Light Mode:**
- `text`: '#11181C' - Main text
- `mutedText`: '#6B7280' - Secondary/muted text
- `background`: '#FFFFFF' - Main background
- `card`: '#FFFFFF' - Card backgrounds
- `surface`: '#F3F4F6' - Surface elements
- `border`: '#E5E7EB' - Borders
- `destructive`: '#DC2626' - Error/delete actions
- `tint`: '#0a7ea4' - Primary accent

**Dark Mode:**
- `text`: '#F5F5F5' - Main text
- `mutedText`: '#94a3b8' - Secondary/muted text
- `background`: '#0f172a' - Main background
- `card`: '#1e293b' - Card backgrounds
- `surface`: '#1e293b' - Surface elements
- `border`: '#334155' - Borders
- `destructive`: '#EF4444' - Error/delete actions
- `tint`: '#60a5fa' - Primary accent

## Files Fixed

### ✅ Completed:
1. **app/profile.tsx** - All text colors use theme
2. **app/sign-in.tsx** - Fixed hardcoded colors for buttons and error text

### 🔄 Remaining (30+ files with hardcoded colors):
- app/feed.tsx (verification banner text)
- app/sign-up.tsx
- app/settings/*.tsx (multiple files)
- app/onboarding/*.tsx
- app/(tabs)/*.tsx (various)

## Common Replacements

| Hardcoded Color | Replace With | Use Case |
|----------------|--------------|----------|
| `#111827`, `#374151`, `#1f2937` | `palette.text` | Main text |
| `#6B7280`, `#94a3b8`, `#9CA3AF` | `palette.mutedText` | Secondary text |
| `#FFFFFF`, `#fff` | `palette.card` or `palette.background` | White backgrounds |
| `#E5E7EB`, `#D1D5DB` | `palette.border` | Borders |
| `#F3F4F6`, `#F5F9FF` | `palette.surface` | Surface backgrounds |
| `#b91c1c`, `#DC2626` | `palette.destructive` | Error text |

## Priority Order

1. ✅ **Critical user-facing screens** (sign-in, profile) - DONE
2. 🔄 **Main app screens** (feed, discover, highlights)
3. 🔄 **Settings pages** (most text-heavy)
4. 🔄 **Onboarding flows** (important first impression)
5. 🔄 **Admin/management screens**

## Notes

- Google icon brand color `#4285F4` can stay hardcoded (brand requirement)
- Some warning/alert colors may need custom logic but should still adapt to theme
- Icons should use `palette.icon` or `palette.text` for better contrast
