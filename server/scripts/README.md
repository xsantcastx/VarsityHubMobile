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
  - Sets up Veteran ($1.00/month per additional team) and Legend ($29.99/year) pricing
  - Outputs price IDs for environment variables
  - Requires `STRIPE_SECRET_KEY` in the environment before running
  - Usage: `node create_stripe_prices.js`

## Usage

All scripts should be run from the server directory:

```bash
cd server
node scripts/database/check_user_plans.mjs
node scripts/database/reset_unpaid_simple.mjs  
node scripts/stripe/create_stripe_prices.js
```

## Security Notes

- Never commit real Stripe keys or webhook secrets into scripts or docs
- Database scripts modify user data - always test first
- Use these scripts with caution in production
