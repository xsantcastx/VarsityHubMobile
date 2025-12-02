#!/bin/bash

# Repository Health Check
# Verifies the repository is clean and ready for development

echo "🔍 VarsityHub Repository Health Check"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

ISSUES=0

# Check 1: Repository size
echo "📊 Checking repository size..."
REPO_SIZE=$(du -sh . 2>/dev/null | cut -f1)
echo -e "${BLUE}Current size: $REPO_SIZE${NC}"

# Check for large directories that should be gitignored
if [ -d "node_modules" ]; then
    echo -e "${RED}⚠️  WARNING: node_modules/ exists (should be gitignored)${NC}"
    ((ISSUES++))
fi

if [ -d "ios/Pods" ]; then
    echo -e "${RED}⚠️  WARNING: ios/Pods/ exists (should be gitignored)${NC}"
    ((ISSUES++))
fi

if [ -d "server/node_modules" ]; then
    echo -e "${RED}⚠️  WARNING: server/node_modules/ exists (should be gitignored)${NC}"
    ((ISSUES++))
fi

# Check 2: Verify .gitignore exists
echo ""
echo "📋 Checking .gitignore..."
if [ -f ".gitignore" ]; then
    if grep -q "node_modules/" .gitignore && grep -q "ios/Pods/" .gitignore; then
        echo -e "${GREEN}✅ .gitignore properly configured${NC}"
    else
        echo -e "${YELLOW}⚠️  .gitignore missing some exclusions${NC}"
        ((ISSUES++))
    fi
else
    echo -e "${RED}❌ .gitignore not found!${NC}"
    ((ISSUES++))
fi

# Check 3: Verify uploads directory structure
echo ""
echo "📁 Checking uploads directory..."
if [ -f "server/uploads/.gitkeep" ]; then
    UPLOAD_COUNT=$(find server/uploads -type f ! -name ".gitkeep" 2>/dev/null | wc -l)
    if [ "$UPLOAD_COUNT" -eq 0 ]; then
        echo -e "${GREEN}✅ uploads/ is clean (only .gitkeep)${NC}"
    else
        echo -e "${YELLOW}⚠️  Found $UPLOAD_COUNT files in uploads/ (will not be committed)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  server/uploads/.gitkeep not found${NC}"
fi

# Check 4: Git status
echo ""
echo "🔄 Checking git status..."
if git rev-parse --git-dir > /dev/null 2>&1; then
    UNTRACKED=$(git status --porcelain | grep "^??" | wc -l)
    MODIFIED=$(git status --porcelain | grep "^ M" | wc -l)
    STAGED=$(git status --porcelain | grep "^M" | wc -l)
    
    echo -e "${BLUE}Untracked files: $UNTRACKED${NC}"
    echo -e "${BLUE}Modified files: $MODIFIED${NC}"
    echo -e "${BLUE}Staged files: $STAGED${NC}"
    
    # Check for accidentally staged large files
    LARGE_FILES=$(git status --porcelain | grep -E "(node_modules|Pods|build)" || echo "")
    if [ ! -z "$LARGE_FILES" ]; then
        echo -e "${RED}❌ Large directories detected in git status:${NC}"
        echo "$LARGE_FILES"
        ((ISSUES++))
    fi
else
    echo -e "${YELLOW}⚠️  Not a git repository${NC}"
fi

# Check 5: Documentation exists
echo ""
echo "📚 Checking documentation..."
REQUIRED_DOCS=(
    "README.md"
    "SETUP.md"
    "SECURITY.md"
)

for doc in "${REQUIRED_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}✅ $doc exists${NC}"
    else
        echo -e "${YELLOW}⚠️  $doc not found${NC}"
    fi
done

# Summary
echo ""
echo "======================================"
if [ $ISSUES -eq 0 ]; then
    echo -e "${GREEN}✅ Repository is clean and healthy!${NC}"
    echo ""
    echo "Repository size: $REPO_SIZE (source code only)"
    echo "Ready for: git add, git commit, git push"
else
    echo -e "${YELLOW}⚠️  Found $ISSUES issue(s)${NC}"
    echo ""
    echo "Run this to clean up:"
    echo "  rm -rf node_modules ios/Pods server/node_modules"
    echo "  find server/uploads -type f ! -name '.gitkeep' -delete"
fi

exit $ISSUES
