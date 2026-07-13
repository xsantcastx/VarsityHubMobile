# Android Keystore Reset - Exact Steps

## Current Situation

- **Google Play expects SHA-1**: `FD:A8:46:D4:02:0D:4F:6C:85:04:00:59:BB:1E:10:DF:50:FE:BE:AF`
- **EAS keystore SHA-1**: `E1:10:61:6D:1F:E3:11:60:1A:1A:3F:FC:E1:54:F9:2C:7B:AE:1B:5B`
- **Status**: Mismatch - Play Console blocks uploads

## Solution: Request Upload Key Reset in Play Console

### Step 1: Go to Play Console

1. Open [Google Play Console](https://play.google.com/console)
2. Select your app: **VarsityHub** (package: `com.varsithub.varsityhub`)

### Step 2: Navigate to App Integrity

1. Left sidebar → **Release** → **Setup** → **App integrity**
2. Scroll to **Upload key certificate** section

### Step 3: Request Upload Key Reset

1. Click **Request upload key reset** (or **Reset upload key**)
2. Follow the prompts:
   - You'll need to upload a **new upload certificate** (PEM file)
   - Or Google may allow you to reset without uploading (depends on your account)

### Step 4: Get Current EAS Keystore Certificate (if needed)

If Play Console asks for a new certificate, get it from EAS:

```bash
eas credentials --platform android
# Choose: production → Keystore → Download keystore
# Then export certificate:
keytool -export -rfc -keystore downloaded-keystore.jks -alias YOUR_ALIAS -file upload_cert.pem
```

Upload `upload_cert.pem` to Play Console.

### Step 5: Wait for Approval

- Google typically approves within **24-48 hours** (sometimes faster)
- You'll get an email when approved

### Step 6: Rebuild After Approval

Once approved, rebuild:

```bash
eas build --platform android --profile production
```

The new AAB will be signed with EAS's keystore (SHA-1: `E1:10:61...`) and Play Console will accept it.

## What I've Configured

- ✅ `eas.json` → Android production → `credentialsSource: "auto"` (EAS manages keystore)
- ✅ After reset approval, EAS will use its managed keystore automatically
- ✅ Next build will work

## Current Status

- ⏳ **Waiting for**: Play Console upload key reset approval
- ✅ **Ready**: EAS configured to use managed credentials after reset
