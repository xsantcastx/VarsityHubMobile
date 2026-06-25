# Maestro E2E Tests

Smoke tests covering the highest-risk flows: onboarding, posting, coach
gating/admit, and tab back navigation.

## Install Maestro

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

Verify: `maestro --version`

## Setup

### 1. Create a permanent test fan account

Register once manually (or via flow 01), then use those credentials for flow 02:

```
TEST_ACCOUNT_EMAIL=testfan@yourdomain.com
TEST_ACCOUNT_PASSWORD=Test1234!
```

### 2. Enable dev codes on your local server

Add to `server/.env`:

```
ENABLE_DEV_CODES=1
```

Then restart the server. The verify code for each registration will appear in:

- Server logs (`console.log`)
- Reactotron network inspector (response body)

Use code `123456` if your server is configured to always return that in test mode.

### 3. Start your dev build

```bash
npm run dev:expo
```

Make sure your device/simulator is running the dev client build.

---

## Running Tests

### All flows

```bash
maestro test .maestro/flows/
```

### Individual flows

**Flow 1 — Sign up + fan onboarding**

```bash
maestro test .maestro/flows/01-signup-fan-onboarding.yaml \
  -e TEST_EMAIL=you+test1@gmail.com \
  -e TEST_PASSWORD=Test1234! \
  -e TEST_VERIFY_CODE=123456
```

**Flow 2 — Create text post** (uses pre-existing account, no verify needed)

```bash
maestro test .maestro/flows/02-create-text-post.yaml \
  -e TEST_ACCOUNT_EMAIL=testfan@yourdomain.com \
  -e TEST_ACCOUNT_PASSWORD=Test1234!
```

**Flow 3 — Coach onboarding to pending screen**

```bash
maestro test .maestro/flows/03-coach-onboarding-to-pending.yaml \
  -e COACH_EMAIL=coach+test1@gmail.com \
  -e COACH_PASSWORD=Test1234! \
  -e TEST_VERIFY_CODE=123456
```

**Flow 4 — Coach gating** (athlete is bounced from management)

```bash
maestro test .maestro/flows/04-coach-gating.yaml \
  -e ATHLETE_EMAIL=coach-uat-athlete@varsityhub.test \
  -e ATHLETE_PASSWORD=CoachUAT2026!
```

**Flow 5 — Manager admit** (non-coach authorized manager CAN manage)

```bash
maestro test .maestro/flows/05-manager-admit.yaml \
  -e MANAGER_EMAIL=coach-uat-manager@varsityhub.test \
  -e MANAGER_PASSWORD=CoachUAT2026!
```

Flows 4 and 5 need the seeded role accounts created by
`server/scripts/prepare-coach-uat-accounts.ts` (a fan-role `manager` and a
`player` athlete on the rookie team, password `CoachUAT2026!`).

**Flow 6 — Tab back navigation** (regression guard for `backBehavior="history"`)

```bash
maestro test .maestro/flows/06-tab-back-navigation.yaml \
  -e COACH_EMAIL=coach@varsityhub.test \
  -e COACH_PASSWORD=CoachUAT2026!
```

Run on **both** iOS and Android. `COACH_EMAIL` must be an **approved coach with an
organization** so the Discover "Manage Teams" Quick Action is visible — seed one
with `server/scripts/prepare-coach-uat-accounts.ts` (password `CoachUAT2026!`).

---

## Subflows

Reusable building blocks live in `.maestro/subflows/` and are pulled in with
`runFlow: { file: ../subflows/<name>.yaml, env: {...} }`:

- **login.yaml** — launch + dev-client launcher + sign in as `EMAIL`/`PASSWORD`.
  Use it for any flow that needs a known-role session (coach / fan / manager /
  athlete) instead of registering a fresh account.

---

## What Each Test Covers

| Flow                   | Screens                                                                                | Risk                                                |
| ---------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 01-signup-fan          | sign-up → verify → step-1-role → step-2-basic → feed                                   | Highest — most users hit this                       |
| 02-create-post         | sign-in → create-post → feed                                                           | Core feature, daily use                             |
| 03-coach-onboarding    | sign-up → verify → step-1-role (coach) → step-2-basic → step-3-league → pending screen | Highest-value users                                 |
| 04-coach-gating        | login (athlete) → Discover (no coach actions) → deep-link manage-teams → **bounced**   | Authorization — roster member must not manage       |
| 05-manager-admit       | login (non-coach manager) → deep-link manage-teams → **My Teams renders**              | Authorization — authorized manager must be admitted |
| 06-tab-back-navigation | login (coach) → Discover → Manage Teams → back → **assert Discover, not Feed**         | Navigation regression — back-button-to-feed bug     |

---

## Known Limitations

- **Date picker**: The native iOS date picker requires manual scrolling that Maestro handles with `tapOn: "Done"`. If the DOB field fails, tap the field manually once then re-run.
- **Username uniqueness**: Flow 01 and 03 use `TEST_EMAIL` as part of the username to ensure uniqueness per run. Use a different email each run or the username check will fail.
- **Verify code**: Flows 01 and 03 require `ENABLE_DEV_CODES=1` on the server. Without it, you must manually intercept the email and enter the code.
- **Coach flow 03**: Does not test actual admin approval — that's async and out of scope for smoke tests.
