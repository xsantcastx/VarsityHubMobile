# Event Slug Specification

Goal: Introduce SEO-friendly event slugs and expose them across API responses to enable canonical web URLs and deep links from the mobile app.

## Prisma Schema Changes

Add an optional `slug` column to the `Event` model. Slugs must be unique when present.

```prisma
model Event {
  id            String   @id @default(cuid())
  title         String
  description   String?
  date          DateTime?
  location      String?
  latitude      Float?
  longitude     Float?
  capacity      Int?
  banner_url    String?
  // ... other fields

  slug          String?  @unique
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
}
```

### Migration Notes

- Generate slug for existing rows using a deterministic strategy (e.g., `kebab-case(title)` + short id suffix) to avoid collisions.
- Backfill may be deferred; `slug` is optional and mobile will fall back to `id` when absent.
- Index the `slug` column with `@unique` to guarantee uniqueness.

Example backfill SQL (conceptual):

```sql
UPDATE "Event"
SET slug = LOWER(REGEXP_REPLACE(title, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTR(id, 1, 6)
WHERE slug IS NULL;
```

## Serializer / API Output

Include `slug` in event payloads wherever `id` is present. Mobile will prefer `slug` for URLs when available.

Example `GET /events/:id` response:

```json
{
  "id": "evt_123",
  "slug": "championship-finals-evt123",
  "title": "Championship Finals",
  "description": "Final match",
  "date": "2025-12-20T19:00:00.000Z",
  "location": "Center Court",
  "latitude": 40.7128,
  "longitude": -74.006,
  "capacity": 250,
  "banner_url": "https://.../banner.jpg",
  "attendees_count": 42
}
```

List endpoints should also include `slug`:

```json
[
  {
    "id": "evt_123",
    "slug": "championship-finals-evt123",
    "title": "Championship Finals",
    "date": "2025-12-20T19:00:00.000Z",
    "location": "Center Court"
  }
]
```

## Routing Considerations

- Accept both numeric/opaque `id` and `slug` in routes for flexibility:
  - `GET /events/:id`
  - `GET /events/slug/:slug`
- Alternatively, transparently resolve `GET /events/:key` where `key` matches either an `id` or a `slug`.
- RSVP endpoints remain keyed by `id` for now:
  - `POST /events/:id/rsvp`
  - `GET /events/:id/rsvp`

## Mobile Client Behavior

- `AppLinks.event(idOrSlug, title?)` now accepts either `id` or `slug`.
- If `event.slug` exists, the app passes it to `AppLinks.event`. Otherwise, it passes `event.id`.
- Share payload always includes a canonical web URL like `https://varsityhub.app/events/<slug-or-id>`.

## Validation Rules

- Slug must be lowercase, URL-safe, and 3–80 chars.
- Allowed chars: `[a-z0-9-]`; collapse consecutive dashes; trim leading/trailing dashes.
- Uniqueness: enforce at DB level; on conflict, append a short suffix (e.g., `-evt123`).

## Error Responses

- `GET /events/slug/:slug`:
  - `404 Not Found` when slug is unknown: `{ "error": "Not found" }`
- `POST /events/:id/rsvp`:
  - `401 Unauthorized` when auth required; include message for client toast: `{ "error": "Unauthorized" }`

## Testing Checklist

- Fetch event detail returns `slug`.
- List endpoints include `slug`.
- Slug resolves via both `/events/:id` (legacy) and `/events/slug/:slug` (optional).
- Mobile shares use `slug` when present; fall back to `id` when absent.
- RSVP endpoints continue to function with `id`.

## Rollout Strategy

1. Add `slug` field and migration.
2. Update serializers and list endpoints.
3. Optional: add slug-based route.
4. Deploy backend.
5. Mobile already compatible; no further mobile release required beyond current changes.
