# Promo Code Usage Limits

## Overview
The system supports limiting promo codes to a specific number of total redemptions. For example, you can create promo codes limited to the first 8 users.

## Database Schema

The `PromoCode` model includes these fields for usage control:

```prisma
model PromoCode {
  id              String    @id @default(cuid())
  code            String    @unique
  type            PromoType  // PERCENT_OFF or COMPLIMENTARY
  percent_off     Int?
  enabled         Boolean   @default(true)
  
  // Redemption limits
  max_redemptions Int?       // Total number of allowed redemptions (e.g., 8)
  uses            Int       @default(0)  // Current number of redemptions
  per_user_limit  Int       @default(1)  // Max uses per user (usually 1)
  
  // Date constraints
  start_at        DateTime?
  end_at          DateTime?
  
  applies_to_service String?  // e.g., 'booking'
  
  note        String?
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt
  
  redemptions PromoRedemption[]
}
```

## Creating a Limited Promo Code (First 8 Users)

### Via Prisma Studio (Development):

```bash
npx prisma studio
```

Then create a new PromoCode with:
- `code`: "LAUNCH8" (or any code, will be auto-uppercased)
- `type`: "PERCENT_OFF"
- `percent_off`: 50 (for 50% off)
- `enabled`: true
- `max_redemptions`: 8
- `per_user_limit`: 1
- `applies_to_service`: "booking"
- `note`: "Limited to first 8 users"

### Via SQL (Production):

```sql
INSERT INTO "PromoCode" (
  id, code, type, percent_off, enabled, 
  max_redemptions, per_user_limit, applies_to_service, 
  note, created_at, updated_at
) VALUES (
  gen_random_uuid()::text,
  'LAUNCH8',
  'PERCENT_OFF',
  50,
  true,
  8,
  1,
  'booking',
  'Limited to first 8 users - Launch promotion',
  NOW(),
  NOW()
);
```

## How It Works

### 1. Preview (Check Validity)
When a user enters a promo code, the frontend calls `/promos/preview`:

```typescript
// In app/ad-calendar.tsx
const applyPromo = async () => {
  const response = await fetch('/promos/preview', {
    method: 'POST',
    body: JSON.stringify({ 
      code: promo, 
      subtotal_cents: subtotalCents, 
      service: 'booking' 
    })
  });
  const data = await response.json();
  
  if (data.valid) {
    // Show discount and "Limited to first 8 users" message
  } else {
    // Show error: invalid, expired, or usage_exhausted
  }
};
```

### 2. Backend Validation
The `previewPromo` function in `server/src/lib/promos.ts` checks:

```typescript
// Check if max redemptions reached
if (promo.max_redemptions != null && promo.uses >= promo.max_redemptions)
  return { valid: false, reason: 'usage_exhausted' };

// Check per-user limit
const userUses = await prisma.promoRedemption.count({
  where: { promo_id: promo.id, user_id: input.userId }
});
if (promo.per_user_limit != null && userUses >= promo.per_user_limit)
  return { valid: false, reason: 'user_limit_reached' };
```

### 3. Redemption (At Checkout)
When payment is processed, `redeemPromo` increments the usage counter:

```typescript
// Atomic increment with race condition protection
if (promo.max_redemptions != null) {
  const updated = await tx.promoCode.updateMany({
    where: { id: promo.id, uses: { lt: promo.max_redemptions } },
    data: { uses: { increment: 1 } }
  });
  
  // If no rows updated, limit was reached by another transaction
  if (updated.count === 0) 
    return { ok: false, error: 'usage_exhausted' };
}
```

### 4. Create Redemption Record
Every use creates a `PromoRedemption` record:

```typescript
await tx.promoRedemption.create({
  data: {
    promo_id: promo.id,
    user_id: input.userId,
    order_id: input.orderId ?? null,
    amount_discounted_cents: preview.discount_cents
  }
});
```

## Frontend Display

In `app/ad-calendar.tsx`, successful promo preview shows:

```tsx
{preview?.valid ? (
  <View>
    <Text>✅ Promo Applied: {preview.code}</Text>
    <Text>Discount: ${(preview.discount_cents / 100).toFixed(2)}</Text>
    <Text style={{ fontSize: 12, color: '#6b7280' }}>
      ⚠️ Limited offer: First 8 users only
    </Text>
  </View>
) : null}
```

## Error Messages

Users see these errors when promo code fails:

| Error Code | User Message | Meaning |
|------------|-------------|---------|
| `invalid_or_disabled` | "Not valid: invalid_or_disabled" | Code doesn't exist or is disabled |
| `not_started` | "Not valid: not_started" | Promo hasn't started yet (start_at in future) |
| `expired` | "Not valid: expired" | Promo has ended (end_at in past) |
| `not_applicable` | "Not valid: not_applicable" | Promo doesn't apply to this service |
| `usage_exhausted` | "Not valid: usage_exhausted" | All 8 redemptions used up |
| `user_limit_reached` | "Not valid: user_limit_reached" | User already used their 1 allowed redemption |

## Admin Monitoring

### Check Promo Usage

```sql
-- See how many times a promo has been used
SELECT 
  code, 
  uses, 
  max_redemptions,
  (max_redemptions - uses) AS remaining
FROM "PromoCode"
WHERE code = 'LAUNCH8';

-- See who redeemed the promo
SELECT 
  pr.created_at,
  u.email,
  u.name,
  pr.amount_discounted_cents / 100.0 AS discount_amount
FROM "PromoRedemption" pr
JOIN "User" u ON u.id = pr.user_id
JOIN "PromoCode" pc ON pc.id = pr.promo_id
WHERE pc.code = 'LAUNCH8'
ORDER BY pr.created_at ASC;
```

## Testing Checklist

- [ ] Create promo with max_redemptions = 8
- [ ] User 1-7 can successfully apply and use the promo
- [ ] User 8 can successfully apply and use the promo
- [ ] User 9 sees "usage_exhausted" error
- [ ] Each user can only use the promo once (per_user_limit)
- [ ] Promo counter increments correctly in database
- [ ] Frontend shows "Limited to first 8 users" message
- [ ] Race conditions handled (two users at redemption #8 don't both succeed)

## Best Practices

1. **Set max_redemptions when creating promotional codes** - Default is NULL (unlimited)
2. **Use per_user_limit = 1** to prevent abuse
3. **Add clear note fields** for admin reference
4. **Set start_at and end_at dates** to auto-disable expired promos
5. **Monitor usage** with SQL queries to see adoption rates
6. **Create new codes** rather than resetting old ones for clean analytics

## Example Use Cases

### Launch Promotion (First 8 Users)
```sql
max_redemptions: 8
percent_off: 50
per_user_limit: 1
note: "Launch week - 50% off for first 8 advertisers"
```

### Beta Testing (20 Users)
```sql
max_redemptions: 20
type: COMPLIMENTARY
per_user_limit: 1
note: "Free ads for beta testers"
```

### Flash Sale (24 Hours, 50 Users)
```sql
max_redemptions: 50
percent_off: 30
start_at: '2025-02-01 00:00:00'
end_at: '2025-02-01 23:59:59'
note: "Super Bowl weekend flash sale"
```

---

**Last Updated:** January 2025  
**Related Files:**
- `server/src/lib/promos.ts` - Promo validation and redemption logic
- `server/prisma/schema.prisma` - Database schema
- `app/ad-calendar.tsx` - Frontend promo application UI
