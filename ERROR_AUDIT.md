# Error Audit

Work in progress. Confirmed findings below are ordered by leverage, not completion order.

## High

### Public email-verification and password-reset handoff routes bypass the shared async error handler

- Affected files:
  - [server/src/routes/publicAppHandoff.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/publicAppHandoff.ts:245)
  - [server/src/routes/publicAppHandoff.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/publicAppHandoff.ts:293)
  - [server/src/routes/publicAppHandoff.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/publicAppHandoff.ts:346)
  - [server/src/middleware/asyncHandler.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/middleware/asyncHandler.ts:3)
- Failure path:
  - `/verify`, `/verify/resend`, and `/reset-password` are registered as raw `async (req, res)` Express handlers.
  - They await Prisma reads/writes and helper calls that can reject.
  - Unlike the rest of the server, these handlers are not wrapped in `asyncHandler`, so rejected promises can bypass the central error pipeline.
- Expected behavior:
  - Public auth-recovery and verification routes should funnel asynchronous failures through the same error handler as the rest of the API.
- Actual behavior:
  - This route family is an exception and can fail outside the normal `catch(next)` path.
- Fix recommendation:
  - Wrap these handlers in `asyncHandler`, or convert them to non-async handlers that explicitly forward errors with `next`.
- Verification:
  - Add a behavior test that forces a thrown dependency inside `/verify` or `/reset-password` and asserts the request returns a handled server error instead of an unhandled rejection or hung response.
