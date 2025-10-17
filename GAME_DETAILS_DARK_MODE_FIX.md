# Game Details Screen - Dark Mode Issues

## Overview
The `GameDetailsScreen.tsx` file (2629 lines) has **extensive hardcoded colors** that prevent proper dark mode support. While the file already imports and uses `useColorScheme` and `useThemeColor`, the static `StyleSheet.create()` at the bottom contains 100+ hardcoded hex colors.

## Current Status
✅ Already has: `useColorScheme` hook imported and initialized  
✅ Already has: `useThemeColor` hook being used for some colors  
❌ Problem: Static StyleSheet with 100+ hardcoded colors (lines 1978-2629)

## Critical Hardcoded Colors Found

### Background Colors
- `#FFFFFF` - Main screen background
- `#eff6ff` - Banner wrapper
- `#f8fafc`, `#F3F4F6`, `#f1f5f9` - Card backgrounds
- `#fff`, `white` - Various backgrounds
- `#e5e7eb`, `#e2e8f0` - Borders and dividers
- `#000`, `#020617`, `#0f172a` - Video/story backgrounds

### Text Colors
- `#0f172a`, `#111827`, `#1f2937` - Primary text (dark)
- `#334155`, `#475569` - Secondary text
- `#64748b`, `#6B7280`, `#94a3b8` - Muted text
- `#fff`, `#ffffff` - Light text on dark backgrounds

### Accent Colors
- `#2563EB` - Primary blue (buttons, links)
- `#10B981` - Success green
- `#EF4444`, `#ef4444`, `#DC2626` - Error/danger red
- `#1e3a8a`, `#1e40af` - Dark blue variants

## Recommended Fix

### Option 1: Convert StyleSheet to Dynamic Function (Recommended)

1. **Move StyleSheet.create() into a function:**
```typescript
// Before the component, create a function that returns styles
const createStyles = (colorScheme: 'light' | 'dark') => {
  return StyleSheet.create({
    screen: { 
      flex: 1, 
      backgroundColor: Colors[colorScheme].background 
    },
    // Convert all hardcoded colors to Colors[colorScheme].property
    title: { 
      fontSize: 28, 
      fontWeight: '900', 
      color: Colors[colorScheme].text, 
      marginBottom: 6 
    },
    // ... etc for all 100+ styles
  });
};
```

2. **Use useMemo in component:**
```typescript
const GameDetailsScreen = () => {
  const colorScheme = useColorScheme() ?? 'light';
  
  // Add this line after colorScheme declaration
  const styles = useMemo(() => createStyles(colorScheme), [colorScheme]);
  
  // Rest of component code...
};
```

3. **Replace hardcoded colors with theme colors:**
- `#FFFFFF` → `Colors[colorScheme].background`
- `#0f172a` → `Colors[colorScheme].text`
- `#6B7280` → `Colors[colorScheme].mutedText`
- `#2563EB` → `Colors[colorScheme].tint`
- `#e5e7eb` → `Colors[colorScheme].border`
- `#F3F4F6` → `Colors[colorScheme].surface`
- `#fff` (on dark bg) → Keep as `#fff` (for contrast)
- `#000` (shadows) → Keep as `#000` (shadows work in both themes)

### Option 2: Gradual Migration (If time-constrained)

Focus on the most visible elements first:
1. **Main screen background** (line 1980)
2. **Text colors** (title, bodyText, sectionTitle, etc.)
3. **Card backgrounds** (sheetContainer, voteBar, statCard, etc.)
4. **Button colors** (maintain current for consistency, or use tint)

## Implementation Steps

1. **Backup the file** before making changes
2. **Create the `createStyles` function** above the component
3. **Add `useMemo` hook** inside component after colorScheme
4. **Systematically replace colors**:
   - Start with backgrounds
   - Then text colors
   - Then borders
   - Finally accent colors
5. **Test thoroughly** in both light and dark modes
6. **Keep white text on colored buttons** (#fff on #2563EB is fine)
7. **Keep shadow colors as black** (#000 for shadows is standard)

## Colors Mapping Guide

| Hardcoded Color | Theme Property | Usage |
|-----------------|----------------|-------|
| `#FFFFFF`, `#fff` | `.background` | Main backgrounds |
| `#F3F4F6`, `#f1f5f9` | `.surface` | Card/elevated surfaces |
| `#0f172a`, `#111827` | `.text` | Primary text |
| `#6B7280`, `#64748b` | `.mutedText` | Secondary text |
| `#2563EB` | `.tint` | Primary actions |
| `#e5e7eb`, `#E5E7EB` | `.border` | Borders/dividers |
| `#000` (backgrounds) | `.background` | Only for video/story overlays |
| `#fff` (on buttons) | Keep `#fff` | Contrast on colored buttons |
| Shadows `#000` | Keep `#000` | Shadows work universally |

## Testing Checklist

After implementing dark mode:
- [ ] Main screen background adapts
- [ ] All text is readable in both modes
- [ ] Cards/surfaces have proper contrast
- [ ] Buttons maintain visual hierarchy  
- [ ] Borders are visible but not harsh
- [ ] Stories viewer works in both modes
- [ ] Vote bars are clearly visible
- [ ] Team logos/badges have good contrast
- [ ] Modal overlays work correctly
- [ ] Error states are visible

## Notes

- This is the **largest and most complex screen** in the app
- Contains voting UI, stories, banner images, modals, and complex animations
- Already has theme infrastructure - just needs StyleSheet conversion
- Estimated time: 2-4 hours for full conversion
- Can be done incrementally if needed

## Priority

🔴 **HIGH PRIORITY** - This is a key user-facing screen with many visual elements that become unreadable in dark mode.

---

**File:** `app/game-details/GameDetailsScreen.tsx`  
**Lines:** 2629 total  
**Hardcoded Colors:** 100+  
**Current Dark Mode Support:** Partial (hooks present, styles not dynamic)
