#!/bin/bash
# Reset onboarding for current user (run this to test onboarding flow again)

# Get your user email
echo "Enter your email address:"
read EMAIL

# Update the database directly
cd server && npx prisma db execute --stdin <<SQL
UPDATE "User"
SET preferences = jsonb_set(
  COALESCE(preferences, '{}'::jsonb),
  '{onboarding_completed}',
  'false'
)
WHERE email = '$EMAIL';
SQL

echo "Onboarding reset for $EMAIL. Log out and log back in to see onboarding flow."
