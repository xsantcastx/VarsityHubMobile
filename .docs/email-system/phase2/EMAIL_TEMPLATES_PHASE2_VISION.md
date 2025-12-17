# Email Templates - Phase 2 Vision

**Status**: Future Enhancement Planning  
**Target**: Post-MVP Deployment  
**Related**: `EMAIL_TEMPLATES_PHASE1.md`

---

## Overview

This document outlines **Phase 2 enhancements** to email templates that require backend schema changes, calculations, or new features not currently available.

Phase 2 is **not a blocker** for launch. Phase 1 email templates are production-ready without these enhancements.

---

## Phase 2 Requirements & Features

### 1. Join Request → Admin Notification (Enhanced)

**What's Missing**: Team context, role information, seat availability

**Phase 2 Changes**:

```typescript
// PHASE 2 ADDITION - Requires backend calculation
await sendJoinRequestToAdmin({
  // Phase 1 fields (kept)
  adminEmail: string;
  adminName: string;
  requesterName: string;
  requesterEmail: string;
  organizationName: string;
  message?: string;
  requestId: string;
  requestedAt: string;
  approveUrl: string;
  denyUrl: string;
  orgLogoUrl?: string;
  
  // PHASE 2 NEW FIELDS
  // --- Team Context ---
  teamName?: string;           // If request is for specific team (future)
  teamSport?: string;          // Sport type (baseball, basketball, etc.)
  
  // --- Seat/Billing Tracking (requires schema change) ---
  currentSeats?: number;       // How many coaches currently in org
  seatLimit?: number;          // Max allowed coaches in their plan
  isAtCapacity?: boolean;      // Quick flag for template logic
  
  // --- Plan Information (requires subscription tracking) ---
  organizationPlan?: string;   // rookie | veteran | legend
  planName?: string;           // Human-readable plan name
  upgradeUrl?: string;         // Link to upgrade plan if at capacity
  
  // --- Role/Permission Info (requires role selection in join flow) ---
  requestedRole?: string;      // Role coach is applying for (coach | assistant_coach | volunteer)
  
  // --- Expiration (requires request expiration logic) ---
  expiresAt?: string;          // ISO timestamp when request expires
  expiresInDays?: number;      // How many days until request auto-closes
});
```

**Email Template Enhancement**:

```html
<!-- PHASE 2 ADDITIONS -->
{{#if teamName}}
<div class="info-block">
  <strong>Team:</strong> {{teamName}} ({{teamSport}})
</div>
{{/if}}

{{#if requestedRole}}
<div class="info-block">
  <strong>Requested Role:</strong> {{requestedRole}}
</div>
{{/if}}

{{#if isAtCapacity}}
<div class="alert alert-warning">
  <strong>⚠️ At Capacity</strong><br>
  Your {{organizationPlan}} plan allows {{seatLimit}} coaches. You currently have {{currentSeats}}.
  <a href="{{upgradeUrl}}">Upgrade Plan</a> to add more coaches.
</div>
{{else if currentSeats && seatLimit}}
<div class="info-block">
  <strong>Capacity:</strong> {{currentSeats}}/{{seatLimit}} coaches
</div>
{{/if}}

{{#if expiresInDays}}
<div class="note">
  This request will expire in {{expiresInDays}} days if not reviewed.
</div>
{{/if}}
```

**Backend Work Required**:
- [ ] Add `team_id` optional field to `OrganizationJoinRequest` schema
- [ ] Add request expiration logic (auto-close after 30 days)
- [ ] Calculate `currentSeats` from `OrganizationMembership.count()`
- [ ] Store organization plan in `Organization` model or fetch from owner's subscription
- [ ] Add `requested_role` field to `OrganizationJoinRequest`
- [ ] Create `POST /organizations/join-requests/upgrade-plan` endpoint

---

### 2. Team Invitation Email (New)

**Phase 2 Status**: New template type (currently using basic team invite)

**Use Case**: When coach/admin explicitly invites someone to join a team

```typescript
await sendTeamInvitationEmail({
  inviteeEmail: string;      // Person being invited
  inviteeName: string;       // Their name (if available)
  inviterName: string;       // Coach/admin sending invite
  teamName: string;          // Team they're invited to
  sport: string;             // Sport type
  organizationName: string;  // Parent organization
  acceptUrl: string;         // Deep link to accept
  role: string;              // Role they're being invited as (coach, player, parent, etc.)
  expiresAt: string;         // ISO timestamp
  expiresInDays: number;     // Days until expiration
  logoUrl?: string;          // Team logo
});
```

**Email Template**:
```html
Hi {{inviteeName}},

You've been invited to join {{teamName}} ({{sport}}) as a {{role}}.

Organization: {{organizationName}}

[Accept Invitation Button]

This invitation expires in {{expiresInDays}} days.
```

**Backend Work Required**:
- [ ] Implement `sendTeamInvitationEmail()` in email.ts
- [ ] Add expiration to `TeamInvite` model
- [ ] Create decline endpoint
- [ ] Track invitation status (pending, accepted, declined, expired)

---

### 3. Role Assignment Notification (New)

**Phase 2 Status**: New template type

**Use Case**: When admin assigns/upgrades a user's role in organization or team

```typescript
await sendRoleAssignmentEmail({
  userEmail: string;         // User whose role changed
  userName: string;
  organizationName?: string; // If org role change
  teamName?: string;         // If team role change
  newRole: string;           // New role name
  previousRole?: string;     // What it was before
  permissions: string[];     // List of new permissions
  manageUrl: string;         // Link to manage settings
});
```

**Email Template**:
```html
Hi {{userName}},

Your role in {{organizationName}} has been updated to {{newRole}}.

New Permissions:
- {{permissions[0]}}
- {{permissions[1]}}
...

[View Details Button]
```

**Backend Work Required**:
- [ ] Add role change logging to middleware
- [ ] Implement email function with permission mapping
- [ ] Create role permission matrix

---

### 4. Subscription Status Email (New)

**Phase 2 Status**: New template type for billing notifications

**Use Cases**: 
- Plan expires in 7 days
- Plan expires today
- Renewal failed
- Seats need adjustment

```typescript
await sendSubscriptionStatusEmail({
  userEmail: string;
  userName: string;
  currentPlan: string;
  status: 'expiring_soon' | 'expired' | 'renewal_failed' | 'adjust_seats';
  expiresAt?: string;
  renewalDate?: string;
  failureReason?: string;
  currentSeats?: number;
  requiredSeats?: number;
  billingPortalUrl?: string; // Link to manage subscription
});
```

**Email Template Examples**:

```html
<!-- EXPIRING_SOON -->
Your {{currentPlan}} plan expires in 7 days.
<a href="{{billingPortalUrl}}">Renew Now</a>

<!-- RENEWAL_FAILED -->
Your subscription renewal failed.
Reason: {{failureReason}}
<a href="{{billingPortalUrl}}">Update Payment Method</a>

<!-- ADJUST_SEATS -->
You have {{currentSeats}} teams but your plan allows only {{requiredSeats}}.
<a href="{{billingPortalUrl}}">Add More Seats</a>
```

**Backend Work Required**:
- [ ] Implement billing portal session creation (Stripe)
- [ ] Add subscription expiration monitoring
- [ ] Create webhook handlers for renewal events
- [ ] Implement seat mismatch detection

---

### 5. Approval Denial → Requester Follow-Up (New)

**Phase 2 Status**: New template for follow-up communication

**Use Case**: Send follow-up email if request denied, offering next steps

```typescript
await sendRejectionFollowUpEmail({
  userEmail: string;
  userName: string;
  organizationName: string;
  reason?: string;
  similarOrganizations?: Array<{ name: string; url: string }>;
  supportUrl?: string;
  allowReapply?: boolean;
  reapplyInDays?: number;
});
```

**Email Template**:
```html
Hi {{userName}},

Thank you for your interest in {{organizationName}}.

Reason: {{reason}}

Here are similar organizations you might be interested in:
{{#each similarOrganizations}}
- <a href="{{url}}">{{name}}</a>
{{/each}}

{{#if allowReapply}}
You can reapply in {{reapplyInDays}} days.
{{/if}}

<a href="{{supportUrl}}">Contact Support</a>
```

**Backend Work Required**:
- [ ] Implement organization similarity search
- [ ] Add reapply cooldown logic
- [ ] Create `POST /support/contact` endpoint

---

## Backend Schema Changes Needed for Phase 2

### 1. Extend `OrganizationJoinRequest`

```prisma
model OrganizationJoinRequest {
  // Phase 1 fields
  id              String   @id @default(cuid())
  organization_id String
  user_id         String
  status          String   @default("pending")
  message         String?
  created_at      DateTime @default(now())
  reviewed_at     DateTime?
  reviewed_by     String?
  
  // PHASE 2 ADDITIONS
  team_id         String?  // Optional team association
  requested_role  String?  // coach | assistant_coach | volunteer
  expires_at      DateTime? // Auto-close after 30 days
  reapply_allowed Boolean @default(true)
  reapply_after   DateTime? // Cooldown period
  
  organization Organization @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  user         User         @relation(fields: [user_id], references: [id], onDelete: Cascade)
  team         Team?        @relation(fields: [team_id], references: [id], onDelete: SetNull)
  
  @@unique([organization_id, user_id])
  @@index([organization_id, status])
  @@index([expires_at])
}
```

### 2. Extend `Organization`

```prisma
model Organization {
  // Existing fields...
  
  // PHASE 2 ADDITIONS
  subscription_plan String?  // rookie | veteran | legend
  max_coaches      Int @default(10)
  max_staff        Int @default(5)
  
  // ...rest of model
}
```

### 3. Extend `TeamInvite`

```prisma
model TeamInvite {
  // Existing fields...
  
  // PHASE 2 ADDITIONS
  expires_at      DateTime? // Default 30 days from created_at
  status          String @default("pending") // pending | accepted | declined | expired
  accepted_at     DateTime?
  
  // ...rest of model
}
```

### 4. New Migration

```bash
npx prisma migrate dev --name add_phase2_email_fields
```

---

## Email Delivery Improvements (Phase 2)

### 1. Email Queuing

Add background job queue for high-volume sends:

```typescript
// Instead of await sgMail.send() directly
await emailQueue.add('send-email', {
  templateId: 'd-123456',
  to: email,
  dynamicData: { ... },
  priority: 'high' | 'normal' | 'low',
  retries: 3
});
```

### 2. Delivery Tracking

```typescript
// Track opens, clicks, bounces
await trackEmail({
  templateId: string;
  messageId: string;
  userId: string;
  eventType: 'sent' | 'opened' | 'clicked' | 'bounced' | 'failed';
  timestamp: DateTime;
});
```

### 3. Unsubscribe Management

```typescript
// Respect email preferences
const canSend = await checkEmailPreference(userId, 'organization_updates');
if (!canSend) return; // Skip sending
```

---

## Rollout Plan

### Phase 2 - Wave 1 (Months 2-3)
- [ ] Implement `OrganizationJoinRequest` schema extensions
- [ ] Add team association to join flow
- [ ] Create team invitation email template
- [ ] Implement expiration auto-close logic

### Phase 2 - Wave 2 (Months 4-5)
- [ ] Add seat/billing tracking to emails
- [ ] Implement subscription status emails
- [ ] Create billing portal integration
- [ ] Add rejection follow-up workflow

### Phase 2 - Wave 3 (Months 6+)
- [ ] Implement email queuing system
- [ ] Add delivery tracking
- [ ] Build email preference center
- [ ] Analytics dashboard for email metrics

---

## Success Metrics for Phase 2

- **Approval Rate**: Track join requests approved vs denied
- **Conversion Rate**: Track approvals that lead to active usage
- **Email Engagement**: Opens, clicks on action buttons
- **Subscription Revenue**: Revenue tied to team limits
- **User Satisfaction**: NPS score for onboarding flow

---

## Related Documentation

- `EMAIL_TEMPLATES_PHASE1.md` - Production-ready Phase 1 templates
- `docs/SENDGRID_TEMPLATES.md` - SendGrid template setup
- `.docs/architecture/ORGANIZATION_JOIN_SYSTEM.md` - Join request system design

---

## Questions?

Phase 2 features should be discussed with product/design before implementation.

**Current blockers for Phase 2**:
1. ⚠️ Team association in join flow (not designed yet)
2. ⚠️ Organization subscription plan tracking (needs design)
3. ⚠️ Seat limit enforcement (needs design)
4. ⚠️ Email preferences center (needs design)

Once these are designed, Phase 2 can be implemented in parallel with Phase 1 testing.
