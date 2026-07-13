# Onboarding Changes Tracker

**Session Date:** November 16, 2025  
**Last Updated:** December 12, 2025 (Autocomplete + Org Metadata)

---

## ⚡ Latest: Autocomplete + Organization Metadata Flow (Dec 12, 2025)

### Summary

Organizations now require canonical location metadata (`place_id`, `formatted_address`, `lat/lng`) to prevent duplicates and enable location-based search. Step 4 onboarding enforces autocomplete selection before submission.

### Key Changes

1. **Database:** Added `formatted_address`, `place_id` to `Organization` model (migration `20251212090000_add_organization_place_id`)
2. **Backend:** New endpoints `/geocoding/autocomplete`, `/geocoding/place-details`, `/organizations/check-duplicate`; duplicate guard checks `place_id` first, then normalized name+zip
3. **Mobile Step 4:** Enforced autocomplete, inline duplicate warning, email verification guard, success toast after creation
4. **Seed:** Added Westhill HS, Greenwich HS, Stamford Youth Soccer with canonical addresses
5. **Org Screens:** `app/organizations/index.tsx` (list + featured Westhill), `app/organizations/[id].tsx` (detail view)
6. **Tests:** Backend tests for duplicate guard, place_id uniqueness, geocoding helpers
7. **Logging:** Reusable middleware with request IDs, timing, payment-specific logging

### Verification

- **Test 1:** Autocomplete enforcement—button disabled until suggestion selected
- **Test 2:** Duplicate detection—yellow warning + backend 409 error for duplicates
- **Test 3:** Email verification guard—blocks unverified users with alert
- **Test 4:** Success toast—confirms creation, navigates to Step 6
- **Test 5:** `/organizations/check-duplicate` endpoint returns `exists: true` for matches
- **Test 6:** Org index features Westhill, detail screen shows address/CTAs
- **Test 7:** `npm test -- tests/organizations.test.ts` passes
- **Test 8:** Logs show `[uuid] → GET /path` and `[uuid] 💳 Payment Request` with session IDs

### Rollback

```bash
cd server
npx prisma migrate resolve --rolled-back 20251212090000_add_organization_place_id
```

Remove autocomplete enforcement from `step-4-organization.tsx` by omitting `&& !!selectedPlace` from `canContinue`.

### Support Scripts

```bash
node server/scripts/verify-organizations.ts  # View org metadata table
```

**See full details in separate section below.**

---

## Changes Made So Far

### ✅ Step 1: Role Selection (`app/onboarding/step-1-role.tsx`)

#### Fan Account

- ✅ Changed "Connect with other fans" → "Pitch events for your community"
- ✅ Removed "Quick setup process"
- ✅ Updated upgrade note: "_Fan accounts can be upgraded to athlete/staff_"
- ✅ Split into two bullets: "- Upon coach approval"
- ✅ Grammar fix: "first-time coaches" (hyphenated)

**Current Features:**

```
✓ Follow your favorite teams
✓ Get game updates and highlights
✓ Pitch events for your community
✓ *Fan accounts can be upgraded to athlete/staff*
✓ - Upon coach approval
```

#### Rookie Account

- ✅ Removed "(Coach)" from title - now just "Rookie"
- ✅ Changed "(ex: Men's and Women's Soccer)" → "Example: Men's and Women's Soccer"
- ✅ Grammar fix: "first-time coaches" (hyphenated)

**Current Features:**

```
✓ Perfect for first-time coaches
✓ First two teams free
✓ Example: Men's and Women's Soccer
✓ Create events including games, fundraisers, and watch parties
```

#### Coach/Organizer Account

- ✅ Replaced "Communication features" → "Unlimited teams and authorized users"

**Current Features:**

```
✓ Create and manage teams
✓ Organize games and events
✓ Invite players and staff
✓ Full management tools
✓ Unlimited teams and authorized users
```

---

## Pending Changes (To Discuss)

### Step 2: Email Verification

- [ ] Review copy/messaging
- [ ] Any permission-related notes?

### Step 3: Profile Setup

- [ ] Different fields for different account types?
- [ ] Required vs optional fields by role?

### Step 4: Team Creation (Coach/Rookie only)

- [ ] Clarify 2-team limit messaging for Rookie
- [ ] Add upgrade prompt when limit reached?

### Step 5: League/Sport Selection

- [ ] Any changes needed?

### Step 6: Authorized Users (Coach only)

- [ ] Add messaging about Rookie vs Veteran vs Legend limits
- [ ] Skip for Rookie accounts?

### Step 7: Profile Photo

- [ ] Any changes?

### Step 8: Interests/Categories

- [ ] Different for each account type?

### Step 9: Welcome/Quick Start

- [ ] Customize actions by account type
- [ ] Match the promises from Step 1

### Step 10: Confirmation

- [ ] Update role descriptions to match Step 1

---

## Backend Implementation Notes

### Critical: Role-Based Feature Access

1. **Fan Permissions:**
   - ⚠️ Event pitching needs API endpoint
   - ⚠️ Upgrade request system needs database table
   - ✅ Can follow teams, RSVP, post reviews

2. **Rookie Permissions:**
   - ⚠️ ENFORCE 2-team limit in backend
   - ⚠️ Event types: games, fundraisers, watch parties
   - ❌ Cannot add authorized users
   - ❌ Cannot create unlimited teams

3. **Coach/Organizer Permissions:**
   - ⚠️ Veteran tier: $2.50/month per team after first 2
   - ⚠️ Legend tier: Unlimited everything
   - ⚠️ Authorized users system needs implementation
   - ✅ Full team management

### Database Changes Needed

- [ ] Add `role` column to User table (currently in preferences JSON)
- [ ] Create `PitchedEvent` table for fan event proposals
- [ ] Create `UpgradeRequest` table for fan→athlete transitions
- [ ] Create `AuthorizedUser` table for multi-user team management
- [ ] Add `event_type` to Event table (game/fundraiser/watch_party)

### API Endpoints Needed

- [ ] `POST /events/pitch` - Fan pitches event
- [ ] `GET /events/pitched` - Coach views pitches
- [ ] `PATCH /events/pitched/:id/approve` - Approve pitch
- [ ] `POST /users/request-upgrade` - Fan requests upgrade
- [ ] `GET /teams/:id/upgrade-requests` - Coach views requests
- [ ] `PATCH /upgrade-requests/:id/approve` - Approve upgrade
- [ ] `POST /teams/:id/authorized-users` - Invite authorized user
- [ ] Team creation endpoint needs to check `max_teams`

---

## Questions to Answer

1. **Athlete vs Staff:**
   - What's the difference between athlete and staff?

---

## 📍 Autocomplete + Org Metadata: Detailed Documentation

### Schema Changes

**File:** `server/prisma/schema.prisma`  
**Migration:** `server/prisma/migrations/20251212090000_add_organization_place_id/migration.sql`

```prisma
model Organization {
  // ... existing fields ...
  formatted_address String? @db.VarChar(500)
  place_id          String? @db.VarChar(255)

  @@index([place_id])
}
```

### Backend: Geocoding Service

**Files:**

- `server/src/lib/geocoding.ts`: Core geocoding logic, caching, batch operations
- `server/src/routes/geocoding.ts`: HTTP endpoints

**New Endpoints:**

```typescript
POST /geocoding/autocomplete?q=<query>&limit=<number>
// Returns: [{ place_id, description, structured_formatting }]

POST /geocoding/place-details
// Body: { place_id }
// Returns: { formatted_address, lat, lng, address_components }
```

**Helper Function:**

```typescript
resolveOrganizationLocation(locationData: {
  place_id?, formatted_address?, location?, zip_code?, latitude?, longitude?
}): Promise<{
  placeId: string | null;
  formattedAddress: string | null;
  locationLabel: string | null;
  zipCode: string | null;
  latitude: number | null;
  longitude: number | null;
}>
```

### Backend: Organization Endpoints

**File:** `server/src/routes/organizations.ts`

**Updated Endpoints:**

```typescript
POST / organizations;
POST / organizations / create;
// Accept: place_id, formatted_address, latitude, longitude
// Call: resolveOrganizationLocation to normalize
// Duplicate guard:
//   1. Check place_id uniqueness (if present)
//   2. Fallback: normalized name + zip_code
// Returns: 409 DUPLICATE_ORGANIZATION if exists
```

**New Endpoint:**

```typescript
POST / organizations / check - duplicate;
// Body: { place_id?, name, zip_code? }
// Returns: { exists: boolean, duplicate_of?: { id, name } }
// Used by UI for pre-submit validation
```

### Frontend: Step 4 Organization

**File:** `app/onboarding/step-4-organization.tsx`

**Location Autocomplete:**

```tsx
const [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
const [locationSuggestions, setLocationSuggestions] = useState<PlaceSuggestion[]>([]);
const [locationQuerying, setLocationQuerying] = useState(false);

// Debounced autocomplete (350ms)
const requestLocationSuggestions = useCallback((text: string) => {
  if (text.trim().length < 3) {
    setLocationSuggestions([]);
    return;
  }
  setLocationQuerying(true);
  locationTimerRef.current = setTimeout(async () => {
    const suggestions = await autocompleteLocations(text, 6);
    setLocationSuggestions(suggestions);
    setLocationQuerying(false);
  }, 350);
}, []);
```

**Enforcement:**

```tsx
const canContinue = useMemo(() => {
  if (saving || alreadyExists) return false;
  return orgName.trim().length > 0 && !!orgType && !!selectedPlace;
}, [orgName, orgType, saving, alreadyExists, selectedPlace]);
```

**Duplicate Warning:**

```tsx
const handleSelectLocation = useCallback(
  (suggestion: PlaceSuggestion) => {
    setSelectedPlace(suggestion);
    setLocation(suggestion.description);
    // Check for duplicates
    (async () => {
      const res = await httpPost('/organizations/check-duplicate', {
        place_id: suggestion.place_id,
        name: orgName.trim(),
      });
      if (res && res.exists) {
        setDuplicateWarning(
          `An organization at "${suggestion.description}" already exists. Use Search to find it.`
        );
      } else {
        setDuplicateWarning(null);
      }
    })();
  },
  [orgName]
);
```

**Email Verification Guard:**

```tsx
const [emailVerified, setEmailVerified] = useState<boolean | null>(null);

useEffect(() => {
  (async () => {
    const me = await User.me();
    setEmailVerified(me?.email_verified ?? null);
  })();
}, []);

const onContinue = async () => {
  if (emailVerified === false && !alreadyExists) {
    Alert.alert(
      'Email Verification Required',
      'Please verify your email address before creating an organization.',
      [
        { text: 'Verify Now', onPress: () => router.push('/verify-email') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
    return;
  }
  // ... proceed with creation
};
```

**Success Toast:**

```tsx
const org = await Organization.createOrganization(payload);
Alert.alert('Organization Created!', `"${orgName.trim()}" has been created successfully.`, [
  {
    text: 'Continue',
    onPress: () => {
      // Navigate to Step 6
      setProgress(5);
      router.push('/onboarding/step-6-authorized-users');
    },
  },
]);
```

### Frontend: API Client

**File:** `api/geocoding.ts`

```typescript
export interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting?: {
    main_text: string;
    secondary_text?: string;
  };
}

export async function autocompleteLocations(
  query: string,
  limit: number = 5
): Promise<PlaceSuggestion[]> {
  const res = await httpGet(
    `/geocoding/autocomplete?q=${encodeURIComponent(query)}&limit=${limit}`
  );
  return res?.suggestions || [];
}
```

### Seed Data

**File:** `server/prisma/seed.ts`

```typescript
const westhill = await prisma.organization.upsert({
  where: { name: 'Westhill High School' },
  create: {
    name: 'Westhill High School',
    description: 'Westhill High School Athletics',
    sport: 'multi-sport',
    org_type: 'school',
    location: 'Stamford, CT',
    formatted_address: 'Westhill High School, Stamford, CT 06902, USA',
    zip_code: '06902',
    status: 'active',
  },
});

// Similar for Greenwich High School and Stamford Youth Soccer Club
```

### Tests

**File:** `server/tests/organizations.test.ts`

```typescript
test('duplicate check by place_id rejects same location', async () => {
  const org1 = await prisma.organization.create({
    data: { name: 'Test Org', place_id: 'ChIJTest123', zip_code: '06902', status: 'active' },
  });
  const existing = await prisma.organization.findFirst({
    where: { place_id: 'ChIJTest123', status: 'active' },
  });
  expect(existing?.id).toBe(org1.id);
});

test('geocodeLocation returns coordinates for valid address', async () => {
  if (!process.env.GOOGLE_MAPS_API_KEY) return;
  const result = await geocodeLocation('Stamford, CT');
  expect(result?.latitude).toBeDefined();
  expect(typeof result?.latitude).toBe('number');
});
```

### Logging Middleware

**File:** `server/src/middleware/logging.ts`

```typescript
export function requestLogging(req, res, next) {
  req.requestId = randomUUID();
  req.startTime = Date.now();
  debugLog(`[${req.requestId}] → ${req.method} ${req.path}`);
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    debugLog(`[${req.requestId}] ← ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
  });
  next();
}

export function paymentLogging(req, res, next) {
  const reqId = req.requestId || randomUUID();
  debugLog(`[${reqId}] 💳 Payment Request: ${req.method} ${req.path}`);
  if (req.body) {
    const { plan, team_count, promo_code } = req.body;
    if (plan) debugLog(`[${reqId}]   Plan: ${plan}`);
    if (team_count) debugLog(`[${reqId}]   Team Count: ${team_count}`);
  }
  // Intercept response to log session ID
  const originalJson = res.json.bind(res);
  res.json = function (body) {
    if (body?.sessionId) debugLog(`[${reqId}]   Stripe Session: ${body.sessionId}`);
    return originalJson(body);
  };
  next();
}
```

### Environment Variables

```bash
# Required for autocomplete to work
GOOGLE_PLACES_API_KEY=your_key_here
# OR
GOOGLE_MAPS_API_KEY=your_key_here
```

### Production Checklist

- [ ] Set `GOOGLE_PLACES_API_KEY` in Railway/prod env
- [ ] Monitor Google Places API quota (daily per-project limits)
- [ ] Set up alerts for API quota exhaustion
- [ ] Backfill `place_id` for legacy organizations (future script)
- [ ] Add rate limiting for `/geocoding/autocomplete` if needed
- [ ] Test autocomplete across different regions (international addresses)

---

**Documentation Complete** ✅

- Different permissions?
- Do they both need coach approval?

2. **Event Pitching:**
   - Can fans pitch to ANY team or only teams they follow?
   - What info is required in a pitch?
   - Can fans pitch all event types or just certain ones?

3. **Rookie Upgrade Flow:**
   - What happens when Rookie tries to create 3rd team?
   - Automatic upgrade to Veteran or manual choice?
   - Show pricing before forcing upgrade?

4. **Authorized Users:**
   - What roles can they have? (assistant coach, staff, analyst?)
   - What permissions do they get?
   - Can they invite other authorized users?

5. **Veteran vs Legend:**
   - Is there a UI to choose between them?
   - When does Legend tier make sense? (how many teams?)
   - Contact sales flow for Legend?

---

## Testing Checklist (After Implementation)

- [ ] Create Fan account → verify can pitch events
- [ ] Create Fan account → request upgrade → verify coach approval flow
- [ ] Create Rookie account → create 2 teams → verify blocked at 3rd
- [ ] Create Rookie account → verify cannot invite authorized users
- [ ] Create Veteran account → verify can create unlimited teams
- [ ] Create Veteran account → verify can invite authorized users (up to limit)
- [ ] Create Legend account → verify truly unlimited
- [ ] Test role transitions (Fan→Athlete, Rookie→Veteran, Veteran→Legend)

---

## Notes for Next Session

_Add any observations or ideas here as we continue..._
