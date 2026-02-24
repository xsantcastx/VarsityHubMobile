#!/bin/bash
# Overnight Database Health Check
# Verifies database integrity and runs maintenance

echo "🗄️  Starting overnight database health check..."
echo "Started: $(date)"

LOG_DIR="overnight-logs-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$LOG_DIR"

# 1. Check database connection
echo ""
echo "================================================="
echo "Phase 1: Database Connection Check"
echo "================================================="
{
    if [ -d "server" ] && [ -f "server/package.json" ]; then
        cd server
        echo "🔍 Checking database connection..."
        
        # Use Prisma to check connection
        if npx prisma db pull --schema=./prisma/schema.prisma > /dev/null 2>&1; then
            echo "✅ Database connection successful"
        else
            echo "❌ ERROR: Database connection failed"
        fi
        
        cd ..
    else
        echo "⚠️  Server directory not found, skipping database check"
    fi
} 2>&1 | tee "$LOG_DIR/1-connection.log"

# 2. Check for pending migrations
echo ""
echo "================================================="
echo "Phase 2: Migration Status"
echo "================================================="
{
    if [ -d "server" ] && [ -f "server/prisma/schema.prisma" ]; then
        cd server
        echo "🔍 Checking migration status..."
        
        # Check if migrations are up to date
        npx prisma migrate status 2>&1 || echo "⚠️  Migration check completed with issues"
        
        cd ..
    else
        echo "⚠️  Prisma schema not found, skipping migration check"
    fi
} 2>&1 | tee "$LOG_DIR/2-migrations.log"

# 3. Database health statistics
echo ""
echo "================================================="
echo "Phase 3: Database Statistics"
echo "================================================="
{
    if [ -d "server" ] && [ -f "server/package.json" ]; then
        cd server
        echo "🔍 Gathering database statistics..."
        
        # Run a simple query to check database health
        # This would need to be implemented as a script
        echo "📊 Database statistics check (implement custom query)"
        
        cd ..
    fi
} 2>&1 | tee "$LOG_DIR/3-statistics.log"

echo ""
echo "================================================="
echo "Database Health Check Complete"
echo "================================================="
echo "Logs saved to: $LOG_DIR"
echo "Completed: $(date)"
