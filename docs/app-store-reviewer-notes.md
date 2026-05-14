**App Review Notes — VarsityHub**

VarsityHub is a team management and social platform for youth sports communities. Users can follow teams, browse a feed of posts and highlights, view events and maps, and message other members. Coaches can manage rosters, schedule events, and purchase promotional ads.

---

**Demo Account**
Email: `demo@varsityhub.app`
Password: provided in App Store Connect review notes / sign-in information

This is the review account we bootstrap for App Review. It is email-verified and fully onboarded so the reviewer can reach the app immediately after sign-in.

---

**Testing Key Flows**

1. _Browse Feed:_ After login, the home tab displays a feed of posts from followed teams. Scroll to browse; tap a post to view details and comments.
2. _Follow a Team:_ Navigate to the Explore tab, search for a team, and tap "Follow." The team's posts will appear in your feed.
3. _View Events:_ Tap the Events tab to see upcoming events. Tap an event for details including location and time.
4. _Maps:_ The Maps tab shows nearby teams and event locations.
5. _Messaging:_ Tap the Messages tab to view conversations.

---

**How To Locate In-App Purchases**

All iOS purchases are presented inside the app and use Apple In-App Purchase.

1. **Subscriptions**
   - Sign in with the demo account.
   - Open **Settings**.
   - Open **Billing**.
   - Tap **Manage Subscription**.
   - The subscription purchase buttons are:
     - **Upgrade to Veteran**
     - **Upgrade to Legend**

2. **Ad Purchases**
   - Sign in with the demo account.
   - Open **Settings**.
   - Open **My Content**.
   - Tap **My Ads**.
   - Open **VarsityHub Review Demo Ad**.
   - Tap **Schedule Dates**.
   - Select campaign dates and tap the checkout button at the bottom:
     - weekday slot product: `MOND_THURS`
     - weekend slot product: `FRI_SUN`

Apple reviews IAP in the Apple-provided sandbox environment by design. The same iOS purchase flow is used for production releases, where approved live products process real App Store transactions.

---

**Coach Accounts Require Admin Approval**

The app has two roles: Fan (default) and Coach. Coach accounts require manual approval by a league administrator to prevent unauthorized access to team management features (rosters, events, lineups).

To test the coach approval flow: create a second account, select Coach role, select "Join Existing League", and search for "VarsityHub Demo League". The approval request can then be reviewed by an administrator account.

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

- Rookie: Free (2 teams, 50-player roster limit)
- Veteran: $0.99/month per team (100-player roster limit)
- Legend: $20/year (unlimited teams and rosters, club features)

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
