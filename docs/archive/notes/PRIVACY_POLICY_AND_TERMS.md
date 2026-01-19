# Privacy Policy & Terms of Service

## PRIVACY POLICY

**Last Updated:** December 10, 2025

### 1. Information We Collect

#### Account Information
- Name, email address, phone number
- Profile information (photo, bio, location, position/role)
- Authentication credentials (managed securely, never stored in plain text)

#### Usage Information
- Posts, messages, photos, and videos you create
- Teams and organizations you join
- Events and games you attend
- Connections with other users (follows, teammates)

#### Location Information
- GPS coordinates for event/game locations (only with permission)
- General location for nearby events feature

#### Device Information
- Device type, operating system, unique identifiers
- App version, crash logs (via Sentry)
- IP address, user agent

### 2. How We Use Your Information

- **Service Delivery:** Create accounts, deliver features, manage teams/events
- **Communication:** Send notifications, emails about teams/events/messages
- **Analytics:** Understand usage patterns and improve the app
- **Safety:** Detect fraud, enforce terms, respond to abuse reports
- **Legal:** Comply with laws and protect VarsityHub's rights

### 3. Data Sharing

We **do not sell** your data. We share information only with:

- **Service Providers:** SendGrid (email), Twilio (SMS), Stripe (payments), Railway (hosting), Cloudinary (media), Google Maps (location)
- **Team Admins:** Your profile and activity within your teams
- **Law Enforcement:** If legally required or to prevent harm
- **Successors:** In case of merger/acquisition

### 4. Data Security

- Passwords encrypted with bcrypt (salted hashing)
- HTTPS/TLS for all transmissions
- JWT tokens for authentication
- Regular security audits via Snyk
- Sentry monitoring for error tracking

### 5. Your Rights

- **Access:** Request a copy of your data
- **Correction:** Update inaccurate information
- **Deletion:** Delete your account and associated data
- **Opt-out:** Disable notifications/marketing emails

Contact: privacy@varsityhub.app

### 6. Retention

- Account data retained while active
- Deleted accounts: 30-day grace period, then purged
- Logs: Retained for 90 days
- Backups: May be retained up to 90 days after deletion

### 7. Children

VarsityHub is not intended for users under 13. If a child's data is collected unknowingly, we will delete it immediately upon notification.

### 8. Changes

We may update this policy. Significant changes will be communicated via email or app notification.

### 9. Contact

**VarsityHub, Inc.**
Email: privacy@varsityhub.app
Website: https://varsityhub.app

---

## TERMS OF SERVICE

**Last Updated:** December 10, 2025

### 1. Acceptance of Terms

By accessing VarsityHub, you agree to these Terms. If you don't agree, do not use the service.

### 2. User Eligibility

- Must be 13 years or older (or age of digital consent in your jurisdiction)
- Must be legally capable of entering contracts
- Responsible for any accounts created with your credentials

### 3. Account Responsibility

- You are responsible for maintaining confidentiality of passwords
- You are liable for all activities under your account
- Notify us immediately of unauthorized access
- You may not share accounts or impersonate others

### 4. User Conduct

You agree **not to:**

- Use VarsityHub for illegal purposes
- Harass, threaten, or abuse other users
- Post hate speech, discriminatory content, or misinformation
- Share explicit/inappropriate content or child exploitation material
- Spam, manipulate rankings, or engage in scams
- Reverse-engineer, hack, or disrupt the service
- Collect data without permission
- Violate anyone's intellectual property rights

**Consequences:** Violations may result in content removal, account suspension, or permanent ban.

### 5. Content Ownership

- You retain ownership of content you create
- By posting, you grant VarsityHub a license to use, display, and distribute your content
- You are responsible for the legality and accuracy of your content
- You represent you have rights to all content you post

### 6. Intellectual Property

- VarsityHub, logos, design, and code are owned by VarsityHub, Inc.
- You may not use our IP without permission
- You grant us a license to use feedback you provide

### 7. Disclaimers

**AS-IS SERVICE:** VarsityHub is provided "as is" without warranties of any kind, including merchantability, fitness for purpose, or non-infringement.

**LIMITATION OF LIABILITY:** In no event shall VarsityHub be liable for indirect, incidental, special, consequential, or punitive damages, even if advised of their possibility.

**MAXIMUM LIABILITY:** VarsityHub's total liability shall not exceed the amount you paid in the last 12 months (or $100, whichever is less).

### 8. Third-Party Services

VarsityHub uses third-party services (Google Maps, Stripe, etc.). We are not liable for their failures, and their terms apply to your use.

### 9. Payment and Refunds

- Subscription charges are recurring and charged to your payment method
- Refunds are available within 14 days of purchase (minus payment processor fees)
- Non-refundable: Digital goods, services already provided, premium memberships after purchase grace period
- Request refunds at: billing@varsityhub.app

### 10. Termination

We may terminate your account if you:
- Violate these Terms
- Engage in illegal activity
- Repeatedly abuse the service
- Request termination

You may terminate by deleting your account in Settings.

### 11. Privacy

See Privacy Policy above for how we handle your data.

### 12. Changes to Terms

We may update Terms at any time. Continued use means acceptance. Major changes will be announced.

### 13. Dispute Resolution

- **Informal Resolution:** Contact disputes@varsityhub.app first
- **Governing Law:** Terms governed by laws of the jurisdiction where VarsityHub is incorporated
- **Arbitration:** Disputes resolved via binding arbitration (not courts) except for injunctive relief
- **Class Action Waiver:** You waive right to class actions

### 14. Severability

If any provision is invalid, remaining provisions remain in effect.

### 15. Entire Agreement

These Terms and Privacy Policy constitute the entire agreement between you and VarsityHub.

### 16. Contact

**VarsityHub, Inc.**
Email: legal@varsityhub.app
Website: https://varsityhub.app

---

## HOW TO CUSTOMIZE FOR YOUR JURISDICTION

The above templates are generic US-focused. Before launch, consult a lawyer and:

1. **Update jurisdiction** in Dispute Resolution section
2. **Add GDPR clauses** if targeting EU users
3. **Add CCPA clauses** if targeting California users
4. **Add age verification** if needed
5. **Update contact emails** to your legal team
6. **Add specific liability caps** based on business model
7. **Clarify data retention** per your infrastructure
8. **Add user verification** requirements if needed

## IMPLEMENTATION

### Option 1: Static Pages (Recommended for Launch)
Create web pages at:
- `https://varsityhub.app/privacy`
- `https://varsityhub.app/terms`

Link from app Settings → Legal

### Option 2: In-App
Embed PDFs in app under Settings → Privacy Policy / Terms

### Option 3: Hybrid
Serve from REST API:
```
GET /api/legal/privacy → JSON or HTML
GET /api/legal/terms → JSON or HTML
```

Then link from app.

---

**Status:** ✅ Template ready - customize and deploy before App Store submission
