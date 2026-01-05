# SendGrid API Key Rotation Guide
**Date:** December 17, 2024  
**Status:** 🔴 **ACTION REQUIRED - Invalid API Key**

---

## 🚨 Critical Issue

The current SendGrid API key `SG.3TyEaTS6Qt2-Pzw3duOoIA...` is **invalid** (returns 401 Unauthorized).

**Root Cause:** Environment loading bug - `server/src/lib/load-env.ts` was stopping at the first `.env` file found (root), which didn't contain `SENDGRID_API_KEY`. The key in `server/.env` was never loaded.

**Status:** ✅ Environment loading **fixed** - now merges all `.env` files  
**Next Step:** 🔴 **Get a new SendGrid API key**

---

## ✅ What's Been Fixed

### 1. Environment Loading Bug (FIXED)
**File:** `server/src/lib/load-env.ts`

**Before:**
```typescript
for (const envPath of candidatePaths) {
  if (!fs.existsSync(envPath)) continue;
  config({ path: envPath });
  break;  // ❌ Stopped at first file
}
```

**After:**
```typescript
for (const envPath of candidatePaths) {
  if (!fs.existsSync(envPath)) continue;
  config({ path: envPath, override: true });
  // ✅ Continues to merge all files
}
```

**Result:** Values from `server/.env` now properly override root `.env`

---

### 2. Root .env Updated (READY)
**File:** `.env`

Added SendGrid configuration with placeholder:
```bash
SENDGRID_API_KEY=REPLACE_WITH_NEW_SENDGRID_API_KEY
SENDGRID_VERIFICATION_TEMPLATE_ID=d-e6e34f349f364529a046d530ba3e03bd
SENDGRID_PASSWORD_RESET_TEMPLATE_ID=d-0f8c1353d4d44599bff28635cd39c167
SENDGRID_TEAM_INVITE_TEMPLATE_ID=d-04a0746f62e04d9bbd63f8f70ff7897b
EMAIL_FROM=noreply@varsityhub.app
```

---

## 🔑 Step-by-Step: Get New SendGrid API Key

### Step 1: Login to SendGrid
```bash
open https://app.sendgrid.com/
```

### Step 2: Create New API Key
1. Navigate to **Settings → API Keys**
2. Click **Create API Key**
3. **Name:** `VarsityHub Production v2024`
4. **Permissions:** Select **Full Access** (or minimum: Mail Send + Template Engine Read)
5. Click **Create & View**
6. **COPY THE KEY IMMEDIATELY** (you won't see it again)

### Step 3: Verify the Key Works
```bash
# Export the new key
export SENDGRID_API_KEY="SG.your-new-key-here"

# Test 1: Check authentication
curl -s -H "Authorization: Bearer $SENDGRID_API_KEY" \
  https://api.sendgrid.com/v3/scopes | jq '.scopes'

# Expected: 200 response with array of permission scopes
# ✅ Success: ["mail.send", "templates.read", ...]
# ❌ Failure: {"errors":[{"message":"unauthorized"}]}

# Test 2: Verify via Node.js
node -e "const sg=require('@sendgrid/client');sg.setApiKey(process.env.SENDGRID_API_KEY);sg.request({method:'GET',url:'/v3/user/credits'}).then(([res])=>console.log('Status:',res.statusCode));"

# Expected: Status: 200
```

---

## 📝 Step 4: Update All Configuration Files

Once you have a valid key, update these **4 locations**:

### 1. Root `.env` (Local Development)
**File:** `/Users/varsityhub/Desktop/CODE/VarsityHubMobile/.env`

```bash
# Replace this line:
SENDGRID_API_KEY=REPLACE_WITH_NEW_SENDGRID_API_KEY

# With your new key:
SENDGRID_API_KEY=SG.your-new-key-here
```

### 2. Server `.env` (Backup)
**File:** `/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/.env`

```bash
# Get your new SendGrid API key from https://app.sendgrid.com/settings/api_keys
SENDGRID_API_KEY=SG.your-new-api-key-here
```

### 3. Railway (Production)
**Platform:** Railway.app

```bash
# Option A: Via CLI
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
railway variables set SENDGRID_API_KEY="SG.your-new-key-here" --service api

# Option B: Via Dashboard
# 1. Go to https://railway.app/project/capable-trust
# 2. Select "api" service
# 3. Variables tab
# 4. Edit SENDGRID_API_KEY
# 5. Paste new key and save
# 6. Redeploy: railway redeploy --service api
```

### 4. GitHub Actions (CI/CD) - Optional
**Platform:** GitHub Secrets

If you're running email tests in CI:
```bash
# 1. Go to https://github.com/xsantcastx/VarsityHubMobile/settings/secrets/actions
# 2. Click "New repository secret"
# 3. Name: SENDGRID_API_KEY
# 4. Value: SG.your-new-key-here
# 5. Click "Add secret"
```

---

## ✅ Verification After Key Rotation

### Local Test
```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile/server

# Start server
npm run dev

# In another terminal, test email
curl -X POST http://localhost:4000/auth/test-email \
  -H "Content-Type: application/json" \
  -d '{"email":"emilmancero@gmail.com"}'

# Expected: {"success":true,"message":"Test email sent successfully"}
# Check inbox for verification email
```

### Production Test (Railway)
```bash
# 1. Check health endpoint
curl -s https://api-production-8ac3.up.railway.app/health | jq '{version, sendgrid: .integrations.sendgrid, warnings}'

# Expected:
# {
#   "version": "v2024.12.17-sendgrid-fix",
#   "sendgrid": true,
#   "warnings": []
# }

# 2. Test password reset
curl -X POST https://api-production-8ac3.up.railway.app/auth/password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email":"emilmancero@gmail.com"}'

# Expected: {"ok":true}
# Check inbox within 10 seconds
```

### Automated Test Script
```bash
# Run the comprehensive test
node /tmp/test-email-logic.js

# Expected output:
# ✅ API Key present: SG.your-new-key...
# ✅ API key valid (status 200)
# ✅ Template ID configured: d-e6e34f349f364529a046d530ba3e03bd
# ✅ Email send successful (sandbox mode)
# ✅ ALL TESTS PASSED - Email logic is working correctly!
```

---

## 🔒 Security Best Practices

### ✅ DO:
- Store production key in Railway environment variables (not in code)
- Use different keys for development and production
- Rotate keys every 90 days
- Set minimum required permissions (Mail Send + Template Engine)
- Monitor SendGrid Activity Feed for suspicious usage

### ❌ DON'T:
- Commit API keys to git (use `.gitignore` for `.env` files)
- Share keys in Slack/email/tickets
- Use the same key across multiple environments
- Grant "Full Access" unless necessary

---

## 📊 Environment Variable Priority

After the fix, environment variables load in this order:

```
1. System environment variables (highest priority)
   ↓
2. server/.env (overrides root)
   ↓
3. .env (root - base configuration)
```

**Example:**
- Root `.env`: `SENDGRID_API_KEY=old-key`
- `server/.env`: `SENDGRID_API_KEY=new-key`
- **Result:** Runtime uses `new-key` ✅

---

## 🧪 Test Checklist

After rotating the key, verify:

- [ ] Local server starts without warnings
- [ ] Health endpoint shows `sendgrid: true`
- [ ] Registration sends verification email
- [ ] Password reset sends reset email
- [ ] Team invitation sends invitation email
- [ ] Railway production shows `sendgrid: true`
- [ ] SendGrid Activity Feed shows successful deliveries

---

## 📋 Current Status

| Component | Status | Action Required |
|-----------|--------|-----------------|
| Environment Loading | ✅ Fixed | None - merged loading works |
| Root `.env` | ✅ Ready | Replace placeholder with new key |
| `server/.env` | ⚠️ Has invalid key | Replace with new key |
| Railway Variables | ❓ Unknown | Set new key after rotation |
| SendGrid API Key | ❌ Invalid (401) | **GET NEW KEY NOW** |
| Email Templates | ✅ Configured | No changes needed |

---

## 🚀 Quick Start Commands

```bash
# 1. Get new SendGrid API key
open https://app.sendgrid.com/settings/api_keys

# 2. Export and test locally
export SENDGRID_API_KEY="SG.your-new-key-here"
curl -s -H "Authorization: Bearer $SENDGRID_API_KEY" \
  https://api.sendgrid.com/v3/scopes | jq

# 3. Update .env files
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
sed -i '' 's/SENDGRID_API_KEY=.*/SENDGRID_API_KEY=SG.your-new-key-here/' .env
sed -i '' 's/SENDGRID_API_KEY=.*/SENDGRID_API_KEY=SG.your-new-key-here/' server/.env

# 4. Test locally
cd server && npm run dev
# In another terminal:
curl -X POST http://localhost:4000/auth/test-email

# 5. Update Railway
railway variables set SENDGRID_API_KEY="SG.your-new-key-here" --service api
railway redeploy --service api

# 6. Verify production
curl -s https://api-production-8ac3.up.railway.app/health | jq .integrations.sendgrid
```

---

## 📞 Support

If emails still don't send after rotation:

1. **Check logs:**
   ```bash
   # Local
   cd server && npm run dev
   # Look for: "✅ SendGrid email service initialized"
   
   # Production
   railway logs --service api --tail 100
   # Look for: "[email] ❌ Failed to send"
   ```

2. **Verify template IDs exist in SendGrid:**
   - Login to [SendGrid Dashboard](https://app.sendgrid.com/)
   - Navigate to **Email API → Dynamic Templates**
   - Confirm these IDs exist:
     - `d-e6e34f349f364529a046d530ba3e03bd` (Verification)
     - `d-0f8c1353d4d44599bff28635cd39c167` (Password Reset)
     - `d-04a0746f62e04d9bbd63f8f70ff7897b` (Team Invite)

3. **Check SendGrid Activity Feed:**
   - Dashboard → **Activity Feed**
   - Look for delivery attempts and errors
   - Check for "Bounced" or "Dropped" status

---

**Last Updated:** December 17, 2024  
**Next Action:** 🔴 Get new SendGrid API key from https://app.sendgrid.com/
