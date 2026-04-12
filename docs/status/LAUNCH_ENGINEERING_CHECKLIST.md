# Launch Engineering Checklist (Dec 6, 2025)

## 1. Environment & Secrets
| Item | Status | Details / Next Action |
| --- | --- | --- |
| Mobile runtime env (`app.json`) | ✅ Aligned | `app.json` and `package.json` both at version 1.0.1 (aligned Dec 7, 2025). |
| Sentry DSN (mobile + server) | ✅ Configured | Client DSN in `utils/sentry.ts` (invalid `enableInExpoDevelopment` option removed); server requires `SENTRY_DSN` env var. Confirm production keys present. |
| Expo Push project ID | ✅ | Sourced from `app.json.extra.eas.projectId`; ensure tokens registered via `AuthProvider`. |
| Stripe / SendGrid secrets | ⏳ Verify | Server expects env vars (see `server/src/lib/email.ts`, payments routes). Confirm values stored in hosting platform and CI. |
| `ALLOWED_ORIGINS` | ✅ Guarded | `server/src/index.ts` now rejects `*` in prod; populate env with store domains before deploy. |
| Google Maps API keys | ✅ Env-backed | Expo config now injects them from `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` via `app.config.js`; rotate/restrict the old key in Google Cloud. |

## 2. Backend Readiness
| Task | Status | Notes |
| --- | --- | --- |
| `npm run build` / `npm test` | ✅ 55/55 passing | Server tests pass (auth, payments, ads suites). 1 setup file error (jest undefined in setup.ts) - non-blocking. Re-run locally to confirm. |
| Prisma migrations | ⏳ Pending | Ensure latest schema deployed (`server/package.json` scripts). |
| Health endpoints / rate limits | ✅ | `/health` route registered; auth/api limiters configured via `express-rate-limit`. Need real-world validation under load. |
| Email/push test endpoints | ✅ Dev only | `/test-emails` and `/test-notifications` enabled in non-prod; disable or secure before production release. |

## 2a. Security Audit (Dec 7, 2025)
| Task | Status | Notes |
| --- | --- | --- |
| Root dependencies (`npm audit`) | ✅ Clean | 0 vulnerabilities in mobile app dependencies. |
| Server dependencies (`npm audit`) | ⚠️ 2 HIGH | **Cloudinary <2.7.0**: Arbitrary Argument Injection (CVSS 8.6, CVE GHSA-g4mf-96x5-5m2c). **multer-storage-cloudinary >=3.0.0**: Depends on vulnerable cloudinary. Fix: `cd server && npm audit fix --force` (breaking change to v2.2.1). Decision required before release. |
| TypeScript compilation | ✅ Clean | All type errors fixed (test mocks + Sentry config). `npm run typecheck` passes. |
| ESLint baseline | ✅ Documented | 375 warnings (see `codebase-metrics.txt`). Auto-fix available for 230 unused-vars. Non-blocking for launch. |

## 3. Mobile Build & Pipeline
| Task | Status | Notes |
| --- | --- | --- |
| Lint / typecheck | ✅ Validated (Dec 7) | `npm run typecheck` ✅ 0 errors. `npm run lint:strict` shows 375 warnings (230 unused-vars, 108 floating-promises, 20 no-console). Auto-fix script available at `scripts/autofix-unused-vars.sh`. |
| Unit tests | ✅ | `npm test` passes (OfflineBanner suite). Expand coverage (auth hooks, feed). |
| EAS builds | ⏳ Pending | Run `eas build --platform ios/android --profile production`; attach build logs to `build_output.log`. |
| Store metadata | ⏳ Pending | Confirm icons, splash (`assets/images`), privacy/support URLs in app.json; prep screenshots + release notes. |

## 4. Monitoring & Observability
| Task | Status | Notes |
| --- | --- | --- |
| Sentry alerts | ⏳ Pending | Ensure alert rules exist for mobile/server projects. |
| Uptime / log forwarding | ⏳ Pending | Set up ping monitors (Railway/BetterStack) and log drains for API + push worker. |
| Offline banner | ✅ | `OfflineBanner` ties to health check; manual QA required to ensure it appears on real devices. |

## 5. Compliance & Legal
| Task | Status | Notes |
| --- | --- | --- |
| Privacy & support links | ✅ Configured | `app.json` includes privacy/support URLs; verify pages live + updated. |
| Data retention / ToS copy | ⏳ Pending | Audit in-app copy + website for final language; document in `README_LAUNCH_READY.md`. |
| Third-party SDK disclosures | ⏳ Pending | App Store Connect privacy questionnaire must list Sentry, Stripe, Google Maps, etc. |

## 6. Go-To-Market / Ops
| Task | Status | Notes |
| --- | --- | --- |
| Beta feedback triage | ⏳ Pending | Close TestFlight/Play Console issues; capture in `APP_FIXES_LOG.md`. |
| Support playbook | ⏳ Pending | Provide day-0 escalation doc (issues, logs, rollback). |
| Release comms | ⏳ Pending | Prep release notes + marketing copy. |

> Update this checklist as you complete items. Link artifacts (build IDs, dashboards) in the Notes column for reference.
