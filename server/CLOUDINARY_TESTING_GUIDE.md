# 🧪 Cloudinary Upload Testing Guide

This guide shows you multiple ways to test that your Cloudinary integration is working correctly.

## ✅ Prerequisites

1. **Environment Variables Set**: Make sure these are in your `.env` file:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

2. **Server Running**: Start your backend server
   ```bash
   cd server
   npm start
   ```

---

## Method 1: Direct Cloudinary Test (Recommended First)

Test Cloudinary directly without going through your API.

```bash
cd server
node test-cloudinary.js
```

**What it does:**
- ✅ Checks if environment variables are set
- ✅ Uploads a test image directly to Cloudinary
- ✅ Shows the resulting URL
- ✅ Cleans up the test image

**Expected Output:**
```
🧪 Testing Cloudinary Configuration...

✅ Cloudinary environment variables found:
   Cloud Name: your_cloud_name
   API Key: 12345678...
   API Secret: abcdefgh...

📤 Uploading test image to Cloudinary...

✅ Upload successful!

📊 Upload Details:
   Public ID: varsityhub-dev/test-1729468800000
   URL: https://res.cloudinary.com/your_cloud/image/upload/v1729468800/varsityhub-dev/test-1729468800000.png
   Format: png
   Width: 1px
   Height: 1px
   Size: 68 bytes
   Created: 2025-10-20T12:00:00Z

🎉 Cloudinary is working correctly!
```

---

## Method 2: Test via API Endpoint (PowerShell)

Test the actual upload API endpoint that your app uses.

```powershell
cd server
.\test-upload-api.ps1
```

**What it does:**
- Creates a test image
- Uploads it to your API endpoint (`POST /api/uploads`)
- Shows the response with Cloudinary URL
- Cleans up

**Note**: You'll need a valid JWT token. Get one by:
1. Sign in to your app
2. Check the browser console for your token
3. Or use the token from your API client

---

## Method 3: Test with cURL (Command Line)

### Simple test:
```bash
# Create a test image first
curl -X POST http://localhost:3000/api/uploads \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@path/to/image.jpg"
```

### With PowerShell:
```powershell
$headers = @{
    "Authorization" = "Bearer YOUR_JWT_TOKEN"
}

$filePath = "C:\path\to\test-image.jpg"
Invoke-RestMethod -Uri "http://localhost:3000/api/uploads" `
  -Method Post `
  -Headers $headers `
  -Form @{file = Get-Item $filePath}
```

---

## Method 4: Test via Mobile App

### Using Expo Go:

1. **Start the backend**:
   ```bash
   cd server
   npm start
   ```

2. **Start the mobile app**:
   ```bash
   cd ..
   npx expo start
   ```

3. **Test upload features**:
   - Create a post with an image
   - Update profile picture
   - Upload team logo
   - Submit an ad banner

4. **Verify in Cloudinary Dashboard**:
   - Go to https://cloudinary.com/console
   - Navigate to Media Library
   - Check the `varsityhub-dev` folder (or `varsityhub-prod` in production)
   - You should see your uploaded images

---

## Method 5: Test with Postman/Insomnia

1. **Import this cURL as a request**:
   ```bash
   curl --location 'http://localhost:3000/api/uploads' \
   --header 'Authorization: Bearer YOUR_JWT_TOKEN' \
   --form 'file=@"/path/to/image.jpg"'
   ```

2. **Set up the request**:
   - Method: `POST`
   - URL: `http://localhost:3000/api/uploads`
   - Headers:
     - `Authorization: Bearer YOUR_JWT_TOKEN`
   - Body (form-data):
     - Key: `file`
     - Type: File
     - Value: Select an image file

3. **Send and check response**:
   ```json
   {
     "url": "https://res.cloudinary.com/your_cloud/image/upload/v1729468800/varsityhub-dev/1729468800-123456789.jpg",
     "type": "image"
   }
   ```

---

## 🔍 Troubleshooting

### "Cloudinary is not configured"
**Solution**: Check your `.env` file has all three variables:
```bash
cd server
cat .env | grep CLOUDINARY
```

### "Upload failed: 401 Unauthorized"
**Problem**: Invalid Cloudinary credentials  
**Solution**: 
1. Go to Cloudinary dashboard
2. Copy credentials from "Product Environment Credentials"
3. Update your `.env` file

### "File too large"
**Problem**: File exceeds 25MB limit  
**Solution**: 
- For images/videos: Max 25MB (configured in `uploads.ts`)
- For general files: Max 50MB
- Adjust limits in `server/src/routes/uploads.ts` if needed

### "Only image or video files are allowed"
**Problem**: Wrong file type  
**Solution**: Endpoint only accepts:
- Images: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`
- Videos: `.mp4`, `.mov`, `.avi`, `.webm`

### Local storage still being used
**Problem**: Server logs show "using local disk storage"  
**Solution**:
1. Check environment variables are loaded
2. Restart the server after setting env vars
3. Run `test-cloudinary.js` to verify configuration

---

## 📊 Verifying Uploads

### 1. Check Server Logs
Look for this line when server starts:
```
✅ Cloudinary configured - using cloud storage
```

### 2. Check Upload Response
Cloudinary URLs look like:
```
https://res.cloudinary.com/YOUR_CLOUD_NAME/image/upload/v1234567890/varsityhub-dev/filename.jpg
```

Local storage URLs look like:
```
http://localhost:3000/uploads/1234567890-987654321.jpg
```

### 3. Check Cloudinary Dashboard
- Login to https://cloudinary.com
- Go to Media Library
- Check folders:
  - `varsityhub-dev` - Development uploads
  - `varsityhub-prod` - Production uploads

---

## 🎯 Quick Test Checklist

- [ ] Environment variables are set
- [ ] Server starts with "✅ Cloudinary configured" message
- [ ] `node test-cloudinary.js` succeeds
- [ ] Upload via API returns Cloudinary URL
- [ ] Image appears in Cloudinary dashboard
- [ ] Image is accessible via the returned URL
- [ ] Mobile app uploads work correctly

---

## 🚀 Production Testing

Before deploying to production:

1. **Set production environment variables** on Railway:
   ```
   CLOUDINARY_CLOUD_NAME=your_cloud
   CLOUDINARY_API_KEY=your_key
   CLOUDINARY_API_SECRET=your_secret
   NODE_ENV=production
   ```

2. **Test production endpoint**:
   ```bash
   curl -X POST https://your-app.railway.app/api/uploads \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -F "file=@test-image.jpg"
   ```

3. **Verify in Cloudinary**:
   - Production uploads go to `varsityhub-prod` folder
   - Check Media Library for the new upload

---

## 📝 Additional Resources

- **Cloudinary Docs**: https://cloudinary.com/documentation
- **Multer Docs**: https://github.com/expressjs/multer
- **VarsityHub Upload API**: Check `server/src/routes/uploads.ts`

---

## 💡 Tips

1. **Use Cloudinary Transformations**: Automatically optimize images:
   ```
   https://res.cloudinary.com/your_cloud/image/upload/w_500,h_500,c_fill,q_auto/image.jpg
   ```

2. **Monitor Usage**: Check your Cloudinary dashboard for storage/bandwidth usage

3. **Set Up Webhooks**: Get notified when uploads complete (advanced)

4. **Enable Auto-Backup**: Configure automatic backups in Cloudinary settings
