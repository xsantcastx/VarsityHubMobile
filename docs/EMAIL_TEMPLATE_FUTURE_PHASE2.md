# Phase 2 Email Template Designs (Future Implementation)

**Status**: Design only | Not yet implemented  
**Target Release**: TBD (requires backend schema/logic changes)

These templates represent the full vision for VarsityHub email experiences. They are **not yet supported by the backend** but are preserved here for Phase 2 implementation.

---

## Coach Verification Email (Phase 2 - Enhanced)

**Current Status (Phase 1)**: Minimal version with only org-level data  
**Future Status (Phase 2)**: Full version with team assignment, role selection, seat tracking, and expiration

### Phase 2 Template Preview

```
✋ Action Required: Coach Verification
New Coach Awaiting Approval
You're receiving this as an Organization Admin with approval authority

A new coach or staff member has registered and is waiting for your verification to access your team's tools.

────────────────────

COACH NAME
{{COACH_NAME}}

EMAIL
{{COACH_EMAIL}}

ROLE REQUESTED
{{ROLE_REQUESTED}}

ORGANIZATION
{{ORG_NAME}}

TEAM
{{TEAM_NAME}}

Requested by: {{REQUESTED_BY}}
Requested at: {{REQUESTED_AT}}
Expires in: {{EXPIRES_IN}}

────────────────────

💳 Billing & Seat Usage

You're using {{CURRENT_SEATS}} of {{SEAT_LIMIT}} seats on your {{PLAN_NAME}} plan ({{BILLING_MODEL}}).

[Manage billing →]

────────────────────

✅ Verify Coach    [Button]
or Deny this request    [Button]

────────────────────

What Happens When You Verify?
- {{COACH_NAME}} gains access to team tools, messaging, and roster management
- They can upload content, coordinate with athletes, and support local sports
- You can change their role or remove access anytime from your dashboard

What Happens When You Deny?
- The coach will remain in a pending state and won't have access to any team features
- They'll be notified that their request was not approved

Need help? Contact us at {{SUPPORT_EMAIL}}
or [manage this from your dashboard]

────────────────────

🔒 If you didn't request this verification or don't recognize {{COACH_NAME}}, you can safely deny or ignore this email.

[Follow social media links]
© 2025 LIME PRODUCTIONS
```

### Fields Required for Phase 2

#### Currently Available (Phase 1)

- `{{COACH_NAME}}` — From user.display_name
- `{{COACH_EMAIL}}` — From user.email
- `{{ORG_NAME}}` — From organization.name
- `{{REQUESTED_AT}}` — From join_request.created_at
- `{{SUPPORT_EMAIL}}` — From env config

#### Requires Backend Implementation (Phase 2)

- `{{ROLE_REQUESTED}}` — Requires role selection UI in signup + storage in join_request table
- `{{TEAM_NAME}}` — Requires team-level join requests (currently org-level only)
- `{{REQUESTED_BY}}` — Requires linking join request to referring admin (if applicable)
- `{{EXPIRES_IN}}` — Requires TTL logic on pending requests (suggest 7–14 days)
- `{{CURRENT_SEATS}}` — Requires seat tracking logic (count authorized users in org)
- `{{SEAT_LIMIT}}` — Requires seat limit definition per plan tier
- `{{PLAN_NAME}}` — Requires plan lookup from organization
- `{{BILLING_MODEL}}` — Requires billing model per plan (Rookie free, Veteran per-team, Legend flat)

### Schema Changes Needed

```sql
-- Join Request
ALTER TABLE join_requests ADD COLUMN role VARCHAR(50); -- 'coach', 'staff', 'assistant', etc.
ALTER TABLE join_requests ADD COLUMN team_id UUID REFERENCES teams(id); -- If team-specific
ALTER TABLE join_requests ADD COLUMN expires_at TIMESTAMP; -- 7-14 day TTL
ALTER TABLE join_requests ADD COLUMN referred_by_id UUID REFERENCES users(id); -- Who requested them?

-- Organization (if seat limits vary)
ALTER TABLE organizations ADD COLUMN seat_limit INT; -- Or derive from plan
```

### Implementation Checklist

- [ ] Add role selection to coach signup flow
- [ ] Make join requests team-specific (not just org-level)
- [ ] Implement seat calculation logic
- [ ] Define seat limits per plan (Veteran: X seats, Legend: unlimited)
- [ ] Add expiration TTL to join requests
- [ ] Wire email sender with seat/billing data lookup
- [ ] Un-stub `sendJoinRequestToAdmin` with real SendGrid call
- [ ] Update test endpoint to use Phase 2 sample data
- [ ] Design UI for role/team selection in approval flow

---

## Future Enhancement Notes

**Approval Flow Enhancement**:
Currently admins just approve/deny. Phase 2 could allow:

- Reassigning role before approval ("promote to assistant coach")
- Limiting team access ("only Dallas Tigers, not Youth League")
- Conditional approval ("verify with league first")

**Seat Usage Alerts**:
Once seats are tracked, admins could see:

- "You have 2 seats left on Veteran" when approving coaches
- Upgrade prompts if trying to exceed seat limit
- Seat reallocation tools to shuffle users between teams

**Expiration & Auto-Cleanup**:
Set pending requests to auto-deny after 14 days, with optional reminder email at day 7.

---

## Keeping Phase 1 Accurate

The Phase 1 minimal template (`server/src/routes/test-emails.ts`) uses **only fields the backend can actually provide**:

- Coach name, email, organization
- Request message (optional)
- Request timestamp
- Generic support email

This ensures shipped templates match backend reality while preserving the full vision for Phase 2.
