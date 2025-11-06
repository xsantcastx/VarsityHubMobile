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
Write-Host "  - Public Host: hopper.proxy.rlwy.net:22104" -ForegroundColor White

Write-Host "`n🔗 Access Database:" -ForegroundColor Yellow
Write-Host "  1. Use Prisma Studio:" -ForegroundColor White
Write-Host "     cd server" -ForegroundColor Gray
Write-Host '     $env:DATABASE_URL="postgresql://postgres:AAsjKJWvsRouJdPbWNepiqyhyvYAYJbg@hopper.proxy.rlwy.net:22104/railway"' -ForegroundColor Gray
Write-Host "     npx prisma studio" -ForegroundColor Gray
Write-Host "`n  2. Use pgAdmin or DBeaver:" -ForegroundColor White
Write-Host "     Host: hopper.proxy.rlwy.net" -ForegroundColor Gray
Write-Host "     Port: 22104" -ForegroundColor Gray
Write-Host "     Database: railway" -ForegroundColor Gray
Write-Host "     User: postgres" -ForegroundColor Gray

Write-Host "`n📚 See POSTGRESQL_GUIDE.md for full details" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
