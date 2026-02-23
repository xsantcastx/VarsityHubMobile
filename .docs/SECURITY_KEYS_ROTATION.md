# Security Keys Rotation Notice

**Date:** February 22, 2025

## Summary

Hardcoded keys have been removed and replaced with environment variables or placeholders. The following previously committed keys **must be rotated** in their dashboards. **We cannot confirm whether they have been rotated or are still valid**—only the account owner can verify this.

## Keys to Rotate

| Key Type | Prefix/Identifier | Action |
|----------|-------------------|--------|
| **Stripe production secret** | `sk_live_51RtgdG...` | Rotate in [Stripe Dashboard](https://dashboard.stripe.com/apikeys) → API Keys → Roll key |
| **Stripe production publishable** | `pk_live_51RtgdG...` | Rotate in Stripe Dashboard if the secret was rotated (publishable keys can be rolled separately) |
| **Stripe test secret** | `sk_test_51S5t0k...` | Rotate if this repo is public or shared |
| **Google Maps API** | `AIzaSyDKZL34B2z...` | Restrict in [Google Cloud Console](https://console.cloud.google.com/) (API restrictions, bundle IDs); consider regenerating if exposed broadly |

## Remediation Completed

- `app.json` → Google Maps key removed; now injected via `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` in `app.config.js`
- `server/scripts/stripe/create_stripe_prices.js` → Uses `STRIPE_SECRET_KEY` env var
- Docs → Real keys replaced with placeholders (`sk_live_xxx`, `pk_live_xxx`, `sk_test_xxx`)

## Confirming Rotation

To confirm keys are rotated and no longer valid:

1. **Stripe:** In Stripe Dashboard → Developers → API keys, check that old keys show "Rolled" or are deleted.
2. **Google Maps:** In Google Cloud Console → APIs & Services → Credentials, verify the key is restricted or replaced.
