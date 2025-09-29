# VarsityHub Railway Deployment Quick Setup
# Run this script after setting up Railway project

Write-Host "🚂 VarsityHub Railway Deployment Setup" -ForegroundColor Green
Write-Host "=======================================" -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "server\package.json")) {
    Write-Host "❌ Error: Please run this script from the VarsityHubMobile root directory" -ForegroundColor Red
    exit 1
}

Write-Host "📋 Railway Deployment Checklist:" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. ✅ Railway Project Setup" -ForegroundColor Yellow
Write-Host "   - Go to railway.app and create new project" -ForegroundColor White
Write-Host "   - Add PostgreSQL database service" -ForegroundColor White
Write-Host "   - Connect your GitHub repository" -ForegroundColor White
Write-Host ""

Write-Host "2. ⚙️ Environment Variables to Set in Railway:" -ForegroundColor Yellow
Write-Host "   Copy these to your Railway service Variables tab:" -ForegroundColor White
Write-Host ""
Write-Host "JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters-long" -ForegroundColor Gray
Write-Host "NODE_ENV=production" -ForegroundColor Gray
Write-Host "SMTP_HOST=smtp.gmail.com" -ForegroundColor Gray
Write-Host "SMTP_PORT=587" -ForegroundColor Gray
Write-Host "SMTP_USER=its.sc05@gmail.com" -ForegroundColor Gray
Write-Host "SMTP_PASS=oqjwfyovgmxuwobg" -ForegroundColor Gray
Write-Host "FROM_EMAIL=its.sc05@gmail.com" -ForegroundColor Gray
Write-Host "ADMIN_EMAILS=xsancastrillonx@hotmail.com" -ForegroundColor Gray
Write-Host "ALLOWED_ORIGINS=*" -ForegroundColor Gray
Write-Host "APP_SCHEME=varsityhubmobile" -ForegroundColor Gray
Write-Host "STRIPE_SECRET_KEY=sk_test_51S5t0kRuB2a0vFjp0bdj2NbzkDp6ACVhtWU48TXtNuviL0wnJxxIx0eBgg6whwiM9gJkNiqnINPbSQHqV9qRIxfe00KEwuxjwZ" -ForegroundColor Gray
Write-Host "STRIPE_WEBHOOK_SECRET=whsec_8f60823f31adfb85a3616a110e6a3d97fcfb529f8c0868a67a83b1d69edc833a" -ForegroundColor Gray
Write-Host "STRIPE_PRICE_VETERAN=price_1SCd6HRuB2a0vFjp1QlboTEv" -ForegroundColor Gray
Write-Host "STRIPE_PRICE_LEGEND=price_1SCd6IRuB2a0vFjpQOSdctN4" -ForegroundColor Gray
Write-Host ""

Write-Host "3. 🔧 Railway Service Settings:" -ForegroundColor Yellow
Write-Host "   - Root Directory: server" -ForegroundColor White
Write-Host "   - Start Command: npm start" -ForegroundColor White
Write-Host "   - Build Command: npm run build" -ForegroundColor White
Write-Host ""

Write-Host "4. 🗃️ After Deployment, run in Railway console:" -ForegroundColor Yellow
Write-Host "   npx prisma migrate deploy" -ForegroundColor White
Write-Host "   npm run seed" -ForegroundColor White
Write-Host ""

Write-Host "5. 📱 Update Frontend API URL:" -ForegroundColor Yellow
Write-Host "   After Railway gives you the URL, update:" -ForegroundColor White
Write-Host "   src/config/api.ts" -ForegroundColor White
Write-Host ""

# Test local build
Write-Host "🔨 Testing local build..." -ForegroundColor Yellow
Set-Location server
npm run build
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Local build successful! Ready for Railway deployment" -ForegroundColor Green
} else {
    Write-Host "❌ Build failed. Please fix errors before deploying" -ForegroundColor Red
    exit 1
}

Set-Location ..

Write-Host ""
Write-Host "🎉 Setup Complete!" -ForegroundColor Green
Write-Host "=================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Go to railway.app and follow the checklist above" -ForegroundColor White
Write-Host "2. Deploy your server and database" -ForegroundColor White
Write-Host "3. Update frontend API URL with Railway domain" -ForegroundColor White
Write-Host "4. Test your deployed API" -ForegroundColor White
Write-Host "5. Share with beta testers!" -ForegroundColor White
Write-Host ""
Write-Host "💡 Need help? Check RAILWAY_DEPLOYMENT.md for detailed instructions" -ForegroundColor Yellow
Write-Host ""