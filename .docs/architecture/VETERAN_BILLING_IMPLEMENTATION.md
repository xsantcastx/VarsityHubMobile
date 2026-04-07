# Veteran Plan Billing Implementation

## Overview
Implemented comprehensive team count tracking and billing validation for Veteran plan subscribers ($2.50/month per team).

## Changes Made

### 1. Backend - Payment System (server/src/routes/payments.ts)

#### Modified `createMembershipCheckoutSession()` function:
- **Added `teamCount` parameter** - accepts number of teams for Veteran plan
- **Validation** - requires minimum 3 teams for Veteran (since first 2 are free on Rookie)
- **Dynamic quantity** - calculates Stripe line item quantity based on team count
- **Metadata tracking** - stores team_count in session metadata
- **Accurate pricing** - displays total monthly cost in description (e.g., "$2.50/month per team (3 teams)")

#### Added new endpoint `/update-subscription-quantity`:
- **Purpose** - Updates existing Veteran subscription quantity when user adds teams
- **Method** - POST
- **Body** - `{ team_count: number }`
- **Validation** - Checks user has active Veteran subscription, minimum 3 teams
- **Action** - Updates Stripe subscription item quantity via `stripe.subscriptionItems.update()`
- **Response** - Returns subscription_id, new quantity, and monthly cost

### 2. Frontend - Onboarding Flow (app/onboarding/step-3-plan.tsx)

#### Added Team Count Selection Modal:
- **Trigger** - Shows when user selects Veteran plan
- **UI Components**:
  - Plus/minus buttons to adjust team count (minimum 3)
  - Real-time pricing display (e.g., "$7.50/month" for 3 teams)
  - Breakdown showing calculation (3 teams × $2.50)
- **UX Flow** - User must specify team count before checkout
- **State Management** - `teamCount` state with default value of 3

#### Updated checkout integration:
- **API call** - Passes `teamCount` parameter to `Subscriptions.createCheckout(plan, teamCount)`
- **Validation** - Prevents checkout if team count not confirmed for Veteran plan

### 3. Frontend - Team Creation (app/create-team.tsx)

#### Enhanced Veteran user flow:
- **Detection** - Checks if user is on Veteran plan before creating team
- **Alert improvements**:
  - Shows current team count and new total
  - Displays new monthly cost (e.g., "Adding this team will increase your monthly charge to $3.00/month (4 total teams = 2 billed × $0.99)")
  - Explains subscription will be updated automatically
- **Subscription update** - Calls `Subscriptions.updateQuantity(newTeamCount)` before creating team
- **Error handling** - Shows user-friendly error if subscription update fails

### 4. Backend - Team Creation Validation (server/src/routes/teams.ts)

#### Added Veteran plan validation in `/teams/create` endpoint:
- **Team count check** - Counts user's owned active teams
- **Subscription verification**:
  - Checks user has `subscription_id` in preferences
  - Retrieves Stripe subscription to verify status (must be `active`)
  - Gets paid quantity from subscription item
- **Enforcement logic**:
  - If creating team #4 but only paid for 3 → reject with error
  - Error includes current team count and paid quantity
  - Requires frontend to update subscription first
- **Error codes**:
  - `NO_ACTIVE_SUBSCRIPTION` - Missing subscription_id
  - `SUBSCRIPTION_NOT_ACTIVE` - Subscription canceled/expired
  - `SUBSCRIPTION_QUANTITY_EXCEEDED` - Trying to exceed paid limit

### 5. API Client (api/entities.ts)

#### Updated Subscriptions API:
- **Modified `createCheckout()`** - Now accepts optional `teamCount` parameter
- **Added `updateQuantity()`** - New method to update subscription quantity
  - Signature: `updateQuantity: (teamCount: number) => httpPost('/payments/update-subscription-quantity', { team_count: teamCount })`

## User Flow Examples

### Onboarding with Veteran Plan:
1. User selects "Veteran" plan on step 3
2. Modal appears asking "How Many Total Teams?" (first 2 stay free)
3. User adjusts count (min 3) using +/- buttons
4. Sees real-time pricing: "$0.99/month (3 total teams = 1 billed × $0.99)"
5. Clicks "Continue to Checkout"
6. Stripe checkout created with quantity=3, total $2.97/month
7. After payment, subscription stored with quantity=3

### Adding a Team as Veteran User:
1. Veteran user (paid for 3 teams, has 3 teams) clicks "Create Team"
2. Alert shows: "Adding this team will increase your monthly charge to $1.98/month (4 total teams = 2 billed × $0.99)"
3. User clicks "Continue"
4. Frontend calls `Subscriptions.updateQuantity(4)`
5. Stripe subscription updated to quantity=4 ($3.96/month)
6. Team creation proceeds
7. Backend validates: user has 3 teams, paid for 4 → allowed

### Rookie Auto-Upgrade at 3rd Team:
1. Rookie user has 2 teams (free)
2. Attempts to create 3rd team
3. App prompts to upgrade to Veteran and shows total monthly cost based on new team count
4. Starts Stripe checkout with quantity = current teams + 1
5. After payment, app verifies plan is Veteran and proceeds to create the team
6. Backend still validates subscription quantity to prevent bypass

### Protection Against Bypass:
1. Malicious user tries to create team #5 but only paid for 4
2. Backend checks Stripe subscription quantity
3. Finds quantity=4, current teams=4
4. Returns 403 error: "You've paid for 4 teams but are trying to create team #5"
5. Team creation blocked

## Technical Details

### Stripe Integration:
- **Price ID** - Uses `STRIPE_PRICE_VETERAN` environment variable (price_1SGKDDGJt8CsPE1EY6aFs7Hz)
- **Unit Amount** - 250 cents ($2.50)
- **Interval** - Monthly recurring
- **Quantity** - Dynamic based on team count
- **Subscription storage** - `preferences.subscription_id` in User model

### Data Flow:
1. **Onboarding** → team_count → Stripe session quantity
2. **Webhook** → Stripe subscription_id → user.preferences.subscription_id
3. **Create team** → update subscription quantity → Stripe API
4. **Validation** → fetch subscription → verify quantity ≥ team count

### Error Handling:
- **Frontend** - Shows user-friendly alerts with pricing details
- **Backend** - Returns structured errors with codes and specific messages
- **Stripe failures** - Graceful degradation with informative error messages

## Testing Checklist

- [ ] Onboarding: Select Veteran with 3 total teams → Verify $0.99/month checkout (1 billed × $0.99)
- [ ] Onboarding: Select Veteran with 5 total teams → Verify $2.97/month checkout (3 billed × $0.99)
- [ ] Add team: Veteran with 3 total teams (1 billed) → Should prompt to upgrade to $1.98/month (2 billed × $0.99)
- [ ] Add team: After payment, verify Stripe subscription quantity updated
- [ ] Backend validation: Try to create team without updating subscription → Should fail with 403
- [ ] Edge case: Rookie user creates 2 teams → Should work
- [ ] Edge case: Rookie user tries 3rd team → Should show upgrade prompt
- [ ] Legend user: Should create unlimited teams without quantity checks

## Environment Variables Required

```
STRIPE_SECRET_KEY=sk_live_YOUR_KEY_HERE
STRIPE_PRICE_VETERAN=price_1SGKDDGJt8CsPE1EY6aFs7Hz
```

## Security Considerations

✅ **Backend validation** - Cannot bypass by manipulating frontend
✅ **Stripe source of truth** - Always checks actual subscription quantity
✅ **Plan verification** - Validates user plan before applying rules
✅ **Subscription status** - Only allows active subscriptions (no trials)
✅ **Error codes** - Structured errors prevent information leakage

## Future Enhancements

1. **Subscription downgrade** - Allow users to reduce team count (with team deletion confirmation)
2. **Prorated billing** - Calculate prorated amounts when adding teams mid-cycle
3. **Team transfer** - Allow transferring team ownership without affecting subscription
4. **Bulk team creation** - Allow creating multiple teams at once with proper quantity calculation
5. **Analytics** - Track average team count per Veteran user for pricing optimization
