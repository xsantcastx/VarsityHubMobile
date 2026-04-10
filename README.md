# VarsityHub Mobile

VarsityHub is an Expo / React Native app backed by a Node / Express API in `server/`. This repo now uses a clearer split between Expo Router route files at the root `app/` and shared app code under `src/`.

## Tech Stack

- Expo 54
- React Native 0.81
- Expo Router
- TypeScript
- Jest and Playwright
- Express
- Prisma
- SendGrid for email
- Stripe, Cloudinary, Sentry, Twilio integrations

## Local Setup

1. Install root dependencies:

```bash
npm ci
```

2. Install server dependencies:

```bash
npm --prefix server ci
```

3. Create local env files from the examples:

```bash
cp .env.example .env
cp server/.env.example server/.env
```

4. Fill in the minimum required values:

- `DATABASE_URL`
- `JWT_SECRET`
- `EXPO_PUBLIC_API_URL`
- email config if you want real email delivery

5. If you run iOS locally, install CocoaPods:

```bash
cd ios && pod install && cd ..
```

## Environment Setup

- General env reference: [docs/ENV.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/ENV.md)
- Email env reference: [docs/EMAIL_ENV.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/EMAIL_ENV.md)
- Safe examples:
  - [.env.example](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/.env.example)
  - [server/.env.example](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/server/.env.example)

## Running The Project

Full stack development:

```bash
npm run dev
```

App only:

```bash
npm run start
npm run android
npm run ios
npm run web
```

Server only:

```bash
npm --prefix server run dev
```

## Quality Commands

```bash
npm run lint
npm run format
npm run typecheck
npm test
npm --prefix server test
```

## Folder Structure

```text
.
├── app/                  Expo Router routes only
├── assets/               Expo assets
├── components/           shared UI components that remain route-adjacent
├── docs/
├── scripts/
├── src/
│   ├── api/
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
    ├── scripts/
    ├── src/
    │   ├── routes/
    │   ├── jobs/
    │   ├── workers/
    │   ├── lib/
    │   └── services/email/
    └── tests/
```

Conventions:

- `app/` is only for route files, layouts, and route-local helpers.
- `src/` contains shared app code.
- `server/src/services/email/` owns provider logic and reusable email templates.
- `server/src/lib/email.ts` keeps compatibility exports for callers, but it should delegate to the email service instead of talking to providers directly.

## How Email Works

- Frontend auth and workflow triggers call server routes.
- The server uses `server/src/lib/email.ts` compatibility helpers.
- Those helpers delegate to `server/src/services/email/EmailService.ts`.
- SendGrid is the primary provider.
- Fallback HTML/text templates live in `server/src/services/email/templates/`.

For details:

- [docs/EMAIL_AUDIT.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/EMAIL_AUDIT.md)
- [docs/EMAIL_GUIDE.md](/Users/varsityhub/Desktop/CODE/VarsityHubMobile/docs/EMAIL_GUIDE.md)

## Testing Emails Locally

Config-only verification:

```bash
npm --prefix server run verify:email
```

Real delivery test:

```bash
tsx server/scripts/verify-email-templates.ts --test-to=you@example.com
```

## Troubleshooting

- Expo app cannot reach the API:
  - check `EXPO_PUBLIC_API_URL`
  - confirm the server is running on the expected host and port
- Email verification or password reset does not arrive:
  - verify `EMAIL_PROVIDER`, `EMAIL_FROM`, and `SENDGRID_API_KEY`
  - verify the related `SENDGRID_*_TEMPLATE_ID`
  - check `/health` and server logs
- Typecheck fails after adding shared code:
  - import shared app modules through `@/...`
  - keep route files in `app/`
- Queue-backed jobs do not run:
  - verify `REDIS_URL`
  - confirm the relevant worker process is running
