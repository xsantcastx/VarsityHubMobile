# Railway Migration Script (Windows)
# Use this if you need to run migrations manually

Write-Host "🔄 Running database migrations on Railway..." -ForegroundColor Cyan

# Note: railway run executes locally with Railway env vars
# This won't work if database is behind Railway proxy
# Use Railway dashboard instead

Write-Host @"

⚠️  IMPORTANT: Run migrations in Railway Dashboard instead!

Steps:
1. Go to: https://railway.com/project/22899614-5ae1-47e9-bdd6-7f6d5ce5619e/service/6bf477a3-56a7-44d0-aa29-ff86a76cdc02
2. Click on 'Settings' tab
3. Scroll to 'Deploy' section
4. Under 'Custom Start Command', temporarily change to:
   npx prisma migrate deploy && node dist/index.js
5. Click 'Deploy' to run migrations
6. After successful deploy, change back to:
   node dist/index.js
7. Click 'Deploy' again

OR use Railway CLI shell (requires interactive terminal):
   railway shell
   npx prisma migrate deploy
   exit

"@ -ForegroundColor Yellow
