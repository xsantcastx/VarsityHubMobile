# How to Find Your Apple Team ID

**Quick Guide** - Multiple methods to find your Apple Developer Team ID

---

## 🎯 Method 1: Apple Developer Portal (EASIEST)

### Steps:

1. **Go to Apple Developer Portal**
   - Open: https://developer.apple.com/account
   - Sign in with your Apple ID (`sanchezemil82@gmail.com` or the one you use)

2. **Navigate to Membership**
   - Click **Membership** in the left sidebar
   - Or go directly to: https://developer.apple.com/account/#/membership/

3. **Find Team ID**
   - Look for **Team ID** section
   - It's a 10-character string (letters and numbers)
   - Example format: `XXXXXXXXXX` or `ABC123DEF4`

**Location in Portal:**

```
Developer Portal
└── Membership
    └── Team ID: XXXXXXXXXX  ← Here!
```

---

## 🎯 Method 2: App Store Connect

### Steps:

1. **Go to App Store Connect**
   - Open: https://appstoreconnect.apple.com
   - Sign in with your Apple ID

2. **Navigate to Users and Access**
   - Click **Users and Access** in the top menu
   - Or go directly to: https://appstoreconnect.apple.com/access/users

3. **Find Team ID**
   - Look at the top of the page
   - Your **Team ID** is displayed near your team name
   - Format: 10 characters (letters and numbers)

**Location in App Store Connect:**

```
App Store Connect
└── Users and Access
    └── Team: Your Team Name
        Team ID: XXXXXXXXXX  ← Here!
```

---

## 🎯 Method 3: Xcode (If Installed)

### Steps:

1. **Open Xcode**

   ```bash
   open -a Xcode
   ```

2. **Go to Settings**
   - Xcode → Settings (or Preferences on older versions)
   - Or press `⌘,` (Command + Comma)

3. **Select Accounts Tab**
   - Click **Accounts** tab at the top

4. **Select Your Apple ID**
   - Click on your Apple ID in the left list
   - If not there, click **+** to add it
   - Sign in if prompted

5. **Find Team ID**
   - Your **Team ID** is shown under your name
   - Format: `XXXXXXXXXX` (10 characters)

**Location in Xcode:**

```
Xcode → Settings → Accounts
└── Apple ID: your@email.com
    └── Team: Your Team Name
        Team ID: XXXXXXXXXX  ← Here!
```

---

## 🎯 Method 4: Terminal/Command Line

### Option A: Using EAS CLI (If Logged In)

```bash
# Check if logged in
eas whoami

# Try to see credentials (will show Team ID if authenticated)
eas credentials

# Or try device creation (will show Team ID)
eas device:create
```

### Option B: Check Xcode Command Line Tools

```bash
# If you have Xcode installed
security find-identity -v -p codesigning

# Look for "Apple Development: Your Name (XXXXXXXXXX)"
# The XXXXXXXXXX part is your Team ID
```

### Option C: Check Xcode Derived Data

```bash
# Check if you have any Xcode projects that show Team ID
find ~/Library/Developer/Xcode/DerivedData -name "*.xcodeproj" -exec grep -r "DEVELOPMENT_TEAM" {} \; 2>/dev/null | head -5
```

---

## 🎯 Method 5: Keychain Access (Mac Only)

### Steps:

1. **Open Keychain Access**
   - Applications → Utilities → Keychain Access
   - Or search "Keychain Access" in Spotlight

2. **Search for Apple**
   - In search box, type "Apple Development"
   - Or "Apple Distribution"

3. **View Certificate**
   - Double-click on a certificate
   - Click **Details** arrow
   - Look for **Organizational Unit** field
   - Your Team ID is shown there (10 characters)

---

## 🎯 Method 6: Check Existing Builds/Credentials

If you've built before:

### Check EAS Build Logs

```bash
# List your builds
eas build:list

# View a build (will show Team ID in logs)
eas build:view <BUILD_ID>
```

### Check Git History

```bash
# Check if Team ID was committed before
git log --all --full-history -- "eas.json" | grep -i "team"
```

---

## 📋 What Your Team ID Looks Like

**Format:**

- 10 characters (letters and numbers)
- Example: `ABC123DEF4`
- Example: `XYZ987ABC6`
- Example: `1234567890`

**NOT:**

- ❌ 8 characters (that's Bundle ID prefix)
- ❌ UUID format (that's App Store Connect App ID)
- ❌ Email address (that's your Apple ID)

---

## 🔍 Verification

Once you find your Team ID, verify it:

1. **It should be 10 characters**
2. **It should match in Apple Developer Portal and App Store Connect**
3. **It should match what Xcode shows** (if you use Xcode)

---

## ✅ Quick Checklist

- [ ] Found Team ID from Apple Developer Portal
- [ ] Verified it's 10 characters
- [ ] Verified it matches in App Store Connect
- [ ] Ready to update `eas.json`

---

## 🚀 Next Steps

After finding your Team ID:

1. **Update `eas.json`**:

   ```json
   {
     "submit": {
       "production": {
         "ios": {
           "appleId": "sanchezemil82@gmail.com",
           "ascAppId": "6754257357",
           "appleTeamId": "YOUR_FOUND_TEAM_ID" // ← Replace this
         }
       }
     }
   }
   ```

2. **Save and commit**:

   ```bash
   git add eas.json
   git commit -m "fix: update Apple Team ID"
   git push
   ```

3. **Retry build**:
   ```bash
   eas build --platform ios --profile production
   ```

---

## 🆘 Still Can't Find It?

### Contact Apple Developer Support

If you can't find your Team ID:

1. **Apple Developer Support**:
   - https://developer.apple.com/support
   - They can help you find your Team ID

2. **Check Your Email**
   - Search for emails from Apple Developer
   - Team ID might be in welcome emails or receipts

3. **Check Receipts**
   - Look for Apple Developer Program payment receipts
   - Team ID is often on receipts

---

## 📚 Related Documentation

- [Apple Developer Portal](https://developer.apple.com/account)
- [App Store Connect](https://appstoreconnect.apple.com)
- [EAS Documentation](https://docs.expo.dev/submit/ios/)

---

**Most Common Method**: Apple Developer Portal → Membership → Team ID

**Fastest Method**: Xcode → Settings → Accounts (if you have Xcode)

---

**Last Updated**: January 17, 2025
