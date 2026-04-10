# Repo Audit

## Scope

This repository contains two active runtime surfaces:

- Expo / React Native app at the repo root
- Node / Express API in `server/`

The audit below focuses on making the repo easier to navigate and safer to maintain without changing app behavior.

## Current Structure Snapshot

Top-level structure observed during the audit:

```text
.
├── app/                  Expo Router routes
├── api/                  app-side API client helpers
├── assets/               Expo assets
├── components/           shared UI and feature components
├── config/               app runtime config
├── constants/            app constants and theme values
├── context/              React context providers
├── docs/                 mixed product, release, and ops docs
├── hooks/                app hooks
├── ios/                  native iOS project
├── android/              native Android project
├── scripts/              local scripts
├── server/               Express API and background jobs
├── tests/                Playwright and API-level tests
├── types/                app typings
├── utils/                app utilities
└── sendgrid-templates/   exported provider template artifacts
```

Server-side structure relevant to email and notifications:

```text
server/src/
├── jobs/
├── lib/
│   ├── email.ts
│   ├── env.ts
│   ├── queue.ts
│   └── sms.ts
├── middleware/
├── routes/
├── services/
│   └── email/
└── workers/
```

## What Is Working

- The repo already separates mobile app and API concerns.
- Expo Router is already established and should remain the routing convention.
- Path aliases already exist, which reduces some import churn risk.
- A first pass at a centralized server email service already exists in `server/src/services/email/`.
- Root and server packages both have runnable scripts and tests.

## Pain Points

- Shared app code is split across many root folders, while `app/` also contains route-specific components. It is hard to know whether new code belongs in `app/`, `components/`, `api/`, or `utils/`.
- The repo currently mixes long-lived docs, audit notes, release notes, and one-off troubleshooting files at the top level.
- The root `src/` folder exists but is effectively unused, which signals an unfinished migration.
- Email delivery is only partially centralized:
  - `server/src/services/email/` exists
  - `server/src/lib/email.ts` still contains provider-specific logic and direct `@sendgrid/mail` calls
  - template fallback HTML is embedded inline in multiple functions
- Environment documentation is duplicated between root `.env.example` and `server/.env.example`, with overlapping but inconsistent naming such as `FROM_EMAIL` vs `EMAIL_FROM`.
- Config validation still treats SMTP as the required email path even though the live implementation is SendGrid.
- Linting is frontend-focused and does not clearly cover the server package.
- There is no basic GitHub Actions workflow checked into the repo.

## Quick Wins

- Move shared app source into `src/` while keeping Expo Router `app/` at the repo root.
- Standardize path aliases so all non-route app code resolves from `@/`.
- Document folder ownership and email architecture in `docs/`.
- Make the server email path consistently use the `EmailService` abstraction.
- Normalize email env names around `EMAIL_PROVIDER`, `EMAIL_FROM`, and `SENDGRID_*`.
- Add a repo-level `format` script and lightweight CI for install, lint, typecheck, and tests.
- Add a short organizational changelog so the maintainer can review structural changes quickly.

## Risks

- Moving route files would be high risk because Expo Router depends on the filesystem. Route paths should remain under the root `app/`.
- Many app files already import via `@/` aliases, but some still use relative paths. A move to `src/` requires careful alias coverage and import updates.
- The email layer has existing production-facing flows for auth, moderation, billing, team invites, and event notifications. Refactoring must preserve exported helper names and request contracts.
- The repo contains a local `server/.env` file in the workspace. It is ignored by Git, but it increases the chance of confusing local-only behavior during validation.
- Server build exclusions are broad, so some paths may be lightly validated by TypeScript today.

## Proposed Target Structure

Expo Router should remain at the root, but shared app code should move under `src/`:

```text
.
├── app/                  Expo Router routes only
├── assets/               Expo-native static assets
├── docs/
├── scripts/
├── src/
│   ├── api/
│   ├── components/
│   ├── config/
│   ├── constants/
│   ├── context/
│   ├── features/
│   ├── hooks/
│   ├── services/
│   ├── theme/
│   ├── types/
│   └── utils/
├── tests/
└── server/
    ├── docs/
    ├── scripts/
    ├── src/
    │   ├── jobs/
    │   ├── lib/
    │   ├── middleware/
    │   ├── routes/
    │   └── services/
    │       └── email/
    │           ├── providers/
    │           ├── templates/
    │           ├── EmailService.ts
    │           ├── service.ts
    │           └── types.ts
    └── tests/
```

## Conventions To Establish

- `app/` is only for Expo Router routes, layouts, and route-local helpers.
- `src/components/` is for reusable UI shared by multiple routes.
- `src/features/` is for feature-scoped code that is not route-owned.
- `src/services/` is for app-side service abstractions and integrations.
- `server/src/services/email/` is the only place that may know about email providers.
- `server/src/lib/email.ts` may keep compatibility exports, but it should delegate to the email service instead of talking to SendGrid directly.
- Root `.env.example` documents the combined local dev surface; email-specific details live in dedicated docs.

## Recommended Refactor Sequence

1. Write repo and email audit docs.
2. Move shared frontend source into `src/` and update aliases/imports.
3. Finish centralizing email delivery behind `EmailService`.
4. Normalize env docs, formatting scripts, and CI.
5. Run static validation across app and server, then document any remaining manual checks.
