import { beforeAll, afterAll, describe, expect, it, jest } from '@jest/globals';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
const capture = jest.fn();
jest.unstable_mockModule('../lib/sentry.js', () => ({
  captureException: capture,
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
}));
// Provider signature verification has a separate real-crypto forgery regression.
// Only this external boundary is substituted; storage, constraints and fulfillment are real PostgreSQL.
jest.unstable_mockModule('../lib/appleSignedJws.js', () => ({
  verifyAppleSignedJws: async (jws: string) => JSON.parse(jws),
}));
const { prisma } = await import('../lib/prisma.js');
const service = await import('../lib/adPurchaseIntents.js');
const users: string[] = [],
  ads: string[] = [];
const monday = new Date();
monday.setUTCDate(monday.getUTCDate() + ((8 - monday.getUTCDay()) % 7 || 7));
const friday = new Date(monday);
friday.setUTCDate(friday.getUTCDate() + 4);
const dates = [monday, friday].map(date => date.toISOString().slice(0, 10));
async function fixture() {
  const user = await prisma.user.create({
    data: { email: `intent-${randomUUID()}@example.invalid`, email_verified: true },
  });
  users.push(user.id);
  const ad = await prisma.ad.create({
    data: {
      user_id: user.id,
      status: 'approved',
      business_name: 'Isolated purchase test',
      target_zip_code: `T${randomUUID().slice(0, 8)}`,
    },
  });
  ads.push(ad.id);
  const intent = await service.createAdPurchaseIntent(user.id, {
    ad_id: ad.id,
    client_transaction_id: randomUUID(),
    dates,
  });
  const receipt = (sku: string) =>
    JSON.stringify({
      appAccountToken: intent.id,
      transactionId: `${intent.id}-${sku}`,
      productId: sku,
      quantity: 1,
    });
  return { user, ad, intent, receipt };
}
beforeAll(async () => {
  const url = new URL(process.env.DATABASE_URL!);
  expect(['localhost', '127.0.0.1', '[::1]']).toContain(url.hostname);
  const [marker] = await prisma.$queryRawUnsafe<Array<{ value: string }>>(
    "SELECT current_setting('varsity.restore_isolated', true) AS value"
  );
  expect(marker.value).toBe('on');
});
afterAll(async () => {
  await prisma.$executeRawUnsafe(
    'DROP TRIGGER IF EXISTS intent_test_failure ON "AdPurchaseIntent"'
  );
  await prisma.$executeRawUnsafe('DROP FUNCTION IF EXISTS intent_test_failure()');
  await prisma.adPurchaseIntent.deleteMany({ where: { ad_id: { in: ads } } });
  await prisma.appleTransactionClaim.deleteMany({ where: { ad_id: { in: ads } } });
  await prisma.transactionLog.deleteMany({ where: { user_id: { in: users } } });
  await prisma.ad.deleteMany({ where: { id: { in: ads } } });
  await prisma.user.deleteMany({ where: { id: { in: users } } });
  await prisma.$disconnect();
});
describe('durable ad purchase recovery against PostgreSQL', () => {
  it('recovers in a fresh process after receipts commit but fulfillment is interrupted', async () => {
    const { user, ad, intent, receipt } = await fixture();
    await service.recordAdPurchaseReceipt(user.id, intent.id, receipt('MOND_THURS'));
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION intent_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id='${intent.id}' AND NEW.status='completed' THEN RAISE EXCEPTION 'injected fulfillment interruption'; END IF; RETURN NEW; END $$`
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER intent_test_failure BEFORE UPDATE ON "AdPurchaseIntent" FOR EACH ROW EXECUTE FUNCTION intent_test_failure()'
    );
    await expect(
      service.recordAdPurchaseReceipt(user.id, intent.id, receipt('FRI_SUN'))
    ).rejects.toThrow();
    expect(await prisma.adPurchaseReceipt.count({ where: { intent_id: intent.id } })).toBe(2);
    expect(await prisma.adReservation.count({ where: { ad_id: ad.id } })).toBe(0);
    expect(await prisma.appleTransactionClaim.count({ where: { ad_id: ad.id } })).toBe(0);
    expect(capture).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ context: 'ad_intent_reconciliation', intent_id: intent.id })
    );
    await prisma.$executeRawUnsafe('DROP TRIGGER intent_test_failure ON "AdPurchaseIntent"');
    await prisma.$executeRawUnsafe('DROP FUNCTION intent_test_failure()');
    // A new Node process has no checkout ref, promises, mock verifier or receipt memory.
    await promisify(execFile)(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `const {reconcileReadyAdPurchases}=await import('./src/lib/adPurchaseIntents.ts'); const {prisma}=await import('./src/lib/prisma.ts'); await reconcileReadyAdPurchases(${JSON.stringify(user.id)}); await prisma.$disconnect();`,
      ],
      { cwd: process.cwd(), env: process.env, timeout: 30000 }
    );
    const recovered = await prisma.adPurchaseIntent.findUniqueOrThrow({ where: { id: intent.id } });
    expect(recovered.status).toBe('completed');
    expect(recovered.completed_transaction_id).not.toBeNull();
    expect(await prisma.adReservation.count({ where: { ad_id: ad.id } })).toBe(2);
  });
  it('five concurrent deliveries fulfill exactly once', async () => {
    const { user, ad, intent, receipt } = await fixture();
    await service.recordAdPurchaseReceipt(user.id, intent.id, receipt('MOND_THURS'));
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        service.recordAdPurchaseReceipt(user.id, intent.id, receipt('FRI_SUN'))
      )
    );
    expect(results.every(result => result.status === 'completed')).toBe(true);
    expect(await prisma.adPurchaseReceipt.count({ where: { intent_id: intent.id } })).toBe(2);
    expect(await prisma.appleTransactionClaim.count({ where: { ad_id: ad.id } })).toBe(2);
    expect(
      await prisma.transactionLog.count({
        where: { user_id: user.id, order_id: ad.id, status: 'COMPLETED' },
      })
    ).toBe(1);
    expect(await prisma.adReservation.count({ where: { ad_id: ad.id } })).toBe(2);
  });
  it('rejects a different account and rejects completion without a ledger row', async () => {
    const { user, intent, receipt } = await fixture();
    await expect(
      service.recordAdPurchaseReceipt(`not-${user.id}`, intent.id, receipt('MOND_THURS'))
    ).rejects.toMatchObject({ code: 'PURCHASE_INTENT_NOT_FOUND' });
    expect(await prisma.adPurchaseReceipt.count({ where: { intent_id: intent.id } })).toBe(0);
    await expect(
      prisma.adPurchaseIntent.update({ where: { id: intent.id }, data: { status: 'completed' } })
    ).rejects.toThrow();
    await expect(
      prisma.adPurchaseIntent.update({
        where: { id: intent.id },
        data: { status: 'completed', completed_transaction_id: 'missing-ledger' },
      })
    ).rejects.toThrow();
  });
});
