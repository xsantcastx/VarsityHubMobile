# Apple Sign In Setup Guide

## Overview

VarsityHub Mobile uses Apple Sign In for seamless iOS authentication. The implementation includes:
- **Simulator support**: Development tokens for testing (prefix: `sim-`)
- **Production verification**: JWT token validation against Apple's public keys
- **Secure key management**: Private key stored securely (never committed to git)

---

## Environment Setup

### 1. Key ID & Team ID

Your current configuration:
- **Key ID**: `LS9X6BV22K`
- **Bundle ID**: `com.xsantcastx.varsityhub` (from app.json)
- **Team ID**: (Set in environment - see below)

### 2. Store Private Key

Place your Apple Sign In private key at:
```
server/.keys/AuthKey_LS9X6BV22K.p8
```

The key file is automatically added to `.gitignore` (never committed):
```bash
# server/.keys/.gitignore
*.p8
AuthKey_*.p8
```

### 3. Environment Variables

Add to `server/.env`:
```bash
# Apple Sign In Configuration
APPLE_BUNDLE_ID=com.xsantcastx.varsityhub
APPLE_TEAM_ID=<your-apple-developer-team-id>
APPLE_KEY_ID=LS9X6BV22K
```

Or set in Railway dashboard for production:
```
Variables → Add Variable
  APPLE_BUNDLE_ID: com.xsantcastx.varsityhub
  APPLE_TEAM_ID: <team-id>
  APPLE_KEY_ID: LS9X6BV22K
```

---

## Implementation Details

### Backend Token Verification

**File**: `server/src/lib/appleAuth.ts`

```typescript
/**
 * Verify Apple Sign In identity token
 * - Fetches Apple's public keys
 * - Validates JWT signature
 * - Checks issuer and audience
 */
export async function verifyAppleToken(
  identityToken: string
): Promise<AppleTokenPayload | null>
```

**Token Payload**:
```typescript
interface AppleTokenPayload {
  iss: string;        // Issuer: https://appleid.apple.com
  aud: string;        // Audience: Bundle ID
  sub: string;        // Subject: User ID
  iat: number;        // Issued at
  exp: number;        // Expiration
  email?: string;     // Optional email
  email_verified?: boolean;
  is_private_email?: boolean;
}
```

### Auth Endpoint

**Route**: `POST /api/auth/apple`

**Request**:
```json
{
  "identity_token": "eyJhbGc..."
}
```

**Response (Success)**:
```json
{
  "access_token": "jwt-token",
  "user": {
    "id": "user-id",
    "email": "user@example.com",
    "apple_id": "001234.5678...abcd",
    "preferences": { "role": "fan" }
  },
  "needs_onboarding": true,
  "created": false
}
```

**Response (Error)**:
```json
{
  "error": "Invalid or expired Apple credential"
}
```

---

## Development Testing

### Simulator Tokens

For testing without real Apple Sign In, use simulator tokens:

```typescript
// Development token format
const devToken = 'sim-test-user-123';

// POST /api/auth/apple
{
  "identity_token": "sim-test-user-123"
}
```

These tokens:
- Bypass verification (simulator only)
- Create test accounts with deterministic emails
- Useful for QA and integration testing

### Test Apple Sign In

1. **Xcode Simulator**:
   ```bash
   # Open project in Xcode
   open -a Xcode ios/VarsityHubMobile.xcworkspace
   ```

2. **Real Device**:
   - Use Expo Go or internal build
   - Tap "Sign in with Apple"
   - Authenticate with Test User in Xcode or real account

---

## Production Deployment

### Pre-Deployment Checklist

- [ ] Private key stored at `server/.keys/AuthKey_LS9X6BV22K.p8`
- [ ] Environment variables set in Railway:
  - `APPLE_BUNDLE_ID`
  - `APPLE_TEAM_ID`
  - `APPLE_KEY_ID`
- [ ] Bundle ID matches app.json iOS bundle identifier
- [ ] Key is active in Apple Developer account
- [ ] Server build succeeds: `npm run build`
- [ ] Tests pass: `npm test` (requires Watchman)

### Railway Deployment

1. **Upload key file** (one-time setup):
   ```bash
   # Copy key to Railway project
   # Via Railway CLI or dashboard file uploader
   ```

2. **Set environment variables**:
   ```bash
   # Railway Dashboard → Variables
   APPLE_BUNDLE_ID=com.xsantcastx.varsityhub
   APPLE_TEAM_ID=<your-team-id>
   APPLE_KEY_ID=LS9X6BV22K
   ```

3. **Deploy**:
   ```bash
   git push origin main
   # Railway auto-deploys
   ```

### Post-Deployment Validation

```bash
# Test token verification
curl -X POST http://localhost:4000/api/auth/apple \
  -H "Content-Type: application/json" \
  -d '{ "identity_token": "sim-test-123" }'

# Expected response: 200 OK with user + token
```

---

## Troubleshooting

### Issue: "Invalid or expired Apple credential"

**Causes**:
1. Token expired (valid for ~10 minutes)
2. Key ID doesn't match (wrong env var)
3. Bundle ID mismatch
4. Network issue fetching Apple's public keys

**Solution**:
```bash
# Check logs
tail -f server.log | grep "apple-auth"

# Verify env vars
echo $APPLE_BUNDLE_ID
echo $APPLE_TEAM_ID
echo $APPLE_KEY_ID

# Test with simulator token
curl -X POST http://localhost:4000/api/auth/apple \
  -d '{ "identity_token": "sim-test-123" }'
```

### Issue: "Public key not found for kid"

**Causes**:
- Apple revoked the key
- Key ID in token doesn't match `APPLE_KEY_ID`

**Solution**:
1. Verify key is active: https://developer.apple.com/account/resources/authkeys/
2. Check that token matches key ID
3. Regenerate key if revoked

### Issue: Private key file not found

**Solution**:
```bash
# Copy key to correct location
cp ~/Downloads/AuthKey_LS9X6BV22K.p8 server/.keys/

# Verify permissions
ls -la server/.keys/AuthKey_LS9X6BV22K.p8

# Add to git ignore (already done)
cat server/.keys/.gitignore
```

---

## Security Best Practices

✅ **DO**:
- Store private key in secure location (never git)
- Use environment variables for sensitive data
- Verify tokens against Apple's public keys
- Rotate keys every 12 months
- Use HTTPS in production
- Log authentication failures for monitoring

❌ **DON'T**:
- Hardcode private keys in source code
- Commit `.p8` files to git
- Share private keys via email/chat
- Use simulator tokens in production
- Skip token signature verification
- Store plaintext user identifiers

---

## References

- [Apple Sign In Documentation](https://developer.apple.com/sign-in-with-apple/)
- [JWT Token Verification](https://developer.apple.com/documentation/sign_in_with_apple/fetch_apple_s_public_key_for_verifying_token_signature)
- [Expo Apple Authentication](https://docs.expo.dev/build/reference/apple-authentication/)

---

## Support

For issues or questions:
1. Check server logs: `VERBOSE=1 npm run dev`
2. Test with simulator token first
3. Verify environment variables are set
4. Ensure key file exists at correct path

---

**Last Updated**: December 7, 2025  
**Key ID**: LS9X6BV22K  
**Status**: ✅ Production Ready
