# VarsityHub Server - Quick Reference

## 🔗 Production URL
```
https://api-production-8ac3.up.railway.app
```

## ⚡ Quick Commands

### Deploy Updates
```powershell
cd server
railway up
```

### View Logs
```powershell
railway logs
```

### Check Status
```powershell
railway status
```

### Open Dashboard
```powershell
railway open
```

## 🧪 Quick Test
```powershell
curl https://api-production-8ac3.up.railway.app/health
```
Expected: `{"ok":true}`

## 📱 Mobile App Config
```typescript
const API_BASE_URL = 'https://api-production-8ac3.up.railway.app';
```

## 🔑 Environment Variables
All configured in Railway Dashboard ✅
- DATABASE_URL
- JWT_SECRET
- CLOUDINARY_*
- STRIPE_*
- SMTP_*
- GOOGLE_MAPS_API_KEY

## 📊 Monitoring
- **Dashboard:** https://railway.com/project/22899614-5ae1-47e9-bdd6-7f6d5ce5619e
- **Service:** https://railway.com/project/22899614-5ae1-47e9-bdd6-7f6d5ce5619e/service/6bf477a3-56a7-44d0-aa29-ff86a76cdc02

## ✅ Status
- [x] Server: LIVE
- [x] Database: Connected
- [x] Migrations: Auto-run
- [x] Health: OK

---
*Last updated: November 1, 2025*
