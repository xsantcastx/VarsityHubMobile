#!/bin/bash

# VS Code Extensions Auto-Install Script
# This script installs all recommended extensions for VarsityHub Mobile development

set -e

echo "🚀 VarsityHub Mobile - VS Code Extensions Setup"
echo "=================================================="
echo ""

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if VS Code CLI is available
if ! command -v code &> /dev/null; then
    echo -e "${YELLOW}⚠️  VS Code CLI not found. Installing...${NC}"
    # Try to find VS Code in standard locations
    if [ -d "/Applications/Visual Studio Code.app" ]; then
        sudo ln -s "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" /usr/local/bin/code
        echo -e "${GREEN}✓ VS Code CLI installed${NC}"
    else
        echo -e "${YELLOW}⚠️  Please install VS Code first${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}Installing extensions...${NC}"
echo ""

# Install each extension
extensions=(
    "sentry.sentry"
    "github.vscode-github-actions"
    "rangav.vscode-thunder-client"
    "snyk-security.snyk-vulnerability-scanner"
    "expo.vscode-expo-tools"
    "msjsdiag.vscode-react-native"
)

for ext in "${extensions[@]}"; do
    echo -n "Installing $ext... "
    if code --install-extension "$ext" --force &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${YELLOW}⚠️  (may already be installed)${NC}"
    fi
done

echo ""
echo -e "${GREEN}✓ Extension installation complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Restart VS Code"
echo "2. Run 'Sentry: Connect' from Command Palette (Cmd+Shift+P)"
echo "3. Sign in with your Sentry account"
echo "4. Run 'Snyk: Authenticate' from Command Palette"
echo "5. Sign in with GitHub"
echo ""
echo -e "${YELLOW}Installed Extensions:${NC}"
echo "  ✓ Sentry - Error tracking"
echo "  ✓ GitHub Actions - CI/CD monitoring"
echo "  ✓ Thunder Client - API testing"
echo "  ✓ Snyk Security - Vulnerability scanning"
echo "  ✓ Expo Tools - Build support"
echo "  ✓ React Native Tools - Debugging"
echo ""
echo -e "${GREEN}Setup complete! Happy coding! 🎉${NC}"
