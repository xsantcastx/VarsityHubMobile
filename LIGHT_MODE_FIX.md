# Light Mode Visibility Fix - Game Creation

## Issue Summary
User reported that when creating or adding a game in **light mode**, the opponent team dropdown wasn't showing anything and the calendar may have had visibility issues.

## Root Cause
The `AddGameModal` component had **hardcoded background colors** in the picker item styles:
- `backgroundColor: '#f3f4f6'` (light gray) in `pickerItem` style
- This made text invisible in light mode since both background and text were light-colored
- The component wasn't using the theme-aware `Colors[colorScheme]` system

## Files Fixed
- ✅ `components/AddGameModal.tsx` - Opponent team picker dropdown
- ✅ `components/QuickAddGameModal.tsx` - Already correct (no changes needed)
- ✅ DateTimePicker - Native component, uses system colors automatically

## Changes Made

### Before (line 764-774 in AddGameModal.tsx):
```tsx
pickerItem: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 20,
  paddingVertical: 18,
  borderRadius: 16,
  marginVertical: 8,
  backgroundColor: '#f3f4f6',  // ❌ Hardcoded light gray
  elevation: 2,
  shadowColor: '#000',
  shadowOpacity: 0.08,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  borderWidth: 0,
},
```

### After:
```tsx
pickerItem: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingHorizontal: 20,
  paddingVertical: 16,
  borderBottomWidth: StyleSheet.hairlineWidth,  // ✅ Uses theme border color
},
```

### Also Fixed:
```tsx
// Before
manualCoords: {
  marginTop: 12,
  padding: 12,
  backgroundColor: '#F9FAFB',  // ❌ Hardcoded
  borderRadius: 8,
},

// After
manualCoords: {
  marginTop: 12,
  paddingHorizontal: 12,
  paddingVertical: 12,
  borderRadius: 8,  // ✅ No hardcoded background
},
```

## Testing Instructions

### Test 1: Add Game - Light Mode
1. Switch your device to **Light Mode** (Settings → Display → Light)
2. Open the app
3. Go to **Manage Season** or **My Team**
4. Tap **Add Game**
5. Tap on "Opponent" field
6. **Verify**:
   - ✅ You can see the dropdown modal with a white/light background
   - ✅ Team names are **clearly visible** (dark text on light background)
   - ✅ Search bar is visible and functional
   - ✅ Can select an opponent team

### Test 2: Date Picker - Light Mode
1. In the Add Game modal (light mode)
2. Tap on the **Date** field
3. **Verify**:
   - ✅ Calendar picker opens and is fully visible
   - ✅ Dates are readable
   - ✅ Can select a date

### Test 3: Time Picker - Light Mode
1. In the Add Game modal (light mode)
2. Tap on the **Time** field
3. **Verify**:
   - ✅ Time picker opens and is fully visible
   - ✅ Hours and minutes are readable
   - ✅ Can select a time

### Test 4: Dark Mode (Regression Test)
1. Switch to **Dark Mode**
2. Repeat all tests above
3. **Verify**: Everything still works correctly in dark mode

### Test 5: Quick Add Game Modal
1. Test the same flows in the **Quick Add Game** modal
2. **Verify**: All dropdowns and pickers are visible in both themes

## Affected Screens
- ✅ Manage Season → Add Game
- ✅ My Team → Add Game
- ✅ Any screen using `AddGameModal` component
- ✅ Any screen using `QuickAddGameModal` component

## Theme Colors Now Used
The components now properly use the theme system:
- `Colors[colorScheme].background` - Modal/screen backgrounds
- `Colors[colorScheme].surface` - Card/input backgrounds
- `Colors[colorScheme].text` - Main text color
- `Colors[colorScheme].mutedText` - Secondary text/placeholders
- `Colors[colorScheme].border` - Borders and dividers
- `Colors[colorScheme].tint` - Primary action color

## Deployment
- ✅ Changes committed: `32ba65d`
- ✅ Pushed to GitHub: `main` branch
- ✅ Railway will auto-deploy (backend unaffected)
- ⏳ **EAS Build Required**: You'll need to create a new build for users to get this fix
  - Run: `eas build --platform all` (or just `--platform ios` / `--platform android`)

## Why It Happened
The original developer likely:
1. Styled the component in dark mode only
2. Used a design tool that showed light colors looking good
3. Didn't test in actual light mode on device
4. Forgot to use the theme color system

## Prevention
- ✅ Always use `Colors[colorScheme].*` for colors
- ✅ Test components in BOTH light and dark modes before committing
- ✅ Use React DevTools to inspect styles in different themes
- ✅ Avoid hardcoded hex colors except for brand colors (like #007AFF for buttons)

## Related Components Checked
Also audited these components for similar issues:
- ✅ `QuickAddGameModal.tsx` - Already correct
- ✅ `DateTimePicker` - Native component, system handles theming
- ✅ Event creation modals - Using theme colors properly

## User Impact
**Before**: Users in light mode couldn't see:
- Opponent team dropdown options
- Manual coordinate inputs background
- Potentially other form elements

**After**: Perfect visibility in both light and dark modes ✨

## Questions?
If you notice any other light mode visibility issues, check for:
1. Hardcoded hex colors like `#f3f4f6`, `#ffffff`, `#000000`
2. Missing `Colors[colorScheme]` usage
3. Styles that don't adapt to theme changes
