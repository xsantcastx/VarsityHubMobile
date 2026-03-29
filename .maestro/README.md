# Maestro E2E Tests

Three smoke tests covering the highest-risk flows.

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

---

## What Each Test Covers

| Flow | Screens | Risk |
|------|---------|------|
| 01-signup-fan | sign-up → verify → step-1-role → step-2-basic → feed | Highest — most users hit this |
| 02-create-post | sign-in → create-post → feed | Core feature, daily use |
| 03-coach-onboarding | sign-up → verify → step-1-role (coach) → step-2-basic → step-3-league → pending screen | Highest-value users |

---

## Known Limitations

- **Date picker**: The native iOS date picker requires manual scrolling that Maestro handles with `tapOn: "Done"`. If the DOB field fails, tap the field manually once then re-run.
- **Username uniqueness**: Flow 01 and 03 use `TEST_EMAIL` as part of the username to ensure uniqueness per run. Use a different email each run or the username check will fail.
- **Verify code**: Flows 01 and 03 require `ENABLE_DEV_CODES=1` on the server. Without it, you must manually intercept the email and enter the code.
- **Coach flow 03**: Does not test actual admin approval — that's async and out of scope for smoke tests.
