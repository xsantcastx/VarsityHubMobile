# P0 Load and Concurrency Validation

This plan validates baseline performance and concurrency safety before broad launch.

---

## 1) Target endpoints

Run load checks against:

- Auth (`/auth/login`)
- Feed (`/posts`)
- Upload signing (`/uploads/sign`)
- Messaging (`/messages`)
- Payment finalize (`/payments/finalize-session`)
- Webhook signature path (`/payments/webhook`)

---

## 2) Commands

```bash
# API load smoke (configurable via env)
BASE_URL=http://localhost:4000 \
LOAD_CONCURRENCY=10 \
LOAD_REQUESTS=50 \
npm --prefix server run load:smoke

# Distributed lock validation (requires REDIS_URL)
npm --prefix server run load:validate-lock
```

Optional auth token for auth-required routes:

```bash
LOAD_TEST_TOKEN=your_jwt_token npm --prefix server run load:smoke
```

---

## 3) Pass criteria (P0)

- No uncontrolled server errors during load run.
- API p95 latency stays under SLO target (500ms) for baseline load.
- Distributed lock validation reports:
  - `max_active <= 1`
  - `violations = 0`
  - all workers completed

---

## 4) Multi-instance note

`load:validate-lock` uses multiple Node processes and shared Redis lock state.
For full production confidence, run the same validation against your deployed multi-instance environment.
