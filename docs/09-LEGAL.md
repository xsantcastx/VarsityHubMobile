# Legal Documents

Privacy Policy and Terms of Service for VarsityHub.

---

## Table of Contents

1. [Overview](#overview)
2. [Privacy Policy](#privacy-policy)
3. [Terms of Service](#terms-of-service)
4. [Implementation](#implementation)
5. [Updates](#updates)

---

## Overview

These legal documents are **required** for:
- ✅ App Store submission (Apple)
- ✅ Play Store submission (Google)
- ✅ User trust and transparency
- ✅ Legal compliance (GDPR, CCPA, etc.)

**Location:**
- Privacy Policy: Root directory (`PRIVACY_POLICY.md`)
- Terms of Service: Root directory (`TERMS_OF_SERVICE.md`)

**Public Access:**
Both documents should be publicly accessible via URL for app store submissions.

---

## Privacy Policy

See **[PRIVACY_POLICY.md](../PRIVACY_POLICY.md)** in the root directory.

### Key Sections

1. **Information We Collect**
   - Account information (email, name, profile picture)
   - User-generated content (posts, photos, videos, messages)
   - Usage data (app interactions, features used)
   - Device information (device type, OS version)
   - Location data (if user grants permission)

2. **How We Use Information**
   - Provide and improve services
   - Personalize user experience
   - Send notifications and updates
   - Process payments
   - Respond to support requests
   - Comply with legal obligations

3. **Information Sharing**
   - With other users (public content)
   - With service providers (Stripe, Cloudinary, Railway)
   - For legal compliance
   - With user consent

4. **Data Security**
   - Encryption in transit (HTTPS)
   - Secure database storage
   - Access controls
   - Regular security audits

5. **User Rights**
   - Access your data
   - Update your data
   - Delete your account
   - Opt-out of communications
   - Data portability

6. **Children's Privacy**
   - App not intended for users under 13
   - Parental consent required for minors 13-17
   - Compliance with COPPA

7. **Contact Information**
   - Email: privacy@varsityhub.com
   - Support: support@varsityhub.com

### Hosting Requirements

**For App Store/Play Store:**
Privacy policy must be hosted at a publicly accessible URL.

**Options:**

1. **GitHub Pages** (Free, Easy)
   - Create `docs/privacy.html` in repository
   - Enable GitHub Pages in repository settings
   - URL: `https://yourusername.github.io/VarsityHubMobile/privacy.html`

2. **Custom Domain** (Professional)
   - Host on your website: `https://varsityhub.com/privacy`
   - Requires domain and hosting

3. **TermsFeed** (Quick Solution)
   - Use TermsFeed's privacy policy generator
   - Free hosting provided
   - URL: `https://app.termsfeed.com/download/...`

### Example Implementation

**Convert Markdown to HTML:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VarsityHub Privacy Policy</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.6;
    }
    h1 { color: #1a73e8; }
    h2 { color: #333; margin-top: 30px; }
    p { margin: 15px 0; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p><strong>Last Updated:</strong> January 1, 2025</p>
  
  <h2>1. Information We Collect</h2>
  <p>...</p>
  
  <!-- Rest of privacy policy content -->
</body>
</html>
```

**Update app.json:**

```json
{
  "expo": {
    "name": "VarsityHub",
    "privacy": "https://yourusername.github.io/VarsityHubMobile/privacy.html"
  }
}
```

---

## Terms of Service

See **[TERMS_OF_SERVICE.md](../TERMS_OF_SERVICE.md)** in the root directory.

### Key Sections

1. **Acceptance of Terms**
   - By using VarsityHub, you agree to these terms
   - Must be 13+ years old (or have parental consent)
   - Compliance required for continued access

2. **User Accounts**
   - Account registration requirements
   - Account security responsibilities
   - Account termination conditions
   - Subscription and billing terms

3. **Acceptable Use**
   - Permitted uses of the platform
   - Prohibited activities:
     - Harassment, bullying, hate speech
     - Spam or fraudulent content
     - Copyright infringement
     - Impersonation
     - Illegal activities
     - Hacking or system abuse

4. **User Content**
   - Users retain ownership of their content
   - License granted to VarsityHub to display/distribute content
   - Content moderation rights
   - Copyright and intellectual property
   - Reporting violations

5. **Subscriptions and Payments**
   - Subscription tiers (Free, Veteran, Legend)
   - Pricing and billing
   - Auto-renewal policy
   - Cancellation and refunds
   - Payment disputes

6. **Intellectual Property**
   - VarsityHub owns app, trademarks, and design
   - User content ownership
   - DMCA compliance

7. **Disclaimers and Limitations**
   - Service provided "as is"
   - No warranty of uninterrupted service
   - Limitation of liability
   - Indemnification

8. **Dispute Resolution**
   - Governing law (your jurisdiction)
   - Arbitration clause (optional)
   - Class action waiver (optional)

9. **Changes to Terms**
   - Right to modify terms
   - Notification of changes
   - Continued use implies acceptance

10. **Contact Information**
    - Email: legal@varsityhub.com
    - Support: support@varsityhub.com

### Hosting Requirements

Same as Privacy Policy - must be publicly accessible URL.

**Update app.json:**

```json
{
  "expo": {
    "name": "VarsityHub",
    "privacy": "https://yourusername.github.io/VarsityHubMobile/privacy.html",
    "termsOfService": "https://yourusername.github.io/VarsityHubMobile/terms.html"
  }
}
```

---

## Implementation

### In-App Display

**Show during registration:**

```typescript
// app/index.tsx (Login/Register screen)
import { Linking } from 'react-native';

function RegisterScreen() {
  const openPrivacyPolicy = () => {
    Linking.openURL('https://yourusername.github.io/VarsityHubMobile/privacy.html');
  };

  const openTerms = () => {
    Linking.openURL('https://yourusername.github.io/VarsityHubMobile/terms.html');
  };

  return (
    <View>
      {/* Registration form */}
      
      <Text style={styles.legal}>
        By signing up, you agree to our{' '}
        <Text style={styles.link} onPress={openTerms}>
          Terms of Service
        </Text>
        {' '}and{' '}
        <Text style={styles.link} onPress={openPrivacyPolicy}>
          Privacy Policy
        </Text>
      </Text>
      
      <Button title="Sign Up" onPress={handleRegister} />
    </View>
  );
}
```

**Show in Settings:**

```typescript
// app/settings/index.tsx
function SettingsScreen() {
  return (
    <ScrollView>
      {/* Other settings */}
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        
        <TouchableOpacity onPress={() => Linking.openURL('...')}>
          <View style={styles.row}>
            <Text>Privacy Policy</Text>
            <Icon name="chevron-right" />
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => Linking.openURL('...')}>
          <View style={styles.row}>
            <Text>Terms of Service</Text>
            <Icon name="chevron-right" />
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
```

### App Store Submission

**Apple App Store Connect:**
1. Go to **App Information**
2. Add **Privacy Policy URL**: `https://yourusername.github.io/VarsityHubMobile/privacy.html`
3. Add **Terms of Service URL** (optional but recommended)

**Google Play Console:**
1. Go to **Store presence** → **Store listing**
2. Scroll to **Privacy Policy**
3. Add URL: `https://yourusername.github.io/VarsityHubMobile/privacy.html`

### Email Footer

Include legal links in all automated emails:

```html
<!-- Email footer template -->
<footer style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #666;">
  <p>
    <a href="https://yourusername.github.io/VarsityHubMobile/privacy.html">Privacy Policy</a> |
    <a href="https://yourusername.github.io/VarsityHubMobile/terms.html">Terms of Service</a> |
    <a href="mailto:support@varsityhub.com">Contact Support</a>
  </p>
  <p>&copy; 2025 VarsityHub. All rights reserved.</p>
</footer>
```

---

## Updates

### When to Update

Update legal documents when:
- ✅ Adding new features that collect data
- ✅ Changing data handling practices
- ✅ Adding new third-party services
- ✅ Changing subscription pricing
- ✅ Expanding to new jurisdictions
- ✅ New legal requirements (GDPR, CCPA updates)

### Update Process

1. **Update Documents**
   - Edit `PRIVACY_POLICY.md` and `TERMS_OF_SERVICE.md`
   - Update "Last Updated" date
   - Clearly note changes in changelog

2. **Notify Users**
   - Send email to all users
   - Show in-app notification
   - Require acceptance for significant changes

3. **Update Hosted Versions**
   - Regenerate HTML files
   - Update GitHub Pages
   - Verify URLs still work

4. **Update App Stores**
   - Update URLs in App Store Connect
   - Update URLs in Play Console
   - Include in app update release notes

### Version Control

Keep track of changes:

```markdown
## Privacy Policy Changelog

### Version 1.1 - January 15, 2025
- Added section on push notification data
- Updated third-party service list (added Firebase)
- Clarified data retention period

### Version 1.0 - January 1, 2025
- Initial privacy policy
```

---

## Compliance Checklist

### GDPR (European Union)

- [ ] Clear consent for data collection
- [ ] Right to access personal data
- [ ] Right to delete personal data
- [ ] Right to data portability
- [ ] Data breach notification (within 72 hours)
- [ ] Privacy by design and default
- [ ] Appointed Data Protection Officer (if required)

### CCPA (California)

- [ ] Disclose categories of data collected
- [ ] Right to opt-out of data selling
- [ ] Right to delete personal data
- [ ] Right to non-discrimination
- [ ] "Do Not Sell My Personal Information" link

### COPPA (Children's Privacy)

- [ ] Age verification (13+ requirement)
- [ ] Parental consent for minors
- [ ] Limited data collection for children
- [ ] No targeted advertising to children

### App Store Requirements

**Apple:**
- [ ] Privacy policy URL provided
- [ ] Privacy nutrition labels completed
- [ ] In-app purchases clearly described
- [ ] Subscription terms clearly stated

**Google:**
- [ ] Privacy policy URL provided
- [ ] Data safety section completed
- [ ] Permissions justified
- [ ] Subscription terms clearly stated

---

## Legal Review

### Before Launch

Consider getting legal review for:
- ✅ Privacy policy completeness
- ✅ Terms of service enforceability
- ✅ Compliance with local laws
- ✅ Subscription/refund policies
- ✅ User content liability

### Find Legal Help

- **LegalZoom**: Online legal services
- **Rocket Lawyer**: Affordable legal documents
- **TermsFeed**: Automated policy generator
- **Local Attorney**: Best for complex situations

### Cost Estimate

- **DIY with templates**: $0
- **Online generators**: $0-$200
- **Legal review**: $500-$2,000
- **Full legal package**: $2,000-$5,000

---

## Quick Setup Guide

### Option 1: GitHub Pages (Recommended)

**Step 1: Create HTML files**

```bash
# In project root
mkdir -p docs
# Convert PRIVACY_POLICY.md to docs/privacy.html
# Convert TERMS_OF_SERVICE.md to docs/terms.html
```

**Step 2: Enable GitHub Pages**

1. Go to repository **Settings**
2. Scroll to **Pages**
3. Source: **Deploy from a branch**
4. Branch: **main** → Folder: **/docs**
5. Save

**Step 3: Get URLs**

After deployment (1-2 minutes):
- Privacy: `https://xsantcastx.github.io/VarsityHubMobile/privacy.html`
- Terms: `https://xsantcastx.github.io/VarsityHubMobile/terms.html`

**Step 4: Update app.json**

```json
{
  "expo": {
    "privacy": "https://xsantcastx.github.io/VarsityHubMobile/privacy.html"
  }
}
```

### Option 2: Custom Domain

If you have `varsityhub.com`:

1. Host files on your server
2. URLs: `https://varsityhub.com/privacy` and `https://varsityhub.com/terms`
3. Update app.json with your URLs

---

## Resources

### Templates
- [TermsFeed Privacy Policy Generator](https://www.termsfeed.com/privacy-policy-generator/)
- [TermsFeed Terms & Conditions Generator](https://www.termsfeed.com/terms-conditions-generator/)
- [Shopify Privacy Policy Generator](https://www.shopify.com/tools/policy-generator)

### Legal Information
- [GDPR Compliance Checklist](https://gdpr.eu/checklist/)
- [CCPA Compliance Guide](https://oag.ca.gov/privacy/ccpa)
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Policy Center](https://play.google.com/about/developer-content-policy/)

### Tools
- [Markdown to HTML Converter](https://markdowntohtml.com/)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)

---

## Next Steps

- **[Production Deployment](./07-PRODUCTION.md)** - Launch checklist
- **[Troubleshooting](./11-TROUBLESHOOTING.md)** - Common issues

---

**Questions?** Contact legal@varsityhub.com or support@varsityhub.com
