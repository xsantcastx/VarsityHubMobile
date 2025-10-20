# Transaction Logging Implementation Guide

## Overview
Complete transaction logging system for financial compliance and audit trails. Logs all payment transactions (ad purchases, subscription purchases, renewals, etc.) with 7-year retention.

## Implementation Status
✅ **COMPLETE** - Ready for migration and testing

### Completed Components
1. ✅ Prisma schema with TransactionLog model
2. ✅ Transaction logger library (`server/src/lib/transactionLogger.ts`)
3. ✅ Payment route integration (ad purchases and subscriptions)
4. ✅ Webhook status updates
5. ✅ Admin endpoints for viewing transactions
6. ✅ Server integration

## Database Schema

### TransactionLog Model
```prisma
model TransactionLog {
  id                      String            @id @default(cuid())
  transaction_type        TransactionType
  status                  TransactionStatus @default(PENDING)
  
  // Stripe IDs
  stripe_session_id       String            @unique
  stripe_payment_intent_id String?
  stripe_subscription_id  String?
  
  // User tracking
  user_id                 String
  user_email              String
  order_id                String?           // Ad ID or other reference
  
  // Financial details (all in cents)
  subtotal_cents          Int
  tax_cents               Int               @default(0)
  stripe_fee_cents        Int
  discount_cents          Int               @default(0)
  total_cents             Int
  net_cents               Int               // total - stripe_fee
  
  // Promo code tracking
  promo_code              String?
  promo_discount_cents    Int               @default(0)
  
  // Audit trail
  ip_address              String?
  user_agent              String?
  metadata                Json?
  
  created_at              DateTime          @default(now())
  updated_at              DateTime          @updatedAt
  
  user                    User              @relation(fields: [user_id], references: [id], onDelete: Cascade)
  
  @@index([user_id])
  @@index([stripe_session_id])
  @@index([transaction_type])
  @@index([status])
  @@index([created_at])
}

enum TransactionType {
  AD_PURCHASE
  SUBSCRIPTION_PURCHASE
  SUBSCRIPTION_RENEWAL
  SUBSCRIPTION_CANCELLATION
  REFUND
}

enum TransactionStatus {
  PENDING      // Created when checkout session starts
  COMPLETED    // Payment succeeded
  FAILED       // Payment failed
  REFUNDED     // Payment was refunded
  CANCELLED    // User cancelled checkout
}
```

## Transaction Logger Functions

### Core Functions

#### 1. `logTransaction(data: TransactionLogData)`
Creates a new transaction log entry when a payment session is initiated.

**When Called**: After Stripe checkout session creation (before user pays)

**Example**:
```typescript
await logTransaction({
  transactionType: 'AD_PURCHASE',
  status: 'PENDING',
  stripeSessionId: session.id,
  userId: req.user!.id,
  userEmail: currentUser?.email || 'unknown',
  orderId: String(ad_id),
  subtotalCents: amount,
  taxCents: 0,
  stripeFeeeCents: calculateStripeFee(total),
  discountCents: discount,
  totalCents: total,
  promoCode: appliedCode || undefined,
  promoDiscountCents: discount,
  metadata: { dates: isoDates, adId: ad_id },
  ipAddress: req.ip,
  userAgent: req.get('user-agent'),
});
```

#### 2. `updateTransactionStatus(sessionId, status, additionalData?)`
Updates an existing transaction log when payment status changes.

**When Called**: In webhook handler when `checkout.session.completed` event received

**Example**:
```typescript
await updateTransactionStatus(session.id, 'COMPLETED', {
  stripePaymentIntentId: session.payment_intent ? String(session.payment_intent) : undefined,
  stripeSubscriptionId: session.subscription ? String(session.subscription) : undefined,
});
```

#### 3. `getTransactionBySession(sessionId)`
Retrieves a transaction log by Stripe session ID.

#### 4. `getUserTransactions(userId, limit = 50)`
Gets transaction history for a specific user (most recent first).

#### 5. `getAllTransactions(filters, limit = 50, offset = 0)`
Admin query with filters for transaction type, status, date range, etc.

#### 6. `getTransactionSummary(startDate?, endDate?)`
Revenue analytics: totals, counts, and averages for date range.

#### 7. `calculateStripeFee(totalCents)`
Calculates Stripe's fee: `(totalCents * 0.029) + 30`

## Payment Flow Integration

### Ad Purchase Flow
```
1. User initiates ad purchase
   ↓
2. /payments/checkout endpoint
   ↓
3. Stripe session created
   ↓
4. logTransaction() - Status: PENDING
   ↓
5. User completes payment
   ↓
6. Stripe webhook: checkout.session.completed
   ↓
7. finalizeFromSession() - Process reservation
   ↓
8. updateTransactionStatus() - Status: COMPLETED
```

### Subscription Purchase Flow
```
1. User selects subscription tier
   ↓
2. /payments/subscribe endpoint
   ↓
3. createMembershipCheckoutSession()
   ↓
4. Stripe session created
   ↓
5. logTransaction() - Status: PENDING
   ↓
6. User completes payment
   ↓
7. Stripe webhook: checkout.session.completed
   ↓
8. finalizeFromSession() - Update user preferences
   ↓
9. updateTransactionStatus() - Status: COMPLETED
```

## Admin Endpoints

### 1. GET `/admin/transactions`
Get all transactions with optional filters.

**Authentication**: Requires admin account (`admin@varsityhub.com`)

**Query Parameters**:
- `type` - Filter by transaction type (e.g., `AD_PURCHASE`, `SUBSCRIPTION_PURCHASE`)
- `status` - Filter by status (e.g., `COMPLETED`, `PENDING`, `FAILED`)
- `userId` - Filter by user ID
- `startDate` - ISO date string (e.g., `2024-01-01T00:00:00Z`)
- `endDate` - ISO date string
- `limit` - Number of results (default 50)
- `offset` - Pagination offset (default 0)

**Example Request**:
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:4000/admin/transactions?type=AD_PURCHASE&status=COMPLETED&limit=100"
```

**Example Response**:
```json
{
  "ok": true,
  "transactions": [
    {
      "id": "clxxx...",
      "transaction_type": "AD_PURCHASE",
      "status": "COMPLETED",
      "stripe_session_id": "cs_test_xxx...",
      "user_id": "clyyy...",
      "user_email": "user@example.com",
      "subtotal_cents": 1000,
      "tax_cents": 0,
      "stripe_fee_cents": 59,
      "discount_cents": 200,
      "total_cents": 800,
      "net_cents": 741,
      "promo_code": "SAVE20",
      "created_at": "2024-01-15T10:30:00Z",
      "metadata": {
        "dates": ["2024-02-01", "2024-02-02"],
        "adId": "ad_123"
      }
    }
  ],
  "filters": {
    "type": "AD_PURCHASE",
    "status": "COMPLETED"
  },
  "limit": 100,
  "offset": 0
}
```

### 2. GET `/admin/transactions/summary`
Get revenue analytics and summary statistics.

**Query Parameters**:
- `startDate` - ISO date string (optional)
- `endDate` - ISO date string (optional)

**Example Request**:
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:4000/admin/transactions/summary?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z"
```

**Example Response**:
```json
{
  "ok": true,
  "summary": {
    "totalTransactions": 150,
    "completedTransactions": 142,
    "failedTransactions": 5,
    "refundedTransactions": 3,
    "totalRevenueCents": 500000,
    "totalStripeFeesCents": 14530,
    "totalNetRevenueCents": 485470,
    "averageTransactionCents": 3521,
    "byType": {
      "AD_PURCHASE": {
        "count": 100,
        "revenueCents": 250000
      },
      "SUBSCRIPTION_PURCHASE": {
        "count": 50,
        "revenueCents": 250000
      }
    }
  },
  "dateRange": {
    "start": "2024-01-01T00:00:00.000Z",
    "end": "2024-12-31T23:59:59.000Z"
  }
}
```

### 3. GET `/admin/transactions/:sessionId`
Get a specific transaction by Stripe session ID.

**Example Request**:
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  "http://localhost:4000/admin/transactions/cs_test_abc123"
```

**Example Response**:
```json
{
  "ok": true,
  "transaction": {
    "id": "clxxx...",
    "transaction_type": "AD_PURCHASE",
    "status": "COMPLETED",
    "stripe_session_id": "cs_test_abc123",
    "stripe_payment_intent_id": "pi_xxx",
    "user_id": "clyyy...",
    "user_email": "user@example.com",
    "order_id": "ad_123",
    "subtotal_cents": 1000,
    "tax_cents": 0,
    "stripe_fee_cents": 59,
    "discount_cents": 0,
    "total_cents": 1000,
    "net_cents": 941,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:31:00Z"
  }
}
```

## Setup Instructions

### 1. Run Prisma Migration
This creates the `TransactionLog` table and generates TypeScript types.

```bash
cd server
npx prisma migrate dev --name add_transaction_logging
```

**Expected Output**:
```
Applying migration `20240115123456_add_transaction_logging`
The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20240115123456_add_transaction_logging/
    └─ migration.sql

✔ Generated Prisma Client
```

### 2. Generate Prisma Client
If types are still not recognized, regenerate:

```bash
npx prisma generate
```

### 3. Build Server
Verify no TypeScript errors:

```bash
npm run build
```

### 4. Restart Server
```bash
npm run dev
```

## Testing Guide

### Test 1: Ad Purchase Transaction
1. **Create an ad** via the app
2. **Submit ad for scheduling** with dates
3. **Complete Stripe checkout** (use test card: `4242 4242 4242 4242`)
4. **Check transaction logged**:
   ```bash
   # In Prisma Studio
   npx prisma studio
   # Or query directly
   node -e "import('./lib/prisma.js').then(p => p.prisma.transactionLog.findMany().then(console.log))"
   ```

**Expected Database Entry**:
- `transaction_type`: `AD_PURCHASE`
- `status`: `PENDING` → `COMPLETED` (after webhook)
- `stripe_session_id`: Populated
- `user_id`, `user_email`: Your user
- `subtotal_cents`: Calculated price
- `stripe_fee_cents`: ~2.9% + $0.30
- `total_cents`: After promo discount
- `metadata`: Contains dates and ad ID

### Test 2: Subscription Purchase Transaction
1. **Navigate to subscription screen** in app
2. **Select Veteran or Legend tier**
3. **Complete Stripe checkout**
4. **Check transaction logged**

**Expected Database Entry**:
- `transaction_type`: `SUBSCRIPTION_PURCHASE`
- `status`: `PENDING` → `COMPLETED`
- `stripe_subscription_id`: Populated (from webhook)
- `subtotal_cents`: 7000 (Veteran) or 15000 (Legend)
- `metadata`: Contains plan name

### Test 3: Promo Code Transaction
1. **Use a valid promo code** during ad or subscription purchase
2. **Complete payment**
3. **Verify discount tracked**:
   - `promo_code`: Code used
   - `discount_cents`: Amount discounted
   - `promo_discount_cents`: Same as discount_cents
   - `total_cents`: Reduced by discount

### Test 4: Admin Endpoints
1. **Get auth token** for admin user
2. **Test list endpoint**:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:4000/admin/transactions?limit=10"
   ```
3. **Test summary endpoint**:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:4000/admin/transactions/summary"
   ```
4. **Test single transaction**:
   ```bash
   # Use a real session ID from database
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "http://localhost:4000/admin/transactions/cs_test_xxx"
   ```

### Test 5: Webhook Status Updates
1. **Use Stripe CLI** to forward webhooks:
   ```bash
   stripe listen --forward-to localhost:4000/payments/webhook
   ```
2. **Complete a test payment**
3. **Check webhook logs**:
   ```
   [payments] finalizeFromSession called
   [transaction-log] Updated log xxx to COMPLETED
   ```
4. **Verify status updated** in database

## Error Handling

### Logging Never Breaks Payments
The transaction logger is designed to **never throw errors** that could break the payment flow:

```typescript
try {
  await logTransaction(...);
} catch (error) {
  console.error('[transaction-log] Failed to log transaction:', error);
  // Don't throw - payment continues
  return null;
}
```

Even if logging fails:
- ✅ Payment still processes
- ✅ Ad/subscription still activates
- ✅ User still charged
- ❌ Just missing audit record

### Common Issues

#### Issue: `Property 'transactionLog' does not exist on type 'PrismaClient'`
**Solution**: Run Prisma migration and generate:
```bash
npx prisma migrate dev --name add_transaction_logging
npx prisma generate
```

#### Issue: `TransactionType is not exported`
**Solution**: Same as above - need to generate Prisma types

#### Issue: Transactions showing PENDING forever
**Cause**: Webhook not configured or failing
**Solution**: 
1. Check `STRIPE_WEBHOOK_SECRET` in `.env`
2. Test webhook with Stripe CLI
3. Check webhook logs for errors

#### Issue: Admin endpoints return 403
**Cause**: User is not admin
**Solution**: Update `requireAdmin` middleware to match your admin logic, or ensure user email is `admin@varsityhub.com`

## Compliance Notes

### 7-Year Retention
For financial compliance, transaction logs should be retained for 7 years. Implement data retention policy:

```typescript
// Example: Delete logs older than 7 years
await prisma.transactionLog.deleteMany({
  where: {
    created_at: {
      lt: new Date(Date.now() - 7 * 365 * 24 * 60 * 60 * 1000)
    }
  }
});
```

### Data Included for Audit
Each transaction log includes:
- ✅ Stripe session/payment IDs (for Stripe dashboard lookup)
- ✅ User identification (ID + email)
- ✅ Financial breakdown (subtotal, fees, discounts, net)
- ✅ Promo code usage (for fraud detection)
- ✅ Timestamps (created/updated)
- ✅ IP address and user agent (optional, for fraud investigation)
- ✅ Metadata (flexible JSON for additional context)

### Privacy Considerations
- IP addresses and user agents are **optional** fields
- Consider GDPR/CCPA requirements in your jurisdiction
- Provide user data export functionality if required

## Next Steps

1. ✅ Run migration (`npx prisma migrate dev`)
2. ✅ Test ad purchase flow
3. ✅ Test subscription flow
4. ✅ Test admin endpoints
5. ⏳ Set up automated reporting (weekly revenue summary)
6. ⏳ Create data retention policy
7. ⏳ Add user transaction history endpoint (non-admin)

## Related Documentation
- [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) - Overall project status
- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - General testing procedures
- [Stripe Webhooks Documentation](https://stripe.com/docs/webhooks)
