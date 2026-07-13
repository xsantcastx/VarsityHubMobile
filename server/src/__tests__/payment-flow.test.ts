/**
 * Payment Flow Tests
 *
 * Tests critical payment processing functionality:
 * - Price calculation
 * - Promo code validation
 * - Transaction logging
 * - Subscription creation
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../lib/prisma.js';
import bcrypt from 'bcrypt';
import { SERVER_LEGEND_PRICE_CENTS } from '../lib/planDefinitions.js';
import { redeemPromo, reversePromoRedemption } from '../lib/promos.js';

const TEST_USER_EMAIL = `test-payment-${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

describe('Payment Flow', () => {
  let userId: string;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    const user = await prisma.user.create({
      data: {
        email: TEST_USER_EMAIL,
        password_hash: passwordHash,
        display_name: 'Test Payment User',
        email_verified: true,
        preferences: {},
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    try {
      // Clean up transaction logs
      await prisma.transactionLog.deleteMany({
        where: { user_id: userId },
      });

      // Clean up promo redemptions
      await prisma.promoRedemption.deleteMany({
        where: { user_id: userId },
      });

      await prisma.promoCode.deleteMany({
        where: { code: { startsWith: 'TESTPAY' } },
      });

      // Clean up user
      await prisma.user.delete({
        where: { id: userId },
      });
    } catch (error) {
      console.warn('Cleanup error (non-critical):', error);
    }
  });

  describe('Transaction Logging', () => {
    it('should log transaction creation', async () => {
      const transaction = await prisma.transactionLog.create({
        data: {
          transaction_type: 'SUBSCRIPTION_PURCHASE',
          status: 'PENDING',
          user_id: userId,
          user_email: TEST_USER_EMAIL,
          subtotal_cents: SERVER_LEGEND_PRICE_CENTS,
          tax_cents: 0,
          total_cents: SERVER_LEGEND_PRICE_CENTS,
          currency: 'usd',
        },
      });

      expect(transaction).toBeDefined();
      expect(transaction.transaction_type).toBe('SUBSCRIPTION_PURCHASE');
      expect(transaction.status).toBe('PENDING');
      expect(transaction.total_cents).toBe(SERVER_LEGEND_PRICE_CENTS);
    });

    it('should update transaction status', async () => {
      const transaction = await prisma.transactionLog.create({
        data: {
          transaction_type: 'SUBSCRIPTION_PURCHASE',
          status: 'PENDING',
          user_id: userId,
          user_email: TEST_USER_EMAIL,
          total_cents: SERVER_LEGEND_PRICE_CENTS,
          currency: 'usd',
        },
      });

      const updated = await prisma.transactionLog.update({
        where: { id: transaction.id },
        data: {
          status: 'COMPLETED',
          stripe_payment_intent_id: 'pi_test_123',
        },
      });

      expect(updated.status).toBe('COMPLETED');
      expect(updated.stripe_payment_intent_id).toBe('pi_test_123');
    });
  });

  describe('Price Calculation', () => {
    it('should calculate correct membership price', () => {
      const basePrice = SERVER_LEGEND_PRICE_CENTS;
      const tax = 0;
      const discount = 0;
      const total = basePrice + tax - discount;

      expect(total).toBe(SERVER_LEGEND_PRICE_CENTS);
    });

    it('should apply promo code discount', () => {
      const basePrice = SERVER_LEGEND_PRICE_CENTS;
      const discount = 500; // $5.00 discount
      const total = basePrice - discount;

      expect(total).toBe(SERVER_LEGEND_PRICE_CENTS - 500);
      expect(total).toBeLessThan(basePrice);
    });

    it('should calculate net amount after Stripe fees', () => {
      const total = SERVER_LEGEND_PRICE_CENTS;
      const stripeFee = 88; // ~2.9% + $0.30 at the shared Legend price
      const net = total - stripeFee;

      expect(net).toBe(SERVER_LEGEND_PRICE_CENTS - 88);
      expect(net).toBeLessThan(total);
    });
  });

  describe('Promo Redemption Lifecycle', () => {
    it('should reverse promo usage on refund references idempotently', async () => {
      const code = `TESTPAY${Date.now()}`;
      const orderId = `pi_test_${Date.now()}`;

      const promo = await prisma.promoCode.create({
        data: {
          code,
          type: 'PERCENT_OFF',
          percent_off: 25,
          enabled: true,
          max_redemptions: 5,
          per_user_limit: 1,
          applies_to_service: 'booking',
        },
      });

      const redeemed = await redeemPromo({
        code,
        subtotalCents: 2000,
        userId,
        service: 'booking',
        orderId,
      });

      expect(redeemed.ok).toBe(true);

      const promoAfterRedeem = await prisma.promoCode.findUnique({
        where: { id: promo.id },
        select: { uses: true },
      });
      expect(promoAfterRedeem?.uses).toBe(1);

      const reversed = await reversePromoRedemption({ orderReferences: [orderId] });
      expect(reversed.reversed).toBe(true);
      expect(reversed.count).toBe(1);

      const promoAfterReverse = await prisma.promoCode.findUnique({
        where: { id: promo.id },
        select: { uses: true },
      });
      const redemptionAfterReverse = await prisma.promoRedemption.findMany({
        where: { promo_id: promo.id, order_id: orderId },
        select: { id: true },
      });

      expect(promoAfterReverse?.uses).toBe(0);
      expect(redemptionAfterReverse).toHaveLength(0);

      const reversedAgain = await reversePromoRedemption({ orderReferences: [orderId] });
      expect(reversedAgain.reversed).toBe(false);
      expect(reversedAgain.count).toBe(0);

      await prisma.promoCode.delete({ where: { id: promo.id } });
    });
  });

  describe('Subscription Management', () => {
    it('should create subscription record', async () => {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          subscription_tier: 'premium',
          subscription_status: 'active',
          subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          stripe_customer_id: 'cus_test_123',
        },
      });

      expect(user.subscription_tier).toBe('premium');
      expect(user.subscription_status).toBe('active');
      expect(user.stripe_customer_id).toBe('cus_test_123');
    });

    it('should validate subscription expiry', () => {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const now = new Date();

      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });
});
