# Permission System Security Audit

## Executive Summary

Found **1 CRITICAL vulnerability** and **1 HIGH priority issue**. The permission system has mostly good enforcement but one endpoint allows unauthenticated team creation.

---

## 🚨 CRITICAL: POST /teams Endpoint Missing Role Enforcement

**Location:** `/server/src/routes/teams.ts` line 265

**Issue:** The `POST /` endpoint for team creation does NOT check if the user has a coach role. It only checks team limits.

**Current Code (VULNERABLE):**
```typescript
teamsRouter.post('/', requireVerified as any, async (req: AuthedRequest, res) => {
  // ... checks team limits only ...
  // NO ROLE CHECK!
  const t = await prisma.team.create({ data: { name: parsed.data.name, description: parsed.data.description } });
  await prisma.teamMembership.create({ data: { team_id: t.id, user_id: me.id, role: 'owner' } });
  return res.status(201).json(t);
});
```

**Impact:** 
- A **fan account can create teams** (should only be coaches)
- Bypasses subscription tier limits (a Rookie fan could create unlimited teams)
- Violates business model (teams are a coach feature)

**Severity:** CRITICAL

**Status:** ⚠️ **REQUIRES IMMEDIATE FIX**

---

## ✅ Properly Implemented Controls

### 1. POST /teams/create Endpoint
**Location:** `/server/src/routes/teams.ts` line 483

**Status:** ✅ CORRECT
```typescript
if (userRole !== 'coach') {
  return res.status(403).json({
    error: 'COACH_ROLE_REQUIRED',
    message: 'Only coach accounts can create teams.'
  });
}
```

**Also enforces:**
- Rookie tier: max 2 teams
- Veteran tier: subscription quantity verification
- Legend tier: can create extracurricular clubs

### 2. PUT /teams/:id Update Endpoint
**Location:** `/server/src/routes/teams.ts` line 315

**Status:** ✅ CORRECT
- Verifies user is team owner OR admin
- Only owners can modify team info

### 3. DELETE /teams/:id Endpoint
**Location:** `/server/src/routes/teams.ts` line 408

**Status:** ✅ CORRECT
- Verifies user is team owner OR admin
- Cascade deletes all related data

### 4. POST /events (Event Creation)
**Location:** `/server/src/routes/events.ts` line 185

**Status:** ✅ CORRECT
```typescript
const autoApprove = userRole === 'coach' || userRole === 'organizer';
// Fans: approval_status = 'pending'
// Coaches: approval_status = 'approved'
```

**Also enforces:**
- Fans limited to 3 pending events (Rookie)
- Coaches get auto-approval
- Coaches → unlimited events

### 5. PUT /events/:id/approve Endpoint
**Location:** `/server/src/routes/events.ts` line 284

**Status:** ✅ CORRECT
```typescript
if (!isAdmin && userRole !== 'coach' && userRole !== 'organizer') {
  return res.status(403).json({ error: 'Only coaches and admins can approve events' });
}
```

---

## 🟠 MEDIUM: Two Duplicate Team Creation Endpoints

**Issue:** There are two endpoints for the same functionality:
- `POST /` (line 265) - **VULNERABLE** (missing role check)
- `POST /teams/create` (line 483) - **SECURE** (has role check)

**Why This Is Bad:**
- Confusion about which endpoint to use
- One is vulnerable, one is secure
- Frontends might be using either endpoint inconsistently

**Recommendation:** 
- Deprecate `POST /` endpoint
- Ensure all clients use `POST /teams/create`
- Or add role check to `POST /` and remove `/create`

---

## ⚠️ LOW: Public Endpoints Without Authentication

**Endpoints:**
- `GET /teams/:id` - Public team details (intentional?)
- `GET /teams/:id/members` - Public member list (intentional?)

**Status:** Need clarification
- May be intentional for team discovery
- But member lists expose internal structure to unauthenticated users

**Recommendation:** 
- Add comment explaining intentional public access
- Or restrict to authenticated users only

---

## Test Coverage

### Tests Needed (from documented test plan):

✅ **Role Enforcement:**
- [x] Coach can create team (works via POST /teams/create)
- [x] Rookie coach limited to 2 teams (works)
- [x] Veteran coach unlimited teams (works)
- [x] Legend can create extracurricular clubs (works)
- [ ] **Fan CANNOT create team** - FAILS on POST / (CRITICAL)

✅ **Event Approval:**
- [x] Fan event pitch → pending approval status (works)
- [x] Coach event → auto-approved (works)
- [x] Only coach/admin can approve events (works)

✅ **Team Management:**
- [x] Only owner can update team info (works)
- [x] Only owner can delete team (works)
- [x] Members can't modify team data (works)

---

## Summary of Findings

| Issue | Severity | Status | Location |
|-------|----------|--------|----------|
| POST / missing role check | CRITICAL | Unfixed | teams.ts:265 |
| Duplicate endpoints | MEDIUM | Unfixed | teams.ts:265 vs 483 |
| Public member endpoint | LOW | Review needed | teams.ts |

**Action Items:**
1. **CRITICAL:** Add role check to POST /teams endpoint
2. **HIGH:** Consolidate team creation endpoints
3. **MEDIUM:** Review and document intentional public endpoints
4. **RUN SECURITY SCAN:** After fixes, run Snyk code scan

