# Final Launch Sequence

Use this when the code-side release baseline is already green and you want one strict execution order from current worktree to real production sign-off.

## 1. Commit the current code changes

Run these first:

```bash
npm run doctor
npm run coach:uat:baseline
npm --prefix server run verify:org-manager-access
npm --prefix server run verify:email-go-live
```

If the first three are green, commit the repo changes.

Suggested commit title:

```text
Fix org manager approval access and harden release verification
```

Suggested commit body:

```text
- expose can_manage without granting owner-only can_edit
- unblock manager access to approval and org admin screens
- hide false org join CTA for public fans
- add org manager runtime verifier and UAT coverage
- align Expo patch deps and restore baseline test dependencies
- harden SendGrid verification to reject placeholder keys
- add email go-live verifier and operator checklist
```

## 2. Fix production email configuration

Use the dedicated checklist:

- [EMAIL_GO_LIVE_CHECKLIST.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/release/EMAIL_GO_LIVE_CHECKLIST.md)

Required commands:

```bash
npm --prefix server run verify:email-go-live
npm --prefix server run verify:email
npx tsx server/scripts/email-delivery-test.ts
```

Do not proceed until:

- `SENDGRID_API_KEY` is real
- missing template env vars are set in Railway
- stale SendGrid template IDs are recreated and published
- `verify:email` passes

## 3. Re-run production smoke checks

After Railway vars are updated:

```bash
BASE_URL="$(node -e "require('dotenv').config(); process.stdout.write(process.env.EXPO_PUBLIC_API_URL || '')")" npm --prefix server run verify:production-health
npm --prefix server run verify:org-manager-access
```

Then manually confirm:

1. New fan signup works.
2. Verification email arrives.
3. Coach approval path works.
4. Org manager can open approvals and org admin surfaces.
5. Public fan cannot submit org join requests.
6. One real payment flow works.

## 4. Run device UAT

Use:

- [COACH_DEVICE_UAT.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/COACH_DEVICE_UAT.md)
- [COACH_DEVICE_UAT_RESULTS_TEMPLATE.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/COACH_DEVICE_UAT_RESULTS_TEMPLATE.md)

Minimum required pass:

- approved coach account
- fan-role org manager account
- public fan account
- one paid account state
- one blocked coach/fan-mode account

## 5. Final go/no-go gate

Release only if all are true:

- `doctor` passes
- `coach:uat:baseline` passes
- `verify:org-manager-access` passes
- `verify:production-health` passes
- `verify:email-go-live` passes
- `verify:email` passes
- device UAT is signed off
- Railway logs show no SendGrid `401` or invalid template errors

If any item is red, treat launch as no-go.
