## Summary

- What changed:
- Why:

## Verification

- [ ] `npm run typecheck:app`
- [ ] `npm run typecheck:server`
- [ ] `cd server && npx prisma validate`
- [ ] `cd server && npx prisma generate`
- [ ] `git diff --check`

## Audit Standard

- [ ] Thin routes, thick features
- [ ] Backend validation is law
- [ ] No client-controlled security state
- [ ] One source of truth per domain
- [ ] Every protected action checks auth, role, plan, and ownership server-side
- [ ] Every async flow is idempotent
- [ ] No silent failures
- [ ] No duplicate policy logic when shared code is available
- [ ] Every affected screen handles loading, error, success, and empty states as required
- [ ] Deep links fail gracefully
- [ ] Every admin-impacting action is auditable
- [ ] Every release has a rollback path

## Source of Truth

- [ ] I checked `docs/SOURCE_OF_TRUTH_REGISTRY.md` for every auth, billing, moderation, and entitlement field touched in this PR
- [ ] If I changed a critical writer or invariant, I updated the registry in this PR

## Exceptions

- If any checkbox above is not true, explain why:
