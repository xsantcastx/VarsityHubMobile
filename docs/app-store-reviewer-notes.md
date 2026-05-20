**App Review Notes — VarsityHub**

VarsityHub is a team management and social platform for youth sports communities. Users can follow teams, browse a feed of posts and highlights, view events and maps, and message other members. Coaches can manage rosters, schedule events, and purchase promotional ads.

---

**Demo Account**

- Email: `demo@varsityhub.app`
- Password: provided in App Store Connect review notes / sign-in information

This account is email-verified, fully onboarded, pre-approved as a coach / organizer, and attached to `VarsityHub Review League` and `VarsityHub Review Team`. It is the single App Review login and starts on the free Rookie plan so the subscription purchase buttons remain visible during review. Feed, events, maps, messaging, coach tools, approvals, schedules, ad booking, and billing surfaces are pre-populated and reachable immediately after sign-in.

---

**Testing Key Flows**

1. _Main review flow:_ Sign in with `demo@varsityhub.app`. This account is already attached to the seeded review league and review team, and it follows that content so the app is populated on first launch.
2. _View Events:_ Tap the Events tab to see upcoming seeded events. Tap an event for details including location and time.
3. _Maps:_ The Maps tab shows nearby teams and event locations.
4. _Messaging:_ Tap the Messages tab to view conversations.

---

**How To Delete an Account (Guideline 5.1.1(v))**

The app supports in-app account deletion with a confirmation step.

For deletion testing, please use a disposable account (newly created in-app), so the shared demo account remains available for IAP review.

1. Sign in (or create a new account).
2. Open **Settings**.
3. Open **Account**.
4. Tap **Delete Account** (also available in **Session**).
5. Tap **Continue**.
6. Type `DELETE` and, for password accounts, enter the account password.
7. Tap **Delete** to complete deletion.

Expected behavior: the account is deleted, user data is anonymized/deleted server-side, and the session is signed out.

---

**How To Locate In-App Purchases**

All iOS purchases are presented inside the app and use Apple In-App Purchase.

1. **Subscriptions**
   - Sign in with the demo account.
   - Open **Settings**.
   - Open **Billing & Plans**.
   - Tap **View Subscription Plans** (direct path to purchase buttons).
   - Optional: coaches can also tap **Manage Subscription**.
   - The subscription purchase buttons are:
     - **Upgrade to Veteran**
     - **Upgrade to Legend**

2. **Ad Purchases**
   - Sign in with the demo account.
   - Open **Settings**.
   - Open **My Content**.
   - Tap **My Ads**.
   - Open **VarsityHub Review Coach Demo Ad**.
   - Tap **Schedule Dates**.
   - Select campaign dates and tap the checkout button at the bottom:
     - weekday slot product: `MOND_THURS`
     - weekend slot product: `FRI_SUN`

Apple reviews IAP in the Apple-provided sandbox environment by design. The same iOS purchase flow is used for production releases, where approved live products process real App Store transactions.

---

**Coach / Organizer Review Access**

Please use `demo@varsityhub.app` as the single review account. It is already approved for coach / organizer flows, so there is no need to create a new coach account during review.

---

**Content Moderation (Guideline 1.2)**

All user-generated content (posts, comments, messages) can be reported by any user via an in-app flagging system. Reports are reviewed by our moderation team through an admin dashboard. Enforcement is escalated automatically: 3 reports trigger a warning to the user, and 5 reports result in a strike. Repeated violations lead to account suspension. Ads submitted by coaches go through a separate approval workflow and must be approved by an administrator before becoming visible to other users.

---

**Youth Safety Measures**

- **COPPA compliance:** Users under 13 are blocked from creating accounts during registration.
- **Under-18 restrictions:** Users between 13 and 17 have restricted direct messaging access. DMs use a trust-based system that limits who can initiate conversations with minor accounts.
- **Age-gated content:** The app contains no violent, sexual, or gambling content. All content is youth sports related.
- **Age rating:** 12+ (sports content only).

---

**In-App Purchases (iOS)**

Subscriptions and ad purchases use Apple In-App Purchase exclusively on iOS. Available plans:

- Rookie: Free (3 teams, 50-player roster limit)
- Veteran: $0.99/month per team over 3 teams (100-player roster limit)
- Legend: $19.99/year (unlimited teams and rosters, club features)

Ad purchases are one-time IAP transactions for promoting team content within the app.

Subscription product IDs:

- `MIDTIER` — Veteran
- `TOPTIER` — Legend

Ad product IDs:

- `MOND_THURS`
- `FRI_SUN`

---

**Contact**

If you encounter any issues during review or need an upgraded demo account, please reply to this submission and we will respond promptly.
