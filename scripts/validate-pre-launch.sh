#!/bin/bash
# VarsityHub Pre-Launch Validation Script
# Checks if all required items are configured before building

echo "=========================================="
echo "🔍 VarsityHub Pre-Launch Validation"
echo "=========================================="
echo ""

ERRORS=0
WARNINGS=0

echo "[1/10] Checking app.json configuration..."
if [ ! -f "app.json" ]; then
    echo "❌ ERROR: app.json not found"
    ((ERRORS++))
else
    if grep -q '"version": "1.0.1"' app.json; then
        echo "✅ Version found: 1.0.1"
    else
        echo "⚠️  WARNING: Version not set to 1.0.1"
        ((WARNINGS++))
    fi
fi

echo ""
echo "[2/10] Checking Google Maps API keys..."
if grep -q '"googleMapsApiKey":' app.json && ! grep -q '"googleMapsApiKey": ""' app.json; then
    echo "✅ iOS Google Maps API key configured"
elif [ -f "app.config.js" ] && grep -q "googleMapsApiKey" app.config.js && grep -q "GOOGLE_MAPS_API_KEY" app.config.js; then
    echo "✅ iOS Google Maps API key sourced from env via app.config.js"
else
    echo "❌ ERROR: iOS Google Maps API key missing or empty"
    ((ERRORS++))
fi

if grep -q '"apiKey":' app.json && ! grep -q '"apiKey": ""' app.json; then
    echo "✅ Android Google Maps API key configured"
elif [ -f "app.config.js" ] && grep -q "googleMaps" app.config.js && grep -q "GOOGLE_MAPS_API_KEY" app.config.js; then
    echo "✅ Android Google Maps API key sourced from env via app.config.js"
else
    echo "❌ ERROR: Android Google Maps API key missing or empty"
    ((ERRORS++))
fi

echo ""
echo "[3/10] Checking EAS configuration..."
if [ ! -f "eas.json" ]; then
    echo "❌ ERROR: eas.json not found"
    ((ERRORS++))
else
    if grep -q "your-apple-id@example.com" eas.json; then
        echo "❌ ERROR: Apple ID not configured in eas.json"
        ((ERRORS++))
    else
        echo "✅ Apple ID configured"
    fi
fi

echo ""
echo "[4/10] Checking required assets..."
if [ -f "assets/images/icon.png" ]; then
    echo "✅ App icon exists"
else
    echo "❌ ERROR: App icon missing"
    ((ERRORS++))
fi

if [ -f "assets/images/adaptive-icon.png" ]; then
    echo "✅ Adaptive icon exists"
else
    echo "❌ ERROR: Adaptive icon missing"
    ((ERRORS++))
fi

if [ -f "assets/images/splash-icon.png" ]; then
    echo "✅ Splash screen exists"
else
    echo "❌ ERROR: Splash screen missing"
    ((ERRORS++))
fi

echo ""
echo "[5/10] Checking environment configuration..."
if [ -f ".env" ]; then
    if grep -q "EXPO_PUBLIC_API_URL=https://api-production.varsityhub.net" .env; then
        echo "✅ Production API URL configured"
    else
        echo "⚠️  WARNING: API URL might not be production"
        ((WARNINGS++))
    fi
elif grep -q '"EXPO_PUBLIC_API_URL":' app.json 2>/dev/null || grep -q "EXPO_PUBLIC_API_URL" app.config.js 2>/dev/null; then
    echo "✅ API URL provided via Expo config / env-driven config"
else
    echo "⚠️  WARNING: No local .env or Expo API URL config detected"
    ((WARNINGS++))
fi

echo ""
echo "[6/10] Checking legal documents..."
if [ -f "PRIVACY_POLICY.md" ]; then
    echo "✅ Privacy Policy exists"
else
    echo "❌ ERROR: Privacy Policy missing"
    ((ERRORS++))
fi

if [ -f "TERMS_OF_SERVICE.md" ]; then
    echo "✅ Terms of Service exists"
else
    echo "❌ ERROR: Terms of Service missing"
    ((ERRORS++))
fi

echo ""
echo "[7/10] Checking build scripts..."
if [ -f "scripts/build-production.bat" ]; then
    echo "✅ Build script exists"
else
    echo "⚠️  WARNING: Build script missing"
    ((WARNINGS++))
fi

echo ""
echo "[8/10] Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "✅ node_modules exists"
else
    echo "❌ ERROR: Dependencies not installed. Run: npm install"
    ((ERRORS++))
fi

echo ""
echo "[9/10] Checking backend server..."
if [ -f "server/.env" ]; then
    echo "✅ Server environment file exists"
else
    echo "⚠️  WARNING: Server .env not found"
    ((WARNINGS++))
fi

echo ""
echo "[10/10] Checking Git status..."
if git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    echo "✅ Git repository initialized"
    
    if [ -n "$(git status --porcelain)" ]; then
        echo "⚠️  WARNING: You have uncommitted changes"
        ((WARNINGS++))
    else
        echo "✅ No uncommitted changes"
    fi
else
    echo "⚠️  WARNING: Not a git repository"
    ((WARNINGS++))
fi

echo ""
echo "=========================================="
echo "📊 VALIDATION RESULTS"
echo "=========================================="
echo ""

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo "✅ ALL CHECKS PASSED! Ready for production build."
        echo ""
        echo "Next steps:"
        echo "  1. Run: npm run build:production"
        exit 0
    else
        echo "⚠️  PASSED with $WARNINGS warning(s)"
        echo ""
        echo "You can proceed, but review warnings above."
        exit 0
    fi
else
    echo "❌ FAILED: $ERRORS error(s) and $WARNINGS warning(s)"
    echo ""
    echo "Please fix errors before building."
    echo "See PRODUCTION_LAUNCH_CHECKLIST.md for details."
    exit 1
fi
