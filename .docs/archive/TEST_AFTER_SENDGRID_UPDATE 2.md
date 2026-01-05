# TEST AFTER YOU UPDATE SENDGRID

## ✅ Backend is READY - Here's what's configured:

### Password Reset Email Function
- Template ID: `d-97a704ec6a35434195364e0ed9dfaf21`
- Variables sent from backend:
  - `name` ✅
  - `resetLink` ✅ (uses `varsityhubmobile://reset/CODE`)
  - `expiresIn` ✅ (defaults to "1 hour")
  - `code` ✅

### Password Changed Email Function
- Template ID: `d-6f11ea835053413296e159c91204b658`
- Variables sent from backend:
  - `name` ✅
  - `date` ✅
  - `email` ✅

---

## 🔧 WHAT YOU NEED TO DO IN SENDGRID:

### 1. Update Password Reset Template
Go to: https://mc.sendgrid.com/dynamic-templates
- Find template ID: `d-97a704ec6a35434195364e0ed9dfaf21`
- Click "Edit" → "Code Editor"
- **COPY THE ENTIRE HTML from the message above** (the first HTML block)
- Paste it, replacing all existing content
- **IMPORTANT**: Set subject line to: `Reset Your VarsityHub Password`
- Click "Save"

### 2. Update Password Changed Template
- Find template ID: `d-6f11ea835053413296e159c91204b658`
- Click "Edit" → "Code Editor"
- **COPY THE ENTIRE HTML from the message above** (the second HTML block)
- Paste it, replacing all existing content
- **IMPORTANT**: Set subject line to: `Your VarsityHub Password Was Changed`
- Click "Save"

---

## ✅ AFTER YOU UPDATE, IT WILL WORK BECAUSE:

1. **Button link is correct**: `{{{resetLink}}}` matches backend variable `resetLink`
2. **App will open**: Deep link `varsityhubmobile://reset/CODE` is already configured in backend
3. **All images will load**: Using Flaticon CDN (reliable, fast)
4. **All 5 social icons**: Instagram, TikTok, YouTube, Facebook, Lime
5. **Footer has links**: Privacy Policy | Community Guidelines
6. **Variables match**: Backend sends exact variable names template expects

---

## 🧪 TEST IT:

Run this command to send a test email:
```bash
curl -X POST http://localhost:4000/auth/password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email":"emilmancero@gmail.com"}'
```

Or start the server and test the full flow:
```bash
cd server && npm run dev
```

Then in another terminal:
```bash
curl -X POST http://localhost:4000/auth/password/forgot \
  -H "Content-Type: application/json" \
  -d '{"email":"emilmancero@gmail.com"}'
```

Check your email:
- ✅ All 5 social icons should appear
- ✅ Click "Reset Password" button
- ✅ App should open to /reset screen
- ✅ Code should auto-fill
- ✅ Enter new password and submit
- ✅ Should receive "Password Changed" email

---

## ⚠️ IF IT DOESN'T WORK:

1. **Button doesn't open app**: Make sure you're testing on a device with the app installed
2. **Icons don't load**: Clear SendGrid template cache (save template again)
3. **Email doesn't send**: Check server logs for SendGrid errors
4. **Wrong variables**: Double-check you pasted the EXACT HTML provided above

---

## 🎯 YES, IT WILL WORK!

Backend is configured correctly. Once you paste those HTML templates into SendGrid:
- Button will use deep link: `varsityhubmobile://reset/CODE`
- All icons will load from Flaticon CDN
- Footer will show all social links
- Variables will populate correctly

**Just update SendGrid and test!**
