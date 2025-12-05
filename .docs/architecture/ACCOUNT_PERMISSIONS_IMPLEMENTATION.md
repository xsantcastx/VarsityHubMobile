# Account Permissions & Features Implementation Plan

## Critical Implementation Requirements
**These onboarding promises MUST be backed by real functionality - no empty promises to users.**

---

## Account Types & Roles

### 1. FAN Account
**Current State:** Basic implementation exists  
**Role Value:** `preferences.role = 'fan'`  
**Subscription Tier:** `subscription_tier = 'free'` (always free)

#### Promised Features (from onboarding):
- ✅ Follow your favorite teams
- ✅ Get game updates and highlights
- ⚠️ **Pitch events for your community** (NEEDS IMPLEMENTATION)
- ⚠️ **Upgrade to athlete/staff upon coach approval** (NEEDS IMPLEMENTATION)

#### Required Permissions:
```typescript
FAN_PERMISSIONS = {
  // Read-only features
  viewTeams: true,
  viewGames: true,
  viewHighlights: true,
  followTeams: true,
  
  // Social features
  rsvpToGames: true,
  postReviews: true,
  commentOnPosts: true,
  
  // NEW: Event pitching
  pitchEvents: true,  // ⚠️ NEEDS IMPLEMENTATION
  
  // Restrictions
  createTeams: false,
  createGames: false,
  invitePlayers: false,
  manageRoster: false,
  viewPrivateTeamData: false
}
```

#### Implementation Gaps:
1. **Event Pitching Feature:**
   - Need new table: `PitchedEvent` with fields: `fan_id`, `team_id`, `event_type`, `description`, `proposed_date`, `status` (pending/approved/rejected)
   - API endpoint: `POST /events/pitch` (fan submits pitch)
   - API endpoint: `GET /events/pitched` (coaches view pitches)
   - API endpoint: `PATCH /events/pitched/:id` (coach approves/rejects)
   - UI: Fan event pitch form
   - UI: Coach event pitch approval dashboard

2. **Fan → Athlete/Staff Upgrade System:**
   - Need upgrade request flow: `preferences.upgrade_request = { type: 'athlete' | 'staff', status: 'pending' | 'approved' | 'rejected', coach_id, team_id }`
   - API endpoint: `POST /users/request-upgrade` (fan requests upgrade)
   - API endpoint: `GET /users/upgrade-requests` (coach views pending requests)
   - API endpoint: `PATCH /users/upgrade-requests/:id` (coach approves/rejects)
   - On approval: Update `preferences.role` from 'fan' to 'athlete' or 'staff'
   - UI: Upgrade request button in fan profile
   - UI: Coach approval interface in team management

---

### 2. ROOKIE Account (Entry-Level Coach)
**Current State:** Partial implementation  
**Role Value:** `preferences.role = 'rookie'`  
**Subscription Tier:** `subscription_tier = 'free'`  
**Team Limit:** `max_teams = 2`

#### Promised Features (from onboarding):
- ⚠️ **Perfect for first-time coaches** (just marketing copy)
- ✅ First two teams free (enforced by `max_teams = 2`)
- ✅ Example: Men's and Women's Soccer
- ⚠️ **Create events including games, fundraisers, and watch parties** (PARTIAL - need event types)

#### Required Permissions:
```typescript
ROOKIE_PERMISSIONS = {
  // Team management
  createTeams: true,
  maxTeams: 2,  // ⚠️ ENFORCE IN BACKEND
  manageRoster: true,
  invitePlayers: true,
  
  // Event creation
  createGames: true,
  createFundraisers: true,  // ⚠️ NEEDS EVENT TYPE SUPPORT
  createWatchParties: true,  // ⚠️ NEEDS EVENT TYPE SUPPORT
  
  // Content
  postHighlights: true,
  postUpdates: true,
  
  // Restrictions
  unlimitedTeams: false,
  addAuthorizedUsers: false,  // Only 1 owner per team
  prioritySupport: false
}
```

#### Implementation Gaps:
1. **Enforce 2-Team Limit:**
   - Backend validation in team creation endpoint
   - Check `user.max_teams` before allowing new team
   - Show upgrade prompt when limit reached

2. **Event Type System:**
   - Update `Event` model with `event_type` field: 'game' | 'fundraiser' | 'watch_party' | 'practice' | 'scrimmage'
   - Filter event creation UI based on account type
   - Add fundraiser-specific fields: `fundraiser_goal`, `fundraiser_raised`
   - Add watch party-specific fields: `watch_party_location`, `watch_party_streaming_url`

3. **Upgrade Path to Veteran:**
   - When rookie tries to create 3rd team, show paywall
   - Stripe integration for $2.50/month per team
   - Update `subscription_tier` to 'premium' (Veteran)
   - Update `max_teams` to unlimited (-1 or 999)

---

### 3. COACH / ORGANIZER Account (Veteran/Legend)
**Current State:** Exists but needs feature gating  
**Role Value:** `preferences.role = 'coach'`  
**Subscription Tier:** `subscription_tier = 'premium'` (Veteran) OR `'pro'` (Legend)

#### Promised Features (from onboarding):
- ✅ Create and manage teams
- ✅ Organize games and events
- ✅ Invite players and staff
- ✅ Full management tools
- ⚠️ **Unlimited teams and authorized users** (NEEDS SUBSCRIPTION GATING)

#### Veteran Coach (Premium Tier):
```typescript
VETERAN_PERMISSIONS = {
  createTeams: true,
  maxTeams: -1,  // Unlimited (or 999)
  pricePerTeam: 2.50,  // $2.50/month per team after first 2
  firstTwoFree: true,
  
  // Same as Rookie, plus:
  addAuthorizedUsers: true,  // Limited to 3-5 per team?
  maxAuthorizedUsers: 5,
  advancedStats: true,
  teamPromotion: true
}
```

#### Legend Coach (Pro Tier):
```typescript
LEGEND_PERMISSIONS = {
  createTeams: true,
  maxTeams: -1,
  unlimited: true,
  
  // Premium features:
  addAuthorizedUsers: true,
  maxAuthorizedUsers: -1,  // Truly unlimited
  organizationManagement: true,
  prioritySupport: true,
  customBranding: true,
  advancedAnalytics: true
}
```

#### Implementation Gaps:
1. **Subscription Management:**
   - Stripe integration for recurring payments
   - Calculate monthly charge: `(teamCount - 2) * 2.50` for Veteran
   - Contact sales flow for Legend tier
   - Webhook handling for payment success/failure
   - Downgrade logic when payment fails

2. **Authorized Users System:**
   - New table: `AuthorizedUser` with `user_id`, `team_id`, `role` (assistant_coach, staff), `invited_by`, `status`
   - Check `subscription_tier` before allowing authorized user invites
   - Enforce `maxAuthorizedUsers` limit for Veteran tier
   - API endpoints for managing authorized users

3. **Feature Gating:**
   - Middleware to check subscription tier before API calls
   - Block unlimited team creation for Rookie
   - Block authorized user invites for Rookie
   - Show upgrade prompts in UI when limits reached

---

## Database Schema Updates Needed

### 1. Add `role` field to User table (proper column)
```prisma
model User {
  // ... existing fields
  role String @default("fan") // fan | rookie | coach | athlete | staff
  // Keep preferences.role for backward compatibility during migration
}
```

### 2. Add Event Pitch table
```prisma
model PitchedEvent {
  id          String   @id @default(cuid())
  fan_id      String
  fan         User     @relation(fields: [fan_id], references: [id])
  team_id     String
  team        Team     @relation(fields: [team_id], references: [id])
  event_type  String   // game | fundraiser | watch_party
  title       String
  description String
  proposed_date DateTime?
  location    String?
  status      String   @default("pending") // pending | approved | rejected
  created_at  DateTime @default(now())
  reviewed_by String?
  reviewed_at DateTime?
  rejection_reason String?
}
```

### 3. Add Upgrade Request tracking
```prisma
model UpgradeRequest {
  id         String   @id @default(cuid())
  user_id    String
  user       User     @relation(fields: [user_id], references: [id])
  from_role  String   // fan
  to_role    String   // athlete | staff
  team_id    String?
  team       Team?    @relation(fields: [team_id], references: [id])
  status     String   @default("pending") // pending | approved | rejected
  coach_id   String?
  coach      User?    @relation("coach_approvals", fields: [coach_id], references: [id])
  created_at DateTime @default(now())
  reviewed_at DateTime?
}
```

### 4. Update Event table with types
```prisma
model Event {
  // ... existing fields
  event_type String @default("game") // game | fundraiser | watch_party | practice | scrimmage
  
  // Fundraiser fields
  fundraiser_goal   Float?
  fundraiser_raised Float?
  
  // Watch party fields
  watch_party_streaming_url String?
}
```

### 5. Add Authorized Users table
```prisma
model AuthorizedUser {
  id         String   @id @default(cuid())
  user_id    String
  user       User     @relation(fields: [user_id], references: [id])
  team_id    String
  team       Team     @relation(fields: [team_id], references: [id])
  role       String   // assistant_coach | staff | analyst
  invited_by String
  inviter    User     @relation("invited_users", fields: [invited_by], references: [id])
  status     String   @default("pending") // pending | active | revoked
  created_at DateTime @default(now())
  
  @@unique([user_id, team_id])
}
```

---

## API Endpoints to Implement

### Event Pitching
- `POST /events/pitch` - Fan pitches event to team
- `GET /events/pitched` - Coach views pitched events for their teams
- `PATCH /events/pitched/:id/approve` - Coach approves pitch
- `PATCH /events/pitched/:id/reject` - Coach rejects pitch

### Upgrade Requests
- `POST /users/request-upgrade` - Fan requests upgrade to athlete/staff
- `GET /teams/:id/upgrade-requests` - Coach views pending upgrade requests
- `PATCH /upgrade-requests/:id/approve` - Coach approves upgrade
- `PATCH /upgrade-requests/:id/reject` - Coach rejects upgrade

### Authorized Users
- `POST /teams/:id/authorized-users` - Coach invites authorized user
- `GET /teams/:id/authorized-users` - List authorized users for team
- `DELETE /teams/:id/authorized-users/:userId` - Revoke access
- `PATCH /authorized-users/:id/accept` - User accepts invitation

### Subscription Management
- `POST /subscriptions/upgrade` - Upgrade from Rookie to Veteran/Legend
- `POST /subscriptions/downgrade` - Downgrade tier
- `GET /subscriptions/calculate` - Calculate monthly bill preview
- `POST /subscriptions/webhook` - Stripe webhook handler

---

## Permission Checking Middleware

```typescript
// server/src/middleware/permissions.ts

export const requireRole = (allowedRoles: string[]) => {
  return (req, res, next) => {
    const userRole = req.user?.preferences?.role || 'fan';
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

export const requireSubscription = (minTier: 'free' | 'premium' | 'pro') => {
  return (req, res, next) => {
    const tier = req.user?.subscription_tier || 'free';
    const tierLevels = { free: 0, premium: 1, pro: 2 };
    if (tierLevels[tier] < tierLevels[minTier]) {
      return res.status(402).json({ error: 'Upgrade required', minTier });
    }
    next();
  };
};

export const checkTeamLimit = async (req, res, next) => {
  const userId = req.user.id;
  const teamCount = await prisma.teamMembership.count({
    where: { user_id: userId, role: 'owner' }
  });
  const maxTeams = req.user.max_teams || 2;
  
  if (teamCount >= maxTeams) {
    return res.status(402).json({ 
      error: 'Team limit reached', 
      currentTeams: teamCount,
      maxTeams,
      upgradeRequired: true 
    });
  }
  next();
};
```

---

## Frontend Permission Checks

```typescript
// utils/permissions.ts

export const canCreateTeam = (user: User): boolean => {
  const teamCount = user.ownedTeamsCount || 0;
  const maxTeams = user.max_teams || 2;
  return teamCount < maxTeams;
};

export const canPitchEvent = (user: User): boolean => {
  return user.role === 'fan';
};

export const canApproveUpgrades = (user: User, team: Team): boolean => {
  return user.role === 'coach' && isTeamOwner(user, team);
};

export const canInviteAuthorizedUsers = (user: User): boolean => {
  return ['premium', 'pro'].includes(user.subscription_tier);
};

export const getUpgradePrompt = (user: User, action: string): string => {
  if (user.role === 'rookie' && action === 'create_team') {
    return 'Upgrade to Veteran ($2.50/month per team) to create unlimited teams';
  }
  // ... more prompts
};
```

---

## Next Steps (Priority Order)

1. **Database Migration:**
   - Add `role` column to User table
   - Create PitchedEvent table
   - Create UpgradeRequest table
   - Add event_type to Event table
   - Create AuthorizedUser table

2. **Implement Event Pitching:**
   - API endpoints
   - Fan UI (pitch form)
   - Coach UI (approval dashboard)

3. **Implement Upgrade System:**
   - API endpoints
   - Fan UI (request upgrade)
   - Coach UI (approve requests)
   - Handle role transitions

4. **Enforce Team Limits:**
   - Backend validation
   - Frontend checks
   - Upgrade prompts

5. **Subscription Management:**
   - Stripe integration
   - Billing calculations
   - Payment webhooks
   - Upgrade/downgrade flows

6. **Authorized Users:**
   - Invitation system
   - Permission enforcement
   - Team collaboration features

---

## Testing Requirements

- [ ] Fan can pitch events to teams
- [ ] Coach receives pitched event notifications
- [ ] Coach can approve/reject pitched events
- [ ] Fan can request upgrade to athlete
- [ ] Coach can approve/reject upgrade requests
- [ ] Rookie blocked from creating 3+ teams
- [ ] Veteran can create unlimited teams after payment
- [ ] Rookie blocked from inviting authorized users
- [ ] Veteran can invite up to 5 authorized users
- [ ] Legend has truly unlimited everything
- [ ] Subscription downgrade removes features
- [ ] Payment failure blocks premium features

---

**Remember: Every feature promised in onboarding MUST work. No empty promises.**
