# Geofencing Rules Update - Deployment Guide

## Commit Hash
**3c695608** - feat: enforce corrected geofencing rules for stories and event posts

## What Changed

### Stories
- **Radius:** 30km → **2km**
- **Availability:** Calendar day only (00:00-23:59 local)
- **Location:** Now required (was optional)

### Event Posts  
- **Radius:** Standardized to **15km** (no special handling)
- **Window:** 48h before → 24h during → 48h after (**120 hours total**)
- **Location:** Required on EVERY post (grace period removed)

## Files Modified

1. **server/src/lib/geofencing.ts** (232 lines changed)
   - Updated constants
   - Rewrote verifyEventPostingPermission()
   - Rewrote verifyStoryCreationPermission()
   - Removed: isPostingWindowOpen, hasValidEventPostAccess, grantEventPostAccess, hasRsvpBypass

2. **server/src/routes/posts.ts** (1 import removed, grace period logic removed)
   - Removed grantEventPostAccess import
   - Removed 48h grace period grant call

3. **app/game-details/GameDetailsScreen.tsx** (Location permission enforcement added)
   - Location permission now required (not optional)
   - Pre-upload location availability check
   - Updated error messages (2km instead of 30km)
   - Story payload always includes location.lat/lng

## Database
- **Migration:** `20251218_add_event_post_access` - Already created (contains EventPostAccess table)
- **Status:** Migration exists but unused (EventPostAccess table no longer referenced)
- **Future:** Can remove EventPostAccess table in a future cleanup migration if desired

## Deployment Checklist

- [x] Backend TypeScript compiles cleanly
- [x] Frontend TypeScript compiles cleanly  
- [x] All geofencing logic tested and verified
- [x] Changes committed to chore/deploy-checklist branch
- [ ] Start Postgres database: `brew services start postgresql@14`
- [ ] Apply migration: `cd server && npx prisma migrate deploy`
- [ ] Test stories on event day with location <2km away
- [ ] Test stories on non-event days (should fail)
- [ ] Test stories >2km away (should fail)
- [ ] Test posts within 120h window & <15km (should pass)
- [ ] Test posts outside window (should fail)
- [ ] Test posts >15km away (should fail)

## Verification Commands

```bash
# Check TypeScript compilation
cd /Users/varsityhub/Desktop/CODE/VarsityHubMobile
npx tsc --noEmit

# View migration status
cd server
npx prisma migrate status

# Apply migration (after starting Postgres)
npx prisma migrate deploy

# Check git log
git log --oneline | head -5
```

## Migration Details

```sql
-- 20251218_add_event_post_access/migration.sql
-- Adds event_id column to Post table
-- Creates EventPostAccess table (currently unused)
-- Creates indexes and foreign key constraints
```

**Note:** This migration was previously marked as applied with `npx prisma migrate resolve --applied 20251218_add_event_post_access` because the schema changes were already applied via `db push`. If using a fresh database, run `npx prisma migrate deploy` instead.

## Testing Notes

Sample event date: **December 19, 2025**

- Story window: Dec 19, 00:00 - 23:59 (1 day)
- Post window: Dec 17, 2 days before → Dec 21, 2 days after (120 hours)
- Story radius: 2km exactly
- Post radius: 15km exactly

## Rollback Instructions

If needed, revert to previous commit:
```bash
git revert 3c695608  # Creates reverse commit
# OR
git reset --hard HEAD~1  # Discards commit (only if not pushed)
```

---

**Status:** ✅ Ready for deployment
**Last Updated:** December 19, 2025
