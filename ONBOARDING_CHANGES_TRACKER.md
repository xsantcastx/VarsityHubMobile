# Onboarding Changes Tracker
**Session Date:** November 16, 2025

## Changes Made So Far

### ✅ Step 1: Role Selection (`app/onboarding/step-1-role.tsx`)

#### Fan Account
- ✅ Changed "Connect with other fans" → "Pitch events for your community"
- ✅ Removed "Quick setup process"
- ✅ Updated upgrade note: "*Fan accounts can be upgraded to athlete/staff*"
- ✅ Split into two bullets: "- Upon coach approval"
- ✅ Grammar fix: "first-time coaches" (hyphenated)

**Current Features:**
```
✓ Follow your favorite teams
✓ Get game updates and highlights
✓ Pitch events for your community
✓ *Fan accounts can be upgraded to athlete/staff*
✓ - Upon coach approval
```

#### Rookie Account
- ✅ Removed "(Coach)" from title - now just "Rookie"
- ✅ Changed "(ex: Men's and Women's Soccer)" → "Example: Men's and Women's Soccer"
- ✅ Grammar fix: "first-time coaches" (hyphenated)

**Current Features:**
```
✓ Perfect for first-time coaches
✓ First two teams free
✓ Example: Men's and Women's Soccer
✓ Create events including games, fundraisers, and watch parties
```

#### Coach/Organizer Account
- ✅ Replaced "Communication features" → "Unlimited teams and authorized users"

**Current Features:**
```
✓ Create and manage teams
✓ Organize games and events
✓ Invite players and staff
✓ Full management tools
✓ Unlimited teams and authorized users
```

---

## Pending Changes (To Discuss)

### Step 2: Email Verification
- [ ] Review copy/messaging
- [ ] Any permission-related notes?

### Step 3: Profile Setup
- [ ] Different fields for different account types?
- [ ] Required vs optional fields by role?

### Step 4: Team Creation (Coach/Rookie only)
- [ ] Clarify 2-team limit messaging for Rookie
- [ ] Add upgrade prompt when limit reached?

### Step 5: League/Sport Selection
- [ ] Any changes needed?

### Step 6: Authorized Users (Coach only)
- [ ] Add messaging about Rookie vs Veteran vs Legend limits
- [ ] Skip for Rookie accounts?

### Step 7: Profile Photo
- [ ] Any changes?

### Step 8: Interests/Categories
- [ ] Different for each account type?

### Step 9: Welcome/Quick Start
- [ ] Customize actions by account type
- [ ] Match the promises from Step 1

### Step 10: Confirmation
- [ ] Update role descriptions to match Step 1

---

## Backend Implementation Notes

### Critical: Role-Based Feature Access
1. **Fan Permissions:**
   - ⚠️ Event pitching needs API endpoint
   - ⚠️ Upgrade request system needs database table
   - ✅ Can follow teams, RSVP, post reviews

2. **Rookie Permissions:**
   - ⚠️ ENFORCE 2-team limit in backend
   - ⚠️ Event types: games, fundraisers, watch parties
   - ❌ Cannot add authorized users
   - ❌ Cannot create unlimited teams

3. **Coach/Organizer Permissions:**
   - ⚠️ Veteran tier: $2.50/month per team after first 2
   - ⚠️ Legend tier: Unlimited everything
   - ⚠️ Authorized users system needs implementation
   - ✅ Full team management

### Database Changes Needed
- [ ] Add `role` column to User table (currently in preferences JSON)
- [ ] Create `PitchedEvent` table for fan event proposals
- [ ] Create `UpgradeRequest` table for fan→athlete transitions
- [ ] Create `AuthorizedUser` table for multi-user team management
- [ ] Add `event_type` to Event table (game/fundraiser/watch_party)

### API Endpoints Needed
- [ ] `POST /events/pitch` - Fan pitches event
- [ ] `GET /events/pitched` - Coach views pitches
- [ ] `PATCH /events/pitched/:id/approve` - Approve pitch
- [ ] `POST /users/request-upgrade` - Fan requests upgrade
- [ ] `GET /teams/:id/upgrade-requests` - Coach views requests
- [ ] `PATCH /upgrade-requests/:id/approve` - Approve upgrade
- [ ] `POST /teams/:id/authorized-users` - Invite authorized user
- [ ] Team creation endpoint needs to check `max_teams`

---

## Questions to Answer

1. **Athlete vs Staff:**
   - What's the difference between athlete and staff?
   - Different permissions?
   - Do they both need coach approval?

2. **Event Pitching:**
   - Can fans pitch to ANY team or only teams they follow?
   - What info is required in a pitch?
   - Can fans pitch all event types or just certain ones?

3. **Rookie Upgrade Flow:**
   - What happens when Rookie tries to create 3rd team?
   - Automatic upgrade to Veteran or manual choice?
   - Show pricing before forcing upgrade?

4. **Authorized Users:**
   - What roles can they have? (assistant coach, staff, analyst?)
   - What permissions do they get?
   - Can they invite other authorized users?

5. **Veteran vs Legend:**
   - Is there a UI to choose between them?
   - When does Legend tier make sense? (how many teams?)
   - Contact sales flow for Legend?

---

## Testing Checklist (After Implementation)

- [ ] Create Fan account → verify can pitch events
- [ ] Create Fan account → request upgrade → verify coach approval flow
- [ ] Create Rookie account → create 2 teams → verify blocked at 3rd
- [ ] Create Rookie account → verify cannot invite authorized users
- [ ] Create Veteran account → verify can create unlimited teams
- [ ] Create Veteran account → verify can invite authorized users (up to limit)
- [ ] Create Legend account → verify truly unlimited
- [ ] Test role transitions (Fan→Athlete, Rookie→Veteran, Veteran→Legend)

---

## Notes for Next Session

*Add any observations or ideas here as we continue...*

