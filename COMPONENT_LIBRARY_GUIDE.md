# 📚 Component Library - Quick Reference Guide

**VarsityHub Mobile - Reusable UI Components**  
**Last Updated**: October 17, 2025  
**Status**: Production Ready ✅

---

## 🚀 Quick Start

```typescript
// Import components from centralized index
import { 
  Card, 
  GameCard, 
  TeamCard, 
  SectionHeader, 
  EmptyState,
  LoadingState,
  SettingItem,
  StatCard,
  Button
} from '@/components/ui';
```

---

## 📦 Available Components

### 1. **Card** - Base Container
```typescript
<Card variant="outlined" pressable onPress={handlePress} padding="lg">
  <Text>Content goes here</Text>
</Card>
```
**Props:**
- `variant`: 'default' | 'elevated' | 'outlined'
- `pressable`: boolean
- `onPress`: () => void
- `padding`: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | 'xxxl'

**Subcomponents:**
- `<CardHeader>` - Card header section
- `<CardContent>` - Main content area
- `<CardFooter>` - Footer section

---

### 2. **GameCard** - Game Display
```typescript
<GameCard 
  game={game}
  onPress={handleViewGame}
  onEdit={handleEditGame}
  onDelete={handleDeleteGame}
  showActions={true}
/>
```
**Props:**
- `game`: Game object (id, opponent_name, scheduled_date, scheduled_time, location, game_type)
- `onPress?`: (game: Game) => void
- `onEdit?`: (game: Game) => void
- `onDelete?`: (game: Game) => void
- `showActions?`: boolean
- `style?`: ViewStyle

**Features:**
- Displays opponent, date, time, location
- Game type badges (league/playoff/tournament) with colors
- Score display for past games
- Edit/Delete action buttons
- Pressable for navigation

---

### 3. **TeamCard** - Team Display
```typescript
<TeamCard 
  team={{
    id: '1',
    name: 'Varsity Basketball',
    sport: 'Basketball',
    member_count: 15,
    role: 'coach'
  }}
  onPress={handleTeamPress}
  showRole={true}
/>
```
**Props:**
- `team`: Team object (id, name, sport?, season?, logo_url?, member_count?, role?)
- `onPress?`: (team: Team) => void
- `showRole?`: boolean
- `style?`: ViewStyle

**Features:**
- Team logo with fallback placeholder
- Sport and season display
- Member count
- Role badges (coach, player, parent, fan)
- Pressable for navigation

---

### 4. **SectionHeader** - Section Headers
```typescript
<SectionHeader 
  title="MY TEAMS" 
  subtitle="Manage your teams"
  action={<Button>Add</Button>}
/>
```
**Props:**
- `title`: string
- `subtitle?`: string
- `action?`: React.ReactNode
- `style?`: ViewStyle

---

### 5. **EmptyState** - Empty State Displays
```typescript
<EmptyState 
  icon="calendar-outline"
  title="No Games Yet"
  subtitle="Add your first game to get started"
  action={<Button>Add Game</Button>}
/>
```
**Props:**
- `icon?`: Ionicons icon name
- `title`: string
- `subtitle?`: string
- `action?`: React.ReactNode
- `style?`: ViewStyle

---

### 6. **LoadingState** - Loading Indicators
```typescript
<LoadingState 
  message="Loading teams..." 
  size="large"
  fullScreen={true}
/>
```
**Props:**
- `message?`: string
- `size?`: 'small' | 'large'
- `fullScreen?`: boolean
- `style?`: ViewStyle

---

### 7. **SettingItem** - Settings Menu Items
```typescript
<SettingItem
  icon="create-outline"
  label="Edit Team Info"
  onPress={handleEdit}
/>

<SettingItem
  icon="trash-outline"
  label="Delete Team"
  destructive={true}
  onPress={handleDelete}
/>
```
**Props:**
- `icon?`: Ionicons icon name
- `label`: string
- `value?`: string
- `onPress`: () => void
- `destructive?`: boolean (shows red color)
- `showChevron?`: boolean
- `style?`: ViewStyle

---

### 8. **StatCard** - Statistics Display
```typescript
<StatCard 
  icon="trophy-outline"
  label="Wins"
  value={12}
  trend="up"
  trendValue="+3"
  variant="success"
/>
```
**Props:**
- `icon?`: Ionicons icon name
- `label`: string
- `value`: string | number
- `subtitle?`: string
- `trend?`: 'up' | 'down' | 'neutral'
- `trendValue?`: string
- `variant?`: 'default' | 'primary' | 'success' | 'warning' | 'danger'
- `style?`: ViewStyle

---

### 9. **Button** - Action Buttons
```typescript
<Button
  label="Create Team"
  onPress={handleCreate}
  variant="primary"
  size="md"
  icon="add-circle-outline"
/>
```
**Props:**
- `children`: React.ReactNode
- `onPress?`: () => void
- `disabled?`: boolean
- `variant?`: 'default' | 'outline' | 'ghost'
- `size?`: 'sm' | 'md' | 'lg' | 'icon'
- `style?`: ViewStyle
- `textStyle?`: TextStyle

---

## 🎨 Design System Tokens

### Spacing
```typescript
import { spacing } from '@/constants/Theme';

spacing.xs    // 4px
spacing.sm    // 8px
spacing.md    // 12px
spacing.lg    // 16px
spacing.xl    // 20px
spacing.xxl   // 24px
spacing.xxxl  // 32px
```

### Typography
```typescript
import { typography } from '@/constants/Theme';

typography.caption     // 12px / 16px
typography.body        // 14px / 20px
typography.subheading  // 16px / 24px
typography.heading     // 20px / 28px / bold
typography.title       // 24px / 32px / extrabold
typography.display     // 32px / 40px / extrabold
```

### Border Radius
```typescript
import { radius } from '@/constants/Theme';

radius.xs   // 6px
radius.sm   // 8px
radius.md   // 12px
radius.lg   // 16px
radius.xl   // 20px
radius.xxl  // 24px
```

### Shadows
```typescript
import { shadows } from '@/constants/Theme';

shadows.none  // No shadow
shadows.sm    // Small shadow with elevation
shadows.md    // Medium shadow
shadows.lg    // Large shadow
shadows.xl    // Extra large shadow
```

### Colors
```typescript
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

const colorScheme = useColorScheme() ?? 'light';

Colors[colorScheme].text           // Primary text color
Colors[colorScheme].background     // Background color
Colors[colorScheme].surface        // Surface color (cards)
Colors[colorScheme].border         // Border color
Colors[colorScheme].mutedText      // Secondary text
Colors[colorScheme].tint           // Accent/primary color
Colors[colorScheme].icon           // Icon color
```

---

## 💡 Common Patterns

### Creating a List Screen
```typescript
import { SectionHeader, EmptyState, LoadingState, TeamCard } from '@/components/ui';

function TeamsScreen() {
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);

  if (loading) {
    return <LoadingState message="Loading teams..." fullScreen />;
  }

  return (
    <ScrollView>
      <SectionHeader 
        title="MY TEAMS"
        action={<Ionicons name="add" size={24} />}
      />
      
      {teams.length === 0 ? (
        <EmptyState 
          icon="people-outline"
          title="No Teams Yet"
          subtitle="Create your first team"
        />
      ) : (
        teams.map(team => (
          <TeamCard 
            key={team.id}
            team={team}
            onPress={handleTeamPress}
            showRole
          />
        ))
      )}
    </ScrollView>
  );
}
```

### Creating a Settings Screen
```typescript
import { SectionHeader, SettingItem } from '@/components/ui';

function SettingsScreen() {
  return (
    <ScrollView>
      <SectionHeader title="Account" />
      
      <SettingItem
        icon="person-outline"
        label="Edit Profile"
        onPress={handleEditProfile}
      />
      
      <SettingItem
        icon="lock-closed-outline"
        label="Change Password"
        onPress={handleChangePassword}
      />
      
      <SectionHeader title="Danger Zone" />
      
      <SettingItem
        icon="trash-outline"
        label="Delete Account"
        destructive
        onPress={handleDeleteAccount}
      />
    </ScrollView>
  );
}
```

### Creating a Game List
```typescript
import { GameCard, EmptyState } from '@/components/ui';

function GamesScreen() {
  const [games, setGames] = useState([]);

  return (
    <ScrollView>
      {games.length === 0 ? (
        <EmptyState 
          icon="calendar-outline"
          title="No Games Yet"
          subtitle="Add your first game"
        />
      ) : (
        games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            onPress={handleGamePress}
            onEdit={handleEditGame}
            onDelete={handleDeleteGame}
            showActions
          />
        ))
      )}
    </ScrollView>
  );
}
```

---

## 📊 Component Usage Stats

**Screens Using Components:**
- ✅ manage-season.tsx - GameCard, SectionHeader, EmptyState
- ✅ team-profile.tsx - SettingItem, SectionHeader
- ✅ manage-teams.tsx - TeamCard, LoadingState, EmptyState, SectionHeader
- ⏳ feed.tsx - Potential for GameCard, EmptyState
- ⏳ post-detail.tsx - Potential for Card, SectionHeader
- ⏳ highlights.tsx - Potential for GameCard, EmptyState

**Impact:**
- ~250 lines removed from refactored screens
- ~1,200+ lines of duplication identified
- 20% code reduction achieved (target: 30-40%)

---

## 🎯 Best Practices

### ✅ DO:
- Always use design tokens (spacing, typography, radius, shadows)
- Respect theme colors with `useColorScheme()`
- Keep components simple and focused
- Use TypeScript interfaces for props
- Include JSDoc comments with examples
- Export types alongside components

### ❌ DON'T:
- Hardcode colors or sizes
- Create inline styled duplicates
- Ignore dark mode support
- Skip prop validation
- Create overly complex components
- Mix business logic in UI components

---

## 🚀 Adding New Components

1. **Create Component File**
   ```typescript
   // components/ui/MyComponent.tsx
   export interface MyComponentProps {
     // Define props
   }
   
   export function MyComponent({ ...props }: MyComponentProps) {
     // Implementation
   }
   ```

2. **Export from Index**
   ```typescript
   // components/ui/index.ts
   export { MyComponent } from './MyComponent';
   export type { MyComponentProps } from './MyComponent';
   ```

3. **Use in Screens**
   ```typescript
   import { MyComponent } from '@/components/ui';
   ```

---

## 📝 Changelog

**October 17, 2025 - Phase 1 & 2 Complete**
- ✅ Created 9 production-ready components
- ✅ Established design system tokens
- ✅ Refactored 3 major screens
- ✅ Zero compilation errors
- ✅ Full TypeScript coverage
- ✅ Dark/light mode support

---

## 🔗 Related Documentation

- `PHASE1_COMPLETION.md` - Detailed component documentation
- `ARCHITECTURE_OPTIMIZATION_REPORT.md` - Full optimization report
- `ARCHITECTURE_REVIEW.md` - Original architecture analysis

---

**Questions?** Check the component files for JSDoc comments and usage examples!

**Need a new component?** Follow the patterns established in existing components and add to this library!

🎨 **Happy coding!**
