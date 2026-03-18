# Why TestFlight Shows the Old App (and how to fix it)

**TestFlight does not see your local code or git.** It only ever has builds that you **build** and **submit**. If you changed code until 3am but didn’t run a new build and submit it, TestFlight will still show the previous build.

---

## What has to happen for your latest code to be in TestFlight

1. **Your code is ready** (committed or at least saved locally).
2. **You run a new iOS build** so EAS packages your **current** project into a new binary:
   ```bash
   cd VarsityHubMobile
   eas build --platform ios --profile production
   ```
3. **That build is submitted to App Store Connect** (TestFlight):
   - If you don’t have auto-submit, after the build finishes run:
     ```bash
     eas submit --platform ios --profile production
     ```
     and pick the **new** build (the one you just made).
   - Or configure auto-submit so every production build goes to App Store Connect.
4. **Apple processes the build** (often 5–30 minutes). You’ll get an email when it’s ready.
5. **In TestFlight, you install the new build:**
   - Open the **TestFlight** app on your iPhone.
   - Open your app’s page.
   - If a new build is available, you’ll see an **Update** button or a new build number (e.g. 1.0.1 (50)).
   - Tap **Update** or **Install** for that build. **Until you do this, the app on your phone is still the old build.**

So: **code changes only appear in TestFlight after you build → submit → wait for processing → install the new build in TestFlight.**

---

## Checklist: “I changed code, I want it in TestFlight”

- [ ] Code is committed (and pushed if your build runs from git).
- [ ] Run `eas build --platform ios --profile production` **after** your changes.
- [ ] Wait for the build to finish on the EAS dashboard.
- [ ] Submit that build to App Store Connect (`eas submit` or your auto-submit).
- [ ] Wait for Apple’s “Ready to test” email (or status in App Store Connect).
- [ ] On your iPhone: open **TestFlight** → your app → tap **Update** or install the **new** build (check the build number).
- [ ] Open the app from the home screen; you should now be on the new build.

---

## Why it felt like “nothing updated”

- **No new build** – If you didn’t run `eas build` after your 3am changes, EAS never created a new binary. TestFlight only has the last build you submitted.
- **Old build still installed** – Even if a new build is in TestFlight, the icon on your phone is the old one until you **update** (or reinstall) from TestFlight. Opening the app doesn’t fetch new code; you have to install the new build.
- **Wrong build submitted** – If you ran `eas submit` and picked an older build from the list instead of the one you just built, TestFlight would get the old code.

---

## Quick commands (from repo root)

```bash
# 1. Build a new iOS production binary (includes your latest code)
eas build --platform ios --profile production

# 2. After build succeeds, submit to TestFlight (if not auto-submitted)
eas submit --platform ios --profile production

# 3. Then in TestFlight on your phone: install/update to the new build
```

Your **production** profile in `eas.json` has `autoIncrement: true`, so each new build gets a new build number. In TestFlight, pick the build with the **highest** build number (e.g. 1.0.1 (50) instead of 1.0.1 (49)) to get your latest changes.
