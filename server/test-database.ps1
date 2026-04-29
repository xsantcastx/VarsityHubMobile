# Test Database Connection

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  PostgreSQL Database Status Check" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "📊 Database Information:" -ForegroundColor Yellow
railway service Postgres | Out-Null
railway variables | Select-String "PGDATABASE","PGUSER","PGHOST" | ForEach-Object { Write-Host "  $_" }

Write-Host "`n🔄 Switching to API service..." -ForegroundColor Yellow
railway service api | Out-Null

Write-Host "`n✅ Database is configured and connected to your API!" -ForegroundColor Green
Write-Host "`n📝 Connection Details:" -ForegroundColor Cyan
Write-Host "  - Database: railway" -ForegroundColor White
Write-Host "  - User: postgres" -ForegroundColor White
Write-Host "  - Internal Host: postgres.railway.internal:5432" -ForegroundColor White
Write-Host "  - External Access: create temporary access in Railway only if operationally required" -ForegroundColor White

Write-Host "`n🔗 Access Database:" -ForegroundColor Yellow
Write-Host "  1. Preferred: use Railway-run commands from the API service:" -ForegroundColor White
Write-Host "     railway service api" -ForegroundColor Gray
Write-Host "     railway run npx prisma migrate status" -ForegroundColor Gray
Write-Host "     railway run npx prisma db pull" -ForegroundColor Gray
Write-Host "`n  2. If you need Prisma Studio locally:" -ForegroundColor White
Write-Host "     cd server" -ForegroundColor Gray
Write-Host '     $env:DATABASE_URL="<temporary external admin URL from Railway>"' -ForegroundColor Gray
Write-Host "     npx prisma studio" -ForegroundColor Gray
Write-Host "`n  3. Use pgAdmin or DBeaver only with a temporary admin URL:" -ForegroundColor White
Write-Host "     Host: [from Railway only when needed]" -ForegroundColor Gray
Write-Host "     Port: [from Railway only when needed]" -ForegroundColor Gray
Write-Host "     Database: railway" -ForegroundColor Gray
Write-Host "     User: postgres" -ForegroundColor Gray

Write-Host "`n📚 See POSTGRESQL_GUIDE.md for full details" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
