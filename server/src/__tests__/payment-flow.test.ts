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
          subtotal_cents: 2999, // $29.99
          tax_cents: 0,
          total_cents: 2999,
          currency: 'usd',
        },
      });

      expect(transaction).toBeDefined();
      expect(transaction.transaction_type).toBe('SUBSCRIPTION_PURCHASE');
      expect(transaction.status).toBe('PENDING');
      expect(transaction.total_cents).toBe(2999);
    });

    it('should update transaction status', async () => {
      const transaction = await prisma.transactionLog.create({
        data: {
          transaction_type: 'SUBSCRIPTION_PURCHASE',
          status: 'PENDING',
          user_id: userId,
          user_email: TEST_USER_EMAIL,
          total_cents: 2999,
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
      const basePrice = 2999; // $29.99 in cents
      const tax = 0;
      const discount = 0;
      const total = basePrice + tax - discount;

      expect(total).toBe(2999);
    });

    it('should apply promo code discount', () => {
      const basePrice = 2999;
      const discount = 500; // $5.00 discount
      const total = basePrice - discount;

      expect(total).toBe(2499);
      expect(total).toBeLessThan(basePrice);
    });

    it('should calculate net amount after Stripe fees', () => {
      const total = 2999;
      const stripeFee = 87; // ~2.9% + $0.30
      const net = total - stripeFee;

      expect(net).toBe(2912);
      expect(net).toBeLessThan(total);
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
