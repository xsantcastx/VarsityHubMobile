# Guard Map (Auth / Verification / Role)

Snapshot of key HTTP routes and their required guards. All routes assume `authMiddleware` runs globally to attach `req.user`.

| Area | Route(s) | Guards | Notes |
| --- | --- | --- | --- |
| Auth | `/auth/me` | `requireAuth` | Returns `is_admin`, `preferences.onboarding_completed`. |
| Games | `POST /games` | `requireAuth` + `requireVerified` + coach/admin check | Admin via `getIsAdmin`; coaches/managers/owners of home team. |
| Games | `PUT /games/:id/approve` | `requireAuth` + `requireVerified` + coach/admin check | Admin via `getIsAdmin`; home team staff only. |
| Games | `POST /games/:id/stories` | `requireVerified` | Story creation requires verified email. |
| Events | `POST /events/pitch`, `GET /events/pitches` | `requireVerified` | Fan pitches gated on verified email. |
| Events | `PUT /events/pitches/:id/(approve|reject)` | `requireVerified` + coach/admin check | Approval restricted to coaches/admins. |
| Posts | `POST /posts` | `requireVerified` | Post/create gated on verified email. |
| Teams | `POST /teams`, `PUT/DELETE /teams/:id`, invites, membership updates | `requireVerified` + role checks | Coach role required to create; staff roles for updates; admin overrides via `getIsAdmin`. |
| Ads | `POST/PUT/DELETE /ads` | `requireVerified` | Ad submissions require verified email. |
| Admin | `/admin/*`, `/admin-reports/*` | `requireVerified` + `requireAdmin` | Admin-only dashboards/reports. |
| Payments | `/payments/*` (mutations) | `requireVerified` | Billing actions require verified email. |

Guidance:
- Apply `requireVerified` to any route that mutates user-visible content or financial data.
- Use centralized helpers for role checks (`requireAdmin`, `getIsAdmin`, `isEmailAdmin`) and avoid inspecting raw `req.user` fields beyond `{ id, is_admin }`.
- For team/org scoped actions, prefer helper functions that validate membership (owner/manager/coach) rather than inline queries.***
