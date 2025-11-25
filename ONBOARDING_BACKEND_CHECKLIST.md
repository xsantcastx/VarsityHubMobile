# Onboarding Backend Implementation Checklist

**Last Updated:** November 19, 2025  
**Status:** Pre-Production Verification

This document tracks all backend requirements to support the updated onboarding flow.

---

## Overview of Onboarding Changes

### Frontend Changes Made:
1. ✅ Role standardization (Fan vs Coach only - removed "Rookie" as role)
2. ✅ New team role system (Coach, Manager, Assistant, Equipment, Health & Wellness)
3. ✅ Plan-based authorized user limits (Rookie: 1, Veteran: 2 per team, Legend: unlimited)
4. ✅ Organization search (name or zip code with live preview)
5. ✅ Duplicate organization handling
6. ✅ Metallic silver UI for Rookie Plan Benefits
7. ✅ Complete onboarding state management

---

## Backend Verification Checklist

### ✅ COMPLETED - Working as Expected

#### 1. Authentication & User Management
- [x] **JWT Authentication** (`/auth/login`, `/auth/register`)
  - Location: `server/src/routes/auth.ts`
  - Password hashing with bcrypt (10-12 rounds)
  - Token generation and validation working
  
- [x] **User Preferences** (`/me/preferences`)
  - Location: `server/src/routes/auth.ts` line 454-505
  - Supports role, plan, dob, zip_code, etc.
  - Merge function preserves nested objects

- [x] **Complete Onboarding** (`/me/complete-onboarding`)
  - Location: `server/src/routes/auth.ts` line 601-675
  - Schema: `completeOnboardingSchema` (line 556)
  - Accepts all onboarding fields
  - Sets `onboarding_completed: true`

#### 2. Team Management
- [x] **Create Team** (`POST /teams`)
  - Location: `server/src/routes/teams.ts` line 560-657
  - Schema validates name, sport, age_group, organization_id
  - Supports authorized_users array during creation
  
- [x] **Team Invites** (`POST /teams/:id/invite`)
  - Location: `server/src/routes/teams.ts` line 660-679
  - Accepts email and role
  - Creates `TeamInvite` record
  - Sends email notification

- [x] **Get Managed Teams** (`GET /teams/managed`)
  - Location: `server/src/routes/teams.ts` line 30-83
  - Returns teams where user is owner/manager/coach

#### 3. Organization Management
- [x] **Create Organization** (`POST /organizations`)
  - Location: `server/src/routes/organizations.ts` line 143-293
  - Schema validates name, type, location, zip_code, sport
  - Creates owner membership automatically
  - Supports authorized_users array during creation
  
- [x] **Organization Invites** (`POST /organizations/:id/invite`)
  - Location: `server/src/routes/organizations.ts` line 302-338
  - Accepts email and role
  - Permission check (requires admin/owner)
  - Creates `OrganizationInvite` record
  - Sends email notification

- [x] **Search Organizations** (`GET /organizations/search/nearby`)
  - Location: `server/src/routes/organizations.ts` line 397-450
  - **UPDATED:** Now accepts `query` param (replaces `zip_code`)
  - Supports name OR zip code search with OR conditions
  - Case-insensitive partial matching for name/location
  - Exact match for 5-digit zip codes

- [x] **Check Duplicate** (`POST /organizations/check-duplicate`)
  - Location: `server/src/routes/organizations.ts` line 452-473
  - Case-insensitive name matching
  - Optional zip_code filter

- [x] **Get My Organizations** (`GET /organizations/mine`)
  - Location: `server/src/routes/organizations.ts` line 109-141
  - Returns orgs where user is owner/manager

#### 4. Join Request System
- [x] **Create Join Request** (`POST /organizations/join-requests`)
  - Location: `server/src/routes/organizations.ts` line 481-533
  - User can request to join organization
  - Sends notification to organization admins
  - Prevents duplicate requests

---

### ⚠️ NEEDS IMPLEMENTATION / VERIFICATION

#### 5. Team & Organization Roles

**Current Backend Role Values (from schema):**

**TeamMembership roles:**
```prisma
enum TeamRole {
  owner
  manager
  coach
  assistant_coach
  player
  parent
  member
}
```

**OrganizationMembership roles:**
```prisma
enum OrgRole {
  owner
  manager
  member
}
```

**Frontend is sending:**
- `coach` ✅ (exists in TeamRole)
- `manager` ✅ (exists in both)
- `assistant_coach` ✅ (exists in TeamRole)
- `equipment` ❌ **NOT IN SCHEMA**
- `health_wellness` ❌ **NOT IN SCHEMA**

**ACTION REQUIRED:**
```prisma
// Update server/prisma/schema.prisma

enum TeamRole {
  owner
  manager
  coach
  assistant_coach
  equipment          // ← ADD THIS
  health_wellness    // ← ADD THIS
  player
  parent
  member
}
```

Then run:
```bash
cd server
npx prisma migrate dev --name add_equipment_health_wellness_roles
npx prisma generate
```

#### 6. Plan-Based Limits Enforcement

**Frontend Expectations:**
- **Rookie Plan:** Max 2 teams, 1 authorized user
- **Veteran Plan:** Unlimited teams ($2.50/month each after first 2), 2 authorized users per team
- **Legend Plan:** Unlimited teams (flat $19.99/year), unlimited authorized users

**Current Backend Status:**
- ❌ No team count limit enforcement
- ❌ No authorized user limit enforcement
- ❌ No billing integration for Veteran plan per-team pricing

**ACTION REQUIRED:**

1. **Add Subscription Validation Middleware**
```typescript
// server/src/middleware/subscription.ts (NEW FILE)
export function requirePlan(minPlan: 'rookie' | 'veteran' | 'legend') {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { preferences: true }
    });
    
    const userPlan = user?.preferences?.plan;
    const plans = ['rookie', 'veteran', 'legend'];
    const userPlanIndex = plans.indexOf(userPlan);
    const requiredIndex = plans.indexOf(minPlan);
    
    if (userPlanIndex === -1 || userPlanIndex < requiredIndex) {
      return res.status(403).json({ 
        error: 'PLAN_UPGRADE_REQUIRED',
        message: `This feature requires ${minPlan} plan or higher`
      });
    }
    next();
  };
}
```

2. **Enforce Team Limits on Creation**
```typescript
// In POST /teams endpoint (server/src/routes/teams.ts)

// After auth check, before creating team:
const user = await prisma.user.findUnique({
  where: { id: req.user!.id },
  select: { preferences: true }
});

const userPlan = user?.preferences?.plan || 'rookie';
const existingTeams = await prisma.team.count({
  where: {
    memberships: {
      some: {
        user_id: req.user!.id,
        role: 'owner'
      }
    }
  }
});

// Rookie plan: max 2 teams
if (userPlan === 'rookie' && existingTeams >= 2) {
  return res.status(403).json({
    error: 'TEAM_LIMIT_REACHED',
    message: 'Rookie plan allows maximum 2 teams. Upgrade to Veteran or Legend for more.',
    limit: 2,
    current: existingTeams
  });
}

// Note: Veteran/Legend have no hard limit, but billing should be triggered
```

3. **Enforce Authorized User Limits**
```typescript
// In POST /teams/:id/invite and POST /organizations/:id/invite

const user = await prisma.user.findUnique({
  where: { id: req.user!.id },
  select: { preferences: true }
});

const userPlan = user?.preferences?.plan || 'rookie';

// Count existing authorized users
const existingInvites = await prisma.teamInvite.count({
  where: { team_id: teamId }
});

const existingMembers = await prisma.teamMembership.count({
  where: { 
    team_id: teamId,
    role: { in: ['manager', 'coach', 'assistant_coach', 'equipment', 'health_wellness'] }
  }
});

const totalAuthorized = existingInvites + existingMembers;

// Rookie: 1 authorized user max
if (userPlan === 'rookie' && totalAuthorized >= 1) {
  return res.status(403).json({
    error: 'USER_LIMIT_REACHED',
    message: 'Rookie plan allows 1 authorized user. Upgrade for more.',
    limit: 1
  });
}

// Veteran: 2 per team (need team count from preferences)
if (userPlan === 'veteran') {
  const teamCount = user?.preferences?.team_count_total || 0;
  const maxUsers = teamCount * 2;
  if (totalAuthorized >= maxUsers) {
    return res.status(403).json({
      error: 'USER_LIMIT_REACHED',
      message: `Veteran plan allows ${maxUsers} authorized users (2 per team).`,
      limit: maxUsers
    });
  }
}

// Legend: unlimited (no check needed)
```

#### 7. Stripe Billing Integration

**Frontend sends:**
- `payment_pending: true` for Veteran/Legend plans
- `team_count_total: <number>` for Veteran plan

**Backend needs:**
- ⚠️ Stripe checkout session creation
- ⚠️ Webhook handlers for payment success/failure
- ⚠️ Dynamic pricing for Veteran plan (quantity = team count - 2)

**ACTION REQUIRED:**

1. **Add Stripe Checkout Endpoint**
```typescript
// server/src/routes/billing.ts (NEW FILE)
import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

billingRouter.post('/checkout/create-session', requireAuth, async (req: AuthedRequest, res) => {
  const { plan, teamCount } = req.body;
  
  let priceId: string;
  let quantity = 1;
  
  if (plan === 'veteran') {
    priceId = process.env.STRIPE_VETERAN_PRICE_ID!; // $2.50/month per team
    quantity = Math.max(0, teamCount - 2); // First 2 teams free
  } else if (plan === 'legend') {
    priceId = process.env.STRIPE_LEGEND_PRICE_ID!; // $19.99/year flat
    quantity = 1;
  } else {
    return res.status(400).json({ error: 'Invalid plan' });
  }
  
  const session = await stripe.checkout.sessions.create({
    customer_email: req.user!.email,
    payment_method_types: ['card'],
    line_items: [{
      price: priceId,
      quantity: quantity || 1
    }],
    mode: plan === 'legend' ? 'subscription' : 'subscription',
    success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
    metadata: {
      user_id: req.user!.id,
      plan,
      team_count: teamCount
    }
  });
  
  return res.json({ sessionId: session.id, url: session.url });
});
```

2. **Add Webhook Handler**
```typescript
billingRouter.post('/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, webhookSecret);
  } catch (err) {
    return res.status(400).send(`Webhook Error`);
  }
  
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.user_id;
    const plan = session.metadata.plan;
    
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscription_tier: plan,
        subscription_status: 'active',
        stripe_customer_id: session.customer,
        preferences: {
          ...existingPrefs,
          payment_pending: false,
          plan: plan
        }
      }
    });
  }
  
  res.json({ received: true });
});
```

#### 8. Age-Based Messaging Restrictions

**Frontend collects:** Date of birth  
**Backend needs:** Enforce age policy on `/messages` endpoints

**ACTION REQUIRED:**
```typescript
// In server/src/routes/messages.ts

messagesRouter.post('/', requireAuth, async (req: AuthedRequest, res) => {
  const { recipient_id, content } = req.body;
  
  // Check sender and recipient ages
  const [sender, recipient] = await Promise.all([
    prisma.user.findUnique({ 
      where: { id: req.user!.id },
      select: { preferences: true }
    }),
    prisma.user.findUnique({
      where: { id: recipient_id },
      select: { id: true, preferences: true }
    })
  ]);
  
  if (!recipient) {
    return res.status(404).json({ error: 'Recipient not found' });
  }
  
  // Calculate ages
  const senderDob = sender?.preferences?.dob;
  const recipientDob = recipient?.preferences?.dob;
  
  if (senderDob) {
    const senderAge = calculateAge(senderDob);
    
    // Users under 18 can only message users they follow
    if (senderAge < 18) {
      const isFollowing = await prisma.follows.findUnique({
        where: {
          follower_id_following_id: {
            follower_id: req.user!.id,
            following_id: recipient_id
          }
        }
      });
      
      if (!isFollowing) {
        return res.status(403).json({
          error: 'AGE_POLICY_BLOCKED',
          message: 'Users under 18 can only message accounts they follow.'
        });
      }
    }
  }
  
  // Continue with message creation...
});

function calculateAge(dob: string): number {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}
```

---

## Database Schema Updates Needed

### 1. Add New Team Roles
```prisma
enum TeamRole {
  owner
  manager
  coach
  assistant_coach
  equipment          // ← NEW
  health_wellness    // ← NEW
  player
  parent
  member
}
```

**Migration command:**
```bash
cd server
npx prisma migrate dev --name add_equipment_health_wellness_roles
```

### 2. Verify Invite Tables

**TeamInvite:**
```prisma
model TeamInvite {
  id         String   @id @default(cuid())
  team_id    String
  email      String
  role       String   @default("member")  // ✅ Accepts any string
  created_at DateTime @default(now())
  team       Team     @relation(fields: [team_id], references: [id])
}
```
Status: ✅ Working (accepts all role strings)

**OrganizationInvite:**
```prisma
model OrganizationInvite {
  id              String       @id @default(cuid())
  organization_id String
  email           String
  role            String       @default("member")  // ✅ Accepts any string
  created_at      DateTime     @default(now())
  organization    Organization @relation(fields: [organization_id], references: [id])
}
```
Status: ✅ Working (accepts all role strings)

---

## Environment Variables Required

Add to `server/.env`:

```bash
# Stripe (Production - DO NOT COMMIT)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs
STRIPE_VETERAN_PRICE_ID=price_... # $2.50/month per team
STRIPE_LEGEND_PRICE_ID=price_...  # $19.99/year flat

# Frontend URLs
FRONTEND_URL=https://yourdomain.com

# Optional: Development fallbacks
# FRONTEND_URL=http://localhost:8081
# If missing STRIPE_* keys, billing routes will return BillingUnavailable
```

---

## Testing Checklist

### Unit Tests Needed
- [ ] Team creation with plan limits
- [ ] Authorized user invitation with limits
- [ ] Age-based messaging restrictions
- [ ] Stripe webhook processing
- [ ] Role validation for equipment/health_wellness

### Integration Tests
- [ ] Complete onboarding flow (Fan)
- [ ] Complete onboarding flow (Coach - Rookie)
- [ ] Complete onboarding flow (Coach - Veteran)
- [ ] Complete onboarding flow (Coach - Legend)
- [ ] Organization search (by name)
- [ ] Organization search (by zip code)
- [ ] Duplicate organization detection
- [ ] Team invite acceptance flow
- [ ] Organization join request flow

### Manual Testing
- [ ] Create team as Rookie user (should succeed for first 2)
- [ ] Create 3rd team as Rookie user (should fail)
- [ ] Add 1 authorized user as Rookie (should succeed)
- [ ] Add 2nd authorized user as Rookie (should fail)
- [ ] Veteran plan checkout with 5 teams (should charge for 3 teams)
- [ ] Under-18 user attempts to message stranger (should fail)
- [ ] Search organization by partial name "West" (should find "Westhill")
- [ ] Search organization by zip "06902" (should find exact matches)

---

## Priority Implementation Order

### 🔴 Critical (Must Complete Before Production)
1. **Add equipment/health_wellness roles to schema** (5 min)
   - Update `schema.prisma`
   - Run migration
   - Restart server

2. **Implement age messaging restrictions** (30 min)
   - Add age check to `/messages` endpoint
   - Add calculate age helper
   - Test with under-18 account

3. **Add Stripe price IDs to environment** (10 min)
   - Create products in Stripe dashboard
   - Add price IDs to `.env`

### 🟡 High Priority (Production Launch Requirements)
4. **Enforce team limits** (1 hour)
   - Rookie: 2 team max
   - Add clear error messages
   - Test enforcement

5. **Enforce authorized user limits** (1 hour)
   - Rookie: 1 user max
   - Veteran: 2 per team
   - Legend: unlimited
   - Test all scenarios

6. **Stripe checkout integration** (2-3 hours)
   - Create checkout session endpoint
   - Implement webhook handler
   - Test payment flows
   - Add error handling

### 🟢 Medium Priority (Post-Launch Improvements)
7. **Rate limiting** (1 hour)
   - Add to auth endpoints
   - Add to invite endpoints

8. **Audit logging** (2 hours)
   - Log team creations
   - Log user invitations
   - Log plan changes

9. **Admin dashboard queries** (As needed)
   - Team count by plan
   - Revenue by plan tier
   - User growth metrics

---

## Security Verification

- [x] Password hashing (bcrypt, 10-12 rounds)
- [x] JWT token authentication
- [x] Data sanitization (remove password_hash, codes)
- [x] Input validation (Zod schemas)
- [x] SQL injection prevention (Prisma ORM)
- [ ] Rate limiting on auth endpoints
- [ ] API key restrictions (Maps, Stripe)
- [ ] HTTPS enforcement
- [ ] CORS configuration for production

---

## Next Steps

1. **Immediate (Today):**
   - Add `equipment` and `health_wellness` to `TeamRole` enum
   - Run Prisma migration
   - Test team/org invite endpoints with new roles

2. **This Week:**
   - Implement plan-based team limits
   - Implement authorized user limits
   - Add age-based messaging restrictions

3. **Before Production:**
   - Complete Stripe integration
   - Add rate limiting
   - Configure production environment variables
   - Run full integration test suite

---

**Document Status:** Ready for implementation  
**Estimated Total Implementation Time:** 8-10 hours  
**Target Completion:** Before production launch
