# Event & Share Hardening Checklist

**Goal:** Make event details, sharing, and email resilient to edge cases and failures  
**Priority:** High (blocking production readiness)  
**Owner:** Engineering

---

## 1. Event Detail Defensive Checks ✅

### What to verify in app/event-detail.tsx

| Check | Current Status | Fix | Priority |
|-------|----------------|-----|----------|
| Missing event ID handling | ✅ Returns early | Already in place (line 39) | High |
| API failure on Event.get() | ✅ Returns null | Already catches (line 46) | High |
| Deleted event state | ❌ Shows error, blank content | Add friendly error card | High |
| Missing location | ✅ Shows "No location" | Already handles (line 105) | High |
| Invalid coordinates | ❌ May pass invalid lat/lng | Add validation (line 111-112) | High |
| Maps open failure | ✅ Falls back to Google Maps | Already in place (line 127) | High |
| Missing title/date | ✅ Shows defaults | Already uses "Event Detail" (line 170) | Medium |

### Hardening Actions

**A) Add friendly deleted event state**
```tsx
// After error && !loading check
{event === null && !loading && !error && (
  <View style={styles.errorCard}>
    <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
    <Text style={styles.errorTitle}>Event Not Found</Text>
    <Text style={styles.errorMessage}>This event may have been deleted or is no longer available.</Text>
    <Pressable style={styles.button} onPress={() => router.back()}>
      <Text style={styles.buttonText}>Go Back</Text>
    </Pressable>
  </View>
)}
```

**B) Validate coordinates before opening maps**
```tsx
const openInMaps = async () => {
  if (!event?.location) {
    Alert.alert('No Location', 'This event does not have a location set.');
    return;
  }

  const lat = (event as any).latitude || (event as any).lat;
  const lng = (event as any).longitude || (event as any).lng;

  // NEW: Validate coordinates
  if (lat && lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      console.warn('[event-detail] Invalid coordinates:', { lat, lng });
      Alert.alert('Invalid Location', 'Location coordinates are invalid.');
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      console.warn('[event-detail] Out of bounds coordinates:', { lat, lng });
      Alert.alert('Invalid Location', 'Location is outside valid range.');
      return;
    }
  }

  const address = encodeURIComponent(event.location);
  // ... rest of maps logic
};
```

**C) Add analytics for share failures**
```tsx
const { share: shareEvent } = useShareLink({
  kind: 'event',
  id: event?.id,
  title: event?.title || 'VarsityHub Event',
  contextLines: eventShareContext,
});

// Track share attempts
const trackEventShare = useCallback(async () => {
  try {
    await shareEvent();
    // useShareLink already emits 'share_action' event
  } catch (err) {
    console.error('[event-detail] Share failed:', err);
    // Send to Sentry for tracking
  }
}, [shareEvent]);
```

---

## 2. Sharing Links Validation ✅

### What to verify in utils/links.ts

| Check | Current Status | Fix | Priority |
|-------|----------------|-----|----------|
| Web URL construction | ✅ Uses WEB_BASE_URL | Check it matches production domain | High |
| Deep link format | ✅ Uses APP_SCHEME | Ensure app.json/eas.json configured | High |
| URL encoding | ✅ Uses encodeURIComponent | Already in place | Medium |
| Invalid entity IDs | ❌ Passes through | Add validation for slug format | High |
| Missing metadata | ✅ Defaults provided | Check defaults are meaningful | Medium |

### Hardening Actions

**A) Validate link construction**
```typescript
// In utils/links.ts, add validation function
export function validateEntityLink(type: 'event' | 'post' | 'game', id: string): boolean {
  if (!id) return false;
  // Ensure ID is URL-safe (alphanumeric, hyphens, underscores)
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// Use in each link builder:
export const event = (id: string, title?: string): ShareableLink | null => {
  if (!validateEntityLink('event', id)) {
    console.warn(`[links] Invalid event ID: ${id}`);
    return null;
  }
  // ... rest of logic
};
```

**B) Verify app.json has correct deep link config**
```json
{
  "expo": {
    "scheme": "varsityhubmobile",
    "plugins": [
      [
        "expo-router",
        {
          "origin": "https://varsityhub.app",
          "prefixes": ["/events", "/posts", "/games", "/highlights", "/teams"]
        }
      ]
    ]
  }
}
```

**C) Verify Android intent filters**
```xml
<!-- In android/app/src/main/AndroidManifest.xml -->
<activity android:name=".MainActivity" ...>
  <intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="varsityhub.app" android:path="/events/*" />
    <data android:scheme="https" android:host="varsityhub.app" android:path="/posts/*" />
  </intent-filter>
</activity>
```

---

## 3. Email Template Completeness ✅

### What to verify in server/src/lib/email.ts

| Check | Current Status | Fix | Priority |
|-------|----------------|-----|----------|
| Missing template IDs | ✅ Checked in health | Already implemented | High |
| Template variable mismatch | ❌ No validation | Add cross-check | High |
| SendGrid bounces | ❌ No event handling | Add webhook handler | Medium |
| Rate limiting compliance | ✅ Enforced | Already in place | High |
| Email delivery logging | ✅ Logs sent | Could add Sentry tracking | Medium |

### Hardening Actions

**A) Create Email Template Validation Matrix**

Create `EMAIL_TEMPLATE_MATRIX.md`:
```markdown
# SendGrid Dynamic Template Variables

## Verification Email (d-xxxxxxx)
**Template ID:** SENDGRID_VERIFICATION_TEMPLATE_ID
**When Sent:** User registers
**Variables Required:**
- verification_link (string): Full URL to verify endpoint
- user_name (string): User's display name or "Varsity Hub user"
- app_name (string): "VarsityHub"

## Password Reset (d-xxxxxxx)
**Template ID:** SENDGRID_PASSWORD_RESET_TEMPLATE_ID
**When Sent:** User requests password reset
**Variables Required:**
- reset_link (string): Full URL with reset token
- user_name (string): User's display name
- reset_code (string): Alternative code if link fails

## Team Invite (d-xxxxxxx)
**Template ID:** SENDGRID_TEAM_INVITE_TEMPLATE_ID
**When Sent:** Coach invites user to team
**Variables Required:**
- team_name (string): Name of team
- team_logo_url (string): Team logo image URL
- inviter_name (string): Name of coach sending invite
- accept_link (string): Deep link or web link to accept
- primary_color (string): Team color (hex)

[... continue for each template ...]
```

**B) Add startup validation**
```typescript
// In server/src/lib/email.ts
export function validateEmailTemplates(): { valid: boolean; missing: string[]; errors: string[] } {
  const missing: string[] = [];
  const errors: string[] = [];

  // Check all required templates have IDs
  for (const [key, id] of Object.entries(TEMPLATE_IDS)) {
    if (REQUIRED_TEMPLATE_KEYS.includes(key as TemplateKey)) {
      if (!id) {
        missing.push(key.toLowerCase());
      }
    }
  }

  // TODO: Could add SendGrid API call to verify templates actually exist
  // const sg = require('@sendgrid/rest');
  // const response = await sg.request({
  //   method: 'GET',
  //   url: `/v3/templates`,
  // });

  return {
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}

// In server startup:
const emailValidation = validateEmailTemplates();
if (!emailValidation.valid) {
  console.error('[email] Template validation failed:', emailValidation);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1); // Fail startup in production
  }
}
```

**C) Add SendGrid webhook handler for bounces**
```typescript
// New file: server/src/routes/webhooks/sendgrid.ts
import { Router } from 'express';

export const sendgridWebhookRouter = Router();

interface SendGridEvent {
  event: 'bounce' | 'dropped' | 'delivered' | 'open' | 'click';
  email: string;
  timestamp: number;
  bounce_type?: 'permanent' | 'temporary';
  reason?: string;
}

sendgridWebhookRouter.post('/sendgrid', async (req, res) => {
  const events: SendGridEvent[] = req.body;

  for (const event of events) {
    if (event.event === 'bounce') {
      console.warn(`[sendgrid-webhook] Email bounced: ${event.email} (${event.bounce_type})`);
      
      // Track in Sentry
      if (event.bounce_type === 'permanent') {
        console.error(`[sendgrid] Permanent bounce for ${event.email}: ${event.reason}`);
        // Could mark user email as invalid in DB
      }
    }

    if (event.event === 'dropped') {
      console.error(`[sendgrid-webhook] Email dropped: ${event.email}`);
      // Critical - email not even attempted
    }
  }

  res.status(200).json({ received: events.length });
});
```

---

## 4. Cross-Platform Deep Link Testing

### Test Matrix

| Scenario | iOS | Android | Web | Pass |
|----------|-----|---------|-----|------|
| Share event link from event detail | ? | ? | ? | |
| Paste link into browser → opens app | ? | ? | ? | |
| Paste link into Messages/WhatsApp → opens app | ? | ? | ? | |
| Event link from email → opens app | ? | ? | ? | |
| Deep link /events/:id on varsityhub.app | ? | ? | ? | |
| Missing entity ID → friendly error | ? | ? | ? | |
| Deleted entity → friendly error | ? | ? | ? | |

### Setup for Production

**A) iOS Universal Links**
```
1. Create .well-known/apple-app-site-association on varsityhub.app
2. Add to server: https://varsityhub.app/.well-known/apple-app-site-association
3. Content:
   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "TEAM_ID.com.varsityhub.mobile",
           "paths": ["/events/*", "/posts/*", "/games/*", "/highlights/*", "/teams/*"]
         }
       ]
     }
   }
```

**B) Android App Links**
```
1. Generate SHA256 fingerprint of signing key
2. Create assetlinks.json on varsityhub.app
3. Add to server: https://varsityhub.app/.well-known/assetlinks.json
4. Content:
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "com.varsityhub.mobile",
         "sha256_cert_fingerprints": ["XX:XX:XX:..."]
       }
     }
   ]
```

---

## 5. Checklist for Production Readiness

### Event Detail (app/event-detail.tsx)
- [ ] Deleted event shows friendly error card
- [ ] Missing location handled gracefully
- [ ] Coordinate validation prevents invalid maps URLs
- [ ] Share failures logged to Sentry
- [ ] Loading state shows spinner
- [ ] Error state shows retry option

### Sharing Links (utils/links.ts + app.json)
- [ ] Web base URL matches production domain
- [ ] Deep links follow APP_SCHEME format
- [ ] App.json has correct Expo Router config
- [ ] Android manifests has intent filters
- [ ] iOS has universal links configured
- [ ] Entity ID validation prevents XSS

### Email (server/src/lib/email.ts + health.ts)
- [ ] All required template IDs loaded at startup
- [ ] Health endpoint shows missing templates
- [ ] SendGrid webhook handler catches bounces
- [ ] Email validation logs include user info
- [ ] Rate limiting prevents spam
- [ ] Sentry integration tracks delivery issues

### Testing (QA_CHECKLIST.md section 4)
- [ ] 6 critical flows include event sharing
- [ ] Share deep links open in app on device
- [ ] Email links open app with correct entity
- [ ] Deleted entity shows proper error
- [ ] Offline share attempts don't crash
- [ ] Copy link works without network

---

## Implementation Order

1. **Day 5 (Fixes):** Add event deleted state + coordinate validation
2. **Day 5 (Fixes):** Add entity ID validation in links.ts
3. **Day 6 (Readiness):** Verify app.json + android manifests
4. **Day 6 (Readiness):** Confirm health endpoint shows all templates
5. **Post-Launch:** Add SendGrid bounce webhook handler

---

## Reference

- app/event-detail.tsx (lines 1-281)
- app/post-detail.tsx (lines 1-50)
- utils/links.ts (lines 1-110)
- server/src/lib/email.ts (lines 1-100)
- server/src/routes/health.ts (lines 1-50)
- QA_CHECKLIST.md (Event & Post section)
