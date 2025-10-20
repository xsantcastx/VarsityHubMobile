# VarsityHub - What We Need for Production Launch

## Quick Overview
This is a simplified list of what we need from you to launch VarsityHub. Don't worry - we'll guide you through each step!

---

## 🔑 1. Email Service (to send verification codes)

**What it's for**: Sending sign-up verification codes, password resets, and notifications to your users

**What we need**:
- [ ] SendGrid account (free tier works great to start)
- [ ] API key from SendGrid
- [ ] A verified email address like `noreply@varsityhub.com`

**How to get it**:
1. Sign up at [SendGrid.com](https://sendgrid.com)
2. Verify your email address
3. Generate an API key (Settings → API Keys → Create API Key)
4. Choose "Full Access" for Mail Send
5. Copy and share the API key with us securely

**Cost**: FREE for up to 100 emails/day, or $20/month for 50,000 emails

---

## 💳 2. Stripe (for processing ad payments)

**What it's for**: Handling credit card payments when users buy ads ($1.75-$2.99 per ad)

**What we need**:
- [ ] Stripe account (production/live mode)
- [ ] Publishable Key (starts with `pk_live_`)
- [ ] Secret Key (starts with `sk_live_`)
- [ ] Webhook signing secret (starts with `whsec_`)

**How to get it**:
1. Sign up at [Stripe.com](https://stripe.com)
2. Complete business verification
3. Add your bank account for payouts
4. Switch from Test mode to Live mode
5. Get keys from Developers → API keys
6. Set up webhook at Developers → Webhooks

**Cost**: 2.9% + $0.30 per transaction (only when you make money!)

**Important**: You need to activate your account and verify your business before going live.

---

## 🗺️ 3. Google Maps API (for showing game locations)

**What it's for**: Displaying maps, finding addresses, calculating distances for the 20-mile ad radius

**What we need**:
- [ ] Google Cloud account
- [ ] Google Maps API key
- [ ] Billing enabled (has $200/month free credit)

**How to get it**:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project called "VarsityHub Production"
3. Enable billing (adds credit card, but you get $200 free monthly)
4. Enable these APIs:
   - Maps SDK for Android
   - Maps SDK for iOS
   - Places API
   - Geocoding API
   - Geolocation API
5. Create API key (APIs & Services → Credentials → Create Credentials)
6. Share the API key with us

**Cost**: $0-$200/month (you get $200 free credit, so usually free unless high traffic)

---

## 🗄️ 4. Database Hosting

**What it's for**: Storing all your app data (users, posts, games, teams, etc.)

**What we need**:
- [ ] PostgreSQL database (we recommend Railway for simplicity)

**Options**:

### Option A: Railway (EASIEST - Recommended)
1. Sign up at [Railway.app](https://railway.app)
2. Create a PostgreSQL database
3. Share the connection details with us
- **Cost**: $5-$20/month

### Option B: AWS RDS (More scalable)
1. We can set this up for you
2. You provide AWS account access
- **Cost**: $30-$100/month

**We recommend Railway** for ease of setup and lower initial cost.

---

## 📦 5. File Storage (for user photos/videos)

**What it's for**: Storing profile pictures, post images/videos, team banners, ad images

**What we need**:
- [ ] AWS S3 bucket OR Cloudinary account

**Options**:

### Option A: Cloudinary (EASIEST)
1. Sign up at [Cloudinary.com](https://cloudinary.com)
2. Share API credentials
- **Cost**: FREE up to 25GB storage + 25GB bandwidth

### Option B: AWS S3
1. Create AWS account
2. We'll set up the S3 bucket for you
- **Cost**: $5-$20/month

**We recommend Cloudinary** for simplicity and free tier.

---

## 🌐 6. Domain Name & Hosting

**What it's for**: Your app's API will run at `api.varsityhub.com` (or whatever domain you choose)

**What we need**:
- [ ] Domain name (e.g., `varsityhub.com`)
- [ ] Access to DNS settings (to add records)

**How to get it**:
1. Buy domain at [Namecheap.com](https://namecheap.com) or [GoDaddy.com](https://godaddy.com)
2. Share domain registrar login with us
3. We'll add the necessary DNS records

**Cost**: $12/year for domain

**Hosting**: We recommend Railway ($20/month) or we can set up AWS for you.

---

## 📱 7. App Store Accounts

**What it's for**: Publishing your app to iPhone and Android users

### iOS App Store
**What we need**:
- [ ] Apple Developer account ($99/year)
- [ ] Access to App Store Connect

**How to get it**:
1. Sign up at [developer.apple.com](https://developer.apple.com)
2. Pay $99/year enrollment fee
3. Complete the account setup
4. Share credentials with us

**Cost**: $99/year

### Google Play Store
**What we need**:
- [ ] Google Play Console account ($25 one-time)
- [ ] Access to Play Console

**How to get it**:
1. Sign up at [play.google.com/console](https://play.google.com/console)
2. Pay $25 one-time registration fee
3. Share credentials with us

**Cost**: $25 one-time fee

---

## 💰 Total Cost Summary

Here's what you'll spend to get VarsityHub live:

### One-Time Costs:
| Item | Cost |
|------|------|
| Google Play Store | $25 |
| Domain name | $12/year |
| **TOTAL ONE-TIME** | **~$40** |

### Monthly Costs:
| Service | Cost | Notes |
|---------|------|-------|
| Server Hosting (Railway) | $20-50 | Scales with users |
| Database (Railway) | $5-20 | Included with hosting |
| Email (SendGrid) | $0-20 | Free until 100/day |
| Stripe | 0% + fees | Only when you make money |
| Google Maps | $0-50 | $200 free credit |
| File Storage | $0-20 | Cloudinary free tier |
| Apple Developer | $8.25/mo | ($99/year) |
| **TOTAL MONTHLY** | **$30-170** | Lower at start |

### First Month Total: ~$70-210
### Ongoing: ~$30-170/month

**Note**: Costs scale with usage. Start small and grow!

---

## 🚀 What Happens Next?

### Step 1: You provide credentials (1-2 days)
- Set up the accounts above
- Share credentials with us securely

### Step 2: We deploy everything (2-3 days)
- Set up production server
- Configure all services
- Deploy API and database
- Build mobile apps

### Step 3: Testing (1-2 days)
- We test everything thoroughly
- Fix any issues
- Get your approval

### Step 4: Submit to app stores (1-14 days)
- Submit iOS app (1-2 week Apple review)
- Submit Android app (1-3 day Google review)

### Step 5: LAUNCH! 🎉
- Apps go live in stores
- Users can download and sign up

**Total timeline**: 2-3 weeks from credentials to launch

---

## 🔒 Security & Privacy

**How to share credentials securely**:
1. Use a password manager (1Password, LastPass)
2. Share via encrypted email (ProtonMail)
3. Use secure file sharing (Dropbox with password)
4. **Don't** send via regular email or text message

**We will**:
- Store your credentials securely
- Never share them with anyone
- Use separate dev/staging/production keys
- Delete access when project is complete

---

## ❓ Frequently Asked Questions

**Q: Do I need ALL of these right now?**
A: The critical ones are: Email (SendGrid), Payments (Stripe), Maps (Google), Database, and Storage. App Store accounts can wait until we're ready to submit.

**Q: Can you set these up for me?**
A: We can guide you through setup, but accounts must be in your name/business for ownership and billing.

**Q: What if I'm not comfortable with the costs?**
A: We can start with the cheapest options (Railway, Cloudinary free tiers) and scale up as you grow.

**Q: How long do I have access to the credentials?**
A: These are YOUR accounts - you own them forever. We just need temporary access to set things up.

**Q: What happens if we lose an API key?**
A: We can regenerate most keys. The critical one to backup is the Android keystore file (we'll handle this).

**Q: Can we test before going live?**
A: Yes! We have staging/test environments. Production deployment only happens when you're ready.

---

## 📞 Need Help?

**Setting up accounts**: We can schedule a video call to walk through any service you're unsure about.

**Bulk discounts**: Some services offer startup/nonprofit discounts. Let us know if applicable.

**Timeline questions**: We're flexible on timeline. No rush - we'll launch when you're ready.

---

## ✅ Quick Checklist

Print this and check off as you complete each item:

**Week 1 - Critical Services**
- [ ] Set up SendGrid account and get API key
- [ ] Set up Stripe account (complete verification)
- [ ] Set up Google Cloud and get Maps API key
- [ ] Set up Railway database
- [ ] Set up Cloudinary for file storage
- [ ] Share all credentials with development team

**Week 2 - Deployment**
- [ ] Buy domain name
- [ ] Provide DNS access
- [ ] Review and approve testing
- [ ] Get Apple Developer account
- [ ] Get Google Play Console account

**Week 3 - Launch**
- [ ] Provide app store credentials
- [ ] Review app store listings
- [ ] Approve final testing
- [ ] Launch! 🚀

---

## 📧 Ready to Start?

Once you've gathered these credentials, send them to us securely and we'll get started on deployment!

**Questions?** Contact: [Your Email/Phone]

**Last Updated**: October 13, 2025

---

*This document is for VarsityHub production deployment. Keep a copy for your records.*
