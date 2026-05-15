# App Review IAP Response Draft

Use this reply in App Store Connect when Apple says they cannot locate the in-app purchases.

---

Hello,

Thank you. The in-app purchases are available inside the iOS app and can be reached with the review account after sign-in. The review account is coach-approved and remains on the free Rookie plan so the subscription upgrade buttons are visible during review.

Review account:

- Email: `demo@varsityhub.app`
- Password: `provided in App Store Connect review notes`

Steps to locate the subscriptions:

1. Sign in with the review account provided in App Store Connect.
2. Open `Settings`.
3. Open the `Billing` section.
4. Tap `Manage Subscription`.
5. The subscription purchase options are:
   - `Upgrade to Veteran` (product ID: `MIDTIER`)
   - `Upgrade to Legend` (product ID: `TOPTIER`)

Steps to locate ad in-app purchases:

1. Sign in with the review account.
2. Open `Settings`.
3. Open `My Content`.
4. Tap `My Ads`.
5. Open `VarsityHub Review Coach Demo Ad`.
6. Tap `Schedule Dates`.
7. Select campaign dates and tap the checkout button at the bottom of the screen.
8. The Apple ad product IDs are:
   - weekday ad slot: `MOND_THURS`
   - weekend ad slot: `FRI_SUN`

The review ad is already approved for review and configured with:

- target ZIP code: `10001`
- radius: `9` miles
- target URL: `https://www.varsityhub.app`

Important note for review: Apple tests these purchases in the Apple-provided sandbox environment during App Review. That is expected. The same iOS in-app purchase flow is used in production with the approved live products.

Thank you.
