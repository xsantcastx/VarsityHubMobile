# Front-End Visibility Overnight Tests

## Overview

Automated front-end visibility tests that run overnight to catch UI regressions, component rendering issues, and visual problems. These tests verify that critical UI elements are visible, properly positioned, and accessible.

**What it checks:**
- Component visibility (profile header, navigation, tabs)
- Status bar and safe area compliance
- Empty state rendering
- Text truncation handling
- Image loading and fallbacks
- Navigation bar visibility
- Tab indicators and active states
- Accessibility (contrast, font sizes)

---

## Quick Start

### Run Now (Manual)
```bash
cd /Users/varsityhub/VarsityHubMobile
./scripts/overnight-frontend-visibility.sh
```

### Run with Custom URL
```bash
APP_URL=http://localhost:8081 ./scripts/overnight-frontend-visibility.sh
```

Takes ~5-10 minutes. Results saved to `overnight-results/`.

---

## What Gets Tested

### 1. Profile Screen - Header Visibility
- **Checks:** Profile picture, user name, handle (@username), settings button
- **Screenshot:** `profile-header-TIMESTAMP.png`
- **Failure:** Any key header element not visible

### 2. Profile Navigation Tabs
- **Checks:** Posts, Replies, Upvotes tabs visible
- **Screenshot:** `profile-tabs-TIMESTAMP.png`
- **Failure:** No tabs visible or not navigable

### 3. Empty State Rendering
- **Checks:** Empty state message and "Create" button when no content
- **Screenshot:** `empty-state-TIMESTAMP.png`
- **Failure:** Empty state not shown when appropriate

### 4. Bottom Navigation Bar
- **Checks:** Feed, Highlights, Discover, Profile nav items + Create button
- **Screenshot:** `bottom-nav-TIMESTAMP.png`
- **Failure:** Less than 3 nav items visible

### 5. Text Rendering and Truncation
- **Checks:** User name, handle, join date visible; proper text truncation
- **Screenshot:** `text-rendering-TIMESTAMP.png`
- **Failure:** No text elements visible or overflow issues

### 6. Image Loading and Fallbacks
- **Checks:** Profile images and content images load properly
- **Screenshot:** `image-loading-TIMESTAMP.png`
- **Failure:** Images not loading or no fallback handling

### 7. Status Bar and Safe Area
- **Checks:** Content not hidden behind status bar, proper safe area
- **Screenshot:** `safe-area-TIMESTAMP.png`
- **Failure:** Content overlaps status bar

### 8. Tab Active State Indicators
- **Checks:** Active tab has visual indicator (underline, bold, color change)
- **Screenshot:** `tab-states-TIMESTAMP.png`
- **Failure:** No active state indicator visible

### 9. Accessibility Basics
- **Checks:** Font sizes ≥14px, basic contrast checks
- **Screenshot:** `accessibility-TIMESTAMP.png`
- **Failure:** Text too small or poor contrast

---

## Output Files

All results are saved in `overnight-results/`:

### Screenshots
- `visibility-screenshots/profile-header-*.png` - Profile header screenshots
- `visibility-screenshots/profile-tabs-*.png` - Tab navigation screenshots
- `visibility-screenshots/empty-state-*.png` - Empty state screenshots
- `visibility-screenshots/bottom-nav-*.png` - Navigation bar screenshots
- `visibility-screenshots/text-rendering-*.png` - Text rendering screenshots
- `visibility-screenshots/image-loading-*.png` - Image loading screenshots
- `visibility-screenshots/safe-area-*.png` - Safe area compliance screenshots
- `visibility-screenshots/tab-states-*.png` - Tab active state screenshots
- `visibility-screenshots/accessibility-*.png` - Accessibility screenshots

### Results
- `frontend-visibility-TIMESTAMP.log` - Full test execution log
- `frontend-visibility-results-TIMESTAMP.json` - Playwright JSON results
- `visibility-results-TIMESTAMP.json` - Detailed visibility results
- `visibility-summary-TIMESTAMP.json` - Test summary (pass/fail counts)

---

## Morning Review

When you wake up, check the results:

```bash
cd /Users/varsityhub/VarsityHubMobile

# View latest summary
ls -t overnight-results/visibility-summary-*.json | head -1 | xargs cat | jq .

# View test log
ls -t overnight-results/frontend-visibility-*.log | head -1 | xargs tail -50

# Check for failed tests
ls -t overnight-results/visibility-results-*.json | head -1 | xargs jq '.results[] | select(.passed == false)'
```

### Sample Summary Output
```json
{
  "timestamp": "2025-12-10T11:23:45.123Z",
  "totalTests": 9,
  "passed": 8,
  "failed": 1,
  "passRate": "88.89%",
  "results": [
    {
      "test": "Profile Header Visibility",
      "passed": true,
      "details": "Profile Picture: true, User Name: true, Handle: true, Settings: true"
    },
    {
      "test": "Empty State Rendering",
      "passed": false,
      "details": "Empty State Text: false, Create Button: false"
    }
  ]
}
```

---

## Visual Regression Detection

### Screenshot Comparison (Manual)

To detect visual regressions manually:

1. **Capture baseline screenshots** (first successful run):
```bash
./scripts/overnight-frontend-visibility.sh
# Note the timestamp in screenshot filenames
```

2. **Compare with current run**:
```bash
# Using image comparison tool (requires ImageMagick)
compare overnight-results/visibility-screenshots/profile-header-BASELINE.png \
       overnight-results/visibility-screenshots/profile-header-CURRENT.png \
       overnight-results/visibility-screenshots/diff-profile-header.png
```

3. **Automated comparison** (future enhancement):
   - Store baseline screenshots in `overnight-results/baselines/`
   - Use Playwright's built-in visual comparison
   - Detect pixel-level differences automatically

---

## Integration with Nightly Sweeps

To include front-end visibility tests in your nightly automation:

### Option 1: Add to Existing Nightly Sweeps
Edit `/tmp/nightly-sweeps.sh` and add:

```bash
# Front-end visibility tests
echo "🔍 Running front-end visibility tests..."
./scripts/overnight-frontend-visibility.sh &
FRONTEND_PID=$!
```

### Option 2: Run Separately (Recommended)
Keep visibility tests separate since they require the app to be running:

```bash
# In cron or separate schedule
# 1. Start app server
# 2. Run visibility tests
# 3. Stop server
```

### Option 3: CI/CD Integration
Add to GitHub Actions workflow:

```yaml
- name: Run Front-End Visibility Tests
  run: |
    npm run web:playwright &
    sleep 30
    ./scripts/overnight-frontend-visibility.sh
```

---

## Troubleshooting

### App Not Starting
**Error:** `App is not accessible at http://localhost:8081`

**Solution:**
```bash
# Start Expo manually first
npx expo start --web --non-interactive &
sleep 10
./scripts/overnight-frontend-visibility.sh
```

### Tests Timing Out
**Error:** Timeout waiting for elements

**Solution:** Increase wait times in test file:
```typescript
await page.waitForTimeout(5000); // Increase from 2000
```

### Screenshots Not Saving
**Check permissions:**
```bash
ls -la overnight-results/visibility-screenshots/
# Should be writable
```

### False Positives
If tests fail but UI looks correct:

1. **Check screenshots** - Visual inspection of saved screenshots
2. **Verify selectors** - UI may have changed, selectors need update
3. **Check console errors** - May indicate loading issues

---

## Customizing Tests

### Add New Visibility Check

Edit `tests/frontend-visibility.spec.ts`:

```typescript
test('New component visibility', async ({ page }) => {
  const testName = 'New Component Check';
  
  // Navigate to target screen
  await page.goto(APP_URL);
  
  // Check visibility
  const element = page.locator('[data-testid="new-component"]');
  const isVisible = await element.isVisible();
  
  // Screenshot
  const screenshotPath = join(SCREENSHOT_DIR, `new-component-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  
  // Log result
  logResult(testName, isVisible, `Component visible: ${isVisible}`, screenshotPath);
  
  expect(isVisible).toBeTruthy();
});
```

### Adjust Test Selectors

Update selectors based on your app's structure:

```typescript
// Current selector
const profileLink = page.locator('text=/profile/i, a:has-text("Profile")');

// Add more specific selector
const profileLink = page.locator('[data-testid="nav-profile"], text=/profile/i');
```

---

## Best Practices

1. **Run regularly** - Nightly is ideal for catching regressions early
2. **Review screenshots** - Visual inspection catches issues automation misses
3. **Update selectors** - When UI changes, update test selectors
4. **Baseline management** - Keep baseline screenshots for comparison
5. **Monitor trends** - Track pass rate over time

---

## Expected Results

### Successful Run
- All 9 tests pass
- Screenshots saved for all checks
- Summary shows 100% pass rate

### Typical Failures
- **Empty state** - May fail if user has content (this is OK)
- **Image loading** - May fail if images slow to load (increase wait time)
- **Tab states** - May fail if tabs not yet implemented (acceptable)

### Action Items
- **Any failures** - Review screenshot, check if UI changed
- **Consistent failures** - Update test or fix UI issue
- **New failures** - Likely regression, investigate immediately

---

## Files Reference

| File | Purpose |
|------|---------|
| `tests/frontend-visibility.spec.ts` | Playwright test suite |
| `scripts/overnight-frontend-visibility.sh` | Execution script |
| `overnight-results/visibility-screenshots/` | Screenshot storage |
| `overnight-results/visibility-summary-*.json` | Test summaries |

---

## Next Steps

1. **First Run:** Execute script to establish baseline
2. **Review:** Check all screenshots, verify tests match reality
3. **Tune:** Adjust selectors and wait times as needed
4. **Automate:** Add to nightly cron or CI/CD pipeline
5. **Monitor:** Review results daily, catch regressions early

This gives you **automated visual QA** running every night while you sleep! 🌙
