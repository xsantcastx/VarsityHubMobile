# VarsityHub User Roles & Account Types

## Overview
This document clarifies the VarsityHub account system structure to prevent confusion between **roles**, **demographic labels**, and **subscription plans**.

---

## 🎭 Primary User Roles (Functional)

These determine **what features users can access** and **how they use the app**.

### 1. Fan (`role: 'fan'`)
**Purpose:** Passive viewers who follow teams and engage with content

**Capabilities:**
- Follow teams and players
- View highlights and game content
- Post reviews and reactions
- RSVP to public fan events
- Direct messaging
- NO team joining/participation
- NO team management
- NO player roster access
- NO subscription required

**Onboarding Flow:**
1. Choose "Fan" role
2. Skip to profile setup (lightest flow)
3. Complete profile
4. Done → Fan onboarding screen with suggested actions

**Database Schema:**
```json
{
  "role": "fan",
  "plan": null,  // Fans don't have plans
  "bio": "Sports enthusiast following local teams...",
  "preferences": {
    "role": "fan",
    "onboarding_completed": true
  }
}
```

---

### 2. Rookie (Player) (`role: 'rookie'`)
**Purpose:** Active players who join teams and participate in games

**Capabilities:**
- All Fan features
- Join teams as player
- View team roster and stats
- Receive game/practice notifications
- Participate in team chat
- View personal performance stats
- NO team creation/management
- NO subscription required

**Onboarding Flow:**
1. Choose "Rookie (Player)" role
2. Basic info (username, affiliation, DOB, zip)
3. Profile setup
4. Done → Rookie onboarding screen with player-focused actions

**Database Schema:**
```json
{
  "role": "rookie",
  "plan": null,  // Rookies don't pay
  "bio": "Varsity basketball player...",
  "preferences": {
    "role": "rookie",
    "affiliation": "high_school",
    "zip_code": "12345",
    "onboarding_completed": true
  }
}
```

---

### 3. Coach / Organizer (`role: 'coach'`)
**Purpose:** Team managers, coaches, and organizers who need team management tools

**Capabilities:**
- All Fan features
- Create and manage teams
- Invite players and staff
- Post game schedules
- Organize events
- Access team analytics
- Manage rosters
- REQUIRES subscription (Rookie/Veteran/Legend)

**Onboarding Flow:**
1. Choose "Coach / Organizer" role
2. Basic info (username, affiliation, DOB, zip)
3. Select subscription plan (Rookie/Veteran/Legend)
4. Season dates
5. Team/organization setup
6. Authorized users
7. Profile
8. Done → Manage Teams

**Database Schema:**
```json
{
  "role": "coach",
  "plan": "veteran",  // or "rookie", "legend"
  "preferences": {
    "role": "coach",
    "plan": "veteran",
    "affiliation": "high_school",
    "zip_code": "12345",
    "season_start": "2024-09-01",
    "season_end": "2025-05-31",
    "onboarding_completed": true
  }
}
```

---

## 📊 Subscription Plans (Coach Only)

**IMPORTANT:** Plans are ONLY for coaches. Fans and Rookies never see plan selection.

### Rookie (Free)
- **Price:** FREE
- **Teams:** Up to 2 teams
- **Features:** Basic team management
- **Payment:** No payment required

### Veteran
- **Price:** $70/year ($7,000 cents in backend)
- **Teams:** Unlimited teams ($1.50/month per extra team)
- **Features:** Priority support, advanced analytics
- **Payment:** Stripe checkout required

### Legend
- **Price:** $150/year ($15,000 cents in backend)
- **Teams:** Unlimited everything
- **Features:** All Veteran + custom branding, white-label
- **Payment:** Stripe checkout required

**Backend Pricing (server/src/routes/payments.ts):**
```typescript
// Line 117-118
unit_amount: chosen === 'veteran' ? 7000 : 15000,  // $70 or $150 per year
```

---

## 🏷️ Demographic Labels (Non-Functional)

These are **descriptive labels** that do NOT affect functionality. Anyone can have these.

### Youth / Boomer
**Purpose:** Age demographic for personalization

**Usage:**
- Can be applied to ANY user (fan, coach, player)
- Does NOT restrict features
- Does NOT affect permissions
- Used for content recommendations
- Purely informational

**Where it appears:**
- User profile badges (optional)
- Analytics/demographics (backend)
- Content personalization

**NOT Used For:**
- Access control
- Feature gating
- Payment logic
- Onboarding routing

**Example:**
```json
{
  "role": "coach",  // Functional role
  "plan": "veteran",
  "demographic": "youth",  // Informational label
  "preferences": {
    "age_group": "youth"  // Can be "youth", "boomer", "adult", etc.
  }
}
```

---

## 🏫 Affiliations (Organization Type)

**Purpose:** Indicates the type of organization a user is associated with

**Values:**
- `none` - Not affiliated with any organization
- `university` - College/university programs
- `high_school` - High school teams
- `club` - Club sports (independent)
- `youth` - Youth sports organizations (e.g., Little League, AYSO)

**Usage:**
- Required for coaches during onboarding
- Optional for fans
- Used to categorize teams
- Helps with search/discovery
- Does NOT restrict features

**Backend Field:**
```typescript
// In User preferences
affiliation: 'high_school' | 'university' | 'club' | 'youth' | 'none'
```

---

## ❌ Common Mistakes to Avoid

### 1. DON'T Confuse "Rookie" with "Youth"
- ❌ "Rookie" = Young player
- ✅ "Rookie" = Free coach subscription plan
- ✅ "Youth" = Age demographic OR youth organization type

### 2. DON'T Link Fan Accounts to Plans
- ❌ Fan with "Rookie" plan
- ✅ Fan with NO plan (null)
- Fans are free users, they never subscribe

### 3. DON'T Use Demographic Labels for Access Control
- ❌ `if (user.demographic === 'youth') { disableFeature(); }`
- ✅ `if (user.role === 'fan') { hideMangementTools(); }`

### 4. DON'T Call Plans "Player Types"
- ❌ "Rookie player"
- ✅ "Rookie plan coach"
- Plans are for coaches, not players

---

## 🗂️ Database Schema Reference

### User Model (Prisma)
```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  display_name  String?
  bio           String?
  avatar_url    String?
  preferences   Json     @default("{}")
  // ...
}
```

### Preferences Structure
```typescript
interface UserPreferences {
  // Functional
  role: 'fan' | 'coach';
  plan?: 'rookie' | 'veteran' | 'legend';  // Only for coaches
  
  // Organizational
  affiliation?: 'none' | 'university' | 'high_school' | 'club' | 'youth';
  
  // Demographic (optional, informational)
  age_group?: 'youth' | 'adult' | 'boomer';
  
  // Onboarding
  onboarding_completed: boolean;
  zip_code?: string;
  dob?: string;
  
  // Coach-specific
  season_start?: string;
  season_end?: string;
  team_id?: string;
  organization_id?: string;
}
```

---

## 🔄 Onboarding Flow Comparison

### Fan Onboarding (Simple)
```
Step 1: Choose Role (Fan)
   ↓
Step 7: Profile (username, avatar)
   ↓
Step 8: Sports Interests
   ↓
Step 9: Features/Permissions
   ↓
DONE → Feed
```
**Skipped:** Plan selection, team setup, season dates, authorized users

### Coach Onboarding (Full)
```
Step 1: Choose Role (Coach)
   ↓
Step 2: Basic Info (username, affiliation, DOB, zip)
   ↓
Step 3: Plan Selection (Rookie/Veteran/Legend)
   ↓
Step 4: Season Dates
   ↓
Step 5: Team/Org Setup
   ↓
Step 6: Authorized Users
   ↓
Step 7: Profile
   ↓
Step 8: Interests
   ↓
Step 9: Features
   ↓
Step 10: Confirmation
   ↓
DONE → Manage Teams
```

---

## 🎯 Implementation Guidelines

### When Adding New Features

**1. Check User Role:**
```typescript
const isCoach = user?.preferences?.role === 'coach';
const isFan = user?.preferences?.role === 'fan';

// Use role for feature access
if (isCoach) {
  // Show team management
}

if (isFan) {
  // Show follow/engage features only
}
```

**2. Check Subscription Plan (Coaches Only):**
```typescript
const plan = user?.preferences?.plan || 'rookie';

if (plan === 'rookie' && teamCount >= 2) {
  // Prompt upgrade to Veteran/Legend
}

if (plan === 'legend') {
  // Show unlimited everything
}
```

**3. DON'T Use Demographic for Logic:**
```typescript
// ❌ WRONG
if (user.preferences.age_group === 'youth') {
  restrictFeature();  // Don't do this!
}

// ✅ CORRECT
// Just store it for analytics
console.log('User demographic:', user.preferences.age_group);
```

---

## 📋 Testing Checklist

### Fan Account
- [ ] Can create account without plan selection
- [ ] Can follow teams
- [ ] CANNOT create teams
- [ ] CANNOT see "Manage Teams" option
- [ ] CANNOT access roster management
- [ ] Bio auto-populated with default fan text

### Coach Account (Rookie)
- [ ] Can create up to 2 teams for free
- [ ] Prompted to upgrade for 3rd team
- [ ] Access to team management tools
- [ ] Can invite players
- [ ] Zip code required during onboarding

### Coach Account (Veteran/Legend)
- [ ] Stripe checkout works
- [ ] Subscription saved after payment
- [ ] Unlimited teams (Legend)
- [ ] Premium features unlocked
- [ ] Correct pricing displayed ($70 or $150/year)

### Demographic Labels
- [ ] Can apply "Youth" or "Boomer" to any user type
- [ ] Labels don't affect feature access
- [ ] Labels visible in profile (optional)

---

## 🆘 Troubleshooting

### "Fan sees plan selection screen"
**Problem:** Fan onboarding showing Rookie/Veteran/Legend options
**Fix:** Check `step-1-role.tsx` - Fans should skip to step-7
```typescript
if (role === 'fan') {
  setProgress(6); // Jump to profile
  router.push('/onboarding/step-7-profile');
}
```

### "Coach can't create team"
**Problem:** Coach marked as "fan" in database
**Fix:** Verify `preferences.role` is "coach", not affiliation

### "Youth org treated as player type"
**Problem:** Confusing affiliation with demographic
**Fix:** Affiliation is organization type, not user age

---

## 📚 Related Documentation

- [Onboarding Context](../context/OnboardingContext.tsx)
- [Role Onboarding Screen](../app/role-onboarding.tsx)
- [User Preferences API](../server/src/routes/auth.ts)
- [Payment/Subscription System](../server/src/routes/payments.ts)

---

**Last Updated:** {{ current_date }}
**Maintained By:** Development Team
**Status:** ✅ Production Reference
