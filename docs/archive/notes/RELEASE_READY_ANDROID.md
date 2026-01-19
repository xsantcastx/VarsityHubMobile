# VarsityHub Android Release Guide (Google Play)

**Status**: ✅ Ready once keystore + checklist complete  
**Last Updated**: December 6, 2025

---

## 🚀 TL;DR

1. Ensure keystore is configured (`ANDROID_KEYSTORE_SETUP.md`).
2. Run `./scripts/pre-submission-check-android.sh`.
3. Run `./scripts/build-release-android.sh` to generate the signed AAB.
4. Upload `android/app/build/outputs/bundle/release/app-release.aab` to Google Play Console.
5. Complete Play Console metadata (screenshots, description, content rating) and roll out.

Total time: ~45 minutes + Google review (24-48 hours).

---

## 📦 Deliverables Inside This Repo

| Item | Path | Purpose |
|------|------|---------|
| Build script | `scripts/build-release-android.sh` | Cleans + builds signed AAB/APK |
| Pre-flight checklist | `scripts/pre-submission-check-android.sh` | Verifies signing + config |
| Keystore guide | `ANDROID_KEYSTORE_SETUP.md` | Step-by-step signing setup |
| Release runbook | `RELEASE_READY_ANDROID.md` (this file) | Submission instructions |

---

## ✅ Pre-Submission Checklist

| Task | Command / Location | Status |
|------|-------------------|--------|
| Configure keystore secrets | `ANDROID_KEYSTORE_SETUP.md` | ⏳ |
| Verify Gradle config | `./scripts/pre-submission-check-android.sh` | ⏳ |
| Run security scan | `snyk_code_scan /Users/varsityhub/Desktop/CODE/VarsityHubMobile` | ⏳ |
| Remove stray `console.log` | `server/src/**/*.ts` | ⏳ |
| Generate release artifacts | `./scripts/build-release-android.sh` | ⏳ |
| Upload AAB to Play Console | UI step | ⏳ |
| Complete store listing | UI step | ⏳ |

---

## 🧪 Validation Steps

```bash
# 1. Confirm signing + config
./scripts/pre-submission-check-android.sh

# 2. Generate release build
./scripts/build-release-android.sh

# 3. Optional – install APK locally
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Outputs:
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

---

## 🛠 Google Play Console Flow

1. **Internal Testing**
   - Upload fresh AAB.
   - Add release notes (summary of changes).
   - Start internal testing to verify install on physical devices.

2. **Production Track**
   - Reuse the tested build or promote from internal track.
   - Ensure country distribution + pricing matches expectations.

3. **Store Listing Requirements**
   - Title, short description, full description.
   - Screenshots: 1080x1920 (phone), optional tablet assets.
   - Feature graphic (1024x500) optional but recommended.
   - Content rating questionnaire.
   - Data safety form (mark analytics + account data).

4. **Review & Rollout**
   - Submit for review.
   - Monitor “Pre-launch report” for issues flagged by Firebase Test Lab.

---

## 🔐 Signing & Security

- The release keystore is loaded via `MYAPP_UPLOAD_*` properties in `android/gradle.properties`.
- Store the `.keystore` file + passwords securely (never commit them).
- Play App Signing is optional; if enabled, follow Google’s key upload wizard.
- Verify no debug logging or test endpoints are exposed before uploading.

---

## 📋 Metadata Reference

| Field | Value |
|-------|-------|
| Package name | `com.xsantcastx.varsityhub` |
| Min SDK | 24 (Android 7.0) |
| Target SDK | 34 (from `gradle.properties`) |
| Version | `versionCode` in `android/app/build.gradle` (increment each release) |
| Contact email | Same as iOS submission |
| Privacy policy | https://varsityhub.app/privacy |
| Website | https://varsityhub.app |
| Support | https://varsityhub.app/support |

---

## 🕒 Release Timeline Estimate

| Step | Duration |
|------|----------|
| Keystore verification | 5 min |
| Pre-submission check | 2 min |
| Build script | 10-15 min |
| Play Console upload | 5 min |
| Metadata + review submission | 20 min |
| Google review | 24-72 hours |

---

## 📞 Need Help?

- Signing issues: `ANDROID_KEYSTORE_SETUP.md`
- Build failures: check `android/app/build.gradle` + `.gradle` logs
- Store listing questions: Play Console “Learn more” links
- Automation tweaks: update scripts in `scripts/`

Once these steps are completed, VarsityHub will have parity between iOS and Android delivery pipelines. 🚀
