#!/bin/bash
# VarsityHub - Overnight Lint Cleanup
# Auto-fixes lint errors across all priority screens

echo "🌙 Starting overnight lint cleanup..."
echo "Started: $(date)"

# Files to fix in order of priority (Day 1-2 targets)
FILES=(
  "app/highlights.tsx"
  "app/messages.tsx"
  "app/feed.tsx"
  "app/profile.tsx"
  "app/edit-profile.tsx"
  "app/onboarding/index.tsx"
  "app/onboarding/step-1-role.tsx"
  "app/onboarding/step-2-basic.tsx"
  "app/onboarding/step-3-plan.tsx"
  "app/onboarding/step-4-organization.tsx"
  "app/onboarding/step-10-confirmation.tsx"
  "app/team-hub.tsx"
  "app/team-profile.tsx"
  "app/team-page.tsx"
  "app/manage-teams.tsx"
  "app/settings/index.tsx"
  "app/settings/manage-subscription.tsx"
  "app/create-post.tsx"
  "app/create-team.tsx"
  "app/dm-restrictions.tsx"
  "app/blocked-users.tsx"
  "app/followers.tsx"
  "app/following.tsx"
  "app/favorites.tsx"
)

FIXED_COUNT=0
FAILED_COUNT=0
START_TIME=$(date +%s)
LOG_FILE="overnight-lint-$(date +%Y%m%d-%H%M%S).log"

echo "📋 Log file: $LOG_FILE"
echo "---" | tee -a "$LOG_FILE"

for FILE in "${FILES[@]}"; do
  echo "" | tee -a "$LOG_FILE"
  echo "🔧 Processing: $FILE" | tee -a "$LOG_FILE"
  
  # Check if file exists
  if [ ! -f "$FILE" ]; then
    echo "⚠️  File not found: $FILE" | tee -a "$LOG_FILE"
    continue
  fi
  
  # Run ESLint with auto-fix
  if npx eslint --fix "$FILE" 2>&1 | tee -a "$LOG_FILE"; then
    FIXED_COUNT=$((FIXED_COUNT + 1))
    echo "✅ Fixed: $FILE" | tee -a "$LOG_FILE"
    
    # Commit every 5 files for safety
    if [ $((FIXED_COUNT % 5)) -eq 0 ]; then
      git add "$FILE"
      if git commit -m "Overnight lint: Fixed $FILE (batch $((FIXED_COUNT / 5)))" 2>&1 | tee -a "$LOG_FILE"; then
        echo "💾 Committed batch $((FIXED_COUNT / 5))" | tee -a "$LOG_FILE"
      fi
    fi
  else
    FAILED_COUNT=$((FAILED_COUNT + 1))
    echo "❌ Failed: $FILE (manual review needed)" | tee -a "$LOG_FILE"
  fi
  
  # Brief pause to avoid overwhelming the system
  sleep 1
done

# Final commit of remaining files
echo "" | tee -a "$LOG_FILE"
echo "💾 Committing final changes..." | tee -a "$LOG_FILE"
git add app/
git commit -m "Overnight lint cleanup: $FIXED_COUNT fixed, $FAILED_COUNT need manual review" 2>&1 | tee -a "$LOG_FILE" || echo "Nothing new to commit" | tee -a "$LOG_FILE"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "---" | tee -a "$LOG_FILE"
echo "🎉 Overnight lint cleanup complete!" | tee -a "$LOG_FILE"
echo "✅ Fixed: $FIXED_COUNT files" | tee -a "$LOG_FILE"
echo "❌ Failed: $FAILED_COUNT files" | tee -a "$LOG_FILE"
echo "⏱️  Duration: $((DURATION / 60)) minutes" | tee -a "$LOG_FILE"
echo "📋 Full log: $LOG_FILE" | tee -a "$LOG_FILE"
echo "Finished: $(date)" | tee -a "$LOG_FILE"

# Run final verification
echo "" | tee -a "$LOG_FILE"
echo "🔍 Running final verification..." | tee -a "$LOG_FILE"
npm run typecheck 2>&1 | tee -a "$LOG_FILE"

echo "" | tee -a "$LOG_FILE"
echo "📊 Final lint status:" | tee -a "$LOG_FILE"
npm run lint:strict 2>&1 | head -50 | tee overnight-results.txt
cat overnight-results.txt | tee -a "$LOG_FILE"

echo "---" | tee -a "$LOG_FILE"
echo "✨ Results saved to: overnight-results.txt" | tee -a "$LOG_FILE"
echo "✨ Full log saved to: $LOG_FILE" | tee -a "$LOG_FILE"

# Success notification (macOS)
if command -v osascript &> /dev/null; then
  osascript -e 'display notification "Fixed '"$FIXED_COUNT"' files!" with title "VarsityHub Overnight Lint"' 2>/dev/null || true
fi
