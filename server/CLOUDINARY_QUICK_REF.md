# Cloudinary Quick Reference 📋

## Environment Variables

Add these to **Railway Dashboard → Variables**:

```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=abc123xyz789secret
```

## Where to Get Credentials

1. Go to: https://cloudinary.com/console
2. Look at the top of the dashboard
3. Copy: Cloud Name, API Key, API Secret

## Test if Working

### Server logs on start:
```
✅ Cloudinary configured - using cloud storage
```

### Upload response:
```json
{
  "url": "https://res.cloudinary.com/your-cloud-name/image/upload/...",
  "storage": "cloudinary"
}
```

## URLs Format

### Cloudinary (Good):
```
https://res.cloudinary.com/your-cloud-name/image/upload/v1234567890/varsityhub/production/abc123.jpg
```

### Local/Railway (Bad - temporary):
```
https://api-production-8ac3.up.railway.app/uploads/1760387731025-388336829.jpg
```

## Common Issues

### Issue: "Cloudinary not configured"
- **Fix**: Add environment variables to Railway
- **Check**: Railway Dashboard → Variables

### Issue: Still using local URLs
- **Fix**: Restart server after adding variables
- **Check**: Watch server logs for "Cloudinary configured"

### Issue: 401 Unauthorized
- **Fix**: Check API credentials are correct
- **Check**: No extra spaces in values

## File Size Limits

- Images/Videos: 25MB
- General files: 50MB
- Can be increased in code if needed

## Free Tier Limits

- **Storage**: 25GB
- **Bandwidth**: 25GB/month
- **Transformations**: 25,000/month
- **Videos**: 1,000 (up to 20MB each)

## Support

- Documentation: https://cloudinary.com/documentation
- Dashboard: https://cloudinary.com/console
- Setup Guide: `server/CLOUDINARY_SETUP.md`
