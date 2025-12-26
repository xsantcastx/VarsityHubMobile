# User Roles & Permissions - Comprehensive Audit
## Access Control, Authorization & Privilege Analysis
**Date:** December 23, 2025  
**Audit Scope:** Role-based access control (RBAC), permission validation, endpoint authorization, privilege escalation risks  
**Files Reviewed:** 35+ route files, 6 middleware files, Prisma schema  

---

## Executive Summary

| Category | Count | Status |
|----------|-------|--------|
| **Critical Issues Found** | 2 | ⚠️ Authorization bypass, privilege escalation |
| **High Issues Found** | 3 | ⚠️ Insufficient permission checks |
| **Medium Issues Found** | 4 | ⚠️ Edge cases, incomplete validation |
| **Low Issues Found** | 3 | ✅ Inconsistent error messages |
| **Total Issues** | **12** | **ACTION REQUIRED** |

---

## Critical Issues

### 🔴 ISSUE #1: CRITICAL - Missing Organization Owner Verification on Admin Actions

**Severity:** CRITICAL | **Type:** Authorization Bypass | **Impact:** Non-owners can modify organizations

**Location:** `server/src/routes/organizations.ts:525-600` (invite, member management endpoints)

**Problem:**
```typescript
// POST /organizations/:id/invite - Invite user to organization
organizationsRouter.post('/:id/invite', requireAuth as any, async (req: AuthedRequest, res) => {
  // Check if user is a member of the organization
  const membership = await prisma.organizationMembership.findUnique({
    where: { organization_id_user_id: { organization_id: id, user_id: req.user!.id } as any }
  });
  
  if (!membership) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  // BUG: Any member (even regular members) can now invite people!
  // Should check: if (membership.role !== 'owner' && membership.role !== 'manager' && membership.role !== 'administrator')
```

**Vulnerabilities:**
1. **No role verification:**
   - Checks if user is member, NOT if they're admin
   - Regular members can invite anyone
   - Members can change roles of other members

2. **No invitation acceptance validation:**
   - Invites are sent without approval workflow
   - Invited users auto-added to organization

3. **Missing scope boundaries:**
   - No check that invitee belongs to allowed scope
   - Can invite unlimited users (no plan limits enforced on invites)

**Test Case:**
- Coach A is regular member of Organization X
- Coach A accepts invite to Organization X (has membership)
- Coach A sends invite to Coach B
- System should reject (Coach A not admin)
- But system accepts it!
- Coach B joins Organization X because of unauthorized invite

**Fix Required:**
- Check membership.role before allowing admin actions
- Only allow: owner, manager, administrator to invite
- Validate plan limits before accepting invites
- Log all member invitations for audit

---

### 🔴 ISSUE #2: CRITICAL - Team Lead Can Add Members Without Coach Role Verification

**Severity:** CRITICAL | **Type:** Privilege Escalation | **Impact:** Non-coaches can create teams and invite members

**Location:** `server/src/routes/teams.ts:750-850` (team member management)

**Problem:**
```typescript
// Team member addition endpoint doesn't check if user is coach
// User needs team membership (any role), not coach status
async function canManageTeamMembers(userId: string, teamId: string): Promise<boolean> {
  const membership = await prisma.teamMembership.findUnique({
    where: { team_id_user_id: { team_id: teamId, user_id: userId } as any
  });
  // BUG: Returns true for ANY membership role (player, assistant, owner)
  // Should require owner or administrator role
  return !!membership;
}
```

**Vulnerabilities:**
1. **No role requirement:**
   - Any team member can manage team
   - Players can add other players, modify team
   - Should require owner/admin role

2. **No scope validation:**
   - Players on Team A can add members
   - Can potentially modify Team B if they're member there
   - No boundary checking

3. **Cascade permission issue:**
   - If user can manage team, they can manage all members
   - No distinction between view/edit permissions

**Test Case:**
- Player joins Team A
- Player tries to add another player (should fail)
- System checks: "is player a team member?" → YES
- System allows it (WRONG!)
- Player is now "managing" team membership

**Fix Required:**
- Check membership.role === 'owner' or 'administrator'
- Enforce coach role for all team management
- Add audit logging for member changes
- Implement immutable permission boundaries

---

## High Severity Issues

### 🟠 ISSUE #3: HIGH - Missing Organization Cascade Permissions

**Severity:** HIGH | **Type:** Authorization Gap | **Impact:** Team-level permissions bypass organization policy

**Location:** `server/src/routes/teams.ts:70-105` (canAccessTeam function)

**Problem:**
```typescript
// ISSUE #3: Helper function to check if user can access team
async function canAccessTeam(userId: string, teamId: string): Promise<boolean> {
  // Check direct team membership
  const teamMember = await prisma.teamMembership.findUnique(...);
  if (teamMember) return true;

  // Check organization membership (if team belongs to org)
  if (team?.organization_id) {
    const orgMember = await prisma.organizationMembership.findUnique(...);
    
    // BUG: Organization admins can access ANY team in organization
    // But what if organization owner revokes someone's access?
    // Organization memberships could be outdated/stale
    if (orgMember && ['owner', 'manager', 'administrator'].includes(orgMember.role || '')) {
      return true; // Allows access without checking if membership is 'active'
    }
  }

  return false;
}
```

**Vulnerabilities:**
1. **No status check:**
   - Allows access even if organizationMembership.status !== 'active'
   - Revoked members still have access via organization role

2. **No cascading permission revocation:**
   - Removing from organization doesn't revoke team access
   - User keeps team-level membership indefinitely
   - Orphaned access records

3. **Missing approval workflow:**
   - Organization members not checked if they're 'pending' vs 'active'

**Test Case:**
- User A is organization admin for Org X
- User A is added to Team B (in Org X)
- Org owner removes User A from organization (status = 'removed')
- User A tries to access Team B
- System checks: "is org member?" → finds record but status='removed'
- System should deny (status not active)
- But code doesn't check status! User still has access

**Fix Required:**
- Check organizationMembership.status === 'active'
- Add cleanup job to remove team access when org membership revoked
- Implement inverse cascade: org removal → team removal
- Add audit logging for permission cascades

---

### 🟠 ISSUE #4: HIGH - No Permission Boundary on Team Roster Management

**Severity:** HIGH | **Type:** Scope Bypass | **Impact:** Team staff can modify rosters across teams

**Location:** `server/src/routes/team-memberships.ts` (member add/remove endpoints)

**Problem:**
Team roster management (adding/removing athletes) doesn't properly verify:
- User owns the team (not just member of it)
- User has coach/staff role (not fan)
- User isn't trying to add/remove from different organization

**Vulnerabilities:**
1. **No athlete type validation:**
   - Can add "athletes" to non-sports teams
   - Can add staff roles to sports teams with athlete limits

2. **Missing plan limit checks:**
   - Can exceed team roster limits by batch operations
   - No enforcement of ROSTER_THRESHOLD

3. **No team ownership verification:**
   - Membership check ≠ ownership check
   - Assistant coaches treated same as head coaches

**Fix Required:**
- Verify user.role === 'coach' OR is team owner
- Check plan limits before roster operations
- Validate athlete count against plan
- Log roster changes for audit

---

### 🟠 ISSUE #5: HIGH - Role Change Without Re-Verification

**Severity:** HIGH | **Type:** State Inconsistency | **Impact:** User keeps old permissions after role downgrade

**Location:** `server/src/routes/auth.ts:730-780` (role update endpoint)

**Problem:**
```typescript
// User can change own role
if (onboardingCompleted && 'role' in data.preferences && data.preferences.role !== currentPrefs.role) {
  // BUG: Role changed but no cascade cleanup
  // If user was coach → fan:
  // - Still owns organizations
  // - Still owns teams
  // - Still has admin permissions
  // No cascade downgrade!
}
```

**Vulnerabilities:**
1. **No permission revocation:**
   - Coach → Fan: keeps organization ownership
   - Keeps all team leadership positions
   - Permissions become orphaned

2. **No re-authorization:**
   - Endpoints still allow operations based on old role
   - Session-based cache of role not invalidated

3. **Missing audit trail:**
   - No log of who changed role or when
   - Can't track privilege escalation chains

**Test Case:**
- User A is coach, owns Organization X
- User A changes role from 'coach' → 'fan'
- User A can still manage Organization X (no cascade)
- User A can still invite people to org
- User A is effectively still coach (role=fan but owns coach resources)

**Fix Required:**
- When coach→fan: revoke org/team ownership
- Auto-remove from organizations on role downgrade
- Remove from teams with permission requirements
- Log all role changes to audit table
- Invalidate cached permissions

---

## Medium Severity Issues

### 🟡 ISSUE #6: MEDIUM - Missing Email Verification Check on Admin Endpoints

**Severity:** MEDIUM | **Type:** Validation Gap | **Impact:** Unverified users can admin-level operations

**Location:** `server/src/routes/organizations.ts:239-260` (POST /organizations)

**Problem:**
```typescript
organizationsRouter.post('/', requireAuth as any, async (req: AuthedRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  
  // Doesn't check email verification!
  // Should use: requireVerified middleware
  // Instead uses: requireAuth only
  
  const me = await prisma.user.findUnique(...);
  const prefs = (me.preferences as any) : {};
  const userRole = prefs.role || 'fan';
  if (userRole !== 'coach') {
    return res.status(403).json({ error: 'COACH_ROLE_REQUIRED' });
  }
  
  // User can be:
  // - Authenticated (req.user set)
  // - Not email verified
  // - With coach role
  // Can create organizations without verified email
}
```

**Vulnerabilities:**
1. **Unverified email can admin:**
   - Test/temporary accounts can create organizations
   - Email not verified but full org access granted

2. **No account validation:**
   - Should require email verification before org ops
   - Other endpoints enforce requireVerified, this doesn't

3. **Inconsistent middleware:**
   - Some endpoints use requireVerified
   - Others only use requireAuth
   - Inconsistent security posture

**Fix Required:**
- Use requireVerified middleware on all admin endpoints
- Verify email before allowing org/team creation
- Audit all endpoints for consistent middleware
- Create middleware stack: requireAuth → requireVerified

---

### 🟡 ISSUE #7: MEDIUM - Event Management Missing User Ownership Check

**Severity:** MEDIUM | **Type:** Boundary Violation | **Impact:** Users can modify events they don't own

**Location:** `server/src/routes/events.ts` (event CRUD endpoints)

**Problem:**
Event endpoints check if user belongs to team, but not if they created/own the event
- User can update any event in team they're member of
- Should be owner OR team admin
- Low-level members shouldn't modify high-level events

**Fix Required:**
- Check event.user_id === req.user.id OR user is team admin
- Implement event ownership model
- Prevent modification by non-owners

---

### 🟡 ISSUE #8: MEDIUM - Game RSVP Doesn't Verify Team Membership

**Severity:** MEDIUM | **Type:** Scope Validation | **Impact:** Non-members can RSVP to team games

**Location:** `server/src/routes/rsvps.ts` (RSVP endpoints)

**Problem:**
```typescript
// User RSVPs to game but doesn't verify they're on the team
// User could RSVP to any game for any team
// Should check: user is team member
```

**Vulnerabilities:**
1. **No team membership validation:**
   - Can RSVP without being on team
   - Crowds out actual team members
   - Game roster becomes meaningless

2. **No game status check:**
   - Can RSVP to canceled games
   - Can RSVP after game already played

3. **Missing capacity validation:**
   - Can RSVP beyond game capacity
   - No roster management

**Fix Required:**
- Verify user is team member before RSVP
- Check game status (not cancelled)
- Validate against game capacity
- Use game.team_id to scope check

---

### 🟡 ISSUE #9: MEDIUM - Message Access Not Scoped by Team/Organization

**Severity:** MEDIUM | **Type:** Information Disclosure | **Impact:** Users can read messages from teams they're not part of

**Location:** `server/src/routes/messages.ts:45-75`

**Problem:**
```typescript
// Messages have accessCheck but it may not properly scope by team
const accessCheck = await prisma.message.findFirst({
  where: { id: message_id }
  // Missing: conversation belongs to team user is member of
});

// Should verify:
// 1. User is member of conversation's team
// 2. User hasn't been removed from conversation
// 3. Conversation still exists (not archived)
```

**Fix Required:**
- Verify user is team member of message's team
- Check conversation membership status
- Validate team access before message access
- Implement message-level access control

---

## Low Severity Issues

### 🟢 ISSUE #10: LOW - Inconsistent 403 Error Messages

**Severity:** LOW | **Type:** UX/Security | **Impact:** Confusing error messages leak information

**Problem:**
- Some endpoints return "Insufficient permissions"
- Others return "COACH_ROLE_REQUIRED"
- Others return "Admin only"
- Inconsistent error handling

**Fix Required:**
- Standardize error messages
- Don't leak role requirements to unauthorized users
- Return generic "Access denied" to non-members
- Return specific errors only to legitimate requests

---

### 🟢 ISSUE #11: LOW - No Audit Logging for Permission Changes

**Severity:** LOW | **Type:** Compliance | **Impact:** No trail of who did what and when

**Problem:**
- No audit log when permissions change
- Can't track privilege escalation attempts
- Can't detect compromise

**Fix Required:**
- Create auditLog table in schema
- Log all permission changes (role, membership, ownership)
- Log all admin actions
- Implement audit review dashboard

---

### 🟢 ISSUE #12: LOW - Admin Check Function Not Consistent

**Severity:** LOW | **Type:** Code Quality | **Impact:** Different admin checks give different results

**Problem:**
Three different ways to check admin:
1. `requireAdmin` middleware (email-based)
2. `userHasOrgAdminAccess` (org membership role)
3. `isOrganizationAdmin` (hardcoded roles)

These can conflict if email admin isn't org member

**Fix Required:**
- Unify admin check logic
- Create single source of truth for permissions
- Use role-based RBAC consistently

---

## Summary by Frequency

### Most Common Pattern
**Missing role/ownership verification:** Issues #1, #2, #4
- Checks membership, not role
- Doesn't verify ownership
- Allows members to admin

### Second Most Common
**Missing cascade/cleanup:** Issues #3, #5
- Permission changes don't cascade
- Revoked access stays active
- Orphaned records

### Validation Gaps
Issues #6, #7, #8, #9
- Incomplete scope checks
- Missing status validation
- No boundary enforcement

---

## Deployment Impact Assessment

| Issue | Blocking | User Impact | Fix Complexity |
|-------|----------|------------|-----------------|
| #1 Org invite | ✅ YES | Non-admins can invite | Medium |
| #2 Team leads | ✅ YES | Non-coaches manage teams | High |
| #3 Org cascade | ⚠️ WARN | Revoked keep access | Medium |
| #4 Roster scope | ⚠️ WARN | Cross-team roster edits | Medium |
| #5 Role downgrade | ✅ YES | Keep old permissions | High |
| #6 Email verify | ⚠️ WARN | Unverified can create org | Low |
| #7 Event owner | ⚠️ WARN | Non-owners modify events | Low |
| #8 RSVP scope | ⚠️ WARN | Non-members RSVP | Low |
| #9 Message scope | ⚠️ WARN | Read messages cross-team | Medium |
| #10 Error msgs | ❌ NO | Confusing messages | Low |
| #11 Audit logs | ❌ NO | No compliance trail | Low |
| #12 Admin check | ⚠️ WARN | Inconsistent checks | Low |

---

## Recommended Fix Order

1. **IMMEDIATE (Critical - Authorization Bypass)**
   - Issue #1: Org admin verification
   - Issue #2: Team role verification
   - Issue #5: Role downgrade cleanup

2. **URGENT (High Impact)**
   - Issue #3: Org cascade cleanup
   - Issue #4: Team roster scope
   - Issue #9: Message scope validation

3. **IMPORTANT (Data Integrity)**
   - Issue #6: Email verification enforcement
   - Issue #7: Event ownership
   - Issue #8: RSVP team membership

4. **RECOMMENDED (Code Quality)**
   - Issue #12: Unify admin checks
   - Issue #10: Standardize errors
   - Issue #11: Add audit logging

---

## Testing Recommendations

### Unit Tests Needed
- [ ] Admin role verification (owner, manager, administrator)
- [ ] Team member role distinction (owner vs player vs assistant)
- [ ] Organization cascade removal (remove from org → remove from teams)
- [ ] Role downgrade cleanup (coach→fan removes org ownership)

### Integration Tests Needed
- [ ] Regular member can't invite to organization
- [ ] Assistant coach can't manage roster
- [ ] Revoked org member can't access teams
- [ ] Non-coach can't create organization
- [ ] Unverified email can't admin

### Scenarios to Test
- [ ] User A (admin) invites User B (regular member) to org
- [ ] User B tries to invite User C (should fail)
- [ ] User A changes role from coach→fan
- [ ] User A still has org/team ownership (should be removed)
- [ ] User is removed from org
- [ ] User can still access org teams (should be blocked)

---

**Status:** 🔴 CRITICAL - 2 authorization bypass vulnerabilities  
**Next Phase:** Begin fixing critical issues with role verification  
**Estimated Fix Time:** 6-8 hours for all critical/high issues

