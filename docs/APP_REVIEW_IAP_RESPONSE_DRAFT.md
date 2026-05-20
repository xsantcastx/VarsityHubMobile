# App Review Response Draft (Account Deletion + IAP)

Use this reply in App Store Connect for the current rejection that includes Guideline 5.1.1(v) and Guideline 2.1(b).

---

Hello App Review Team,

Thank you for the feedback. We addressed both items below.

### 1) Account deletion (Guideline 5.1.1(v))

The app includes an in-app self-serve account deletion flow.

Steps:

1. Sign in to any account (or create a new account in-app).
2. Open `Settings`.
3. Open the `Account` section.
4. Tap `Delete Account` (also available under `Session`).
5. Tap `Continue`.
6. Type `DELETE` (and enter password if prompted).
7. Tap `Delete`.
8. The app confirms deletion and signs the user out.

For the demonstration video requested in the review message, we will attach a physical-device recording that shows:

- sign in (or account creation),
- navigation to `Settings` → `Account` → `Delete Account`,
- the full deletion confirmation flow through completion.

### 2) How to locate In-App Purchases (Guideline 2.1(b))

Review account:

- Email: `demo@varsityhub.app`
- Password: `provided in App Store Connect review notes`

The review account is coach-approved and starts on the free Rookie plan so upgrade purchase buttons remain visible.

**Subscriptions**

1. Sign in with the review account.
2. Open `Settings`.
3. Open `Billing & Plans`.
4. Tap `View Subscription Plans` (direct path to purchase buttons).
5. Optional for coach accounts: tap `Manage Subscription`.
6. Purchase options:
   - `Upgrade to Veteran` (product ID `MIDTIER`)
   - `Upgrade to Legend` (product ID `TOPTIER`)

**Ad purchases**

1. Sign in with the review account.
2. Open `Settings`.
3. Open `My Content`.
4. Tap `My Ads`.
5. Open `VarsityHub Review Coach Demo Ad`.
6. Tap `Schedule Dates`.
7. Select dates and tap checkout.
8. Apple ad product IDs:
   - weekday slot: `MOND_THURS`
   - weekend slot: `FRI_SUN`

Apple reviews IAP in the Apple-provided sandbox environment, and these flows are configured for sandbox review. We also confirm the Paid Apps Agreement is accepted on our App Store Connect account.

Thank you.
