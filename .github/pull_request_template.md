## Summary

- What changed:
- Why it changed:
- Risk level:

## Verification

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] Relevant tests added or updated
- [ ] Manual verification completed for touched flows

## Guardrail Checklist

- [ ] Routing touched: I checked route declarations, navigation call sites, and params
- [ ] Cross-feature change: I checked shared contracts and import boundaries
- [ ] New shared util: I documented why this belongs in a shared layer instead of a single feature
- [ ] API contract changed: client and server shapes are both updated
- [ ] Auth or guard logic touched: guarded and unguarded paths were both verified
- [ ] Error handling changed: user-facing failure state was tested

## Notes for Reviewers

- Files with highest blast radius:
- Follow-up work intentionally deferred:
- Anything that should be smoke-tested on device:
