# Build Android AAB for Google Play Testing

## Quick Build Command

Run this in your terminal:

```bash
cd /Users/varsityhub/VarsityHubMobile
eas build --platform android --profile production
```

**Or for testing/internal track:**

```bash
eas build --platform android --profile preview
```

---

## What This Does

- Builds Android App Bundle (`.aab`) file
- Signs with your release keystore
- Uploads to EAS servers
- You'll get a download link when complete

**Build Time:** ~15-20 minutes

---

## Build Options

### Production Profile (Google Play Store)

```bash
eas build --platform android --profile production
```

- Creates AAB for Google Play Store
- Distribution: `store`
- Auto-increments version code

### Preview Profile (Internal Testing)

```bash
eas build --platform android --profile preview
```

- Creates AAB for internal testing track
- Distribution: `internal`
- Good for QA testing before production

---

## Monitor Build Progress

**Check build status:**

```bash
eas build:list --platform android
```

**View build logs:**

```bash
eas build:view [BUILD_ID]
```

**Web Dashboard:**
https://expo.dev/accounts/varsity-hub/projects/varsityhub/builds

---

## After Build Completes

1. **Download AAB:**
   - Build page will show download link
   - Or run: `eas build:download [BUILD_ID]`

2. **Upload to Google Play Console:**
   - Go to: https://play.google.com/console
   - Select your app
   - Go to: **Release** → **Production** (or **Internal testing**)
   - Click **Create new release**
   - Upload the `.aab` file
   - Add release notes
   - Review and roll out

---

## Current Configuration

- **App Version:** 1.0.1
- **Package:** com.varsithub.varsityhub
- **API URL:** https://api-production-8ac3.up.railway.app
- **Auto-increment:** Enabled

---

## Troubleshooting

**If build fails:**

```bash
# Check build logs
eas build:view [BUILD_ID]

# Verify credentials
eas credentials

# Check EAS status
# Visit: https://status.expo.dev
```

**Common Issues:**

- Keystore not found → Check `service-account-key.json` exists
- API key missing → Verify environment variables in `eas.json`
- Build timeout → Retry the build

---

## Next Steps After Build

1. ✅ Build completes (~15-20 min)
2. ✅ Download `.aab` file
3. ✅ Upload to Google Play Console
4. ✅ Add release notes
5. ✅ Test on internal track
6. ✅ Promote to production when ready

---

**Ready to build? Run:**

```bash
eas build --platform android --profile production
```
