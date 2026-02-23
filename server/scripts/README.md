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

### Feed & Ads

- **`seed-featured-ad.ts`** - Seeds a paid, approved ad with today's reservation (appears in Feed)
  - Use when: DB was seeded before ad fix, or you need a visible ad for testing
  - Usage: `npm run seed:featured-ad` (from server directory)

## Usage

All scripts should be run from the server directory:

```bash
cd server
npm run seed:featured-ad   # Add a feed-visible ad (requires users in DB)
node scripts/database/check_user_plans.mjs
node scripts/database/reset_unpaid_simple.mjs  
node scripts/stripe/create_stripe_prices.js
```

## Security Notes

- Stripe scripts contain live API keys
- Database scripts modify user data - always test first
- Use these scripts with caution in production