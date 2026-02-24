# VarsityHub Android Keystore Setup

Google Play requires every release to be signed with a private keystore. Use the steps below **once per team** and store the credentials securely (1Password, Bitwarden, etc.).

---

## 1. Generate the keystore

```bash
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile/android/app
keytool -genkeypair \
  -v \
  -storetype JKS \
  -keystore varsityhub-release.keystore \
  -alias varsityhub \
  -keyalg RSA \
  -keysize 2048 \
  -validity 3650
```

Keep note of:

| Item | Example | Notes |
|------|---------|-------|
| Keystore file | `android/app/varsityhub-release.keystore` | Include in secure storage, **never commit** |
| Store password | `********` | Password for the keystore file |
| Key alias | `varsityhub` | Identifier for the key inside the keystore |
| Key password | `********` | Password for the alias above |

---

## 2. Configure `android/gradle.properties`

Append the following (replace the placeholder values):

```
MYAPP_UPLOAD_STORE_FILE=app/varsityhub-release.keystore
MYAPP_UPLOAD_STORE_PASSWORD=your-store-password
MYAPP_UPLOAD_KEY_ALIAS=varsityhub
MYAPP_UPLOAD_KEY_PASSWORD=your-key-password
```

These properties are read by `android/app/build.gradle` and the automation scripts. Paths can be absolute or relative to the `android` directory.

---

## 3. Verify signing locally

Run the Android pre-submission check:

```bash
./scripts/pre-submission-check-android.sh
```

This ensures Gradle finds the keystore and that release builds will be signed correctly.

---

## 4. Back up credentials

1. Upload the `.keystore` file and passwords to your secure vault.
2. Share with the minimal number of teammates.
3. Do **not** email or commit the file.

---

Once these steps are complete, `./scripts/build-release-android.sh` will produce signed AAB/APK artifacts ready for Google Play Console. If you ever rotate the keystore, update the credentials in both the vault and `gradle.properties`.
