# Android Upload Key Reset - EXACT Navigation Steps

## You're Currently On: ❌ Wrong Page
- **Play Integrity API settings** (this is NOT where you reset the upload key)

## Where You Need To Go: ✅ Correct Location

### Option 1: Via Release → Setup
1. **Left sidebar** → **Release** → **Setup** → **App integrity**
2. Scroll down past "Play Integrity API settings"
3. Look for section: **"App signing"** or **"Upload key certificate"**
4. You should see your current upload key SHA-1: `FD:A8:46:D4:...`
5. Click **"Request upload key reset"** or **"Reset upload key"** button

### Option 2: Via Test and release → App integrity
1. **Left sidebar** → **Test and release** → **App integrity**
2. You should see tabs or sections:
   - **"Play Integrity API"** (where you are now - WRONG)
   - **"App signing"** or **"Upload key certificate"** ← **GO HERE**
3. Click on **"App signing"** tab/section
4. Find **"Upload key certificate"** section
5. Click **"Request upload key reset"**

### Option 3: Direct URL (if you know your app ID)
Go to:
```
https://play.google.com/console/developers/[YOUR_DEVELOPER_ID]/app/[YOUR_APP_ID]/app-signing
```

## What You're Looking For
- Section title: **"Upload key certificate"** or **"App signing"**
- Shows: **SHA-1 fingerprint** `FD:A8:46:D4:02:0D:4F:6C:85:04:00:59:BB:1E:10:DF:50:FE:BE:AF`
- Button: **"Request upload key reset"** or **"Reset upload key"** or **"Manage upload key"**

## If You Still Don't See It
The upload key reset option might be:
- Under **"Advanced settings"** in the sidebar
- Or your account might need **"App signing by Google Play"** enabled first
- Or you might need to contact Google Play support if the option isn't available

## Screenshot What You See
If you still can't find it, take a screenshot of:
- The **"App integrity"** page (full page, scroll down)
- Or the **"App signing"** section if you see it

And I'll tell you exactly where to click.
