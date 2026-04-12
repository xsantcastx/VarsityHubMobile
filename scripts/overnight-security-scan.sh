#!/bin/bash
# Overnight Security Scan
# Runs security checks and vulnerability scanning

echo "🔒 Starting overnight security scan..."
echo "Started: $(date)"

LOG_DIR="overnight-logs-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

# 1. Snyk security scan
echo ""
echo "================================================="
echo "Phase 1: Snyk Security Scan"
echo "================================================="
{
    if command -v snyk &> /dev/null; then
        if [ -z "${SNYK_TOKEN:-}" ]; then
            echo "⚠️  SNYK_TOKEN is not set. Skipping Snyk scans to avoid interactive auth hangs."
            echo "   Configure SNYK_TOKEN locally or rely on the GitHub Actions workflow."
        else
        echo "🔍 Running Snyk security scan..."
        snyk test --severity-threshold=high 2>&1 || echo "⚠️  Snyk scan completed with issues (check output)"
        
        echo ""
        echo "🔍 Running Snyk code scan..."
        if [ -d "server/src" ]; then
            cd server
            snyk code test --severity-threshold=high 2>&1 || echo "⚠️  Snyk code scan completed"
            cd ..
        fi
        fi
    else
        echo "⚠️  Snyk CLI not installed. Skipping security scan."
        echo "   Install: npm install -g snyk"
    fi
} 2>&1 | tee "$LOG_DIR/1-security.log"

# 2. Check for exposed secrets
echo ""
echo "================================================="
echo "Phase 2: Secret Scanning"
echo "================================================="
{
    echo "🔍 Scanning for exposed secrets..."
    
    # Check for API keys in code
    if grep -r "sk_live\|sk_test" --include="*.ts" --include="*.tsx" --include="*.js" app/ server/src/ 2>/dev/null | grep -v node_modules; then
        echo "❌ ERROR: Secret keys found in code!"
    else
        echo "✅ No secret keys found in code"
    fi
    
    # Check for hardcoded passwords
    if grep -ri "password.*=.*['\"].*[0-9a-zA-Z]" --include="*.ts" --include="*.tsx" --include="*.js" app/ server/src/ 2>&1 | grep -v node_modules | grep -v "password.*:.*string"; then
        echo "⚠️  WARNING: Possible hardcoded passwords found"
    else
        echo "✅ No hardcoded passwords detected"
    fi
} 2>&1 | tee "$LOG_DIR/2-secrets.log"

# 3. Dependency audit
echo ""
echo "================================================="
echo "Phase 3: Dependency Audit"
echo "================================================="
{
    echo "🔍 Running npm audit..."
    npm audit --production 2>&1 || echo "⚠️  npm audit completed with issues"
    
    if [ -d "server" ]; then
        echo ""
        echo "🔍 Running server npm audit..."
        cd server
        npm audit --production 2>&1 || echo "⚠️  Server npm audit completed with issues"
        cd ..
    fi
} 2>&1 | tee "$LOG_DIR/3-dependencies.log"

echo ""
echo "================================================="
echo "Security Scan Complete"
echo "================================================="
echo "Logs saved to: $LOG_DIR"
echo "Completed: $(date)"
