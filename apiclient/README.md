# Client API Layer

This folder is the **single place** the app talks to the backend. No screens or components should use `fetch()` directly.

## Structure

| File             | Purpose                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **http.ts**      | Base URL, auth token, 401 refresh, timeouts, retries. Exports `httpGet`, `httpPost`, `httpPut`, `httpPatch`, `httpDelete`, `httpPostWithOptions`, `httpPostLongTimeout`.                                                                    |
| **entities.ts**  | Re-exports domain objects: `User`, `Game`, `Post`, `Organization`, `Team`, `Event`, `Message`, `Notification`, `Payments`, `Subscriptions`, `Report`, `Support`, `Advertisement`, `Search`, `Highlights`, `TeamMemberships`, `TeamInvites`. |
| **auth.ts**      | Register, login, OAuth, logout, refresh, verify, password flows.                                                                                                                                                                            |
| **upload.ts**    | Cloudinary signing, file upload.                                                                                                                                                                                                            |
| **geocoding.ts** | Geocoding/places.                                                                                                                                                                                                                           |
| **settings.ts**  | User preferences.                                                                                                                                                                                                                           |
| **types.ts**     | Shared request payload types for the client API layer.                                                                                                                                                                                      |

## Server mapping

Paths match the backend mount points in `server/src/app.ts`:

- `/auth/*` → authRouter
- `/me`, `/me/preferences`, etc. → authRouter
- `/games/*` → gamesRouter
- `/teams/*` → teamsRouter
- `/organizations/*` → organizationsRouter
- `/posts/*` → postsRouter
- `/payments/*` → paymentsRouter
- `/events/*` → eventsRouter
- `/notifications/*` → notificationsRouter
- `/messages/*` → messagesRouter
- `/ads/*` → adsRouter (Advertisement in misc)
- `/users/*` → usersRouter
- `/search/*` → searchRouter
- `/uploads/*` → uploadsRouter
- `/highlights/*` → highlightsRouter
- etc.

## Conventions

- Use **entities** for domain types and calls: `import { User, Game, Message } from '@/api/entities'`.
- Use **domain modules** for calls: `User.me()`, `Game.list()`, `Organization.mine()`, `Message.send()`.
- Token is set by auth flow; `http.ts` adds `Authorization: Bearer` and handles 401 refresh.
- Mutations use `retries: 0` to avoid duplicate operations; GETs use limited retries for resilience.
