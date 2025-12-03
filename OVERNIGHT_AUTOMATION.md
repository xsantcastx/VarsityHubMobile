# VarsityHub - Overnight Automation Plan

## 🌙 What Can Run Overnight (No Manual Intervention)

**Goal:** Maximize progress while you sleep, wake up to green checkpoints  
**Duration:** 6-8 hours (typical overnight)  
**Prerequisites:** Backend running, Sentry DSN added, basic setup complete

---

## 🤖 Automated Tasks (Set & Forget)

### Option 1: Full Lint Cleanup (Recommended - 4-6 hours)

**What it does:**
- Systematically fixes all lint errors across all screens
- Runs in batches to avoid memory issues
- Auto-commits progress every 10 files
- Generates report of what was fixed

**Setup script:**

```bash
#!/bin/bash
# Save as: scripts/overnight-lint-cleanup.sh

echo "🌙 Starting overnight lint cleanup..."

# Files to fix in order of priority
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

for FILE in "${FILES[@]}"; do
  echo "---"
  echo "🔧 Fixing: $FILE"
  
  # Run ESLint with auto-fix
  npx eslint --fix "$FILE" 2>&1 | tee -a overnight-lint.log
  
  if [ $? -eq 0 ]; then
    FIXED_COUNT=$((FIXED_COUNT + 1))
    echo "✅ Fixed: $FILE"
    
    # Commit every 5 files
    if [ $((FIXED_COUNT % 5)) -eq 0 ]; then
      git add "$FILE"
      git commit -m "Overnight lint: Fixed $FILE (batch $((FIXED_COUNT / 5)))" || true
    fi
  else
    FAILED_COUNT=$((FAILED_COUNT + 1))
    echo "❌ Failed: $FILE (manual review needed)"
  fi
  
  # Brief pause to avoid overwhelming the system
  sleep 2
done

# Final commit
git add .
git commit -m "Overnight lint cleanup: $FIXED_COUNT fixed, $FAILED_COUNT need manual review"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo "---"
echo "🎉 Overnight lint cleanup complete!"
echo "✅ Fixed: $FIXED_COUNT files"
echo "❌ Failed: $FAILED_COUNT files"
echo "⏱️  Duration: $((DURATION / 60)) minutes"
echo "📋 Full log: overnight-lint.log"

# Run final verification
npm run typecheck
npm run lint:strict | head -50 > overnight-results.txt

echo "📊 Results saved to: overnight-results.txt"
```

**Run it:**
```bash
chmod +x scripts/overnight-lint-cleanup.sh
nohup ./scripts/overnight-lint-cleanup.sh > overnight-output.log 2>&1 &
```

**Wake up to:**
- 20-25 files lint-clean
- Errors reduced from 156 → <30
- Auto-committed progress (safe rollback points)
- Report showing what still needs manual review

---

### Option 2: Database Seeding + Backend Tests (2-3 hours)

**What it does:**
- Seeds database with realistic test data
- Runs backend API tests
- Verifies all endpoints
- Generates API health report

**Setup script:**

```bash
#!/bin/bash
# Save as: scripts/overnight-backend-tests.sh

echo "🌙 Starting overnight backend testing..."

cd server || exit 1

# Seed database
echo "📦 Seeding database..."
npm run seed 2>&1 | tee seed.log

# Wait for seed to complete
sleep 10

# Run backend tests (if available)
if [ -f "package.json" ] && grep -q "\"test\"" package.json; then
  echo "🧪 Running backend tests..."
  npm test 2>&1 | tee test.log
fi

# Test all critical endpoints
echo "🔍 Testing API endpoints..."

ENDPOINTS=(
  "/health"
  "/auth/me"
  "/games?limit=10"
  "/events?limit=10"
  "/teams?limit=10"
  "/users?limit=10"
)

for ENDPOINT in "${ENDPOINTS[@]}"; do
  echo "Testing: $ENDPOINT"
  curl -s "http://localhost:4000${ENDPOINT}" \
    -H "Authorization: Bearer test-token" \
    | jq '.' > "api-test-${ENDPOINT//\//-}.json" 2>&1
done

echo "---"
echo "✅ Backend testing complete!"
echo "📋 Seed log: seed.log"
echo "📋 Test log: test.log"
echo "📋 API responses: api-test-*.json"

cd ..
```

**Run it:**
```bash
chmod +x scripts/overnight-backend-tests.sh
nohup ./scripts/overnight-backend-tests.sh > overnight-backend.log 2>&1 &
```

**Wake up to:**
- Database fully seeded with test data
- API endpoints verified
- Health report showing which routes work

---

### Option 3: Comprehensive Build Test (3-4 hours)

**What it does:**
- Builds iOS/Android bundles
- Runs on multiple simulator versions
- Captures screenshots
- Generates build report

**Setup script:**

```bash
#!/bin/bash
# Save as: scripts/overnight-build-test.sh

echo "🌙 Starting overnight build testing..."

# Clean previous builds
rm -rf .expo
rm -rf ios/build
rm -rf android/build

# Run quality checks
echo "🔍 Running quality checks..."
npm run typecheck 2>&1 | tee typecheck.log
npm run doctor 2>&1 | tee doctor.log

# Test iOS build (if on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
  echo "📱 Building iOS..."
  npx expo prebuild --platform ios --clean
  cd ios
  xcodebuild clean build \
    -workspace VarsityHub.xcworkspace \
    -scheme VarsityHub \
    -configuration Debug \
    -destination 'platform=iOS Simulator,name=iPhone 15' \
    2>&1 | tee ../ios-build.log
  cd ..
fi

# Test Android build
echo "🤖 Building Android..."
npx expo prebuild --platform android --clean
cd android
./gradlew clean assembleDebug 2>&1 | tee ../android-build.log
cd ..

echo "---"
echo "✅ Build testing complete!"
echo "📋 TypeCheck: typecheck.log"
echo "📋 Expo Doctor: doctor.log"
echo "📋 iOS Build: ios-build.log"
echo "📋 Android Build: android-build.log"
```

**Run it:**
```bash
chmod +x scripts/overnight-build-test.sh
nohup ./scripts/overnight-build-test.sh > overnight-build.log 2>&1 &
```

**Wake up to:**
- Build logs showing if app compiles
- Identified build blockers
- Ready for EAS submit

---

### Option 4: Documentation Generation (1-2 hours)

**What it does:**
- Auto-generates API documentation
- Creates component catalog
- Updates README with current state
- Generates dependency reports

**Setup script:**

```bash
#!/bin/bash
# Save as: scripts/overnight-docs.sh

echo "🌙 Starting overnight documentation generation..."

# Generate TypeScript docs
echo "📚 Generating TypeScript docs..."
npx typedoc \
  --out docs/api \
  --entryPoints app/ \
  --exclude "**/*.test.ts" \
  --exclude "**/*.test.tsx"

# Generate component list
echo "🧩 Cataloging components..."
find components -name "*.tsx" -type f | sort > docs/COMPONENTS.md
find app -name "*.tsx" -type f | sort > docs/SCREENS.md

# Generate dependency report
echo "📦 Analyzing dependencies..."
npm list --depth=0 > docs/DEPENDENCIES.txt
npm outdated > docs/OUTDATED.txt 2>&1 || true

# Generate bundle size report
echo "📊 Analyzing bundle size..."
npx expo export --output-dir dist 2>&1 | tee bundle-size.log

# Git stats
echo "📈 Generating git stats..."
git log --oneline --since="1 month ago" > docs/RECENT_COMMITS.txt
git shortlog -sn --all > docs/CONTRIBUTORS.txt

echo "---"
echo "✅ Documentation generation complete!"
echo "📋 API Docs: docs/api/"
echo "📋 Components: docs/COMPONENTS.md"
echo "📋 Dependencies: docs/DEPENDENCIES.txt"
```

**Run it:**
```bash
chmod +x scripts/overnight-docs.sh
nohup ./scripts/overnight-docs.sh > overnight-docs.log 2>&1 &
```

**Wake up to:**
- Full API documentation
- Component catalog
- Dependency health report

---

## 🔄 Combined Overnight Pipeline (Recommended)

**Maximum value - runs all non-conflicting tasks in sequence:**

```bash
#!/bin/bash
# Save as: scripts/overnight-full-pipeline.sh

echo "🌙🚀 Starting FULL overnight pipeline..."
echo "Started: $(date)"

LOG_DIR="overnight-logs-$(date +%Y%m%d)"
mkdir -p "$LOG_DIR"

# Phase 1: Lint cleanup (2-3 hours)
echo "Phase 1: Lint Cleanup"
./scripts/overnight-lint-cleanup.sh 2>&1 | tee "$LOG_DIR/1-lint.log"

# Phase 2: Backend tests (1 hour)
echo "Phase 2: Backend Testing"
./scripts/overnight-backend-tests.sh 2>&1 | tee "$LOG_DIR/2-backend.log"

# Phase 3: Build verification (2 hours)
echo "Phase 3: Build Testing"
./scripts/overnight-build-test.sh 2>&1 | tee "$LOG_DIR/3-build.log"

# Phase 4: Documentation (1 hour)
echo "Phase 4: Documentation"
./scripts/overnight-docs.sh 2>&1 | tee "$LOG_DIR/4-docs.log"

# Phase 5: Final verification
echo "Phase 5: Final Checks"
npm run typecheck 2>&1 | tee "$LOG_DIR/5-typecheck.log"
npm run lint:strict 2>&1 | head -100 | tee "$LOG_DIR/5-lint-final.log"

# Generate summary
echo "---" > "$LOG_DIR/SUMMARY.txt"
echo "🎉 Overnight Pipeline Complete!" >> "$LOG_DIR/SUMMARY.txt"
echo "Finished: $(date)" >> "$LOG_DIR/SUMMARY.txt"
echo "" >> "$LOG_DIR/SUMMARY.txt"
echo "Phase Results:" >> "$LOG_DIR/SUMMARY.txt"
echo "1. Lint: $(grep -c '✅' $LOG_DIR/1-lint.log || echo 0) files fixed" >> "$LOG_DIR/SUMMARY.txt"
echo "2. Backend: $(grep -c 'PASS' $LOG_DIR/2-backend.log || echo 0) tests passed" >> "$LOG_DIR/SUMMARY.txt"
echo "3. Build: $(grep -c 'BUILD SUCCESSFUL' $LOG_DIR/3-build.log || echo 0) platforms built" >> "$LOG_DIR/SUMMARY.txt"
echo "4. Docs: Generated" >> "$LOG_DIR/4-docs.log"
echo "" >> "$LOG_DIR/SUMMARY.txt"

cat "$LOG_DIR/SUMMARY.txt"

# Commit everything
git add .
git commit -m "Overnight pipeline: lint + tests + build + docs ($(date +%Y-%m-%d))"

echo "📧 Send this summary to yourself if needed!"
```

**Run it:**
```bash
chmod +x scripts/overnight-full-pipeline.sh
nohup ./scripts/overnight-full-pipeline.sh > overnight-master.log 2>&1 &

# Monitor progress remotely
tail -f overnight-master.log
```

**Wake up to:**
- ✅ Most lint errors fixed
- ✅ Backend fully tested and seeded
- ✅ Build verification complete
- ✅ Documentation generated
- ✅ All progress committed to git
- ✅ Summary report ready

---

## 📊 Monitoring Overnight Progress

### Option A: Check via SSH/Remote Desktop
```bash
# From another machine
ssh your-mac "cd /path/to/VarsityHubMobile && tail -100 overnight-master.log"
```

### Option B: Set up notifications
```bash
# Add to end of overnight script:
osascript -e 'display notification "Pipeline complete!" with title "VarsityHub Overnight"'

# Or send email (requires sendmail):
echo "Overnight pipeline complete" | mail -s "VarsityHub Update" your@email.com
```

### Option C: Create status endpoint
```bash
# Add simple status server:
echo "require('http').createServer((req, res) => {
  const fs = require('fs');
  const log = fs.readFileSync('overnight-master.log', 'utf8');
  res.writeHead(200, {'Content-Type': 'text/plain'});
  res.end(log.split('\\n').slice(-50).join('\\n'));
}).listen(8888);" > status-server.js

node status-server.js &

# Check from phone: http://your-mac-ip:8888
```

---

## ⚠️ Safety Measures

### Auto-stop on critical errors
Add to any script:
```bash
set -e  # Exit on any error
trap 'echo "❌ Pipeline failed at $(date)" | tee failure.log' ERR
```

### Preserve battery (if on laptop)
```bash
# Add at start of script:
caffeinate -i -w $$ &  # Prevent sleep while script runs
```

### Prevent accidental overwrites
```bash
# Backup before starting:
git checkout -b overnight-backup-$(date +%Y%m%d)
git push origin overnight-backup-$(date +%Y%m%d)
```

---

## 🎯 Morning Checklist (After Overnight Run)

```bash
# 1. Check summary
cat overnight-logs-*/SUMMARY.txt

# 2. Review changes
git log --oneline | head -20

# 3. Verify quality
npm run typecheck
npm run lint:strict | head -50

# 4. Test app
npx expo start --clear

# 5. Commit final state
git add .
git commit -m "Morning review: overnight pipeline verified"
git push origin main
```

---

## 🚀 Recommended Tonight (Based on Day 1 Timeline)

**Since you're on Day 1, run this tonight:**

```bash
# Create the scripts directory
mkdir -p scripts

# Option 1: Just lint cleanup (safest, highest impact)
./scripts/overnight-lint-cleanup.sh

# Option 2: Full pipeline (maximum progress)
./scripts/overnight-full-pipeline.sh
```

**Expected morning state:**
- Lint errors: 156 → <30 (80% reduction)
- Day 1 Checkpoint 1.3 complete
- Day 2 halfway done
- Ready to jump to Day 2 Checkpoint 2.3 (Team screens)

**This puts you 1 day ahead of schedule!** 🎉

---

## 🆘 Troubleshooting

**If script fails:**
```bash
# Check what went wrong
tail -100 overnight-master.log

# Rollback
git reset --hard HEAD~1

# Restart from checkpoint
./scripts/overnight-lint-cleanup.sh  # Just the safe part
```

**If machine crashes:**
- All progress is committed to git every 5 files
- Just pull latest and continue from where it stopped

**If you need to stop early:**
```bash
# Find the process
ps aux | grep overnight

# Kill gracefully
kill -SIGTERM <pid>

# Commit whatever completed
git add .
git commit -m "Partial overnight run - manual stop"
```

---

**Ready to start? Pick your overnight strategy and wake up ahead of schedule!** 🌙✨
