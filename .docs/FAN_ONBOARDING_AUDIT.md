# Fan Onboarding Flow — Audit

**Date:** February 22, 2025

---

## 1. Complete Fan Onboarding Flow (Step by Step)

### Entry Point
- User signs up/in → server sets `onboarding_completed: false` → AuthProvider redirects to `/onboarding/step-1-role`
- `app/onboarding/index.tsx` loads state from AsyncStorage, calculates `nextIncompleteStep(state, state.role)`, redirects to that step

### Fan Path (role = 'fan')
| Step | Route | Data Saved | Where Stored | Resume on App Reopen |
|------|-------|------------|--------------|----------------------|
| **1. Role** | step-1-role | `role: 'fan'` | OnboardingContext → AsyncStorage `onboarding_state` | ✓ State restored; index redirects to next incomplete step |
| **2. Basic** | step-2-basic | `username`, `display_name`, `dob`, `zip`/`zip_code`, `affiliation` | Same | ✓ |
| **3–6** | (skipped) | — | — | Fans never reach these (reducer + guards) |
| **7. Profile** | step-7-profile | `username`, `avatar_url`, `bio`, `sports_interests` | Same | ✓ |
| **8. Interests** | step-8-interests | `primary_intents` | Same | ✓ (Note: reducer currently treats step 8 as optional and may skip) |
| **9. Features** | (skipped) | — | Fans skip per reducer | ✓ |
| **10. Confirmation** | step-10-confirmation | Calls `User.completeOnboarding()` → server sets `onboarding_completed: true` | Backend | ✓ |

### Persistence Keys (AsyncStorage)
- `onboarding_state` — full OnboardingState JSON
- `onboarding_progress` — step index (0–8)
- `onboarding_reducer_state` — reducer state (draftData, currentStepIndex, etc.)

### Resume Behavior
1. App reopens → OBProvider mounts → `loadState()` reads AsyncStorage
2. `setState(parsedState)`, `setProgress(parsedProgress)`, `dispatch(INIT_FROM_PROFILE)`
3. User navigates to `/onboarding` → index runs `nextIncompleteStep(state, state.role)` → redirects to correct step
4. **Result:** User resumes exactly where they left off

---

## 2. Coach-Only Screens — Fan Guards

| Step | Coach-Only? | Guard | Location |
|------|-------------|-------|----------|
| Step 3 (Plan) | Yes | `ob.role === 'fan'` → redirect to step-7-profile | step-3-plan.tsx |
| Step 4 (Organization) | Yes | `ob.role === 'fan'` → redirect to step-7-profile | step-4-organization.tsx |
| Step 6 (Authorized Users) | Yes | `ob.role === 'fan'` → redirect to step-7-profile | step-6-authorized-users.tsx |
| Step 9 (Features) | Yes | Reducer skips for fans: `!isCoach && !isStepComplete(9)` → return STEP_10 | onboardingReducer.ts |

**Audit result:** All coach-only steps have guards. Fans do not see steps 3, 4, 6, or 9.

---

## 3. Optional/Skipped Steps — Null Safety

### Fan-Specific Nullable Fields (never set for fans)
- `plan`, `team_id`, `organization_id`, `organization_name`, `authorized`, `authorized_users`, `team_count_total`

### Optional Fields (may be undefined if skipped)
- `primary_intents` — if step 8 skipped
- `sports_interests` — if step 7 profile sports skipped
- `personalization_goals` — if not set
- `location_enabled`, `notifications_enabled`, `messaging_policy_accepted` — if step 9 skipped (fans)

### Downstream Usage (Safe?)
| Location | Field | Usage | Safe? |
|----------|-------|-------|-------|
| step-10-confirmation | `ob.plan`, `ob.team_id`, etc. | `required: isCoach` — only required for coaches | ✓ |
| step-10-confirmation | `ob.primary_intents` | `ob.primary_intents && ob.primary_intents.length` | ✓ |
| step-10-confirmation | `ob.sports_interests` | `ob.sports_interests && ob.sports_interests.length` | ✓ |
| step-10-confirmation | `ob.messaging_policy_accepted` | `required: isCoach` — fans skip step 9; fixed to be coach-only | ✓ |
| step-9-features (fan branch) | `ob.primary_intents` | `if (ob.primary_intents?.length)` | ✓ |
| step-9-features (fan branch) | `ob.sports_interests` | `if (ob.sports_interests?.length)` | ✓ |

### Fix Applied
- Step 10: "Features Configured" check updated to `required: isCoach` — fans skip step 9 and no longer need to complete this.

---

## 4. Step 8 (Interests) — Optional vs Required

- **Reducer:** `isStepComplete(8)` returns `true` always → step 8 is **skipped** for everyone (fans and coaches).
- **UI:** Step 8 has no "Skip" button; requires at least one selection to continue.
- **Effect:** With current reducer, users never see step 8 in the normal flow. If this is unintended, `isStepComplete(8)` should return `!!(state.primary_intents?.length)` so step 8 is shown until completed.
