# Cloudinary Setup Guide 🌥️

## What is Cloudinary?

Cloudinary is a cloud-based image and video management service that provides:
- ✅ Persistent storage (images survive server restarts)
- ✅ Automatic image optimization
- ✅ Global CDN delivery (fast worldwide)
- ✅ Image transformations on-the-fly
- ✅ FREE tier: 25GB storage + 25GB bandwidth/month

## Why Do We Need This?

Railway uses **ephemeral storage** - files uploaded to the local disk are **deleted on every restart**. Cloudinary solves this by storing images in the cloud permanently.

---

## 🚀 Quick Setup (5 minutes)

### Step 1: Create a Cloudinary Account

1. Go to: https://cloudinary.com/users/register/free
2. Sign up with your email (or GitHub/Google)
3. Verify your email
4. You'll be taken to your dashboard

### Step 2: Get Your API Credentials

On your Cloudinary dashboard, you'll see:
- **Cloud Name**: `your-cloud-name`
- **API Key**: `123456789012345`
- **API Secret**: `abc123xyz789...` (click "reveal" to see it)

Copy these values!

### Step 3: Add to Your Environment Variables

#### For Local Development:

1. Open `server/.env` file
2. Add these lines:

```bash
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abc123xyz789...
```

Replace with your actual values from Step 2!

#### For Railway Production:

1. Go to your Railway project dashboard
2. Click on your service
3. Go to **Variables** tab
4. Add these three variables:
   - `CLOUDINARY_CLOUD_NAME` = your-cloud-name
   - `CLOUDINARY_API_KEY` = 123456789012345
   - `CLOUDINARY_API_SECRET` = abc123xyz789...
5. Click **Deploy** or wait for auto-deploy

### Step 4: Restart Your Server

**Local:**
```bash
cd server
npm run dev
```

**Railway:**
Will auto-deploy when you add the environment variables.

### Step 5: Verify It's Working

Watch the server logs when it starts:
- ✅ `Cloudinary configured - using cloud storage` = Working!
- ⚠️ `Cloudinary not configured - using local disk storage` = Not configured yet

---

## 📸 How It Works

### Before Cloudinary:
```
User uploads image → Server saves to /uploads/ folder → 💥 Gone on restart!
```

### With Cloudinary:
```
User uploads image → Cloudinary stores in cloud → ✅ Permanent!
Image URL: https://res.cloudinary.com/your-cloud-name/image/upload/v1234567890/varsityhub/production/abc123.jpg
```

### Storage Structure:

Images are organized by environment:
- Development: `varsityhub/development/`
- Production: `varsityhub/production/`

This keeps your environments separate!

---

## 🔧 Technical Details

### What Changed:

1. **New Package**: `cloudinary` + `multer-storage-cloudinary`
2. **New Config**: `server/src/lib/cloudinary.ts`
3. **Updated Routes**: `server/src/routes/uploads.ts`

### Fallback Behavior:

- ✅ If Cloudinary configured → Uses cloud storage
- ⚠️ If NOT configured → Falls back to local disk (temporary!)

### Response Format:

The upload endpoint now returns:
```json
{
  "url": "https://res.cloudinary.com/.../image.jpg",
  "type": "image",
  "mime": "image/jpeg",
  "size": 123456,
  "storage": "cloudinary"
}
```

---

## 🎨 Cloudinary Features

### Automatic Optimizations:

Cloudinary automatically:
- Compresses images (quality: auto:good)
- Converts to modern formats (WebP, AVIF)
- Optimizes for device/browser
- Serves via global CDN

### Example Transformations:

You can modify images in the URL:

**Original:**
```
https://res.cloudinary.com/your-cloud-name/image/upload/v1234/image.jpg
```

**Resize to 300x300:**
```
https://res.cloudinary.com/your-cloud-name/image/upload/w_300,h_300,c_fill/v1234/image.jpg
```

**Grayscale:**
```
https://res.cloudinary.com/your-cloud-name/image/upload/e_grayscale/v1234/image.jpg
```

**Blur background:**
```
https://res.cloudinary.com/your-cloud-name/image/upload/e_blur:1000/v1234/image.jpg
```

More: https://cloudinary.com/documentation/image_transformations

---

## 📊 Free Tier Limits

Cloudinary Free Plan includes:
- ✅ **25 GB** storage
- ✅ **25 GB** bandwidth per month
- ✅ **25,000** transformations per month
- ✅ **1,000** videos (up to 20 MB each)
- ✅ Unlimited images

For a small app, this is more than enough!

### Paid Plans (if you need more):

- **Plus**: $99/month (100GB storage, 100GB bandwidth)
- **Advanced**: $249/month (500GB storage, 500GB bandwidth)
- **Custom**: Enterprise pricing

You can start free and upgrade later if needed.

---

## 🐛 Troubleshooting

### "Cloudinary not configured" message

**Problem**: Environment variables not set.

**Solution**: 
1. Check `.env` file has the three variables
2. Restart the server
3. For Railway, check the Variables tab

### Uploads fail with 401 Unauthorized

**Problem**: Invalid API credentials.

**Solution**:
1. Double-check your API Key and Secret from Cloudinary dashboard
2. Make sure there are no extra spaces in `.env`
3. Try regenerating your API secret in Cloudinary

### Images still using local URLs

**Problem**: Using old code or caching.

**Solution**:
1. Restart server
2. Clear browser cache
3. Check server logs for "Cloudinary configured" message

### Uploads are slow

**Tip**: Cloudinary uploads might be slower than local (network latency), but:
- Images are optimized automatically
- Served from global CDN (faster for users)
- Worth the trade-off!

---

## 🔐 Security Best Practices

### DO:
✅ Keep API Secret in `.env` (never commit it!)
✅ Add `.env` to `.gitignore`
✅ Use environment variables in Railway
✅ Regenerate API secret if leaked

### DON'T:
❌ Commit API credentials to Git
❌ Share API secret publicly
❌ Use same credentials for dev/prod (create separate Cloudinary accounts if needed)

---

## 📚 Additional Resources

- Cloudinary Docs: https://cloudinary.com/documentation
- Node.js SDK: https://cloudinary.com/documentation/node_integration
- Image Transformations: https://cloudinary.com/documentation/image_transformations
- Video Upload: https://cloudinary.com/documentation/video_manipulation_and_delivery

---

## ✅ Checklist

Before deploying to production:

- [ ] Created Cloudinary account
- [ ] Got API credentials (Cloud Name, API Key, API Secret)
- [ ] Added to Railway environment variables
- [ ] Deployed to Railway
- [ ] Verified "Cloudinary configured" in logs
- [ ] Tested image upload
- [ ] Confirmed image URL is cloudinary.com domain

---

## 🎉 You're All Set!

Your images will now:
- ✅ Persist forever (survive restarts)
- ✅ Load fast from CDN
- ✅ Auto-optimize for users
- ✅ Scale with your app

Happy uploading! 📸
