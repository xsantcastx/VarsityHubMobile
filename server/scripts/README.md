# Server Scripts

This folder contains administrative and database management scripts for the VarsityHub server.

## Folder Structure

### 📁 database/
Scripts for managing user data, subscriptions, and database operations.

- **`check_user_plans.mjs`** - Analyzes user subscription plans and identifies issues
  - Shows distribution of rookie/veteran/legend users
  - Identifies users with paid plans but missing subscription IDs
  - Usage: `node check_user_plans.mjs`

- **`reset_unpaid_simple.mjs`** - Safely resets users with unpaid subscriptions
  - Interactive script with confirmation prompts
  - Resets paid plan users back to rookie if no valid subscription ID
  - Usage: `node reset_unpaid_simple.mjs`

### 📁 stripe/
Scripts for managing Stripe payment integration.

- **`create_stripe_prices.js`** - Creates Stripe price IDs for subscription plans
  - Sets up Veteran ($70/year) and Legend ($150/year) pricing
  - Outputs price IDs for environment variables
  - ⚠️  Contains actual Stripe keys - keep secure
  - Usage: `node create_stripe_prices.js`

## Usage

All scripts should be run from the server directory:

```bash
cd server
node scripts/database/check_user_plans.mjs
node scripts/database/reset_unpaid_simple.mjs  
node scripts/stripe/create_stripe_prices.js
```

## P0 Foundation scripts

- **`verify-rate-limit-coverage.ts`** - validates sensitive endpoints have rate limiter middleware
  - Usage: `npm run verify:rate-limits`

- **`verify-production-health.ts`** - validates health endpoint reports production integrations and payment config ready
  - Usage: `BASE_URL=https://api-production-8ac3.up.railway.app npm run verify:production-health`

- **`audit-user-auth-state-drift.ts`** - validates Stream 3 dual-write consistency between canonical `User` auth columns and legacy `preferences` JSON
  - Usage: `DATABASE_URL=postgresql://test:test@localhost:5432/varsityhub_test npm run verify:auth-state-drift`

- **`audit-user-billing-state-drift.ts`** - validates Stream 5 dual-write consistency between canonical `User` billing columns and legacy `preferences` JSON
  - Usage: `DATABASE_URL=postgresql://test:test@localhost:5432/varsityhub_test npm run verify:billing-state-drift`

- **`reconcile-post-upvotes.ts`** - recomputes `Post.upvotes_count` from `PostUpvote` rows and repairs drift
  - Usage: `DATABASE_URL=postgresql://test:test@localhost:5432/varsityhub_test npm run reconcile:post-upvotes`

- **`load/p0-load-smoke.ts`** - runs baseline load smoke checks for auth/feed/upload/messages/payments
  - Usage: `npm run load:smoke`

- **`load/validate-distributed-lock.ts`** - validates distributed lock behavior across multiple worker processes (requires `REDIS_URL`)
  - Usage: `npm run load:validate-lock`

## Security Notes

- Stripe scripts contain live API keys
- Database scripts modify user data - always test first
- Use these scripts with caution in production
