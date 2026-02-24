#!/bin/bash
# Ensure Latest Dev Client Script
# Rebuilds dev client to ensure you're using the latest code

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔄 ENSURING LATEST DEV CLIENT${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Check if we're in the right directory
if [ ! -f "app.json" ]; then
    echo -e "${RED}❌ Error: Must run from project root${NC}"
    exit 1
fi

# Get current git commit
CURRENT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
FULL_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
echo -e "${BLUE}Current code version: ${CURRENT_COMMIT}${NC}"
echo ""

# Record build commit for verification
if [ "$FULL_COMMIT" != "unknown" ]; then
    echo "$FULL_COMMIT" > .last-build-commit
    echo -e "${GREEN}✅ Build commit recorded${NC}"
fi
echo ""

# Ask which platform
echo "Which platform do you want to rebuild?"
echo "  1) iOS"
echo "  2) Android"
echo "  3) Both"
read -p "Enter choice (1-3): " platform_choice

case $platform_choice in
    1)
        echo ""
        echo -e "${BLUE}📱 Rebuilding iOS dev client...${NC}"
        echo -e "${YELLOW}This will take a few minutes...${NC}"
        npx expo run:ios --device
        ;;
    2)
        echo ""
        echo -e "${BLUE}🤖 Rebuilding Android dev client...${NC}"
        echo -e "${YELLOW}This will take a few minutes...${NC}"
        npx expo run:android
        ;;
    3)
        echo ""
        echo -e "${BLUE}📱🤖 Rebuilding both platforms...${NC}"
        echo -e "${YELLOW}This will take several minutes...${NC}"
        echo ""
        echo -e "${BLUE}Starting with iOS...${NC}"
        npx expo run:ios --device
        echo ""
        echo -e "${BLUE}Now Android...${NC}"
        npx expo run:android
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

# Record build commit after successful build
if [ "$FULL_COMMIT" != "unknown" ]; then
    echo "$FULL_COMMIT" > .last-build-commit
    echo -e "${GREEN}✅ Build commit recorded: ${CURRENT_COMMIT}${NC}"
fi

echo ""
echo -e "${GREEN}✅ Dev client rebuild complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Open the app on your device"
echo "  2. Make sure Metro bundler is running: npm start"
echo "  3. Test sample event posting"
echo "  4. Test coach onboarding"
echo "  5. Test uploads"
