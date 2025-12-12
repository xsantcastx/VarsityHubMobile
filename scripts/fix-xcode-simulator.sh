#!/bin/bash

##############################################################################
# Xcode Simulator Environment Fix Script
# 
# This script helps diagnose and fix Xcode simulator runtime issues that
# cause "CoreSimulatorService connection became invalid" errors.
#
# Usage:
#   bash scripts/fix-xcode-simulator.sh [--check|--fix|--verify]
#
# Modes:
#   --check   Check current state and report issues
#   --fix     Attempt automated fixes (non-sudo steps)
#   --verify  Verify setup is working
#   (default) Run full check → fix → verify workflow
##############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Status tracking
ISSUES_FOUND=0
FIXES_APPLIED=0

##############################################################################
# Helper Functions
##############################################################################

log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
    ISSUES_FOUND=$((ISSUES_FOUND + 1))
}

log_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

##############################################################################
# Check Functions
##############################################################################

check_xcode_installed() {
    log_section "1. Checking Xcode Installation"
    
    if [ ! -d "/Applications/Xcode.app" ]; then
        log_error "Xcode not found at /Applications/Xcode.app"
        echo "  → Install Xcode from the App Store"
        return 1
    fi
    
    local xcode_version
    xcode_version=$(xcodebuild -version 2>/dev/null | head -n 1)
    log_success "Xcode installed: $xcode_version"
    return 0
}

check_xcode_select() {
    log_section "2. Checking Command Line Tools Path"
    
    local current_path
    current_path=$(xcode-select -p 2>/dev/null || echo "NOT_SET")
    
    if [ "$current_path" = "NOT_SET" ]; then
        log_error "xcode-select path not set"
        echo "  → Run: sudo xcode-select --switch /Applications/Xcode.app"
        return 1
    elif [ "$current_path" != "/Applications/Xcode.app/Contents/Developer" ]; then
        log_warning "xcode-select points to: $current_path"
        echo "  → Should be: /Applications/Xcode.app/Contents/Developer"
        echo "  → Run: sudo xcode-select --switch /Applications/Xcode.app"
        return 1
    fi
    
    log_success "Command line tools path: $current_path"
    return 0
}

check_license_accepted() {
    log_section "3. Checking Xcode License"
    
    # Try to run xcodebuild; if license not accepted, it will fail
    if xcodebuild -checkFirstLaunchStatus 2>/dev/null; then
        log_success "Xcode license accepted"
        return 0
    else
        log_error "Xcode license not accepted"
        echo "  → Run: sudo xcodebuild -license accept"
        return 1
    fi
}

check_simulator_service() {
    log_section "4. Checking CoreSimulatorService"
    
    # Check if service is running
    if launchctl list | grep -q "com.apple.CoreSimulatorService"; then
        log_success "CoreSimulatorService is running"
        return 0
    else
        log_warning "CoreSimulatorService not running"
        echo "  → Run: sudo launchctl kickstart -k system/com.apple.CoreSimulatorService"
        echo "  → Or reboot macOS"
        return 1
    fi
}

check_simulator_runtimes() {
    log_section "5. Checking Simulator Runtimes"
    
    local runtimes
    runtimes=$(xcrun simctl list runtimes 2>&1)
    
    if echo "$runtimes" | grep -q "connection became invalid"; then
        log_error "CoreSimulatorService connection invalid"
        echo "  → CoreSimulatorService needs restart"
        echo "  → Run: sudo launchctl kickstart -k system/com.apple.CoreSimulatorService"
        return 1
    fi
    
    if echo "$runtimes" | grep -q "iOS.*Simulator"; then
        log_success "iOS Simulator runtimes found:"
        echo "$runtimes" | grep "iOS" | sed 's/^/  /'
        return 0
    else
        log_error "No iOS Simulator runtimes installed"
        echo "  → Open Xcode → Settings → Platforms"
        echo "  → Download at least one iOS Simulator runtime (e.g., iOS 18.1)"
        return 1
    fi
}

check_simulator_devices() {
    log_section "6. Checking Simulator Devices"
    
    local devices
    devices=$(xcrun simctl list devices available 2>&1 | head -20)
    
    if echo "$devices" | grep -q "connection became invalid"; then
        log_error "Cannot list devices - CoreSimulatorService connection invalid"
        return 1
    fi
    
    if echo "$devices" | grep -q "iPhone"; then
        log_success "Simulator devices available:"
        echo "$devices" | grep "iPhone" | head -5 | sed 's/^/  /'
        return 0
    else
        log_warning "No iPhone simulators found"
        echo "  → Check Xcode → Settings → Platforms"
        return 1
    fi
}

check_pods_setup() {
    log_section "7. Checking iOS Pods Setup"
    
    if [ ! -d "ios/Pods" ]; then
        log_warning "Pods not installed"
        echo "  → Run: cd ios && pod install"
        return 1
    fi
    
    if [ ! -f "ios/Pods/Target Support Files/Pods-VarsityHub/Pods-VarsityHub.debug.xcconfig" ]; then
        log_warning "Pods configuration incomplete"
        echo "  → Run: cd ios && rm -rf Pods Podfile.lock && pod install"
        return 1
    fi
    
    log_success "Pods installed and configured"
    return 0
}

##############################################################################
# Fix Functions
##############################################################################

fix_pods() {
    log_section "Fixing Pods Setup"
    
    if [ ! -d "ios" ]; then
        log_error "ios directory not found"
        return 1
    fi
    
    cd ios
    
    log_info "Cleaning Pods..."
    rm -rf Pods Podfile.lock ~/Library/Caches/CocoaPods
    
    log_info "Running pod install..."
    if pod install --repo-update; then
        log_success "Pods installed successfully"
        FIXES_APPLIED=$((FIXES_APPLIED + 1))
        cd ..
        return 0
    else
        log_error "Pod install failed"
        cd ..
        return 1
    fi
}

##############################################################################
# Verify Function
##############################################################################

verify_build() {
    log_section "Verifying Build Setup"
    
    log_info "Attempting xcodebuild with iphonesimulator SDK..."
    
    # Get first available iPhone simulator
    local simulator
    simulator=$(xcrun simctl list devices available | grep "iPhone" | head -1 | sed -E 's/.*\(([0-9A-F-]+)\).*/\1/')
    
    if [ -z "$simulator" ]; then
        log_error "No simulator found for testing"
        return 1
    fi
    
    cd ios
    
    # Try a dry-run build
    if xcodebuild -project VarsityHub.xcodeproj \
                   -scheme VarsityHub \
                   -configuration Debug \
                   -sdk iphonesimulator \
                   -destination "id=$simulator" \
                   -showBuildSettings > /dev/null 2>&1; then
        log_success "Build environment verified - xcodebuild can run"
        cd ..
        return 0
    else
        log_warning "Build environment has issues - check output above"
        cd ..
        return 1
    fi
}

##############################################################################
# Main Workflow
##############################################################################

print_manual_steps() {
    log_section "⚠️  Manual Steps Required"
    
    echo "The following commands require sudo access and must be run manually:"
    echo ""
    echo -e "${YELLOW}1. Point CLI tools to Xcode:${NC}"
    echo "   sudo xcode-select --switch /Applications/Xcode.app"
    echo ""
    echo -e "${YELLOW}2. Accept Xcode license:${NC}"
    echo "   sudo xcodebuild -license accept"
    echo ""
    echo -e "${YELLOW}3. Restart CoreSimulatorService:${NC}"
    echo "   sudo launchctl kickstart -k system/com.apple.CoreSimulatorService"
    echo "   (Or just reboot macOS)"
    echo ""
    echo -e "${YELLOW}4. Install iOS Simulator runtime in Xcode:${NC}"
    echo "   - Open Xcode"
    echo "   - Go to Settings → Platforms"
    echo "   - Download iOS 18.1 Simulator (or latest)"
    echo "   - Quit and reopen Xcode after download completes"
    echo ""
}

run_checks() {
    log_section "🔍 Running Environment Checks"
    
    check_xcode_installed
    check_xcode_select
    check_license_accepted
    check_simulator_service
    check_simulator_runtimes
    check_simulator_devices
    check_pods_setup
    
    echo ""
    if [ $ISSUES_FOUND -eq 0 ]; then
        log_success "All checks passed!"
        return 0
    else
        log_warning "Found $ISSUES_FOUND issue(s)"
        return 1
    fi
}

run_fixes() {
    log_section "🔧 Applying Automated Fixes"
    
    # Only fix Pods (non-sudo operation)
    if [ ! -d "ios/Pods" ] || [ ! -f "ios/Pods/Target Support Files/Pods-VarsityHub/Pods-VarsityHub.debug.xcconfig" ]; then
        fix_pods
    else
        log_info "Pods already configured, skipping"
    fi
    
    echo ""
    if [ $FIXES_APPLIED -gt 0 ]; then
        log_success "Applied $FIXES_APPLIED fix(es)"
    else
        log_info "No automated fixes needed"
    fi
}

##############################################################################
# Entry Point
##############################################################################

MODE="${1:---all}"

case "$MODE" in
    --check)
        run_checks
        if [ $ISSUES_FOUND -gt 0 ]; then
            print_manual_steps
        fi
        ;;
    --fix)
        run_fixes
        ;;
    --verify)
        verify_build
        ;;
    --all|*)
        run_checks
        
        if [ $ISSUES_FOUND -gt 0 ]; then
            echo ""
            run_fixes
            echo ""
            print_manual_steps
        else
            echo ""
            verify_build
        fi
        ;;
esac

echo ""
log_section "Summary"
echo "Issues found: $ISSUES_FOUND"
echo "Fixes applied: $FIXES_APPLIED"
echo ""

if [ $ISSUES_FOUND -gt 0 ]; then
    log_warning "Setup incomplete - manual steps required above"
    exit 1
else
    log_success "Environment ready for iOS builds!"
    exit 0
fi
