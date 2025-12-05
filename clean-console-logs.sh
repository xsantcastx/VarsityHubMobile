#!/bin/bash
# Remove console.log statements from TypeScript/React files
# Usage: bash clean-console-logs.sh

cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile

echo "🧹 Removing console.log statements..."

# For each TypeScript file, remove pure console statements (not error handling)
find app components hooks -type f \( -name "*.tsx" -o -name "*.ts" \) -print0 | while IFS= read -r -d '' file; do
    # Use a more sophisticated approach to keep important logs in error handlers
    # Remove lines that are purely: console.log(...) without surrounding logic
    
    # Count before
    before=$(grep -c "console\.\(log\|debug\)" "$file" 2>/dev/null || echo 0)
    
    if [ "$before" -gt 0 ]; then
        # Backup
        cp "$file" "$file.bak"
        
        # Remove console.log/debug (keep error/warn in catch blocks)
        sed -i '' '/^[[:space:]]*console\.log/d' "$file"
        sed -i '' '/^[[:space:]]*console\.debug/d' "$file"
        
        # Count after
        after=$(grep -c "console\.\(log\|debug\)" "$file" 2>/dev/null || echo 0)
        
        if [ "$before" -gt "$after" ]; then
            echo "✓ $file: removed $((before - after)) console statements"
        fi
    fi
done

echo "✅ Console cleanup complete!"
echo ""
echo "Running lint check..."
npx eslint . --format=compact 2>&1 | grep "no-console" | wc -l | xargs echo "Remaining console warnings:"
npx eslint . --format=compact 2>&1 | tail -1
