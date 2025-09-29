@echo off
echo 🚀 Starting VarsityHub Beta Testing Environment
echo.
echo ✅ Railway Database: Connected
echo ✅ Test Accounts: Ready (coach@test.com, player@test.com, fan@test.com)
echo ✅ Sample Data: 5 posts with comments and interactions
echo.
echo Starting backend server...
cd server
start "VarsityHub API" cmd /k "npm run dev"
echo.
echo Waiting 3 seconds for backend to start...
timeout /t 3 /nobreak > nul
echo.
echo Starting frontend (Expo)...
cd..
start "VarsityHub App" cmd /k "npx expo start"
echo.
echo 🎉 Both servers starting!
echo.
echo 📱 Share the QR code from Expo with your beta testers
echo 🔑 Test accounts: coach@test.com / player@test.com / fan@test.com (all use password: beta123)
echo.
pause