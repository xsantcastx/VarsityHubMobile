@echo off
REM VarsityHub Pre-Launch Validation Script
REM Checks if all required items are configured before building

echo ==========================================
echo 🔍 VarsityHub Pre-Launch Validation
echo ==========================================
echo.

set "ERRORS=0"
set "WARNINGS=0"

echo [1/10] Checking app.json configuration...
if not exist "app.json" (
    echo ❌ ERROR: app.json not found
    set /a ERRORS+=1
) else (
    findstr /C:"1.0.1" app.json >nul
    if %errorlevel% equ 0 (
        echo ✅ Version found: 1.0.1
    ) else (
        echo ⚠️  WARNING: Version not set to 1.0.1
        set /a WARNINGS+=1
    )
)

echo.
echo [2/10] Checking Google Maps API keys...
set "MAPS_OK=0"
findstr /C:"EXPO_PUBLIC_GOOGLE_MAPS_API_KEY" app.json | findstr /V /C:"\"EXPO_PUBLIC_GOOGLE_MAPS_API_KEY\": \"\"" >nul
if %errorlevel% equ 0 set "MAPS_OK=1"
if exist "android\app\src\main\AndroidManifest.xml" (
    findstr /C:"${GOOGLE_MAPS_API_KEY}" "android\app\src\main\AndroidManifest.xml" >nul
    if %errorlevel% equ 0 set "MAPS_OK=1"
)
if exist "ios\VarsityHub.xcodeproj\project.pbxproj" (
    findstr /C:"GOOGLE_MAPS_API_KEY" "ios\VarsityHub.xcodeproj\project.pbxproj" >nul
    if %errorlevel% equ 0 set "MAPS_OK=1"
)
if %MAPS_OK% equ 1 (
    echo ✅ Google Maps API key configured ^(env-driven^)
) else (
    echo ❌ ERROR: Google Maps API key missing ^(set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in build env^)
    set /a ERRORS+=1
)

echo.
echo [3/10] Checking EAS configuration...
if not exist "eas.json" (
    echo ❌ ERROR: eas.json not found
    set /a ERRORS+=1
) else (
    findstr /C:"your-apple-id@example.com" eas.json >nul
    if %errorlevel% equ 0 (
        echo ❌ ERROR: Apple ID not configured in eas.json
        set /a ERRORS+=1
    ) else (
        echo ✅ Apple ID configured
    )
)

echo.
echo [4/10] Checking required assets...
if exist "assets\images\icon.png" (
    echo ✅ App icon exists
) else (
    echo ❌ ERROR: App icon missing
    set /a ERRORS+=1
)

if exist "assets\images\adaptive-icon.png" (
    echo ✅ Adaptive icon exists
) else (
    echo ❌ ERROR: Adaptive icon missing  
    set /a ERRORS+=1
)

if exist "assets\images\splash-icon.png" (
    echo ✅ Splash screen exists
) else (
    echo ❌ ERROR: Splash screen missing
    set /a ERRORS+=1
)

echo.
echo [5/10] Checking environment configuration...
if exist ".env" (
    findstr /C:"EXPO_PUBLIC_API_URL=https://api-production" .env >nul
    if %errorlevel% equ 0 (
        echo ✅ Production API URL configured
    ) else (
        echo ⚠️  WARNING: API URL might not be production
        set /a WARNINGS+=1
    )
) else (
    echo ❌ ERROR: .env file missing
    set /a ERRORS+=1
)

echo.
echo [6/10] Checking legal documents...
if exist "docs\release\PRIVACY_POLICY.md" (
    echo ✅ Privacy Policy exists
) else (
    echo ❌ ERROR: Privacy Policy missing
    set /a ERRORS+=1
)

if exist "docs\release\TERMS_OF_SERVICE.md" (
    echo ✅ Terms of Service exists
) else (
    echo ❌ ERROR: Terms of Service missing
    set /a ERRORS+=1
)

echo.
echo [7/10] Checking build scripts...
if exist "scripts\build-production.bat" (
    echo ✅ Build script exists
) else (
    echo ⚠️  WARNING: Build script missing
    set /a WARNINGS+=1
)

echo.
echo [8/10] Checking dependencies...
if exist "node_modules" (
    echo ✅ node_modules exists
) else (
    echo ❌ ERROR: Dependencies not installed. Run: npm install
    set /a ERRORS+=1
)

echo.
echo [9/10] Checking backend server...
if exist "server\.env" (
    echo ✅ Server environment file exists
) else (
    echo ⚠️  WARNING: Server .env not found
    set /a WARNINGS+=1
)

echo.
echo [10/10] Checking Git status...
git status >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Git repository initialized
    
    REM Check for uncommitted changes
    git diff-index --quiet HEAD --
    if %errorlevel% neq 0 (
        echo ⚠️  WARNING: You have uncommitted changes
        set /a WARNINGS+=1
    ) else (
        echo ✅ No uncommitted changes
    )
) else (
    echo ⚠️  WARNING: Not a git repository
    set /a WARNINGS+=1
)

echo.
echo ==========================================
echo 📊 VALIDATION RESULTS
echo ==========================================
echo.

if %ERRORS% equ 0 (
    if %WARNINGS% equ 0 (
        echo ✅ ALL CHECKS PASSED! Ready for production build.
        echo.
        echo Next steps:
        echo   1. Run: npm run build:production
        echo   2. Or: .\scripts\build-production.bat
        exit /b 0
    ) else (
        echo ⚠️  PASSED with %WARNINGS% warning(s)
        echo.
        echo You can proceed, but review warnings above.
        exit /b 0
    )
) else (
    echo ❌ FAILED: %ERRORS% error(s) and %WARNINGS% warning(s)
    echo.
    echo Please fix errors before building.
    echo See PRODUCTION_LAUNCH_CHECKLIST.md for details.
    exit /b 1
)

pause
