#!/bin/bash
# Overnight Dependency Updates Check
# Analyzes outdated packages and generates update reports

echo "📦 Starting overnight dependency updates check..."
echo "Started: $(date)"

LOG_DIR="overnight-logs-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

# 1. Check frontend dependencies
echo ""
echo "================================================="
echo "Phase 1: Frontend Dependencies"
echo "================================================="
{
    echo "🔍 Checking for outdated packages..."
    if [ -f "package.json" ]; then
        echo "📋 Current dependencies:"
        npm list --depth=0 2>&1 | head -30
        
        echo ""
        echo "🔍 Checking outdated packages..."
        npm outdated --json 2>&1 > "$LOG_DIR/frontend-outdated.json" || echo "No outdated packages found or npm outdated failed"
        
        if [ -s "$LOG_DIR/frontend-outdated.json" ]; then
            echo "⚠️  Outdated packages found - see frontend-outdated.json"
            cat "$LOG_DIR/frontend-outdated.json" | head -50
        else
            echo "✅ All frontend dependencies are up to date"
        fi
        
        echo ""
        echo "🔍 Checking for major version updates..."
        npm outdated --json 2>&1 | grep -i "major" | head -20 || echo "✅ No major version updates needed"
    else
        echo "⚠️  package.json not found"
    fi
} 2>&1 | tee "$LOG_DIR/1-frontend.log"

# 2. Check server dependencies
echo ""
echo "================================================="
echo "Phase 2: Server Dependencies"
echo "================================================="
{
    if [ -d "server" ] && [ -f "server/package.json" ]; then
        cd server
        echo "🔍 Checking server dependencies..."
        
        echo "📋 Current server dependencies:"
        npm list --depth=0 2>&1 | head -30
        
        echo ""
        echo "🔍 Checking outdated packages..."
        npm outdated --json 2>&1 > "../$LOG_DIR/server-outdated.json" || echo "No outdated packages found or npm outdated failed"
        
        if [ -s "../$LOG_DIR/server-outdated.json" ]; then
            echo "⚠️  Outdated server packages found - see server-outdated.json"
            cat "../$LOG_DIR/server-outdated.json" | head -50
        else
            echo "✅ All server dependencies are up to date"
        fi
        
        cd ..
    else
        echo "⚠️  Server directory not found, skipping"
    fi
} 2>&1 | tee "$LOG_DIR/2-server.log"

# 3. Security audit
echo ""
echo "================================================="
echo "Phase 3: Security Audit"
echo "================================================="
{
    echo "🔍 Running npm audit on frontend..."
    npm audit --json 2>&1 > "$LOG_DIR/frontend-audit.json" || echo "Audit completed with issues"
    
    if [ -s "$LOG_DIR/frontend-audit.json" ]; then
        vulnerabilities=$(cat "$LOG_DIR/frontend-audit.json" | grep -o '"vulnerabilities":{[^}]*}' | head -1 || echo "")
        echo "📊 Frontend audit results saved to frontend-audit.json"
    fi
    
    if [ -d "server" ] && [ -f "server/package.json" ]; then
        echo ""
        echo "🔍 Running npm audit on server..."
        cd server
        npm audit --json 2>&1 > "../$LOG_DIR/server-audit.json" || echo "Server audit completed with issues"
        cd ..
        echo "📊 Server audit results saved to server-audit.json"
    fi
} 2>&1 | tee "$LOG_DIR/3-audit.log"

# 4. Generate summary report
echo ""
echo "================================================="
echo "Phase 4: Summary Report"
echo "================================================="
{
    echo "📊 Generating summary..."
    
    frontend_outdated=0
    server_outdated=0
    frontend_vulns=0
    server_vulns=0
    
    if [ -f "$LOG_DIR/frontend-outdated.json" ]; then
        frontend_outdated=$(cat "$LOG_DIR/frontend-outdated.json" | grep -c '"' || echo "0")
    fi
    
    if [ -f "$LOG_DIR/server-outdated.json" ]; then
        server_outdated=$(cat "$LOG_DIR/server-outdated.json" | grep -c '"' || echo "0")
    fi
    
    echo "📋 Dependency Update Summary:"
    echo "  Frontend outdated packages: $frontend_outdated"
    echo "  Server outdated packages: $server_outdated"
    echo ""
    echo "📋 Security Audit Summary:"
    echo "  Frontend vulnerabilities: Check frontend-audit.json"
    echo "  Server vulnerabilities: Check server-audit.json"
    echo ""
    echo "📁 Detailed reports saved to: $LOG_DIR/"
    
} 2>&1 | tee "$LOG_DIR/4-summary.log"

echo ""
echo "================================================="
echo "Dependency Updates Check Complete"
echo "================================================="
echo "Logs saved to: $LOG_DIR"
echo "Completed: $(date)"
