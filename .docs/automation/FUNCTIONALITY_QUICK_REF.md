# Real-World Functionality Overnight Tests - Quick Reference

## 🎯 What Gets Tested (12 Automated Checks)

1. **User Registration** - Register new user, get access token
2. **User Login** - Login with credentials
3. **Post Creation** - Create post with content
4. **Posts Feed** - Retrieve posts feed
5. **Team Creation** - Coach creates team
6. **Teams List** - View teams list
7. **Game/Event Creation** - Create game/event
8. **Direct Messaging** - Send message between users
9. **Messages List** - View messages
10. **API Health Check** - Check API health and integrations
11. **User Profile** - Get authenticated user profile
12. **Events List** - View events list

## 🚀 Quick Start

```bash
# With local API
API_URL=http://localhost:4000 ./scripts/overnight-functionality.sh

# With production API
API_URL=https://api-production-8ac3.up.railway.app ./scripts/overnight-functionality.sh
```

## 📊 Morning Review

```bash
# View latest summary
ls -t overnight-results/functionality-summary-*.json | head -1 | xargs cat | jq .

# View failed tests
ls -t overnight-results/functionality-summary-*.json | head -1 | xargs jq '.results[] | select(.passed == false)'

# Check API health
ls -t overnight-results/functionality-summary-*.json | head -1 | xargs jq '.results[] | select(.test == "API Health Check")'
```

## 📁 Output Files

- `overnight-results/functionality-*.log` - Full log
- `overnight-results/functionality-summary-*.json` - Pass/fail summary
- `overnight-results/functionality-results-*.json` - Detailed Playwright results

## ⚡ Common Issues

| Issue | Solution |
|-------|----------|
| API not accessible | Start API server or set correct API_URL |
| Tests timeout | Check API response times, verify database |
| False positives (403) | Some 403s are expected (permissions) |
| Health check fails | **CRITICAL** - API down or misconfigured |

## 📝 Expected Results

- **10-12 passing** - Normal (some 403s expected)
- **8-9 passing** - Minor issues, review failures
- **< 8 passing** - Critical issues, investigate immediately

## 📚 Full Documentation

See `REAL_WORLD_FUNCTIONALITY_OVERNIGHT.md` for complete details.
