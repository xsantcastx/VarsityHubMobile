Epics & User Stories
1) Authentication & Accounts

Google sign-in

As a user, I want to sign in with Google, so that I can access the app quickly without creating a new password.

AC: Given I tap “Continue with Google”, When Google auth succeeds, Then my VarsityHub account is created/linked and I’m logged in.

Role-aware login landing

As a Fan/Coach, I want my default home to reflect my role, so that I see the most relevant content first.

AC: Given I’m a Fan, When I log in, Then I land on Highlights; Given I’m a Coach, Then I land on Team/Events dashboard.

Default Fan bio

As a Fan, I want a sensible default bio, so that my profile isn’t empty on day one.

AC: Given my role = Fan, When my account is created, Then my bio is prefilled with the client’s requested copy.

2) Subscriptions, Pricing & Billing (Stripe)

Plan tiers (Rookie/Veteran/Legend)

As a Coach, I want to select a plan, so that I can add teams according to limits.

AC: Rookie: 2 free teams; Veteran: add team at $1.50/month each; Legend: unlimited teams for $29.99/year; proration and limits enforced on create/add team.

Ad hosting checkout

As an advertiser, I want to purchase ad slots with weekday/weekend/single-day pricing, so that I can target dates and areas.

AC: Weekday bundle (Mon–Thu), Weekend bundle (Fri–Sun), Single day $1.75 weekday, $2.99 weekend; Stripe fee, sales tax, and transaction record captured; receipts emailed.

Promo codes

As an advertiser, I want limited-use promo codes, so that I can redeem discounts while supplies last.

AC: Given a valid active promo code, When I apply it, Then discount applies; enforce global cap (e.g., first 8/first 75 per client notes).

3) Maps & Calendar

Google Maps event location

As a user, I want to see event locations on a map, so that I can navigate to games easily.

AC: Event detail shows map pin; tap opens native Maps.

Google Calendar sync (schools)

As a Coach, I want to import/sync my school’s Google Calendar, so that team events auto-populate.

AC: Given OAuth to a calendar, When I connect, Then events import; future updates sync daily; duplicates deduped.

4) Onboarding (Fans)

Fan onboarding actions

As a new Fan, I want clear actions (View moments, Post reviews/highlights, Support creators, Claim my team), so that I know what to do first.

AC: Onboarding page shows those 4 entries; “Add players” is not shown; each action routes correctly.

Zip code required

As a Fan, I want to provide my zip code, so that content and ads can be localized.

AC: Zip code is mandatory; validation enforces format; saves to profile.

5) Onboarding (Coaches/Organizations)

Team color & org creation

As a Coach, I want to pick a team color and join/create my school org, so that my team branding is clear and organizational hierarchy exists.

AC: New coach flow requires team color; coach can search/join existing org or create new; first coach to a school can create org.

Event merge suggestion

As a Coach, I want simultaneous games (same time/place) by both teams to merge, so that fans see a single shared event.

AC: When two events share near-identical datetime & location, Then app suggests merge; upon confirmation, a combined event is shown.

Coach tier benefits copy & badges

As a Coach, I want tier perks (priority support, admin per team, trophy/gold badges), so that the value of upgrading is clear.

AC: Tier description appears in paywall; proper badges render on coach/team pages by tier.

6) Uploading & Posting

Upload gesture switcher

As a user, I want a middle toggle to switch Camera vs Review mode (blue up / red down), so that I can quickly capture or review.

AC: Swipe up = Camera; swipe down = Review; selected state is visually distinct.

Auto-suggest nearest event

As a user, I want the nearest event preselected after tapping Post, so that my content is correctly attached.

AC: After choosing media and tapping Post, nearest event (by time/location) appears first; user can re-target to team/event/personal page.

Rotate prompts & “Add to Story” camera

As a user, I want helpful rotating prompts and Story capture via camera, so that posting is fast and guided.

AC: Rotating tips display; “Add to Story” opens camera (not gallery).

1080p video & optional encryption

As a user, I want reliable 1080p uploads and secure at-rest media, so that quality is high and content is protected.

AC: Video processed to 1080p; at-rest encryption toggleable via config; playback stable on target devices.

7) Ads Hosting UX

Date range highlighting

As an advertiser, I want selected dates to auto-highlight weekday/weekend windows, so that I understand pricing bands.

AC: Selecting dates highlights Mon–Thu or Fri–Sun; single-day option shows contextually with proper price.

Zip code radius & alternatives

As an advertiser, I want coverage within 20 miles of a zip, so that my ad hits the right audience; if full, suggest nearby zips.

AC: Purchase checks capacity by zip; if booked, suggest next best zips; selection updates cart.

Banner spec handling & link-through

As an advertiser, I want my banner to fit (stretch or color fill), so that it displays well and clicks through to my link.

AC: Uploader supports letterbox/fill/stretch with preview; click opens provided URL; require media/logo and short description.

Eight-week booking horizon

As an advertiser, I want to book up to 8 weeks ahead, so that pricing remains predictable.

AC: Date picker disabled beyond 8 weeks; server validates range.

Email verification flow

As an advertiser, I want to be routed to a proper confirmation page, so that I can complete verification seamlessly.

AC: After purchase, “OK” is replaced with a screen instructing email verification, with deep link to inbox if supported.

8) Highlights, Discover & Home

Highlights ranking

As a Fan, I want Trending to show top 3 first (then algorithm), Recent to show newest nationwide, and Top to show the 10 most-engaged posts, so that discovery feels alive.

AC: Tabs: Trending (top 3 pinned), Recent (reverse chrono), Top (top 10 by engagement); remove “10 highlights” UI element; buttons are readable/high contrast.

Discover with calendar & search

As a Fan, I want a calendar and a search bar at the top, so that I can jump to dates and find teams/events/users quickly.

AC: Calendar visible top; search bar always visible; “Following” section appears under calendar.

Home feed simplification

As a Fan, I want Home to be a mixed, scrollable feed (logo larger, centered title, zip search), so that I consume content quickly.

AC: Home shows mixed Highlights; logo bigger; “Varsity Hub” centered; zip code search present; “Physical Coming Soon” moved below Highlights.

9) Navigation & Deep Links

Post detail linking

As a user, I want to navigate from a post to its Event, Team, and Author pages, so that I can explore context.

AC: Post detail contains tappable links to event/team/user; share sheet supports social and direct share.

Feed view consistency

As a user, I want the global feed to look like profile feed except favorite team feed, so that UX feels consistent.

AC: Default feeds match profile style; favorite-team feed uses video-forward layout.

10) Coach & Team Management

Team creation with limits

As a Coach, I want to create teams within my plan limits, so that billing aligns with usage.

AC: Rookie can create up to two teams; Veteran can add more at per-team monthly charge; Legend unlimited.

Player invitations & group chat

As a Coach, I want to invite players and have a default group chat auto-created, so that communication starts immediately.

AC: Adding players triggers invitation; upon first player added, a team group chat is created and members auto-joined.

Event invitation/merge flow

As a Coach, I want invitations to merge duplicate game events from opponents, so that we keep a single canonical event.

AC: When an opponent creates the same game, I receive an invitation to merge; accepting unifies the event.

Season selection

As a Coach, I want to choose a season and have the year propagate, so that setup is faster.

AC: Selecting “Fall/Spring/Summer/Winter” auto-suggests current/next year; editable override.

11) Ads & Banner Placement/Aesthetics

Banner ad separation

As a user, I want banner ads visually separated from content, so that the UI remains clean.

AC: Banners use dedicated container with spacing; never compress content; passes contrast & tap-target guidelines.

Buttons visibility

As a user, I want clearly visible scroll buttons/actions, so that navigation is obvious.

AC: Buttons meet contrast AA; hit area ≥ 44x44pt; persists on dark/light modes.

12) Infrastructure & Data

Railway database connection

As a developer, I want the Railway DB configured for the app, so that staging/production share a reliable backend.

AC: Env vars set; app connects and migrates schema; healthcheck passes.

Transaction logging

As an operator, I want all Stripe transactions (totals, tax, fee, promo usage) stored, so that I can reconcile revenue.

AC: Each successful charge logs: user, items, base price, tax, Stripe fees, promo code used, net, timestamp.

Media storage policy

As ops, I want a clear media retention/encryption policy, so that we comply with requirements.

AC: At-rest encryption flag documented; retention window configured; CDN caching verified.

13) Support & Contact

Support email routing

As a user/advertiser, I want a single contact endpoint, so that I can reach support for ads or app help.

AC: Contact entries route to customerservice@varsityhub.app
; canned response acknowledges receipt.

Cross-Cutting Non-Functional Requirements

Responsive & Safe-Area Compliance

As a mobile user

I want every screen and component to fit correctly within iPhone and Android “safe areas”

So that text, buttons, and UI elements are never cut off or hidden behind camera notches, status bars, or rounded corners.

Acceptance Criteria:

Given I view any screen on modern devices (iPhone 14 Pro, iPhone 15, Pixel 8, Samsung S24, etc.),
When the app renders,
Then all visible content respects system safe-area insets (top/bottom padding), and no content is hidden behind the camera notch or rounded edges.

UI layouts must use platform-native SafeAreaView (React Native) or system insets.

Text, icons, and buttons must remain fully visible and tappable in both portrait and landscape orientation.

Tested across common aspect ratios (19:9, 20:9, 21:9) and screen cutouts.

Scrolling content must include sufficient padding at top/bottom to prevent cutoff under navigation bars.

Accessibility: All critical actions achieve WCAG 2.1 AA for contrast and tap targets.

Performance: Feed and post detail LCP < 2.5s on mid-tier Android; video starts in < 1.0s P95 with adaptive bitrate.

Analytics: Track: sign-in, onboarding completion, post create, ad checkout funnel, event merges, plan upgrades.

Security: OAuth tokens stored securely; PII & payments never logged; Stripe webhooks verified; media at-rest encryption toggle.

Dependencies & Notes

Stripe products/prices for: single-day (weekday/weekend), bundles (Mon–Thu, Fri–Sun), plan tiers, promo codes.

Google integrations: Sign-In, Maps SDK, Calendar API (read-only import + periodic sync).

Event merge heuristic: same date/time ±15 min, same venue geofence (<150m).

Ads capacity: per-zip inventory model; 20-mile radius coverage map; alternative zips picker.

Content pipeline: 1080p transcode, thumbnail generation, optional story camera path.