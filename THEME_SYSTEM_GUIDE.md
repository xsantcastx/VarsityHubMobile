# 🎨 VarsityHub Multi-Theme System

## Overview
A feature-flag based theme system that allows easy activation/deactivation of sport-themed color schemes without code changes.

---

## 🎯 5 Sport-Themed Color Schemes

### 1. 🌊 **Ocean Blue** (Default/Basketball)
**Vibe:** Clean, energetic, modern  
**Best for:** Basketball, Swimming, Winter Sports

#### Light Mode
```typescript
{
  tint: '#0EA5E9',        // sky-blue-500
  primary: '#0284C7',     // sky-blue-600
  background: '#FFFFFF',
  card: '#F8FAFC',        // slate-50
  text: '#0F172A',        // slate-900
  border: '#E2E8F0',      // slate-200
  accent: '#06B6D4',      // cyan-500
  success: '#14B8A6',     // teal-500
  warning: '#F59E0B',     // amber-500
  error: '#EF4444',       // red-500
  mutedText: '#64748B',   // slate-500
}
```

#### Dark Mode
```typescript
{
  tint: '#38BDF8',        // sky-blue-400
  primary: '#0EA5E9',     // sky-blue-500
  background: '#0F172A',  // slate-900
  card: '#1E293B',        // slate-800
  text: '#F1F5F9',        // slate-100
  border: '#334155',      // slate-700
  accent: '#22D3EE',      // cyan-400
  success: '#2DD4BF',     // teal-400
  warning: '#FBBF24',     // amber-400
  error: '#F87171',       // red-400
  mutedText: '#94A3B8',   // slate-400
}
```

---

### 2. 🌲 **Forest Green** (Football/Soccer)
**Vibe:** Athletic, competitive, grounded  
**Best for:** Football, Soccer, Baseball, Rugby

#### Light Mode
```typescript
{
  tint: '#10B981',        // emerald-500
  primary: '#059669',     // emerald-600
  background: '#FFFFFF',
  card: '#F0FDF4',        // green-50
  text: '#064E3B',        // emerald-900
  border: '#D1FAE5',      // emerald-200
  accent: '#22C55E',      // green-500
  success: '#16A34A',     // green-600
  warning: '#EAB308',     // yellow-500
  error: '#DC2626',       // red-600
  mutedText: '#059669',   // emerald-600
}
```

#### Dark Mode
```typescript
{
  tint: '#34D399',        // emerald-400
  primary: '#10B981',     // emerald-500
  background: '#022C22',  // emerald-950
  card: '#064E3B',        // emerald-900
  text: '#D1FAE5',        // emerald-200
  border: '#065F46',      // emerald-800
  accent: '#4ADE80',      // green-400
  success: '#22C55E',     // green-500
  warning: '#FDE047',     // yellow-300
  error: '#F87171',       // red-400
  mutedText: '#6EE7B7',   // emerald-300
}
```

---

### 3. 🌅 **Sunset Orange** (High Energy)
**Vibe:** Bold, energetic, exciting  
**Best for:** Track & Field, Volleyball, Extreme Sports

#### Light Mode
```typescript
{
  tint: '#F97316',        // orange-500
  primary: '#EA580C',     // orange-600
  background: '#FFFFFF',
  card: '#FFF7ED',        // orange-50
  text: '#7C2D12',        // orange-900
  border: '#FED7AA',      // orange-200
  accent: '#FB923C',      // orange-400
  success: '#84CC16',     // lime-500
  warning: '#FBBF24',     // amber-400
  error: '#DC2626',       // red-600
  mutedText: '#C2410C',   // orange-700
}
```

#### Dark Mode
```typescript
{
  tint: '#FB923C',        // orange-400
  primary: '#F97316',     // orange-500
  background: '#431407',  // orange-950
  card: '#7C2D12',        // orange-900
  text: '#FED7AA',        // orange-200
  border: '#9A3412',      // orange-800
  accent: '#FDBA74',      // orange-300
  success: '#A3E635',     // lime-400
  warning: '#FDE047',     // yellow-300
  error: '#F87171',       // red-400
  mutedText: '#FDBA74',   // orange-300
}
```

---

### 4. 👑 **Royal Purple** (Premium/Elite)
**Vibe:** Premium, elite, championship  
**Best for:** Premium tier, Championship events, Elite teams

#### Light Mode
```typescript
{
  tint: '#9333EA',        // purple-600
  primary: '#7C3AED',     // violet-600
  background: '#FFFFFF',
  card: '#FAF5FF',        // purple-50
  text: '#581C87',        // purple-900
  border: '#E9D5FF',      // purple-200
  accent: '#A855F7',      // purple-500
  success: '#22C55E',     // green-500
  warning: '#F59E0B',     // amber-500
  error: '#DC2626',       // red-600
  mutedText: '#7C3AED',   // violet-600
}
```

#### Dark Mode
```typescript
{
  tint: '#C084FC',        // purple-400
  primary: '#A855F7',     // purple-500
  background: '#2E1065',  // purple-950
  card: '#581C87',        // purple-900
  text: '#F3E8FF',        // purple-100
  border: '#6B21A8',      // purple-800
  accent: '#D8B4FE',      // purple-300
  success: '#4ADE80',     // green-400
  warning: '#FBBF24',     // amber-400
  error: '#F87171',       // red-400
  mutedText: '#D8B4FE',   // purple-300
}
```

---

### 5. 🔴 **Crimson Red** (Traditional)
**Vibe:** Passionate, intense, traditional  
**Best for:** Traditional sports, Rivalries, Championships

#### Light Mode
```typescript
{
  tint: '#EF4444',        // red-500
  primary: '#DC2626',     // red-600
  background: '#FFFFFF',
  card: '#FEF2F2',        // red-50
  text: '#7F1D1D',        // red-900
  border: '#FECACA',      // red-200
  accent: '#F87171',      // red-400
  success: '#10B981',     // emerald-500
  warning: '#F59E0B',     // amber-500
  error: '#B91C1C',       // red-700
  mutedText: '#B91C1C',   // red-700
}
```

#### Dark Mode
```typescript
{
  tint: '#F87171',        // red-400
  primary: '#EF4444',     // red-500
  background: '#450A0A',  // red-950
  card: '#7F1D1D',        // red-900
  text: '#FEE2E2',        // red-100
  border: '#991B1B',      // red-800
  accent: '#FCA5A5',      // red-300
  success: '#34D399',     // emerald-400
  warning: '#FBBF24',     // amber-400
  error: '#DC2626',       // red-600
  mutedText: '#FCA5A5',   // red-300
}
```

---

## 🚀 Implementation

### Step 1: Create Theme Configuration

**File:** `constants/Themes.ts`

```typescript
export type ThemeColors = {
  tint: string;
  primary: string;
  background: string;
  card: string;
  text: string;
  border: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  mutedText: string;
  tabIconDefault?: string;
  tabIconSelected?: string;
  surface?: string;
};

export type Theme = {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  light: ThemeColors;
  dark: ThemeColors;
};

export const AVAILABLE_THEMES: Record<string, Theme> = {
  ocean: {
    id: 'ocean',
    name: 'Ocean Blue',
    description: 'Clean and energetic - Perfect for basketball',
    icon: '🌊',
    enabled: true, // ← DEFAULT THEME
    light: { /* Ocean light colors */ },
    dark: { /* Ocean dark colors */ }
  },
  
  forest: {
    id: 'forest',
    name: 'Forest Green',
    description: 'Athletic and competitive - For football & soccer',
    icon: '🌲',
    enabled: false, // ← FEATURE FLAG: Set true to activate
    light: { /* Forest light colors */ },
    dark: { /* Forest dark colors */ }
  },
  
  sunset: {
    id: 'sunset',
    name: 'Sunset Orange',
    description: 'Bold and exciting - High energy sports',
    icon: '🌅',
    enabled: false,
    light: { /* Sunset light colors */ },
    dark: { /* Sunset dark colors */ }
  },
  
  royal: {
    id: 'royal',
    name: 'Royal Purple',
    description: 'Premium and elite - Championship vibes',
    icon: '👑',
    enabled: false,
    light: { /* Royal light colors */ },
    dark: { /* Royal dark colors */ }
  },
  
  crimson: {
    id: 'crimson',
    name: 'Crimson Red',
    description: 'Passionate and intense - Traditional sports',
    icon: '🔴',
    enabled: false,
    light: { /* Crimson light colors */ },
    dark: { /* Crimson dark colors */ }
  }
};

// Get enabled themes only
export const getEnabledThemes = () => 
  Object.values(AVAILABLE_THEMES).filter(theme => theme.enabled);

// Get default theme
export const getDefaultTheme = () => 
  Object.values(AVAILABLE_THEMES).find(theme => theme.enabled) || AVAILABLE_THEMES.ocean;
```

---

### Step 2: Create Theme Context

**File:** `context/ThemeContext.tsx`

```typescript
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { AVAILABLE_THEMES, getDefaultTheme, getEnabledThemes, type ThemeColors } from '@/constants/Themes';

type ThemeContextType = {
  colors: ThemeColors;
  activeThemeId: string;
  setActiveTheme: (themeId: string) => Promise<void>;
  availableThemes: typeof AVAILABLE_THEMES;
  colorScheme: 'light' | 'dark';
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useRNColorScheme() ?? 'light';
  const [activeThemeId, setActiveThemeId] = useState(getDefaultTheme().id);
  
  // Load saved theme on mount
  useEffect(() => {
    AsyncStorage.getItem('app_theme').then(saved => {
      if (saved && AVAILABLE_THEMES[saved]?.enabled) {
        setActiveThemeId(saved);
      }
    });
  }, []);
  
  const activeTheme = AVAILABLE_THEMES[activeThemeId] || getDefaultTheme();
  const colors = activeTheme[systemColorScheme] || activeTheme.light;
  
  const setActiveTheme = async (themeId: string) => {
    if (AVAILABLE_THEMES[themeId]?.enabled) {
      setActiveThemeId(themeId);
      await AsyncStorage.setItem('app_theme', themeId);
    }
  };
  
  return (
    <ThemeContext.Provider value={{ 
      colors, 
      activeThemeId, 
      setActiveTheme, 
      availableThemes: AVAILABLE_THEMES,
      colorScheme: systemColorScheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

---

### Step 3: Theme Selector Component

**File:** `components/ui/ThemeSelector.tsx`

```typescript
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import { getEnabledThemes } from '@/constants/Themes';

export function ThemeSelector() {
  const { activeThemeId, setActiveTheme } = useTheme();
  const enabledThemes = getEnabledThemes();
  
  // Don't show selector if only one theme enabled
  if (enabledThemes.length <= 1) return null;
  
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      {enabledThemes.map(theme => (
        <Pressable
          key={theme.id}
          style={[styles.themeCard, activeThemeId === theme.id && styles.activeCard]}
          onPress={() => setActiveTheme(theme.id)}
        >
          <Text style={styles.icon}>{theme.icon}</Text>
          <Text style={[styles.name, activeThemeId === theme.id && styles.activeName]}>
            {theme.name}
          </Text>
          <Text style={styles.description}>{theme.description}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', gap: 12 },
  themeCard: {
    width: 140,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  activeCard: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  icon: { fontSize: 32, marginBottom: 8 },
  name: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  activeName: { color: '#2563EB' },
  description: { fontSize: 11, color: '#6B7280' },
});
```

---

### Step 4: Add to Settings

**File:** `app/settings/index.tsx`

```typescript
import { ThemeSelector } from '@/components/ui/ThemeSelector';
import { getEnabledThemes } from '@/constants/Themes';

// In the render:
{getEnabledThemes().length > 1 && (
  <SectionCard title="Theme" initiallyOpen>
    <ThemeSelector />
  </SectionCard>
)}
```

---

## 🎛️ Activation/Deactivation

### To Activate a New Theme
```typescript
// constants/Themes.ts
forest: {
  id: 'forest',
  name: 'Forest Green',
  enabled: true, // ← Just flip to true!
  // ...
}
```

### To Deactivate a Theme
```typescript
// constants/Themes.ts
sunset: {
  id: 'sunset',
  name: 'Sunset Orange',
  enabled: false, // ← Flip back to false
  // ...
}
```

**That's it!** No other code changes needed. The theme system handles everything.

---

## ✅ Migration Checklist

- [ ] Create `constants/Themes.ts` with all 5 themes
- [ ] Create `context/ThemeContext.tsx`
- [ ] Create `components/ui/ThemeSelector.tsx`
- [ ] Wrap app in `<ThemeProvider>` in `_layout.tsx`
- [ ] Replace `Colors[colorScheme]` with `useTheme().colors` across app
- [ ] Add theme selector to Settings screen
- [ ] Test all 5 themes in light + dark mode
- [ ] Document theme activation process for team

---

## 🧪 Testing

### Test Each Theme
1. Enable theme in `Themes.ts`
2. Go to Settings → Theme
3. Select theme
4. Toggle device dark mode
5. Check all main screens:
   - Feed
   - Profile
   - Team screens
   - Game screens
   - Settings

### Verify
- [ ] All colors look good
- [ ] Text is readable (contrast check)
- [ ] Buttons are tappable
- [ ] No white/black flashes
- [ ] Smooth transitions

---

## 📝 Notes

- **Backwards Compatible:** Keep current `Colors.ts` as fallback
- **Performance:** Theme colors cached, no performance hit
- **Easy Rollback:** Just set `enabled: false`
- **No Breaking Changes:** Gradual migration possible

