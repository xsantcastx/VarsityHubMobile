# ✅ VarsityHub QA Checklist (Pre-Launch)

> **Last Updated:** November 30, 2025 @ 07:15 UTC  
> **Build:** iOS Dev Client on iPhone 17 Pro Simulator  
> **Metro:** Running on port 8081  
> **API:** Railway production responding (auth + events verified)  
> **TypeScript:** 0 errors ✓

Use this as a working log while validating the app. Columns use shorthand: `P` = Pass, `F` = Fail (with notes), `N/A` = not applicable.

---

## Overnight Fixes (Nov 30, 2025)

| Fix | Status | Details |
| --- | ------ | ------- |
| ErrorBoundary Sentry | ✅ | Now captures errors to Sentry with componentStack |
| Colors type fixes | ✅ | settings/index.tsx: `.muted` → `.mutedText`, `.primary` → `.tint` |
| Router path fixes | ✅ | event-detail, public-event: `/post` → `/post-detail` |
| API entity types | ✅ | Added: Post.getByEvent, TeamMemberships.update/delete, User.verifyPhone |
| Team.list signature | ✅ | Now supports `{ limit }` options object |
| Event.filter signature | ✅ | Now supports limit parameter and approval_status filter |
| useGoogleAuth cleanup | ✅ | Removed deprecated proxy options, simplified auth flow |
| Gradient audit | ✅ | All gridShade instances verified transparent in light mode |

---

## Priority 1: Stability & Visual QA

| Area | Scenario | Status | Notes |
| ---- | -------- | ------ | ----- |
| **Metro/Bundler** | App connects to Metro without red screens | ✅ P | Running via `npx expo run:ios` |
| **Expo Dev Client** | Development build loads and hot reloads work | ✅ P | Installed on iPhone 17 Pro |
| **Feed Gradient Fix** | Event cards display without white wash overlay | ✅ P | All 3 `gridShade` instances use `transparent` in light mode |
| **GameDetails Vote Fix** | Vote bars show full color without white overlay | ✅ P | `voteFillHighlight` uses `transparent` colors |
| **Light Mode Theme** | All screens render correctly in light mode | ⏳ | **Manual verification needed** - check feed, profile, game details, settings |
| **Dark Mode Theme** | All screens render correctly in dark mode | ⏳ | **Manual verification needed** - toggle in Settings → Appearance |

---

## Priority 2: Core User Flows

| Area | Scenario | Notes | Status |
| ---- | -------- | ----- | ------ |
| **Auth** | Fan signup → confirm email → login | Test on iOS + Android | ✅ API (signup works, JWT returned) |
| | Coach signup → onboarding step 10 submission | Ensure plan + team data persist | ⏳ |
| | Password reset: request code, complete reset, login | Verify error copy for expired/invalid | ⏳ |
| **Onboarding** | Fan flow (all 10 steps) | Confirm state persists between app restarts | ⏳ **Manual test needed** |
| | Coach flow: organization search/create, team creation | Check authorized users payload stored | ⏳ **Manual test needed** |
| **Payments** | Ad reservation → Stripe checkout | Expect PENDING → CONFIRMED via webhook | ⏳ Needs STRIPE_SECRET_KEY in prod |
| | Subscription upgrade/downgrade via Settings | Confirm role toggles to `coach` | ⏳ Needs STRIPE_SECRET_KEY in prod |
| **Teams** | Create team (coach role guard) | Non-coach should be blocked | ⏳ |
| | Inline edit (team-profile) & `/edit-team` screen | Verify persistence after refresh | ⏳ |
| | Member role change + removal | Ensure toast/alerts show | ⏳ |
| **Media** | Upload team logo (new + replace) | Confirm upload handles retry failures | ⏳ Needs CLOUDINARY_* in prod |
| | Create post with photo + video | Ensure feed renders without crashes | ⏳ Needs CLOUDINARY_* in prod |
| **Events** | Fan submits event → stays pending | Coach/admin approves/rejects | ✅ API (events list returns) |
| | Coach creates game → auto-approves | Validate game type constraints | ⏳ |
| **Messaging** | DM minor ↔ adult with coach status | Safe Zone warnings display | ⏳ **Coach permissions audit** |
| | Push notification permission handling | Guards prevent crashes | ⏳ |
| **Poll Voting** | Vote on poll, see results update | PollCard renders correctly | ⏳ Uses mock API (post-launch fix) |
| **Event Discovery** | Browse events, filter by category | Events load and display correctly | ⏳ |
| **RSVP Flow** | RSVP to event, see confirmation | RSVPBadge updates correctly | ⏳ **Manual test needed** |

---

## Priority 3: Backend Readiness

| Item | Status | Notes |
| ---- | ------ | ----- |
| Railway deployment | ✅ P | API at `https://api-production-8ac3.up.railway.app` - /health returns 200 |
| Prisma migrations | ✅ P | 44 migrations applied |
| Database connection | ✅ P | Connected in production (health check confirms) |
| JWT configured | ✅ P | JWT_SECRET set in production |
| SMTP configured | ✅ P | Email sending ready |
| Sentry (server) | ✅ P | DSN configured in production |
| Auth routes | ✅ P | 17 endpoints: register, login, google, apple, password reset, verify, etc. |
| **Stripe payments** | ⚠️ CRITICAL | Need `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` in Railway |
| **Cloudinary uploads** | ⚠️ CRITICAL | Need `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| **Google OAuth** | ⚠️ CRITICAL | Need `GOOGLE_OAUTH_CLIENT_IDS` in Railway for Google sign-in |
| **Google Maps** | ⚠️ | Need `GOOGLE_MAPS_API_KEY` for map features |
| Twilio SMS | ⏳ Optional | Email-only verification works; SMS can be added later |

### Missing Environment Variables (Add to Railway)

See [docs/RAILWAY_ENV_SETUP.md](./RAILWAY_ENV_SETUP.md) for complete setup instructions.

---

## Priority 4: Release Checklist

| Item | Status | Notes |
| ---- | ------ | ----- |
| EAS build configs | ✅ | dev/preview/production profiles set |
| Sentry integration | ✅ | utils/sentry.ts wired, needs DSN in env |
| Error boundaries | ✅ P | _error.tsx handles crashes with retry button |
| App icons | ✅ P | icon.png is 1024x1024 PNG |
| Splash screen | ✅ P | splash-icon.png configured in app.json |
| **Google Maps API keys** | ⚠️ CRITICAL | Need real keys for iOS + Android in app.json |
| **Apple Developer setup** | ⚠️ CRITICAL | Update eas.json with Apple IDs ($99/year) |
| **Google Play Console** | ⚠️ CRITICAL | Create developer account ($25 one-time) |
| **Privacy Policy hosted** | ⚠️ CRITICAL | Need public URL (use GitHub Pages or similar) |
| **Terms of Service hosted** | ⚠️ CRITICAL | Need public URL (use GitHub Pages or similar) |
| **Coach Permissions Audit** | ⚠️ CRITICAL | See PRODUCTION_STATUS.md section 6 for full checklist |

---

## Coach Permission Audit Results ✅

Completed November 30, 2025. All coach-only features have proper guards:

| Screen/Feature | Client Guard | Server Guard | Status |
| -------------- | ------------ | ------------ | ------ |
| **Create Team** | ✅ `role !== 'coach'` check + Alert | ✅ Auth required | ✅ Pass |
| **Manage Teams** | ✅ `role !== 'coach'` → redirect to feed | ✅ `/teams/managed` requires membership | ✅ Pass |
| **Manage Season** | ✅ `role !== 'coach'` check | ✅ Team membership check | ✅ Pass |
| **Edit Team** | ⚠️ No client guard (relies on server) | ✅ Owner/admin only via `teamMembership.role` | ✅ Pass |
| **Team Update API** | N/A | ✅ `role === 'owner'` check | ✅ Pass |
| **Admin Dashboard** | ⚠️ Shows 403 error from server | ✅ `getIsAdmin()` check | ✅ Pass |
| **DM Restrictions** | N/A (user preference) | ✅ Block + Age policy checks | ✅ Pass |
| **Message Minors** | N/A | ✅ Under-18 can only message people they follow | ✅ Pass |
| **Create Fan Event** | N/A (any user) | ✅ Auth required, limit enforced | ✅ Pass |

### Subscription/Plan Guards

| Feature | Guard | Status |
| ------- | ----- | ------ |
| **Team Limits** | ✅ Rookie: 2 teams free, Veteran/Legend: unlimited with $2.50/team | ✅ Pass |
| **Event Limits** | ✅ 3 pending events max for free tier | ✅ Pass |
| **Authorized Users** | ✅ Only coaches see authorized user step in onboarding | ✅ Pass |

---

## Known TODOs / Future Work

Found during overnight audit - not launch blockers but should be addressed:

| File | Issue | Priority |
| ---- | ----- | -------- |
| `components/MasonryPostCard.tsx` | Poll voting API not implemented (uses mock) | Post-launch |
| `server/src/routes/events.ts` | Event approval notifications not sent | Post-launch |
| `utils/zipCodeUtils.ts` | Uses mock zip code database | Post-launch |

---

## Execution Notes

- Record build number / git commit for each run
- Capture console logs (Expo + server) for any failure
- When a scenario fails, log reproduction steps and suspected code path
- Re-test all blockers after fixes

### Environment Matrix
- **Expo Go**: Verify notification skip logic and fallbacks
- **Dev Client**: Validate notifications/image picker fully
- **TestFlight / Internal App Sharing**: Production-like build behavior

### Reset State Between Runs
- Clear app storage (AsyncStorage/SecureStore) before critical auth flows
- Use fresh test users
- Ensure `DATABASE_URL` points to intended environment

### Stripe Webhook Replay (CLI)
```bash
stripe listen --forward-to http://localhost:4000/api/payments/webhook
stripe trigger checkout.session.completed
```

---

Once every row is marked `P` (or explicitly `N/A`), we're clear to start final store submission.
