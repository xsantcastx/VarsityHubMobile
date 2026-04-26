#!/bin/bash
# Verify Latest Version Script
# Checks if you're using the most recent version of the app code

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 VERIFYING LATEST VERSION${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "app.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    exit 1
fi

# 1. Check git status
echo -e "${BLUE}Step 1: Git Status Check...${NC}"
if [ -d ".git" ]; then
    # Check for uncommitted changes
    if [ -n "$(git status --porcelain)" ]; then
        echo -e "${YELLOW}⚠️  You have uncommitted changes:${NC}"
        git status --short | head -10
        echo ""
        read -p "Continue anyway? (y/n): " continue_anyway
        if [ "$continue_anyway" != "y" ]; then
            exit 1
        fi
    else
        echo -e "${GREEN}✅ No uncommitted changes${NC}"
    fi
    
    # Get current commit
    CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    echo -e "  Current branch: ${CURRENT_BRANCH}"
    echo -e "  Current commit: ${CURRENT_COMMIT}"
    
    # Check if behind remote
    git fetch origin --quiet 2>/dev/null || true
    LOCAL=$(git rev-parse @ 2>/dev/null || echo "")
    REMOTE=$(git rev-parse @{u} 2>/dev/null || echo "")
    BASE=$(git merge-base @ @{u} 2>/dev/null || echo "")
    
    if [ -n "$LOCAL" ] && [ -n "$REMOTE" ] && [ -n "$BASE" ]; then
        if [ "$LOCAL" = "$REMOTE" ]; then
            echo -e "${GREEN}✅ Up to date with remote${NC}"
        elif [ "$LOCAL" = "$BASE" ]; then
            echo -e "${RED}❌ Behind remote! Run: git pull${NC}"
            echo -e "  Local:  ${LOCAL:0:7}"
            echo -e "  Remote: ${REMOTE:0:7}"
        elif [ "$REMOTE" = "$BASE" ]; then
            echo -e "${YELLOW}⚠️  Ahead of remote (local commits not pushed)${NC}"
        else
            echo -e "${YELLOW}⚠️  Diverged from remote${NC}"
        fi
    fi
else
    echo -e "${YELLOW}⚠️  Not a git repository${NC}"
fi
echo ""

# 2. Check app version
echo -e "${BLUE}Step 2: App Version Check...${NC}"
VERSION=$(node -e "const app=JSON.parse(require('fs').readFileSync('app.json','utf8')); console.log(app.expo?.version || '')" 2>/dev/null)
RUNTIME_VERSION=$(node -e "
const app = JSON.parse(require('fs').readFileSync('app.json','utf8'));
const runtime = app.expo?.runtimeVersion;
if (!runtime) console.log('');
else if (typeof runtime === 'string') console.log(runtime);
else if (runtime.policy) console.log('__POLICY__:' + runtime.policy);
else console.log('');
" 2>/dev/null)
PACKAGE_VERSION=$(node -e "const pkg=JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(pkg.version || '')" 2>/dev/null)
echo -e "  App Version: ${VERSION}"
echo -e "  Runtime Version: ${RUNTIME_VERSION}"
echo -e "  package.json Version: ${PACKAGE_VERSION}"
if [ "$VERSION" = "$PACKAGE_VERSION" ] && { [ "$RUNTIME_VERSION" = "$VERSION" ] || [ "$RUNTIME_VERSION" = "__POLICY__:appVersion" ]; }; then
    echo -e "${GREEN}✅ Version metadata aligned${NC}"
else
    echo -e "${RED}❌ Version mismatch!${NC}"
    exit 1
fi
echo ""

# 3. Check if dev client needs rebuild
echo -e "${BLUE}Step 3: Dev Client Check...${NC}"
LAST_BUILD_COMMIT_FILE=".last-build-commit"
if [ -f "$LAST_BUILD_COMMIT_FILE" ]; then
    LAST_BUILD_COMMIT=$(cat "$LAST_BUILD_COMMIT_FILE" 2>/dev/null || echo "")
    if [ "$LAST_BUILD_COMMIT" = "$CURRENT_COMMIT" ]; then
        echo -e "${GREEN}✅ Dev client matches current code${NC}"
    else
        echo -e "${YELLOW}⚠️  Dev client may be outdated!${NC}"
        echo -e "  Last build commit: ${LAST_BUILD_COMMIT:0:7}"
        echo -e "  Current commit: ${CURRENT_COMMIT:0:7}"
        echo -e "${YELLOW}  Run: npm run dev:rebuild${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No build record found. Rebuild recommended.${NC}"
    echo -e "${YELLOW}  Run: npm run dev:rebuild${NC}"
fi
echo ""

# 4. Check dependencies
echo -e "${BLUE}Step 4: Dependencies Check...${NC}"
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✅ node_modules exists${NC}"
    
    # Check if package-lock.json matches package.json
    if [ -f "package-lock.json" ]; then
        if npm ls --depth=0 >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Dependencies are installed correctly${NC}"
        else
            echo -e "${YELLOW}⚠️  Dependency issues detected. Run: npm install${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  package-lock.json missing. Run: npm install${NC}"
    fi
else
    echo -e "${RED}❌ node_modules missing! Run: npm install${NC}"
    exit 1
fi
echo ""

# 5. Check iOS pods (if on macOS)
echo -e "${BLUE}Step 5: iOS Dependencies Check...${NC}"
if [ -d "ios" ] && command -v pod >/dev/null 2>&1; then
    if [ -d "ios/Pods" ]; then
        echo -e "${GREEN}✅ iOS Pods installed${NC}"
        
        # Check if Podfile.lock matches Podfile
        if [ -f "ios/Podfile.lock" ]; then
            PODFILE_HASH=$(md5 -q ios/Podfile 2>/dev/null || echo "")
            PODFILE_LOCK_HASH=$(grep "PODFILE CHECKSUM" ios/Podfile.lock | cut -d: -f2 | tr -d ' ' || echo "")
            if [ -n "$PODFILE_HASH" ] && [ -n "$PODFILE_LOCK_HASH" ]; then
                echo -e "${GREEN}✅ Podfile matches Podfile.lock${NC}"
            else
                echo -e "${YELLOW}⚠️  Podfile may have changed. Run: cd ios && pod install${NC}"
            fi
        else
            echo -e "${YELLOW}⚠️  Podfile.lock missing. Run: cd ios && pod install${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  iOS Pods not installed. Run: cd ios && pod install${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Skipping iOS check (not on macOS or CocoaPods not installed)${NC}"
fi
echo ""

# 6. Check critical files
echo -e "${BLUE}Step 6: Critical Files Check...${NC}"
MISSING=0
for file in "app.json" "package.json" "babel.config.js" "metro.config.js" "tsconfig.json"; do
    if [ ! -f "$file" ]; then
        echo -e "${RED}❌ Missing: $file${NC}"
        MISSING=$((MISSING + 1))
    fi
done
if [ $MISSING -eq 0 ]; then
    echo -e "${GREEN}✅ All critical files present${NC}"
else
    echo -e "${RED}❌ Missing $MISSING critical file(s)${NC}"
    exit 1
fi
echo ""

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 VERIFICATION SUMMARY${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${GREEN}✅ Version verification complete!${NC}"
echo ""
echo -e "${BLUE}To ensure you're using the latest version:${NC}"
echo "  1. Run: git pull (if behind remote)"
echo "  2. Run: npm install (if dependencies changed)"
echo "  3. Run: npm run dev:rebuild (to rebuild dev client with latest code)"
echo ""
echo -e "${BLUE}To verify build will work:${NC}"
echo "  1. Run: npm run verify:build"
echo "  2. Run: npm run audit:app"
echo ""
