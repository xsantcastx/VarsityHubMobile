# Google Play Production Deployment Guide

## Current Build Status
- **Build ID**: 6d051ad7-43e7-49ea-87e7-4d14f100349f
- **Version**: 1.0.1 (versionCode: 8)
- **Platform**: Android (.aab)
- **Status**: Building on EAS servers
- **Logs**: https://expo.dev/accounts/varsity-hub/projects/varsityhub/builds/6d051ad7-43e7-49ea-87e7-4d14f100349f

---

## Step 1: Download Your .aab File

Once the build completes (10-20 minutes):

1. Go to: https://expo.dev/accounts/varsity-hub/projects/varsityhub/builds/6d051ad7-43e7-49ea-87e7-4d14f100349f
2. Click "Download" to get your `.aab` file
3. Save it to a secure location

---

## Step 2: Google Play Console Setup

### A. Access Your Google Play Console
1. Go to: https://play.google.com/console
2. Sign in with your Google account
3. Select or create your VarsityHub app

### B. Complete App Information (First Time Only)

#### Required Information:
- [ ] **App Name**: VarsityHub
- [ ] **Package Name**: com.varsithub.varsityhub (already set)
- [ ] **Short Description**: (max 80 characters)
  ```
  Sports team management and social platform for athletes, coaches, and fans
  ```
- [ ] **Full Description**: (max 4000 characters)
  ```
  VarsityHub is the ultimate sports team management and social platform connecting athletes, coaches, and fans.

  KEY FEATURES:
  • Team Management - Organize rosters, schedules, and events
  • Social Feed - Share highlights, updates, and game results
  • Event Planning - Create and manage team events and fan gatherings
  • Live Updates - Real-time scores and game updates
  • Direct Messaging - Connect with teammates and coaches
  • Ad Platform - Local businesses can reach sports communities

  Perfect for:
  - High school and college sports teams
  - Coaches managing multiple teams
  - Athletes sharing their journey
  - Fans staying connected with their favorite teams
  - Local businesses supporting youth sports

  Download VarsityHub today and join the sports community!
  ```

#### App Category:
- [ ] **Category**: Sports
- [ ] **Tags**: Sports, Social, Team Management, Athletics

---

## Step 3: Store Listing Assets

### Required Graphics (create these):

#### App Icon
- Size: 512x512 px
- Format: PNG (32-bit)
- Location: Your current icon is at `assets/images/icon.png`

#### Feature Graphic
- Size: 1024x500 px
- Format: PNG or JPG
- Required for store listing
- Should showcase your app's key features

#### Screenshots (REQUIRED - minimum 2)
You need screenshots for:
- **Phone**:
  - Minimum 2 screenshots
  - Recommended: 4-8 screenshots
  - Dimensions: 1080x1920 px (16:9 or 9:16)
  - Show key features: Feed, Events, Team Pages, Messaging

- **Tablet** (optional but recommended):
  - Minimum 2 screenshots
  - 7-inch: 1024x600 px
  - 10-inch: 1920x1200 px

#### Promo Video (optional)
- YouTube URL
- Shows app in action

---

## Step 4: Content Rating

Complete the content rating questionnaire:
1. Go to: Google Play Console → Content rating
2. Answer questions about:
   - Violence
   - Sexual content
   - Language
   - Controlled substances
   - User interaction features (you have social features!)

For VarsityHub, likely ratings:
- ESRB: Everyone
- PEGI: 3
- USK: 0

**Important**: You have user-generated content and social features - make sure to indicate this!

---

## Step 5: Privacy Policy

**CRITICAL**: You must provide a privacy policy URL

Create a privacy policy that covers:
- What data you collect (location, photos, user profiles)
- How you use it (team management, social features)
- Third-party services (Google Maps, payments)
- User rights (data deletion, access)

Host it at: `https://varsityhub.app/privacy` (or similar)

---

## Step 6: Upload Your .aab to Production

### Manual Upload (First Release):

1. **Go to Production Track**:
   - Navigate to: Release → Production
   - Click "Create new release"

2. **Upload the .aab**:
   - Click "Upload"
   - Select your downloaded `.aab` file
   - Wait for upload to complete

3. **Release Details**:
   - Release name: `1.0.1`
   - Release notes (in English):
     ```
     Welcome to VarsityHub v1.0.1!

     🎉 Initial production release featuring:
     • Complete team management system
     • Social feed with highlights and updates
     • Event creation and RSVP tracking
     • Direct messaging between users
     • Local business advertising platform
     • Google Maps integration for events
     • Real-time notifications

     Join the VarsityHub community today!
     ```

4. **Review and Rollout**:
   - Review the release summary
   - Click "Save"
   - Click "Review release"
   - Click "Start rollout to production"

---

## Step 7: Set Up Automated Submissions (Optional)

For future releases, automate with EAS Submit:

### A. Create Google Service Account

1. **Google Cloud Console**:
   - Go to: https://console.cloud.google.com
   - Select your project (or create one)
   - Enable: Google Play Developer API

2. **Create Service Account**:
   ```
   IAM & Admin → Service Accounts → Create Service Account
   ```
   - Name: `eas-submit-varsityhub`
   - Role: `Service Account User`
   - Click "Create Key" → JSON
   - Download the JSON file

3. **Save the key**:
   ```bash
   # Save as service-account-key.json in project root
   # DO NOT commit to git! (already in .gitignore)
   ```

### B. Grant Access in Google Play Console

1. Go to: Google Play Console → Users and permissions
2. Click "Invite new users"
3. Enter the service account email (from JSON file)
4. Set permissions:
   - [x] Admin (App access)
   - [x] Release to production
   - [x] Release to testing tracks
5. Click "Invite user"

### C. Submit Future Builds Automatically

```bash
# Build and submit in one command
eas build --platform android --profile production --auto-submit

# Or build first, then submit
eas build --platform android --profile production
eas submit --platform android --profile production --latest
```

---

## Step 8: Review and Launch

### Before Launch Checklist:
- [ ] .aab file uploaded
- [ ] Store listing complete (title, description, icon)
- [ ] Screenshots uploaded (minimum 2)
- [ ] Content rating complete
- [ ] Privacy policy URL provided
- [ ] Release notes written
- [ ] Review all details

### Launch:
1. Click "Review release"
2. Google will review your app (typically 1-3 days)
3. You'll receive an email when approved
4. App will go live on Google Play

---

## Step 9: Post-Launch

### Monitor Your Release:
- Check crash reports: Google Play Console → Android vitals
- Review user feedback: Ratings and reviews
- Monitor install metrics: Statistics

### Future Updates:
1. Increment version in `app.json`:
   ```json
   "version": "1.0.2"
   ```

2. Build new .aab:
   ```bash
   eas build --platform android --profile production
   ```

3. Upload to new production release

---

## Common Issues

### Build Fails
- Check build logs on EAS
- Ensure all dependencies are compatible
- Verify Android credentials are valid

### Upload Rejected
- Ensure versionCode is higher than previous
- Check package name matches
- Verify signing key is consistent

### App Rejected by Google
- Common reasons:
  - Missing privacy policy
  - Incomplete content rating
  - Privacy violations
  - Misleading screenshots
- Fix issues and resubmit

---

## Support Resources

- **Google Play Console Help**: https://support.google.com/googleplay/android-developer
- **EAS Build Docs**: https://docs.expo.dev/build/introduction/
- **EAS Submit Docs**: https://docs.expo.dev/submit/introduction/

---

## Current Status

✅ Build in progress
⏳ Waiting for .aab file to download
📋 Complete store listing assets
🚀 Ready to submit to Google Play

**Next Action**: Wait for build to complete, then follow Steps 2-6 above.
