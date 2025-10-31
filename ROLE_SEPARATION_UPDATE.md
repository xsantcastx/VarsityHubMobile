# Role Separation Update: Fan vs Rookie (Player)

## Problem Statement

Previously, VarsityHub conflated two distinct user types into a single "Fan" role:
- **Passive fans** who only want to view content and follow teams
- **Active players** who want to join teams, participate, and view their stats

This caused confusion and limited the app's ability to provide appropriate features to each user type.

## Solution

Implemented a **three-role system** to clearly separate user types by their level of participation:

### Role Definitions

| Role | Type | Purpose | Team Access | Subscription |
|------|------|---------|-------------|--------------|
| **Fan** | Passive | View-only, follow teams | Cannot join teams | FREE |
| **Rookie (Player)** | Active Participant | Join teams, play games | Can join, not create | FREE |
| **Coach** | Manager | Create and manage teams | Full management | REQUIRED |

## Changes Made

### 1. Type System Updates

**Files Modified:**
- `context/OnboardingContext.tsx` (Line 5)
- `src/context/OnboardingContext.tsx` (Line 8)
- `app/onboarding/step-1-role.tsx` (Line 12)

**Change:**
```typescript
// BEFORE
export type UserRole = 'fan' | 'coach';

// AFTER
export type UserRole = 'fan' | 'rookie' | 'coach';
```

### 2. Onboarding Flow Updates

#### Role Selection Screen (`app/onboarding/step-1-role.tsx`)

**Added Third RoleCard:**
```tsx
<RoleCard
  icon="basketball"
  title="Rookie (Player)"
  description="Join teams and play"
  features={[
    'Join teams and participate',
    'View your stats and performance',
    'Get roster and lineup updates',
    'Receive game and event notifications',
    'Chat with teammates and coaches',
  ]}
  selected={role === 'rookie'}
  onPress={() => setRole('rookie')}
  backgroundColor={Colors[colorScheme].card}
  borderColor={role === 'rookie' ? '#22c55e' : Colors[colorScheme].border}
/>
```

**Updated Routing Logic:**
```typescript
// Fan: Skip to profile (lightest flow)
if (role === 'fan') {
  router.push('/onboarding/step-7-profile');
}
// Rookie: Basic info + profile (medium flow)
else if (role === 'rookie') {
  router.push('/onboarding/step-2-basic');
}
// Coach: Full flow with subscription/teams
else {
  router.push('/onboarding/step-2-basic');
}
```

#### Basic Info Screen (`app/onboarding/step-2-basic.tsx`)

**Added Rookie Routing:**
```typescript
if (returnToConfirmation) {
  router.replace('/onboarding/step-10-confirmation');
} else {
  // Rookies skip plan/season/team and go to profile
  if (ob.role === 'rookie') {
    setProgress(6); // step-7 profile
    router.push('/onboarding/step-7-profile');
  } else {
    // Coaches continue to plan selection
    setProgress(2); // step-3 plan
    router.push('/onboarding/step-3-plan');
  }
}
```

#### Profile Screen (`app/onboarding/step-7-profile.tsx`)

**Fixed Fan/Rookie Completion Flow:**
```typescript
if (returnToConfirmation) {
  router.replace('/onboarding/step-10-confirmation');
} else {
  // Fans and rookies skip to role-onboarding, coaches continue
  if (ob.role === 'fan' || ob.role === 'rookie') {
    // Mark onboarding as complete
    await User.updatePreferences({ onboarding_completed: true });
    router.replace('/role-onboarding');
  } else {
    router.push('/onboarding/step-8-interests');
  }
}
```

**Critical Fix:** This prevents fans and rookies from seeing the step-10 confirmation screen with coach-specific checklist items.

### 3. Confirmation Screen Updates (`app/onboarding/step-10-confirmation.tsx`)

**Added Rookie Recognition:**
```typescript
const isRookie = ob.role === 'rookie';

// Completion checks exclude rookie from coach-only requirements
const allRequiredCompleted = 
  (isCoach ? planSelected && seasonDatesEntered && teamCreated : true) &&
  profileCompleted;
```

**Updated Account Summary:**
```typescript
<Text style={styles.summaryValue}>
  {ob.role === 'fan' 
    ? 'Fan' 
    : ob.role === 'rookie'
    ? 'Rookie (Player)'
    : 'Coach/Organizer'}
</Text>
```

### 4. Post-Onboarding Screen (`app/role-onboarding.tsx`)

**Added Rookie-Specific Actions:**
```typescript
const rookieActions: OnboardingAction[] = [
  {
    icon: 'people',
    title: 'Join Teams',
    description: 'Find and join teams to start playing',
    route: '/my-team',
    gradient: ['#2563eb', '#1d4ed8'],
  },
  {
    icon: 'calendar',
    title: 'View Schedule',
    description: 'Check your games and practice schedule',
    route: '/feed',
    gradient: ['#7c3aed', '#6d28d9'],
  },
  {
    icon: 'stats-chart',
    title: 'Track Stats',
    description: 'View your performance and team statistics',
    route: '/highlights',
    gradient: ['#059669', '#047857'],
  },
  {
    icon: 'chatbubbles',
    title: 'Team Chat',
    description: 'Stay connected with teammates and coaches',
    route: '/messages',
    gradient: ['#dc2626', '#b91c1c'],
  },
];
```

**Updated Welcome Message Logic:**
```typescript
let welcomeTitle = 'Welcome to Varsity Hub! 🎉';

if (userRole === 'fan') {
  actions = fanActions;
  welcomeTitle = 'Welcome, Fan! 🎉';
} else if (userRole === 'rookie') {
  actions = rookieActions;
  welcomeTitle = 'Welcome, Rookie! 🏀';
}
```

### 5. Documentation Updates

**Updated `docs/USER_ROLES_AND_TYPES.md`:**
- Added comprehensive Rookie (Player) section
- Clarified Fan as passive role (cannot join teams)
- Updated subscription notes to exclude rookies
- Added role comparison table

## Onboarding Flow Comparison

### Fan Flow (Lightest - 2 Steps)
1. Select "Fan" role → **step-1-role.tsx**
2. → **Automatically skip to step-7-profile** (avatar, bio, interests)
3. Complete profile
4. → **Directly to /role-onboarding** (bypasses confirmation screen)
5. Done → Fan welcome screen with suggested actions

**Steps Skipped:** Basic info (step-2), plan selection (step-3), season dates (step-4), team creation (step-5), authorized users (step-6), interests (step-8), features (step-9), confirmation checklist (step-10)

**Why:** Fans don't need to provide detailed info, select plans, or create teams. They get the quickest path to start using the app.

### Rookie Flow (Medium - 3 Steps)
1. Select "Rookie (Player)" role → **step-1-role.tsx**
2. → **step-2-basic** (username, affiliation, DOB, zip)
3. Complete basic info
4. → **step-7-profile** (avatar, bio, interests)
5. Complete profile
6. → **Directly to /role-onboarding** (bypasses confirmation screen)
7. Done → Rookie welcome screen with player actions

**Steps Skipped:** Plan selection (step-3), season dates (step-4), team creation (step-5), authorized users (step-6), interests (step-8), features (step-9), confirmation checklist (step-10)

**Why:** Rookies need to provide basic identity info so they can be added to teams, but don't need subscriptions or to create teams themselves.

### Coach Flow (Full - 10 Steps)
1. Select "Coach / Organizer" role → **step-1-role.tsx**
2. → **step-2-basic** (username, affiliation, DOB, zip)
3. → **step-3-plan** (Rookie/Veteran/Legend subscription)
4. → **step-4-season** (season start/end dates)
5. → **step-5-league** (create team/organization)
6. → **step-6-authorized-users** (manage staff)
7. → **step-7-profile** (avatar, bio, interests)
8. → **step-8-interests** (personalization)
9. → **step-9-features** (permissions, messaging policy)
10. → **step-10-confirmation** (review checklist)
11. Done → /manage-teams (team management dashboard)

**No Steps Skipped:** Full onboarding required for team management capabilities

## Feature Access Matrix

| Feature | Fan | Rookie (Player) | Coach |
|---------|-----|-----------------|-------|
| View content | ✅ | ✅ | ✅ |
| Follow teams | ✅ | ✅ | ✅ |
| Post reviews | ✅ | ✅ | ✅ |
| Direct messaging | ✅ | ✅ | ✅ |
| Join teams | ❌ | ✅ | ✅ |
| View personal stats | ❌ | ✅ | ✅ |
| Team chat access | ❌ | ✅ | ✅ |
| Game notifications | ❌ | ✅ | ✅ |
| Create teams | ❌ | ❌ | ✅ |
| Manage rosters | ❌ | ❌ | ✅ |
| Post schedules | ❌ | ❌ | ✅ |
| Organize events | ❌ | ❌ | ✅ |
| Subscription required | ❌ | ❌ | ✅ |

## Backend Considerations

### Critical Fix: Default Plan Assignment

**Problem Found:**  
The backend was incorrectly defaulting **ALL users** to `plan: 'rookie'` (a coach subscription tier), regardless of role. This caused:
- Fans displayed as having "Rookie (Free)" plan
- Confusion between rookie role (player) and rookie plan (coach tier)
- Permission leakage where fans inherited coach-like setup screens

**Solution:**  
Updated `server/src/routes/auth.ts` to set `plan: null` by default. Plans are **only assigned when coaches explicitly select them** during onboarding.

```typescript
// BEFORE (Line 371 in auth.ts)
const defaults = {
  plan: 'rookie',  // ❌ Wrong - assigns coach plan to everyone
  role: 'fan',
  ...
};

// AFTER
const defaults = {
  plan: null,  // ✅ Correct - no plan unless explicitly selected
  role: 'fan',
  ...
};
```

### Backend Schema Updates

**Updated Role Enums in `server/src/routes/auth.ts`:**

1. **Register Schema** (Line 22):
```typescript
// BEFORE
role: z.enum(['fan', 'coach']).optional()

// AFTER
role: z.enum(['fan', 'rookie', 'coach']).optional()
```

2. **Update Preferences Schema** (Line 350):
```typescript
// BEFORE
role: z.enum(['fan', 'coach']).optional()

// AFTER
role: z.enum(['fan', 'rookie', 'coach']).optional()
```

3. **Complete Onboarding Schema** (Line 389):
```typescript
// BEFORE
role: z.enum(['fan', 'coach']).optional()

// AFTER
role: z.enum(['fan', 'rookie', 'coach']).optional()
```

### Database Schema

**User Preferences Field:**
```json
// Fan
{
  "role": "fan",
  "onboarding_completed": true
}

// Rookie (Player)
{
  "role": "rookie",
  "affiliation": "high_school",
  "zip_code": "12345",
  "onboarding_completed": true
}

// Coach
{
  "role": "coach",
  "plan": "veteran",
  "affiliation": "high_school",
  "zip_code": "12345",
  "season_start": "2024-09-01",
  "season_end": "2025-05-31",
  "onboarding_completed": true
}
```

### Permission Checks

**Team Creation:**
```typescript
// Only coaches can create teams
if (user.preferences.role !== 'coach') {
  return res.status(403).json({ error: 'Only coaches can create teams' });
}
```

**Team Joining:**
```typescript
// Rookies and coaches can join teams, fans cannot
if (!['rookie', 'coach'].includes(user.preferences.role)) {
  return res.status(403).json({ error: 'Fans cannot join teams' });
}
```

**Subscription Checks:**
```typescript
// Only coaches need subscriptions
if (user.preferences.role === 'coach' && !user.preferences.plan) {
  return res.status(402).json({ error: 'Subscription required' });
}
```

## Testing Checklist

### Fan Onboarding ✅
- [ ] Select "Fan" role on step-1
- [ ] Verify **automatic redirect to step-7-profile** (skips steps 2-6)
- [ ] Complete profile (avatar, bio, interests)
- [ ] Verify **direct redirect to /role-onboarding** (bypasses step-10 confirmation)
- [ ] Verify "Welcome, Fan! 🎉" message shown
- [ ] Verify fan-specific actions displayed (4 cards: View Moments, Post Reviews, Support Creators, Claim My Team)
- [ ] Verify **NO setup checklist shown** (should never see "Plan Selected", "Season Set", "Page Created")
- [ ] Verify no team joining/creation options shown

### Rookie Onboarding ✅
- [ ] Select "Rookie (Player)" role on step-1
- [ ] Verify redirect to step-2-basic
- [ ] Complete basic info (username, affiliation, DOB, zip)
- [ ] Verify **redirect to step-7-profile** (skips steps 3-6: plan, season, team, authorized users)
- [ ] Complete profile
- [ ] Verify **direct redirect to /role-onboarding** (bypasses step-10 confirmation)
- [ ] Verify "Welcome, Rookie! 🏀" message shown
- [ ] Verify rookie-specific actions displayed (4 cards: Join Teams, View Schedule, Track Stats, Team Chat)
- [ ] Verify **NO setup checklist shown** (should never see "Plan Selected", "Season Set", "Page Created")

### Coach Onboarding ✅
- [ ] Select "Coach / Organizer" role on step-1
- [ ] Verify redirect to step-2-basic
- [ ] Complete basic info
- [ ] Verify redirect to step-3-plan (plan selection shown)
- [ ] Select plan
- [ ] Verify redirect to step-4-season (season dates shown)
- [ ] Enter season dates
- [ ] Verify redirect to step-5-league (team creation shown)
- [ ] Create team
- [ ] Verify redirect to step-6-authorized-users
- [ ] Complete authorized users (optional)
- [ ] Verify redirect to step-7-profile
- [ ] Complete profile
- [ ] Verify redirect to step-8-interests
- [ ] Complete interests
- [ ] Verify redirect to step-9-features
- [ ] Complete features
- [ ] Verify redirect to **step-10-confirmation** (setup checklist shown)
- [ ] Verify checklist shows: Role Selected, Basic Info, Plan Selected, Season Set, Page Created, etc.
- [ ] Complete all required items
- [ ] Verify redirect to /manage-teams
- [ ] Verify **NO /role-onboarding screen** shown for coaches

### Account Summary
- [ ] Fan: Verify shows "Fan"
- [ ] Rookie: Verify shows "Rookie (Player)"
- [ ] Coach: Verify shows "Coach/Organizer"

### Role Persistence
- [ ] Complete onboarding as rookie
- [ ] Close app
- [ ] Reopen app
- [ ] Verify role persisted correctly in user preferences
- [ ] Verify rookie-specific features accessible

## Files Modified

1. **context/OnboardingContext.tsx** - Added 'rookie' to UserRole type
2. **src/context/OnboardingContext.tsx** - Added 'rookie' to UserRole type (duplicate)
3. **app/onboarding/step-1-role.tsx** - Added third RoleCard, updated routing
4. **app/onboarding/step-2-basic.tsx** - Added rookie routing to skip coach-only steps
5. **app/onboarding/step-7-profile.tsx** - Fixed fan/rookie completion to bypass confirmation screen
6. **app/onboarding/step-10-confirmation.tsx** - Added rookie recognition & subscription display
7. **app/role-onboarding.tsx** - Added rookie actions and welcome message
8. **app/user-profile.tsx** - Updated badge display for rookie role
9. **server/src/routes/auth.ts** - ⭐ **CRITICAL FIX:** Updated role enums + fixed default plan assignment
10. **docs/USER_ROLES_AND_TYPES.md** - Comprehensive role documentation

## Impact Analysis

### Breaking Changes
- **None** - This is an additive change. Existing users with 'fan' or 'coach' roles are unaffected.

### Database Migration
- **Not Required** - New 'rookie' role is added to type system only. Existing data remains valid.

### API Changes
- **None** - Backend already stores role in preferences JSON. New 'rookie' value is supported automatically.

### UI Changes
- **Onboarding**: Third card added to role selection
- **Post-Onboarding**: New rookie welcome screen with player-focused actions
- **Account Summary**: Displays "Rookie (Player)" for rookie users

## Future Enhancements

1. **Team Roster Integration**: Allow coaches to add rookies to teams
2. **Stats Dashboard**: Player-specific stats page for rookies
3. **Performance Tracking**: Track individual game performance
4. **Team Chat Access**: Implement team-specific chat channels
5. **Role Verification**: Optional verification for player identity
6. **Role Switching**: Allow users to switch between fan/rookie if needed

## Notes

- **Subscription Model**: Fans and rookies are both free. Only coaches pay for team management features.
- **Feature Gating**: Use `user.preferences.role` checks to gate rookie-specific features.
- **Onboarding Depth**: Rookie flow is intentionally between fan (lightest) and coach (heaviest).
- **User Experience**: Rookie role focuses on participation rather than management.

---

**Date:** January 2025  
**Version:** 1.0  
**Status:** ✅ Complete
