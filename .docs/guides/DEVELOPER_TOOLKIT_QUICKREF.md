# Developer Efficiency Toolkit - Quick Reference

**Setup Date:** Dec 4, 2024  
**For:** Days 2-4 Execution  
**Value:** 30-40% faster feedback loops, fewer surprises at launch

---

## 🎯 What Each Tool Does (1-Minute Summary)

| Tool | When to Use | Action | Result |
|------|----------|--------|--------|
| **Sentry** | After deploying/pushing to main | Check Sentry tab | See production errors in real-time |
| **GitHub Actions** | Before/after committing | Check GitHub Actions tab | Monitor CI/CD workflow status |
| **Thunder Client** | Testing API changes | Right-click API file → Create request | Verify endpoints without Postman |
| **Snyk** | Before committing | Look at package.json | See vulnerable dependencies highlighted |
| **Expo Tools** | Writing components | Type `use` or `imp` | Get better Expo/RN snippets |
| **React Native Tools** | Debugging | F5 to start debugger | Better RN breakpoints & inspection |

---

## 📱 Daily Checklist (Takes 2 minutes)

- [ ] **Morning:** Check Sentry tab for overnight errors
- [ ] **Before commit:** Run Snyk scan via `Snyk: Test` command
- [ ] **After push:** Watch GitHub Actions workflow complete
- [ ] **When testing API:** Use Thunder Client instead of curl
- [ ] **Before deployment:** Run `npm audit` and fix Snyk issues

---

## 🔑 Your Environment Variables

Once set up in Thunder Client, use these in all API requests:

```
baseUrl = https://your-railway-app-url.railway.app
authToken = your-jwt-bearer-token
```

**How to get authToken:**
1. In app, get auth token from successful login response
2. Or in Thunder Client: right-click → Manage Environments → add token

---

## 📝 Common Scenarios

### "Did my changes break anything in production?"

**Tools to use:**
1. Sentry (check for new errors)
2. GitHub Actions (verify deployment succeeded)
3. Thunder Client: GET /health (verify API is up)

**Time:** 30 seconds

### "Is SendGrid really sending emails?"

**Tools to use:**
1. Thunder Client: POST /api/test-email
2. Check inbox for test email
3. If fails, check Sentry for SendGrid errors

**Time:** 1 minute

### "Do I have vulnerable dependencies?"

**Tools to use:**
1. Snyk: Look for red badges in package.json
2. Or: Run Snyk: Test from Command Palette
3. Click suggestion → see fix

**Time:** 2 minutes

### "Is the API responding correctly to my changes?"

**Tools to use:**
1. Thunder Client: Create request for endpoint
2. Add auth header with {{authToken}}
3. Click Send → see response instantly

**Time:** 1-2 minutes (no need to rebuild app)

---

## ⚡ Keyboard Shortcuts (Memorize These)

```
Cmd+Shift+P        → Open Command Palette (to access extensions)
Cmd+K Cmd+S        → Open Sentry search
Cmd+Shift+J        → Open GitHub Actions sidebar
Cmd+Shift+X        → Open Extensions tab
Cmd+Shift+D        → Open Debug sidebar (for React Native Tools)
Ctrl+Shift+D       → Start debugging (macOS: Cmd+Shift+D)
```

---

## 🚨 What Happens If You Don't Use These Tools?

| Tool | Without It | Cost |
|------|-----------|------|
| **Sentry** | Only find out about production bugs from users | Days of debugging |
| **GitHub Actions** | Have to manually check CI/CD page | 5 min per check |
| **Thunder Client** | Test API with curl/Postman | 2-3 min per request |
| **Snyk** | Vulnerable deps slip into production | Potential security issues |
| **Expo Tools** | Slower component development | 10-20% slower coding |

---

## 💾 Remember These URLs

Save these bookmarks or copy into Thunder Client:

```
Health Check:
GET https://your-railway-url/health

Test Email:
POST https://your-railway-url/api/test-email

Verify Token:
POST https://your-railway-url/api/verify-token

Get Current User:
GET https://your-railway-url/api/me
```

---

## 🔐 Security Reminders

✅ **DO:**
- Store `authToken` in Thunder Client environment (local only)
- Use Doppler/1Password for team secrets
- Commit `.env.example` with placeholder values only
- Check Snyk before pushing

❌ **DON'T:**
- Hardcode tokens in requests
- Commit real .env files
- Share authTokens in chat/email
- Ignore Snyk vulnerability warnings

---

## 📊 Expected Workflow Impact

**Before Tools:**
- 2-3 min per API test (setup curl command)
- 5+ min to spot production errors (dig through Sentry web)
- 3-5 min to check CI status (manual GitHub page refresh)
- 10+ min to check dependencies (npm audit output is hard to parse)

**After Tools:**
- 30 sec per API test (Thunder Client one-click)
- 30 sec to spot errors (Sentry tab in VS Code)
- 10 sec to check CI (GitHub Actions sidebar)
- 1 min to scan dependencies (Snyk inline badges)

**Time Saved Per Day:** ~20-30 minutes (or 10-15% of work day)

---

## 🎓 Next Steps

1. **Now:** Install extensions using VSCODE_EXTENSIONS_SETUP.md
2. **Today (Day 2):** Sign in to Sentry + GitHub Actions
3. **Tomorrow (Day 3):** Import Thunder Client collection
4. **Day 4:** Use all tools during final QA before launch

**Total Setup Time:** 10-15 minutes  
**ROI:** 20-30 min/day saved starting Day 3

---

## 📞 If You Get Stuck

**Extension won't install?**
- Close VS Code and reopen
- Try uninstalling + reinstalling
- Check your internet connection

**Can't sign into Sentry/GitHub?**
- Verify you have the accounts created
- Check email for verification links
- Try signing out and back in

**Thunder Client not working?**
- Verify {{baseUrl}} and {{authToken}} are set in Environments
- Test with GET /health first (simpler endpoint)
- Check Network tab for actual response

**Snyk showing old vulnerabilities?**
- Run Snyk: Refresh from Command Palette
- Close and reopen package.json

---

## 🎯 Success Metrics

By Day 4, you should be able to:

✅ Check production errors without leaving VS Code  
✅ Test API endpoints in <30 seconds  
✅ Monitor CI/CD in real-time  
✅ Catch vulnerabilities before committing  
✅ Debug React Native code with breakpoints  

**This is what production-grade developer efficiency looks like.** 🚀

---

**Questions?** Reference the setup guide: VSCODE_EXTENSIONS_SETUP.md
