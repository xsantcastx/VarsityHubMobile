# Provider Dashboard Verification

**Purpose:** operator-side companion to [PENDING_OPERATOR_ACTIONS.md](./PENDING_OPERATOR_ACTIONS.md). That doc tells you **what** must be done and **why**. This doc tells you **where to click** and **how to confirm each provider-side change actually landed**.

Use this after or alongside the block-driven runbook. Keep the same ordering: Stripe first, then Railway/env, then stores, then EAS, then DNS.

> Current known live blocker: the previously configured `STRIPE_SECRET_KEY` was confirmed dead by live API call and returned `api_key_expired`. Do not trust any prior Stripe "looks configured" state until rotation + validation are complete.

## 1. Stripe Dashboard

### 1.1 Rotate the API secret key

Path:
- Stripe Dashboard
- `Developers`
- `API keys`
- Find the live secret key currently used by production
- Click `Roll key` or create a replacement live secret key per Stripe's current UI

Do:
- Create a new live secret key.
- Copy it immediately into a secure scratch buffer.
- Do not delete the old key until Railway has the new one and validation passes.

Then:
- Railway dashboard
- Project `capable-trust`
- Service `api`
- `Variables`
- Replace `STRIPE_SECRET_KEY`
- Redeploy or restart the service if Railway does not hot-apply it cleanly

Pass:
- `STRIPE_SECRET_KEY` is updated in Railway
- `curl https://api.stripe.com/v1/prices/... -u "$STRIPE_SECRET_KEY:"` no longer returns `api_key_expired`
- Production checkout/session creation no longer errors on Stripe auth

### 1.2 Rotate the webhook signing secret

Path:
- Stripe Dashboard
- `Developers`
- `Webhooks`
- Open the production endpoint used by the VarsityHub API

Do:
- Confirm the endpoint URL is the production API webhook route currently used by the server.
- Reveal or rotate the signing secret.
- Copy the new secret into Railway as `STRIPE_WEBHOOK_SECRET`.

Then:
- From the webhook endpoint page, use Stripe's `Send test webhook` control.
- Send a representative billing event such as `checkout.session.completed` or another event the endpoint already accepts.

Pass:
- Stripe shows `2xx` delivery for the test event
- Railway logs do not show signature-mismatch rejection
- The API accepts the event without failing webhook auth

### 1.3 Verify the live price objects

Path:
- Stripe Dashboard
- `Product catalog` or `Products`

Find and confirm the price objects backing these env vars:
- `STRIPE_PRICE_VETERAN`
- `STRIPE_PRICE_LEGEND`
- `STRIPE_PRICE_AD_WEEKDAY`
- `STRIPE_PRICE_AD_WEEKEND`

Do:
- Open each product and copy the live `price_...` ID.
- Compare the dashboard value to the Railway env value.
- If any price ID changed during cleanup, update Railway immediately.

Pass:
- Each Railway env var points at a live Stripe `price_...` object
- Veteran/Legend prices correspond to the intended subscription products
- Weekday/weekend ad prices correspond to the intended ad-slot products

Notes:
- The repo wiring expects subscription price IDs from env, not hardcoded constants.
- If a price is archived or deleted in Stripe, checkout can still fail even after the key rotation.

## 2. Railway Dashboard

Path:
- Railway
- Project `capable-trust`
- Service `api`
- `Variables`

### 2.1 Set payment and Apple verification env

Confirm and set:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APPLE_BUNDLE_ID`

Expected Apple bundle ID:
- `com.varsithub.varsityhub-ios`

Important:
- Production server code now hard-fails if Apple IAP shared-secret verification is configured without `APPLE_BUNDLE_ID`.

Pass:
- `APPLE_BUNDLE_ID` is exactly `com.varsithub.varsityhub-ios`
- Stripe vars are present and current
- API health endpoint returns `200`
- Railway boot logs do not show fatal missing-env errors

### 2.2 Confirm SendGrid template IDs are populated

Path:
- Same Railway `Variables` page

Required template env vars:
- `SENDGRID_VERIFICATION_TEMPLATE_ID`
- `SENDGRID_PASSWORD_RESET_TEMPLATE_ID`
- `SENDGRID_TEAM_INVITE_TEMPLATE_ID`
- `SENDGRID_ORG_INVITE_TEMPLATE_ID`
- `SENDGRID_JOIN_REQUEST_ADMIN_TEMPLATE_ID`
- `SENDGRID_JOIN_REQUEST_APPROVED_TEMPLATE_ID`
- `SENDGRID_JOIN_REQUEST_DENIED_TEMPLATE_ID`
- `SENDGRID_EVENT_APPROVED_TEMPLATE_ID`
- `SENDGRID_EVENT_DENIED_TEMPLATE_ID`
- `SENDGRID_EVENT_CANCELED_TEMPLATE_ID`
- `SENDGRID_PAYMENT_FAILED_TEMPLATE_ID`
- `SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID`
- `SENDGRID_AD_PENDING_REVIEW_TEMPLATE_ID`
- `SENDGRID_AD_APPROVED_TEMPLATE_ID`
- `SENDGRID_AD_REJECTED_TEMPLATE_ID`
- `SENDGRID_ORG_APPROVAL_TEMPLATE_ID`
- `SENDGRID_ORG_DENIAL_TEMPLATE_ID`
- `SENDGRID_ADMIN_ACTION_CONFIRMATION_TEMPLATE_ID`

Pass:
- Every required key is present
- Every value is a SendGrid dynamic template ID in the form `d-<32 hex chars>`
- API boot logs do not complain about missing critical templates

### 2.3 Restart and verify production health

Path:
- Railway `Deployments` or service controls

Do:
- Trigger a deploy/restart after env changes if Railway has not already recycled the service.

Pass:
- `https://varsityhub.app/health` returns `200`
- No fatal env validation errors appear on boot

## 3. SendGrid Dashboard

Path:
- SendGrid
- `Email API`
- `Dynamic Templates`

### 3.1 Confirm the hosted templates exist

For each Railway template env var above:
- Open the matching dynamic template in SendGrid.
- Confirm the template still exists and is not archived.
- Confirm the version intended for production is active.

Pass:
- Every required template ID stored in Railway exists in SendGrid
- Each template has one active version
- None of the production IDs point to deleted or draft-only templates

### 3.2 Spot-check template variable shape

Do:
- Open the dynamic template's active version.
- Check the variable names used by the template against the current local contract expectations before sending production mail.

Minimum expectation:
- No obvious drift like renamed placeholders that would render blanks in production
- If a template was recently edited in SendGrid, compare it against the local `sendgrid-templates/` or email contract coverage before declaring it safe

Pass:
- Template IDs exist
- Active versions are correct
- Placeholder names still match the app payload shape

Note:
- Local contract tests only pin the repo-side template assumptions. They do **not** prove the hosted SendGrid template still matches unless you inspect the hosted version.

## 4. App Store Connect

Path:
- App Store Connect
- `My Apps`
- `VarsityHub`

### 4.1 Confirm subscription products

Path:
- `Subscriptions`

Find:
- `MIDTIER`
- `TOPTIER`

For each subscription, confirm:
- Product ID exactly matches the code expectation
- The product belongs to the correct subscription group
- Pricing is the intended tier
- Status is not missing, rejected, or otherwise unavailable for sandbox/prod use
- Localizations and screenshots are complete enough for the current review stage

Pass:
- `MIDTIER` exists for Veteran
- `TOPTIER` exists for Legend
- Both are in a usable review state
- Pricing is correct

### 4.2 Confirm Apple ad IAP products

Path:
- `In-App Purchases`

Find:
- `MOND_THURS`
- `FRI_SUN`

For each IAP, confirm:
- Product ID exactly matches code
- Product type matches the intended Apple-only ad purchase flow currently in use
- Status is available for sandbox testing
- Metadata and screenshots are complete enough for the current review stage

Pass:
- `MOND_THURS` exists
- `FRI_SUN` exists
- Both are testable in sandbox

### 4.3 Confirm app identifiers match server verification

Path:
- App information or app record metadata for the iOS app

Confirm:
- Bundle ID is `com.varsithub.varsityhub-ios`

Pass:
- App Store Connect app record and Railway `APPLE_BUNDLE_ID` agree exactly

### 4.4 Run sandbox purchase verification

Path:
- TestFlight build installed on a sandbox tester device

Do:
- Purchase `MIDTIER`
- Purchase `TOPTIER` on a separate clean test account or after resetting state
- Trigger the Apple ad purchase flows for `MOND_THURS` and `FRI_SUN`

Pass:
- Purchase UI loads
- Purchase completes
- Server accepts the receipt or signed transaction
- Entitlement/ad result appears correctly in-app

## 5. Google Play Console

Path:
- Google Play Console
- App `VarsityHub`

### 5.1 Confirm Android subscription products

Path:
- `Monetize`
- `Products`
- `Subscriptions`

Find:
- `MIDTIER`
- `TOPTIER`

For each subscription, confirm:
- Product ID exactly matches code
- Base plan is active
- Offer configuration is not accidentally disabled
- Billing availability is correct for the intended release track

Pass:
- `MIDTIER` exists and is active
- `TOPTIER` exists and is active
- Android testers can buy them in the internal track

### 5.2 Confirm Android does not expect ad-day IAP SKUs

Path:
- `Monetize`
- `Products`
- `In-app products`

Do:
- Confirm there is no Android dependency on Apple-only ad SKUs.
- Do not create `MOND_THURS` or `FRI_SUN` on Android just to mirror Apple.

Pass:
- Android subscription products exist
- No one is trying to ship Apple ad IAP SKUs through Play Console
- Android ad flow still uses Stripe by design

### 5.3 Run internal-track purchase verification

Path:
- Internal testing release installed on an Android tester device

Do:
- Buy `MIDTIER`
- Buy `TOPTIER`

Pass:
- Billing sheet opens
- Purchase completes
- App/server entitlement changes land correctly

## 6. Expo / EAS

Use this only after the credential/store checks above are done.

### 6.1 Confirm the Maps key secret exists

Path:
- Expo dashboard or EAS secrets/environment for the project

Find:
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`

Pass:
- Secret exists at project scope
- It contains the rotated value from Google Cloud

### 6.2 Confirm Sentry auth is still available

Find:
- `SENTRY_AUTH_TOKEN`

Pass:
- It still exists before the next production build

### 6.3 Build only once the bundle is ready

Use the bundled-build approach from [PENDING_OPERATOR_ACTIONS.md](./PENDING_OPERATOR_ACTIONS.md):
- Maps key rotation
- Sentry mobile alignment
- Mobile worktree decision
- Universal-link entitlements already on `main`

Pass:
- `npm run verify:build` succeeds before build
- TestFlight/internal-track builds verify Maps, IAP, Stripe checkout, and universal links

## 7. Namecheap DNS

Path:
- Namecheap
- `Domain List`
- `varsityhub.app`
- `Manage`
- `Advanced DNS`

### 7.1 Attach apex and www to Railway

Do:
- Add the apex `ALIAS` record using the Railway target for `varsityhub.app`
- Add the `www` `CNAME` record using the Railway target for `www.varsityhub.app`

Pass:
- Railway shows both custom domains as verified
- HTTPS cert provisions successfully

### 7.2 Confirm Apple association file is publicly reachable

After DNS and Railway certs settle, confirm:
- `https://varsityhub.app/health`
- `https://varsityhub.app/.well-known/apple-app-site-association`

Pass:
- Both return `200`
- The apple-app-site-association response has `application/json`

## 8. Final operator close-out

You are done only when all of the following are true:
- Stripe live key is rotated and no longer returns `api_key_expired`
- Stripe webhook secret is rotated and test delivery succeeds
- Railway has current Stripe, Apple, and SendGrid env values
- App Store Connect matches `MIDTIER`, `TOPTIER`, `MOND_THURS`, `FRI_SUN`
- Play Console matches `MIDTIER`, `TOPTIER`
- EAS has the rotated Maps key and still has Sentry auth
- `varsityhub.app` and `www.varsityhub.app` resolve cleanly
- Test purchases work on iOS and Android

If any one of those is still open, the operator handoff is not complete.
