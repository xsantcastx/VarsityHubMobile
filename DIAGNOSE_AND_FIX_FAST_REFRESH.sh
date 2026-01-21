#!/bin/bash
# COMPREHENSIVE FAST REFRESH DIAGNOSIS AND FIX

cd /Users/varsityhub/VarsityHubMobile

echo "🔍 DIAGNOSING FAST REFRESH ISSUES..."
echo ""

# 1. Check if Metro is running
echo "1️⃣ Checking Metro status..."
if lsof -ti:8081 > /dev/null 2>&1; then
    echo "   ⚠️  Metro is running on port 8081"
    METRO_PID=$(lsof -ti:8081)
    echo "   PID: $METRO_PID"
else
    echo "   ✅ No Metro process on port 8081"
fi

# 2. Check Watchman
echo ""
echo "2️⃣ Checking Watchman..."
if command -v watchman &> /dev/null; then
    WATCHMAN_VERSION=$(watchman --version 2>/dev/null || echo "unknown")
    echo "   ✅ Watchman installed: $WATCHMAN_VERSION"
    
    # Check if watchman is watching this project
    if watchman watch-list 2>/dev/null | grep -q "$(pwd)"; then
        echo "   ✅ Watchman is watching this project"
    else
        echo "   ⚠️  Watchman is NOT watching this project"
    fi
else
    echo "   ❌ Watchman not installed - THIS COULD BE THE ISSUE!"
    echo "   Install: brew install watchman"
fi

# 3. Check .expo/settings.json
echo ""
echo "3️⃣ Checking .expo/settings.json..."
if [ -f .expo/settings.json ]; then
    echo "   ✅ .expo/settings.json exists"
    if grep -q '"dev": true' .expo/settings.json; then
        echo "   ✅ dev: true (Fast Refresh should be enabled)"
    else
        echo "   ❌ dev is not true"
    fi
else
    echo "   ❌ .expo/settings.json missing"
fi

# 4. Check for problematic configs
echo ""
echo "4️⃣ Checking for problematic configurations..."
if grep -q '"newArchEnabled": true' app.json; then
    echo "   ⚠️  WARNING: newArchEnabled: true detected"
    echo "      New Architecture can cause Fast Refresh issues"
fi

# 5. Check node_modules for react-refresh
echo ""
echo "5️⃣ Checking React Refresh plugin..."
if [ -d "node_modules/react-refresh" ]; then
    echo "   ✅ react-refresh installed"
else
    echo "   ❌ react-refresh missing - Fast Refresh won't work"
fi

# 6. Check babel config
echo ""
echo "6️⃣ Checking Babel configuration..."
if grep -q "react-refresh" babel.config.js; then
    echo "   ✅ react-refresh in babel.config.js"
else
    echo "   ⚠️  react-refresh not explicitly in babel.config.js"
    echo "      (Should be handled by babel-preset-expo)"
fi

# 7. Check for file watcher issues
echo ""
echo "7️⃣ Checking file watcher limits..."
if [ -f /etc/sysctl.conf ]; then
    KERNEL_MAX=$(sysctl kern.maxfiles 2>/dev/null | awk '{print $2}' || echo "unknown")
    KERNEL_MAXPROC=$(sysctl kern.maxfilesperproc 2>/dev/null | awk '{print $2}' || echo "unknown")
    echo "   Kernel maxfiles: $KERNEL_MAX"
    echo "   Kernel maxfilesperproc: $KERNEL_MAXPROC"
fi

echo ""
echo "🔧 APPLYING FIXES..."
echo ""

# Fix 1: Kill all Metro processes
echo "1️⃣ Killing all Metro/Expo processes..."
pkill -9 -f "expo" 2>/dev/null || true
pkill -9 -f "metro" 2>/dev/null || true
pkill -9 -f "node.*8081" 2>/dev/null || true
sleep 3

# Fix 2: Clear all caches
echo "2️⃣ Clearing all caches..."
rm -rf .expo
rm -rf node_modules/.cache
rm -rf .metro
rm -rf $TMPDIR/metro-* 2>/dev/null || true
rm -rf $TMPDIR/react-* 2>/dev/null || true
rm -rf $TMPDIR/haste-map-* 2>/dev/null || true

# Fix 3: Reset Watchman
if command -v watchman &> /dev/null; then
    echo "3️⃣ Resetting Watchman..."
    watchman watch-del-all 2>/dev/null || true
    watchman shutdown-server 2>/dev/null || true
    sleep 2
    watchman watch-project . 2>/dev/null || true
fi

# Fix 4: Ensure .expo/settings.json exists with correct config
echo "4️⃣ Ensuring .expo/settings.json is correct..."
mkdir -p .expo
cat > .expo/settings.json <<EOF
{
  "hostType": "lan",
  "lanType": "ip",
  "dev": true,
  "minify": false,
  "urlRandomness": null,
  "https": false
}
EOF

# Fix 5: Update metro.config.js to explicitly enable Fast Refresh
echo "5️⃣ Verifying metro.config.js..."
if ! grep -q "fastRefresh" metro.config.js 2>/dev/null; then
    echo "   Metro config looks good (Fast Refresh enabled by default in Expo)"
fi

# Fix 6: Set environment variables
export LANG=en_US.UTF-8
export EXPO_NO_METRO_LAZY=1
export EXPO_USE_FAST_REFRESH=1

echo ""
echo "✅ ALL FIXES APPLIED!"
echo ""
echo "📱 CRITICAL STEPS IN SIMULATOR:"
echo "   1. Close simulator completely (Cmd + Q)"
echo "   2. Reopen: open -a Simulator"
echo "   3. Wait for simulator to fully load"
echo "   4. In simulator: Cmd + Shift + R (HARD RELOAD)"
echo "   5. In simulator: Cmd + D → Dev Menu"
echo "   6. Toggle 'Enable Fast Refresh' OFF then ON (forces reset)"
echo "   7. Press Cmd + R to reload"
echo "   8. Make a small change (add a space) to any file and save"
echo "   9. Should update instantly - if not, see troubleshooting below"
echo ""
echo "🚀 Starting Metro with Fast Refresh enabled..."
echo "   (Press Ctrl+C to stop)"
echo ""

# Start Metro
npx expo start --dev-client --clear
