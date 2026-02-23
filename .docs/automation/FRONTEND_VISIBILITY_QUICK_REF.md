# Front-End Visibility Overnight Tasks - Quick Reference

## 🎯 What Gets Tested (9 Automated Checks)

1. **Profile Header Visibility** - Profile picture, name, handle, settings button
2. **Navigation Tabs** - Posts, Replies, Upvotes tabs
3. **Empty State** - "No posts yet" message and create button
4. **Bottom Navigation** - Feed, Highlights, Discover, Profile, Create (+)
5. **Text Rendering** - User name, handle, join date with proper truncation
6. **Image Loading** - Profile and content images load correctly
7. **Safe Area** - Content not hidden behind status bar
8. **Tab Active States** - Active tab has visual indicator (underline/bold)
9. **Accessibility** - Font sizes ≥14px, basic contrast checks

## 🚀 Quick Start

```bash
# Run now
./scripts/overnight-frontend-visibility.sh

# With custom URL
APP_URL=http://localhost:8081 ./scripts/overnight-frontend-visibility.sh
```

## 📊 Morning Review

```bash
# View latest summary
ls -t overnight-results/visibility-summary-*.json | head -1 | xargs cat | jq .

# View failed tests
ls -t overnight-results/visibility-results-*.json | head -1 | xargs jq '.results[] | select(.passed == false)'

# Check screenshots
open overnight-results/visibility-screenshots/
```

## 📁 Output Files

- `overnight-results/frontend-visibility-*.log` - Full log
- `overnight-results/visibility-summary-*.json` - Pass/fail summary
- `overnight-results/visibility-screenshots/*.png` - Screenshots for each test

## ⚡ Common Issues

| Issue | Solution |
|-------|----------|
| App not running | Script auto-starts Expo server |
| Tests timeout | Increase wait times in test file |
| False positives | Check screenshots to verify actual UI |

## 📚 Full Documentation

See `FRONTEND_VISIBILITY_OVERNIGHT.md` for complete details.
