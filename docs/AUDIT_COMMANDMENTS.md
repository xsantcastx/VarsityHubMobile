# Audit commandments (deck-friendly)

One-page distillation of [AUDIT_METHODOLOGY.md](./AUDIT_METHODOLOGY.md). **Canonical detail, anchors, and tables live there.** Use this file for decks, onboarding, and quick PR self-checks.

Every line below is **testable**: the “pass signal” is how you know it held.

---

## Rule types (do not mix in one bullet)

| Type | Question it answers |
| ---- | -------------------- |
| **Audit step** | What did the reviewer actually check? |
| **Engineering standard** | How must the code be structured? |
| **Business rule** | What product invariant must stay true? |
| **Release gate** | What must be true before merge or ship? |

---

## Audit framework (full-system or targeted)

| Commandment | Pass signal |
| ----------- | ----------- |
| Map end-to-end for each flow under review | Written path: UI or trigger → API → DB → async/webhook → third party → final persisted state |
| One **source of truth** per critical state | Table or bullets naming owner for auth, payment, subscription, approval, membership |
| **Trust boundaries** explicit | List: untrusted client, authed client, admin, webhook, job, storage; each crossing says what is revalidated |
| **Threat model** touched | At least one line each on: bypass, escalation, IDOR, payment spoof, webhook replay, validation drift, deep-link abuse, silent security-weakening fallback |
| **Validation drift** checked | FE vs BE vs schema vs async side effects; intentional deltas documented |
| **Async idempotent** | Webhooks/retries/jobs safe to replay; no silent “complete” on failure |
| **Findings have proof** | Affected files, exploit/failure path, expected vs actual, fix direction, verification |
| **Fixes have verification** | Tests or grep anchor; before/after for security fixes; release risk called out |

---

## Architecture (this repo)

| Commandment | Pass signal |
| ----------- | ----------- |
| Thin **Expo Router** files (`app/`) | Large logic lives in `api/`, `components/`, `hooks/`, `utils/`, `context/`, or `app/features/` |
| Shared code reused | Imports use `@/api/*`, `@/components/*`, `@/hooks/*`, `@/features/*`, `@/shared/*` per `tsconfig.json`; no copy-paste helpers |
| **No raw `fetch`** in screens | `grep 'fetch(' app/` trends toward zero; `api/` clients used |

---

## Validation and data integrity

| Commandment | Pass signal |
| ----------- | ----------- |
| **Backend validation is law** | Protected fields rejected or stripped server-side |
| **Frontend validation is guidance** | UX only; cannot be only line of defense for role/plan/payment/approval |
| **No client-owned security state** | Request bodies cannot set plan, approval, privileged role, ownership |
| **DB backs invariants** | Critical uniqueness / tenancy where Prisma/schema allows |
| **Privileged: fail closed** | Bad/missing params → deny or safe error, not silent success |
| **Public nav: fail gracefully** | Missing deep-link params → safe UI, no partial privileged writes |

---

## Auth, roles, permissions

| Commandment | Pass signal |
| ----------- | ----------- |
| Every protected route checks **auth + role + plan + ownership** as applicable | Middleware + handler review; grep route tests |
| **Server** enforces even if UI hides | Same checks in `server/src/routes/*` |
| **Policy not copy-paste** | Prefer shared helpers/middleware over scattered `if (role)` |
| **Admin actions auditable** | `adminActivityLogger` or equivalent for sensitive mutations |
| **Sensitive responses sanitized** | No accidental token or PII in JSON |

---

## Payments and subscriptions

| Commandment | Pass signal |
| ----------- | ----------- |
| Paid state only after **trusted server** event | Webhook / verified session; tests or idempotency keys |
| **Webhooks**: verify, log, retry-safe | Signature check + duplicate event handling |
| **Success UI** verifies backend | Not query-string trust only; retry UX where applicable |
| **Refund/reject/cancel** financially consistent | Status machine documented in code review |
| **Pricing / entitlements server-side** | Client shows server-derived limits |

---

## Navigation and deep links

| Commandment | Pass signal |
| ----------- | ----------- |
| Push/email/OAuth routes **resolve** in Expo Router | Route exists; smoke or manual matrix |
| **Params validated** before privileged work | Parser + error boundary |
| **Wrappers stateless** for business rules | No hidden mutation in layout-only files |
| **Back stack** safe | No unbounded stack on fallback paths |

---

## UI / UX reliability

| Commandment | Pass signal |
| ----------- | ----------- |
| Async UI: **loading, error, success, empty** | Screen review / component tests |
| **No double submit** | `disabled` / `isLoading` on primary actions |
| **Errors surfaced** | No empty `catch {}` on user flows; user-readable message |
| **Unmount-safe async** | Mounted guards or cancellation where needed |
| **Accessibility** | `testID` / `accessibilityLabel` / image alt for critical flows (store and a11y policy) |

---

## Testing and release

| Commandment | Pass signal |
| ----------- | ----------- |
| Critical flows have **automated** coverage | Auth, onboarding, payment, org/team, deep links — tests exist or tracked debt |
| **Typecheck + lint** green | CI or documented exception |
| **Security fix**: repro before/after | PR description or linked issue |
| **Migrations**: rollback notes | PR + `docs/release/` if schema changes |
| **Real-device smoke** for risky releases | Auth, payments, messaging, dark mode — checklist ticked |

---

## Ten lines for slides

1. **Thin routes, thick modules** — `app/` stays navigational; logic in `api/` / shared dirs. *Pass: grep.*
2. **Backend validation is law; frontend is guidance** — *Pass: schema + route review.*
3. **No client-controlled security-critical state** — *Pass: body allowlists.*
4. **One source of truth per domain object** — *Pass: written owner table.*
5. **Every protected action checks auth, role, plan, ownership on the server** — *Pass: middleware + tests.*
6. **Every async flow is idempotent** — *Pass: webhook + retry review.*
7. **No silent failures in user or payment flows** — *Pass: logging + UI states.*
8. **No duplicate security logic across routes** — *Pass: shared middleware/helpers.*
9. **Every screen handles loading, error, success, and empty** — *Pass: UI review.*
10. **Every admin action is auditable; every risky release is testable and reversible** — *Pass: logs + checklist.*

---

## Related

- [Audit methodology](./AUDIT_METHODOLOGY.md) — full standard
- [Audit review gate](./AUDIT_REVIEW_GATE.md) — PR + release checklists
- [Audit execution guide](./AUDIT_EXECUTION_GUIDE.md) — how to run an audit
