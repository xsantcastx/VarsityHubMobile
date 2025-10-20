# Troubleshooting Guide

Common issues and solutions for VarsityHub development and deployment.

---

## Table of Contents

1. [Setup Issues](#setup-issues)
2. [Development Issues](#development-issues)
3. [Build Issues](#build-issues)
4. [Authentication Issues](#authentication-issues)
5. [Payment Issues](#payment-issues)
6. [Backend Issues](#backend-issues)
7. [Deployment Issues](#deployment-issues)
8. [Platform-Specific Issues](#platform-specific-issues)

---

## Setup Issues

### npm install fails

**Error:** `ERESOLVE unable to resolve dependency tree`

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and lock file
rm -rf node_modules package-lock.json

# Reinstall
npm install --legacy-peer-deps
```

### Expo CLI not found

**Error:** `'expo' is not recognized as an internal or external command`

**Solution:**
```bash
# Install Expo CLI globally
npm install -g expo-cli

# Or use npx
npx expo start
```

### Metro bundler port already in use

**Error:** `Something is already running on port 8081`

**Solution (Windows PowerShell):**
```powershell
# Find process using port 8081
netstat -ano | findstr :8081

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F

# Or use fixed port
npm run start:ci
```

**Solution (Mac/Linux):**
```bash
# Find and kill process
lsof -ti:8081 | xargs kill -9

# Or use different port
npx expo start --port 8082
```

### Database connection fails

**Error:** `Can't reach database server at localhost:5432`

**Solution:**
```bash
# Check PostgreSQL is running
# Windows: Check Services
# Mac: brew services list

# Start PostgreSQL
# Windows: Start service from Services
# Mac: brew services start postgresql

# Check connection string in server/.env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/DATABASE
```

---

## Development Issues

### Hot reload not working

**Symptoms:**
- Changes not reflecting in app
- Need to manually refresh

**Solution:**
```bash
# Clear cache
npx expo start --clear

# Or reset Metro bundler
# Press Shift+R in terminal
```

### TypeScript errors everywhere

**Error:** `Cannot find module '@/components/...'`

**Solution:**
```bash
# Restart TypeScript server
# In VS Code: Ctrl+Shift+P → "TypeScript: Restart TS Server"

# Check tsconfig.json paths are correct
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

### Images not loading

**Symptoms:**
- Images show broken icon
- `require()` or `uri` not working

**Solution:**

**For local images:**
```typescript
// ✅ Correct
import logo from '@/assets/images/logo.png';
<Image source={logo} />

// ❌ Wrong
<Image source={require('../../../assets/images/logo.png')} />
```

**For remote images:**
```typescript
// ✅ Correct
<Image source={{ uri: 'https://example.com/image.jpg' }} />

// Add width/height for remote images
<Image 
  source={{ uri: '...' }} 
  style={{ width: 200, height: 200 }}
/>
```

### Dark mode not working

**Symptoms:**
- Colors don't change when switching themes
- Hardcoded colors visible

**Solution:**
```typescript
// ✅ Use theme colors
import { useTheme } from '@/context/ThemeContext';

const { colors } = useTheme();
<Text style={{ color: colors.text }}>Hello</Text>

// ❌ Don't hardcode
<Text style={{ color: '#000' }}>Hello</Text>
```

### Safe area issues

**Symptoms:**
- Content hidden behind status bar
- Content hidden behind notch
- Bottom content cut off

**Solution:**
```typescript
import { SafeAreaView } from 'react-native-safe-area-context';

// ✅ Wrap screens in SafeAreaView
function MyScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View>{/* Content */}</View>
    </SafeAreaView>
  );
}
```

---

## Build Issues

### EAS Build fails

**Error:** `Build failed with exit code 1`

**Check logs:**
```bash
# View build logs
eas build:list
eas build:view <BUILD_ID>
```

**Common causes:**
1. **Missing credentials**
   ```bash
   eas credentials
   ```

2. **Invalid app.json**
   - Check JSON syntax
   - Verify bundle identifier
   - Check version numbers

3. **Native module issues**
   ```bash
   # Clear cache and retry
   eas build --platform ios --clear-cache
   ```

### Android build fails

**Error:** `Execution failed for task ':app:mergeDexRelease'`

**Solution:**

In `android/app/build.gradle`:
```gradle
android {
    defaultConfig {
        multiDexEnabled true
    }
}
```

### iOS build fails

**Error:** `Code signing issue`

**Solution:**
```bash
# Regenerate credentials
eas credentials

# Select: iOS → Distribution Certificate → Remove → Regenerate
```

### Build succeeds but app crashes on launch

**Check:**
1. Environment variables are set
2. API URL is correct
3. Backend is running
4. Check native logs:

```bash
# iOS
npx react-native log-ios

# Android
npx react-native log-android
```

---

## Authentication Issues

### Google OAuth fails

**Error:** "Sign in with Google failed"

**Solutions:**

**1. Check Client IDs**
```properties
# Frontend .env - verify these exist and are correct
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
```

**2. Verify Package Name/Bundle ID**
```json
// app.json - must match Google Cloud Console
{
  "expo": {
    "android": {
      "package": "com.varsityhub.mobile"
    },
    "ios": {
      "bundleIdentifier": "com.varsityhub.mobile"
    }
  }
}
```

**3. Check SHA-1 Fingerprint (Android)**
```bash
# Get development SHA-1
cd $env:USERPROFILE\.android
keytool -list -v -keystore debug.keystore -alias androiddebugkey -storepass android -keypass android

# Add to Google Cloud Console → Credentials → Android client
```

**4. Verify OAuth Consent Screen**
- Go to Google Cloud Console
- Check OAuth consent screen is **published**
- Add test users if in testing mode

### JWT Token expired

**Error:** `401 Unauthorized` or "Token expired"

**Solution:**
```typescript
// Clear stored token
import AsyncStorage from '@react-native-async-storage/async-storage';

await AsyncStorage.removeItem('token');

// Redirect to login
router.replace('/');
```

### Password reset email not received

**Check:**
1. **Email service configured** (server/.env)
2. **Check spam folder**
3. **Verify email address is correct**
4. **Check server logs:**

```bash
cd server
npm run dev
# Look for email sending errors
```

---

## Payment Issues

### Stripe payment fails

**Error:** "Payment failed"

**Check:**

**1. Test cards only work in test mode**
```properties
# server/.env - check you're using test key
STRIPE_SECRET_KEY=sk_test_...  # For development

# Test card
Card: 4242 4242 4242 4242
Exp: 12/34
CVC: 123
ZIP: 12345
```

**2. Webhook secret is correct**
```bash
# Development - use Stripe CLI
stripe listen --forward-to localhost:4000/api/webhooks/stripe

# Copy webhook secret to server/.env
STRIPE_WEBHOOK_SECRET=whsec_...
```

**3. Price IDs are correct**
```properties
# server/.env - verify these match Stripe Dashboard
STRIPE_PRICE_VETERAN=price_1SCd6HRuB2a0vFjp1QlboTEv
STRIPE_PRICE_LEGEND=price_1SCd6IRuB2a0vFjpQOSdctN4
```

### Payment redirect not working

**Symptoms:**
- User completes payment
- Not redirected back to app
- Subscription not activated

**Solution:**

**1. Check return URLs:**
```typescript
// In payment creation
const session = await stripe.checkout.sessions.create({
  success_url: `${process.env.APP_BASE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.APP_BASE_URL}/payment-cancel`,
});
```

**2. Check deep linking configured:**
```json
// app.json
{
  "expo": {
    "scheme": "varsityhubmobile"
  }
}
```

**3. Handle deep link in app:**
```typescript
// App.tsx or _layout.tsx
import * as Linking from 'expo-linking';

Linking.addEventListener('url', (event) => {
  const { path, queryParams } = Linking.parse(event.url);
  // Handle payment success/cancel
});
```

### Subscription not showing as active

**Check:**
1. **Webhook received** (check Stripe Dashboard → Webhooks)
2. **Database updated** (check users table, subscription column)
3. **Frontend refetching user data**

```typescript
// After successful payment
const response = await fetch('/api/auth/me');
const user = await response.json();
// user.subscription should be 'VETERAN' or 'LEGEND'
```

---

## Backend Issues

### Server won't start

**Error:** `Error: listen EADDRINUSE: address already in use :::4000`

**Solution:**
```bash
# Find process using port 4000
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:4000 | xargs kill -9
```

### Database migration fails

**Error:** `Prisma migrate dev failed`

**Solution:**
```bash
cd server

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# Or fix migration manually
npx prisma migrate resolve --rolled-back "migration_name"
npx prisma migrate deploy
```

### CORS errors

**Error:** `Access to fetch blocked by CORS policy`

**Solution:**

In `server/src/index.ts`:
```typescript
import cors from 'cors';

app.use(cors({
  origin: [
    'http://localhost:8081',  // Expo dev server
    'http://localhost:19000', // Alternative Expo port
    'http://localhost:19006', // Expo web
    process.env.APP_BASE_URL, // Production URL
  ],
  credentials: true,
}));
```

Or in `server/.env`:
```properties
ALLOWED_ORIGINS=http://localhost:8081,http://localhost:19000,https://varsityhub.com
```

### API returns 500 error

**Check server logs:**
```bash
cd server
npm run dev
# Watch for error stack traces
```

**Common causes:**
1. Database connection failed
2. Missing environment variable
3. Invalid request body
4. Unhandled promise rejection

**Enable detailed logging:**
```typescript
// server/src/middleware/errorHandler.ts
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: process.env.NODE_ENV === 'development' 
      ? err.message 
      : 'Internal server error'
  });
});
```

---

## Deployment Issues

### Railway deployment fails

**Check:**
1. **Build logs** in Railway dashboard
2. **Environment variables** are set
3. **Database connected**
4. **Port configuration:**

```javascript
// server/src/index.ts
const PORT = process.env.PORT || 4000;
app.listen(PORT);
```

### App can't connect to backend

**Error:** `Network request failed`

**Check:**

**1. API URL is correct:**
```properties
# Frontend .env
EXPO_PUBLIC_API_URL=https://api-production-8ac3.up.railway.app
```

**2. Backend is running:**
- Visit API URL in browser
- Should see: "VarsityHub API is running"

**3. Network permissions (app.json):**
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "NSAppTransportSecurity": {
          "NSAllowsArbitraryLoads": false
        }
      }
    }
  }
}
```

### Environment variables not working

**Symptoms:**
- `process.env.EXPO_PUBLIC_API_URL` is undefined
- Variables work locally but not in build

**Solution:**

**1. Restart Expo after adding .env:**
```bash
# Kill Expo
# Edit .env
# Restart
npm start
```

**2. Use EXPO_PUBLIC_ prefix:**
```properties
# ✅ Accessible in app
EXPO_PUBLIC_API_URL=...

# ❌ Not accessible (server-side only)
API_URL=...
```

**3. Set in EAS build:**
```json
// eas.json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_API_URL": "https://api-production-8ac3.up.railway.app"
      }
    }
  }
}
```

---

## Platform-Specific Issues

### iOS Simulator

**Simulator won't open**
```bash
# Reset simulator
xcrun simctl erase all

# Open manually
open -a Simulator
```

**App crashes on simulator**
- Check iOS version compatibility
- Clear derived data (Xcode → Product → Clean Build Folder)

### Android Emulator

**Emulator won't start**
```bash
# Check if HAXM/Hypervisor is installed
# Windows: Check Hyper-V is enabled
# Mac: Check System Preferences → Security

# Start manually
$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe @Medium_Phone_API_36.0
```

**"Can't find service: package" error**
```bash
# Restart ADB
adb kill-server
adb start-server
adb wait-for-device
adb devices

# Then run app
npm run android:ci
```

**App crashes on emulator**
- Check Android API level (target SDK 34+)
- Clear app data (Settings → Apps → VarsityHub → Clear Data)
- Wipe emulator data and restart

### Windows-Specific

**PowerShell execution policy**
```powershell
# If scripts won't run
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Path issues**
```powershell
# Add Node to PATH
# Control Panel → System → Advanced → Environment Variables
# Add: C:\Program Files\nodejs\
```

### Mac-Specific

**Xcode command line tools**
```bash
# Install if missing
xcode-select --install
```

**CocoaPods issues**
```bash
# Update CocoaPods
sudo gem install cocoapods

# Reinstall pods
cd ios
pod deintegrate
pod install
```

---

## Getting Help

### Check Logs

**Expo logs:**
```bash
npm start
# Press 'j' to open debugger
```

**Backend logs:**
```bash
cd server
npm run dev
# Watch console output
```

**Build logs:**
```bash
eas build:list
eas build:view <BUILD_ID>
```

### Debugging Tools

**React Native Debugger:**
```bash
# Install
npm install -g react-native-debugger

# Open
react-native-debugger
```

**Flipper:**
- Download from [fbflipper.com](https://fbflipper.com/)
- Great for network requests, layout inspection, logs

**Prisma Studio (Database):**
```bash
cd server
npx prisma studio
# Opens http://localhost:5555
```

### Common Commands Recap

```bash
# Clear all caches
npx expo start --clear
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# Reset database
cd server
npx prisma migrate reset

# Rebuild app
eas build --platform ios --clear-cache

# View logs
eas build:list
eas build:view <BUILD_ID>

# Test backend
cd server
npm run dev
curl http://localhost:4000
```

### Contact Support

If you're still stuck:

1. **Check documentation:**
   - [Setup Guide](./01-SETUP.md)
   - [Development Guide](./04-DEVELOPMENT.md)
   - [Production Guide](./07-PRODUCTION.md)

2. **Search GitHub issues:**
   - Expo: [github.com/expo/expo/issues](https://github.com/expo/expo/issues)
   - React Native: [github.com/facebook/react-native/issues](https://github.com/facebook/react-native/issues)

3. **Ask community:**
   - Expo Discord: [chat.expo.dev](https://chat.expo.dev)
   - Stack Overflow: Tag `expo` or `react-native`

4. **Email support:**
   - support@varsityhub.com

---

## Error Code Reference

| Code | Meaning | Solution |
|------|---------|----------|
| 401 | Unauthorized | Check authentication token |
| 403 | Forbidden | Check user permissions |
| 404 | Not Found | Check API endpoint URL |
| 422 | Validation Error | Check request body format |
| 500 | Server Error | Check backend logs |
| CORS | CORS Error | Check ALLOWED_ORIGINS |
| ECONNREFUSED | Connection Refused | Backend not running |
| EADDRINUSE | Port in use | Kill process using port |

---

**Still need help?** Contact the development team or check the [documentation index](./README.md).
