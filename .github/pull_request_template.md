## Summary

- What changed:
- Why it changed:
- Risk level:
- Source of truth touched:
- Trust boundaries touched:
- Rollback or deploy-order notes:

## Verification

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] Relevant tests added or updated
- [ ] Manual verification completed for touched flows
- [ ] If security or integrity behavior changed, before/after failure path documented
- [ ] If contract shape changed, client and server were verified together

## Guardrail Checklist

- [ ] Routing touched: I checked route declarations, navigation call sites, and params
- [ ] Cross-feature change: I checked shared contracts and import boundaries
- [ ] New shared util: I documented why this belongs in a shared layer instead of a single feature
- [ ] API contract changed: client and server shapes are both updated
- [ ] Auth or guard logic touched: guarded and unguarded paths were both verified
- [ ] Error handling changed: user-facing failure state was tested
- [ ] No client-controlled field sets payment, approval, privileged role, plan, or ownership state
- [ ] No fallback, retry, catch, or redirect path weakens auth, approval, payment, plan, or ownership enforcement
- [ ] Protected actions touched here still fail server-side without permission
- [ ] Async critical flows touched here are replay-safe or their idempotency behavior is documented
- [ ] Missing params fail gracefully for public navigation and fail closed for privileged actions
- [ ] Critical flows touched here have a named verification path: test, script, log, or runtime proof

## Notes for Reviewers

- Files with highest blast radius:
- Follow-up work intentionally deferred:
- Anything that should be smoke-tested on device:
- Which checklist items are `N/A`, and why:

## Review Policy

- Use [`docs/PR_CHECKLIST.md`](../docs/PR_CHECKLIST.md) as the operating review gate.
- Use [`docs/AUDIT_STANDARD.md`](../docs/AUDIT_STANDARD.md) when policy questions come up.
- `N/A` is acceptable only with a concrete reason.
