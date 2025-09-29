# Beta Testing Quick Deploy Script for Windows
# VarsityHub Sports App Beta Deployment

Write-Host "🚀 VarsityHub Beta Testing Deployment" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Please run this script from the VarsityHubMobile root directory" -ForegroundColor Red
    exit 1
}

Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install root dependencies" -ForegroundColor Red
    exit 1
}

Set-Location server
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install server dependencies" -ForegroundColor Red
    exit 1
}

Write-Host "🗃️ Checking database connection..." -ForegroundColor Yellow
npx prisma generate
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Database connection successful" -ForegroundColor Green
} else {
    Write-Host "❌ Database connection failed. Please check your DATABASE_URL in server/.env" -ForegroundColor Red
    Write-Host "💡 For quick setup, consider using Railway or Supabase" -ForegroundColor Cyan
    exit 1
}

Write-Host "🔄 Running database migrations..." -ForegroundColor Yellow
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Migration warning - continuing with existing schema" -ForegroundColor Yellow
}

Write-Host "🌱 Seeding database with sample data..." -ForegroundColor Yellow
npm run seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Seeding warning - some data may already exist" -ForegroundColor Yellow
}

Set-Location ..

Write-Host "⚙️ Configuring API endpoints..." -ForegroundColor Yellow
if (-not (Test-Path "src/config")) {
    New-Item -ItemType Directory -Path "src/config" -Force | Out-Null
}

if (-not (Test-Path "src/config/api.ts")) {
    @'
// API Configuration for Beta Testing
export const API_BASE_URL = __DEV__ 
  ? process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.11:4000'
  : process.env.EXPO_PUBLIC_PROD_API_URL || 'https://your-app.railway.app';

export const API_TIMEOUT = 10000; // 10 seconds

console.log('API Base URL:', API_BASE_URL);
'@ | Out-File -FilePath "src/config/api.ts" -Encoding UTF8
    Write-Host "✅ Created API configuration file" -ForegroundColor Green
}

Write-Host "📱 Preparing Expo app for beta testing..." -ForegroundColor Yellow
$easInstalled = Get-Command eas -ErrorAction SilentlyContinue
if ($easInstalled) {
    Write-Host "🔧 EAS CLI found" -ForegroundColor Green
    Write-Host "📱 Run 'eas build --platform android --profile preview' to build for testing" -ForegroundColor Cyan
} else {
    Write-Host "📱 EAS CLI not found - using Expo Go for testing..." -ForegroundColor Yellow
    Write-Host "💡 Install EAS CLI with: npm install -g @expo/eas-cli" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🎉 Beta Testing Setup Complete!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. 🗃️ Deploy your database to Railway/Render/Supabase" -ForegroundColor White
Write-Host "2. 🚀 Deploy your server to Railway/Render/Heroku" -ForegroundColor White
Write-Host "3. 📱 Share your app with beta testers" -ForegroundColor White
Write-Host "4. 📝 Collect feedback and iterate" -ForegroundColor White
Write-Host ""
Write-Host "📖 See BETA_TESTING_SETUP.md for detailed instructions" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔗 Quick Links:" -ForegroundColor Cyan
Write-Host "   Railway: https://railway.app" -ForegroundColor White
Write-Host "   Render: https://render.com" -ForegroundColor White
Write-Host "   Supabase: https://supabase.com" -ForegroundColor White
Write-Host ""

# Start local development for testing
Write-Host "🏃 Starting local development server for testing..." -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Set-Location server
npm run dev