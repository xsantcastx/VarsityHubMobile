# Database Audit

Work in progress. Confirmed findings below are ordered by leverage, not completion order.

## Medium

### Pending-event approval queue is fetched without a hard cap or pagination

- Affected files:
  - [server/src/routes/events.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/events.ts:552)
  - [server/src/routes/events.ts](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/src/routes/events.ts:608)
- Failure path:
  - `GET /events/pending` builds a scoped `where` clause for coach/admin reviewers.
  - The route then calls `prisma.event.findMany({ where, orderBy, include })` with no `take`, cursor, or page bound.
  - A league or platform admin with a large pending backlog can force the API to materialize the full queue in one request.
- Expected behavior:
  - Reviewer queues should be page-bounded the same way other list surfaces are, especially on coach/admin screens that can accumulate backlog over time.
- Actual behavior:
  - The route is unbounded at the database layer.
- Fix recommendation:
  - Add a default `take` plus cursor or page params to `/events/pending`.
  - Keep the current scoped visibility logic, but cap the result set before returning it.
- Verification:
  - Add a test that `GET /events/pending` respects an explicit or default page size.
  - Grep for `take:` or cursor handling on the route after the fix.
