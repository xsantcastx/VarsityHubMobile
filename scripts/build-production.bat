@echo off
REM Production Build Script for VarsityHub (Windows)
REM This script builds the app for both iOS and Android

echo ======================================
echo 🚀 VarsityHub Production Build Script
echo ======================================
echo.

REM Check if EAS CLI is installed
where eas >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ EAS CLI not found. Installing...
    call npm install -g eas-cli
)

REM Login to EAS
echo 📝 Checking EAS login status...
call eas whoami
if %errorlevel% neq 0 (
    call eas login
)

echo.
echo 🔍 Current configuration:
echo   App: VarsityHub
echo   Bundle ID: com.xsantcastx.varsityhub
echo.

REM Ask which platform to build
echo Select build platform:
echo   1) iOS only
echo   2) Android only  
echo   3) Both iOS and Android
set /p platform_choice="Enter choice (1-3): "

if "%platform_choice%"=="1" (
    echo.
    echo 📱 Building for iOS...
    call eas build --platform ios --profile production
) else if "%platform_choice%"=="2" (
    echo.
    echo 🤖 Building for Android...
    call eas build --platform android --profile production
) else if "%platform_choice%"=="3" (
    echo.
    echo 📱🤖 Building for both platforms...
    call eas build --platform all --profile production
) else (
    echo ❌ Invalid choice. Exiting.
    exit /b 1
)

echo.
echo ✅ Build process completed!
echo 📊 Check build status at: https://expo.dev/accounts/xsantcastx/projects/VarsityHubMobile/builds

pause
