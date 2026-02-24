#!/bin/bash
# Monitor EAS build status until completion

set -e

BUILD_ID="${1:-9ade4649-b4aa-487c-8946-8e9da17bd5b1}"
CHECK_INTERVAL=30  # seconds
MAX_CHECKS=120      # 60 minutes max (30s * 120 = 3600s)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔍 Monitoring Android Build${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Build ID: ${YELLOW}$BUILD_ID${NC}"
echo -e "Check interval: ${YELLOW}${CHECK_INTERVAL}s${NC}"
echo -e "Max duration: ${YELLOW}$((MAX_CHECKS * CHECK_INTERVAL / 60)) minutes${NC}"
echo ""
echo -e "Build URL: ${BLUE}https://expo.dev/accounts/varsity-hub/projects/varsityhub/builds/$BUILD_ID${NC}"
echo ""

CHECK_COUNT=0
LAST_STATUS=""

while [ $CHECK_COUNT -lt $MAX_CHECKS ]; do
    CHECK_COUNT=$((CHECK_COUNT + 1))
    
    # Get build status
    STATUS_OUTPUT=$(eas build:list --platform android --limit 1 --non-interactive 2>&1 | grep -E "Status|Finished|ID" | head -5 || echo "")
    
    if echo "$STATUS_OUTPUT" | grep -q "$BUILD_ID"; then
        STATUS=$(echo "$STATUS_OUTPUT" | grep "Status" | awk '{print $3}' || echo "unknown")
        
        if [ "$STATUS" != "$LAST_STATUS" ]; then
            TIMESTAMP=$(date '+%H:%M:%S')
            echo -e "[$TIMESTAMP] Status: ${YELLOW}$STATUS${NC}"
            LAST_STATUS="$STATUS"
        fi
        
        if [ "$STATUS" = "finished" ]; then
            echo ""
            echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo -e "${GREEN}✅ BUILD COMPLETED SUCCESSFULLY!${NC}"
            echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo ""
            eas build:list --platform android --limit 1 --non-interactive
            echo ""
            echo -e "${BLUE}Next step: Submit to Play Store${NC}"
            echo -e "Run: ${YELLOW}npm run submit:android${NC}"
            exit 0
        elif [ "$STATUS" = "errored" ] || [ "$STATUS" = "canceled" ]; then
            echo ""
            echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo -e "${RED}❌ BUILD FAILED!${NC}"
            echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            echo ""
            eas build:list --platform android --limit 1 --non-interactive
            echo ""
            echo -e "${YELLOW}Check logs: https://expo.dev/accounts/varsity-hub/projects/varsityhub/builds/$BUILD_ID${NC}"
            exit 1
        fi
    fi
    
    # Show progress every 10 checks (5 minutes)
    if [ $((CHECK_COUNT % 10)) -eq 0 ]; then
        ELAPSED=$((CHECK_COUNT * CHECK_INTERVAL / 60))
        echo -e "[$(date '+%H:%M:%S')] Still building... (${ELAPSED} minutes elapsed)"
    fi
    
    sleep $CHECK_INTERVAL
done

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}⏱️  Monitoring timeout reached${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "Build is still in progress after ${YELLOW}$((MAX_CHECKS * CHECK_INTERVAL / 60)) minutes${NC}"
echo -e "Check manually: ${BLUE}https://expo.dev/accounts/varsity-hub/projects/varsityhub/builds/$BUILD_ID${NC}"
exit 2
