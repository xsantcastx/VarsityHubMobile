# 📱 Quick Reference - Screen Compliance

## ✅ Current Compliant Screens (8)

| Screen | File | Status |
|--------|------|--------|
| Feed | `feed.tsx` | ✅ SafeArea + Dark Mode |
| Manage Season | `manage-season.tsx` | ✅ SafeArea + Dark Mode |
| Manage Teams | `manage-teams.tsx` | ✅ SafeArea + Dark Mode |
| Team Profile | `team-profile.tsx` | ✅ SafeArea + Dark Mode |
| Settings | `settings/index.tsx` | ✅ SafeArea + Dark Mode |
| Profile | `profile.tsx` | ✅ SafeArea + Dark Mode |
| Ad Calendar | `ad-calendar.tsx` | ✅ SafeArea + Dark Mode |
| My Ads | `my-ads2.tsx` | ✅ SafeArea + Dark Mode |

---

## 🔧 Quick Fix Patterns

### Pattern 1: Add SafeAreaView
```typescript
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  
  return (
    <SafeAreaView 
      style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}
      edges={['top', 'bottom']} // or ['top'] for screens with tabs
    >
      {/* content */}
    </SafeAreaView>
  );
}
```

### Pattern 2: Add Dark Mode
```typescript
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export default function MyScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  
  return (
    <View style={{ backgroundColor: Colors[colorScheme].background }}>
      <Text style={{ color: Colors[colorScheme].text }}>Hello</Text>
    </View>
  );
}
```

### Pattern 3: Dynamic Styles
```typescript
// Instead of StyleSheet with fixed colors
const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF', // ❌ Hardcoded
  }
});

// Use inline dynamic styles
<View style={[
  styles.container,
  { backgroundColor: Colors[colorScheme].card } // ✅ Dynamic
]} />
```

---

## 🎨 Theme Color Properties

Available color keys in `Colors[colorScheme]`:

- `background` - Main background
- `card` - Card/surface background
- `text` - Primary text
- `mutedText` - Secondary/muted text
- `tint` - Primary brand color
- `primary` - Primary actions
- `border` - Borders and dividers
- `accent` - Accent color
- `success` - Success states
- `warning` - Warning states
- `error` - Error states
- `tabIconDefault` - Inactive tab icons
- `tabIconSelected` - Active tab icons
- `surface` - Alternative surface

---

## 📏 Safe Area Best Practices

### Use SafeAreaView for full-screen layouts
```typescript
<SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
  <ScrollView>{/* content */}</ScrollView>
</SafeAreaView>
```

### Use useSafeAreaInsets for custom positioning
```typescript
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function MyComponent() {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {/* content */}
    </View>
  );
}
```

### For screens with bottom tabs
```typescript
<SafeAreaView style={{ flex: 1 }} edges={['top']}>
  {/* TabBar handles bottom safe area */}
</SafeAreaView>
```

---

## 🚨 Common Issues & Fixes

### Issue 1: White flash when switching to dark mode
**Fix:** Ensure root container has dynamic background
```typescript
<View style={{ flex: 1, backgroundColor: Colors[colorScheme].background }}>
```

### Issue 2: Content hidden behind notch/camera
**Fix:** Add SafeAreaView or padding
```typescript
<SafeAreaView style={{ flex: 1 }} edges={['top']}>
```

### Issue 3: Text unreadable in dark mode
**Fix:** Use dynamic text colors
```typescript
<Text style={{ color: Colors[colorScheme].text }}>
```

### Issue 4: Borders invisible in dark mode
**Fix:** Use theme border colors
```typescript
borderColor: Colors[colorScheme].border
```

---

## ✅ Compliance Checklist

For each screen, verify:

- [ ] Imports `SafeAreaView` from `react-native-safe-area-context`
- [ ] Imports `useColorScheme` from `@/hooks/useColorScheme`
- [ ] Imports `Colors` from `@/constants/Colors`
- [ ] Uses `SafeAreaView` as root or applies safe area insets
- [ ] All backgrounds use `Colors[colorScheme].background` or `.card`
- [ ] All text uses `Colors[colorScheme].text` or `.mutedText`
- [ ] All borders use `Colors[colorScheme].border`
- [ ] No hardcoded hex colors in styles
- [ ] Tested on iPhone (with notch)
- [ ] Tested on Android (with different aspect ratios)
- [ ] Tested in light mode
- [ ] Tested in dark mode

---

## 🎯 Priority Order

### Phase 1 (Critical - Week 1)
1. `sign-in.tsx`
2. `sign-up.tsx`
3. `onboarding/` screens
4. `index.tsx` (landing)

### Phase 2 (High - Week 2)
1. `create-team.tsx`
2. `edit-team.tsx`
3. `game-detail.tsx`
4. `create-post.tsx`

### Phase 3 (Medium - Week 3)
1. All game screens
2. All team screens
3. Social features

### Phase 4 (Low - Week 4)
1. Admin screens
2. Settings sub-pages
3. Help/support screens

