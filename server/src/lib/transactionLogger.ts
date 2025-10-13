/**
 * Transaction Logger
 * 
 * Centralized logging for all financial transactions
 * Ensures compliance with 7-year retention requirements
 */

import { PrismaClient, TransactionStatus, TransactionType } from '@prisma/client';

const prisma = new PrismaClient();

export interface TransactionLogData {
  // Transaction identification
  transactionType: TransactionType;
  status?: TransactionStatus;
  stripeSessionId?: string;
  stripePaymentIntentId?: string;
  stripeSubscriptionId?: string;
  
  // User and order
  userId?: string;
  userEmail?: string;
  orderId?: string;
  
  // Financial details (in cents)
  subtotalCents?: number;
  taxCents?: number;
  stripeFeeeCents?: number;
  discountCents?: number;
  totalCents?: number;
  netCents?: number;
  
  // Promo code
  promoCode?: string;
  promoDiscountCents?: number;
  
  // Metadata
  currency?: string;
  paymentMethod?: string;
  metadata?: Record<string, any>;
  
  // Audit trail
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log a transaction
 */
export async function logTransaction(data: TransactionLogData) {
  try {
    const log = await prisma.transactionLog.create({
      data: {
        transaction_type: data.transactionType,
        status: data.status || 'PENDING',
        stripe_session_id: data.stripeSessionId,
        stripe_payment_intent_id: data.stripePaymentIntentId,
        stripe_subscription_id: data.stripeSubscriptionId,
        
        user_id: data.userId,
        user_email: data.userEmail,
        order_id: data.orderId,
        
        subtotal_cents: data.subtotalCents || 0,
        tax_cents: data.taxCents || 0,
        stripe_fee_cents: data.stripeFeeeCents || 0,
        discount_cents: data.discountCents || 0,
        total_cents: data.totalCents || 0,
        net_cents: data.netCents || (data.totalCents || 0) - (data.stripeFeeeCents || 0),
        
        promo_code: data.promoCode,
        promo_discount_cents: data.promoDiscountCents || 0,
        
        currency: data.currency || 'usd',
        payment_method: data.paymentMethod,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
        
        ip_address: data.ipAddress,
        user_agent: data.userAgent,
      },
    });
    
    console.log(`[transaction-log] Created log ${log.id} for ${data.transactionType}`);
    return log;
  } catch (error) {
    console.error('[transaction-log] Failed to log transaction:', error);
    // Don't throw - logging failures shouldn't break the transaction flow
    return null;
  }
}

/**
 * Update transaction status
 */
export async function updateTransactionStatus(
  stripeSessionId: string,
  status: TransactionStatus,
  additionalData?: Partial<TransactionLogData>
) {
  try {
    const updateData: any = {
      status,
      updated_at: new Date(),
    };
    
    if (additionalData) {
      if (additionalData.stripePaymentIntentId) updateData.stripe_payment_intent_id = additionalData.stripePaymentIntentId;
      if (additionalData.stripeSubscriptionId) updateData.stripe_subscription_id = additionalData.stripeSubscriptionId;
      if (additionalData.stripeFeeeCents !== undefined) updateData.stripe_fee_cents = additionalData.stripeFeeeCents;
      if (additionalData.totalCents !== undefined) {
        updateData.total_cents = additionalData.totalCents;
        updateData.net_cents = additionalData.totalCents - (additionalData.stripeFeeeCents || 0);
      }
      if (additionalData.metadata) updateData.metadata = JSON.parse(JSON.stringify(additionalData.metadata));
    }
    
    const log = await prisma.transactionLog.update({
      where: { stripe_session_id: stripeSessionId },
      data: updateData,
    });
    
    console.log(`[transaction-log] Updated log ${log.id} to ${status}`);
    return log;
  } catch (error) {
    console.error('[transaction-log] Failed to update transaction:', error);
    return null;
  }
}

/**
 * Get transaction by Stripe session ID
 */
export async function getTransactionBySession(stripeSessionId: string) {
  try {
    return await prisma.transactionLog.findUnique({
      where: { stripe_session_id: stripeSessionId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            display_name: true,
          },
        },
      },
    });
  } catch (error) {
    console.error('[transaction-log] Failed to get transaction:', error);
    return null;
  }
}

/**
 * Get user's transactions
 */
export async function getUserTransactions(userId: string, limit = 50) {
  try {
    return await prisma.transactionLog.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      take: limit,
    });
  } catch (error) {
    console.error('[transaction-log] Failed to get user transactions:', error);
    return [];
  }
}

/**
 * Get all transactions (admin)
 */
export async function getAllTransactions(
  filters?: {
    type?: TransactionType;
    status?: TransactionStatus;
    startDate?: Date;
    endDate?: Date;
    userId?: string;
  },
  limit = 100,
  offset = 0
) {
  try {
    const where: any = {};
    
    if (filters?.type) where.transaction_type = filters.type;
    if (filters?.status) where.status = filters.status;
    if (filters?.userId) where.user_id = filters.userId;
    if (filters?.startDate || filters?.endDate) {
      where.created_at = {};
      if (filters.startDate) where.created_at.gte = filters.startDate;
      if (filters.endDate) where.created_at.lte = filters.endDate;
    }
    
    const [transactions, total] = await Promise.all([
      prisma.transactionLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              display_name: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.transactionLog.count({ where }),
    ]);
    
    return { transactions, total };
  } catch (error) {
    console.error('[transaction-log] Failed to get transactions:', error);
    return { transactions: [], total: 0 };
  }
}

/**
 * Calculate Stripe fee (approximate)
 * Stripe charges 2.9% + $0.30 per successful card charge
 */
export function calculateStripeFee(totalCents: number): number {
  return Math.round(totalCents * 0.029 + 30);
}

/**
 * Get transaction summary stats
 */
export async function getTransactionSummary(
  startDate?: Date,
  endDate?: Date
) {
  try {
    const where: any = {};
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = startDate;
      if (endDate) where.created_at.lte = endDate;
    }
    
    const [
      totalTransactions,
      completedTransactions,
      totalRevenue,
      totalFees,
      totalDiscounts,
    ] = await Promise.all([
      prisma.transactionLog.count({ where }),
      prisma.transactionLog.count({ 
        where: { ...where, status: 'COMPLETED' } 
      }),
      prisma.transactionLog.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { total_cents: true },
      }),
      prisma.transactionLog.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { stripe_fee_cents: true },
      }),
      prisma.transactionLog.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { discount_cents: true },
      }),
    ]);
    
    return {
      totalTransactions,
      completedTransactions,
      totalRevenueCents: totalRevenue._sum.total_cents || 0,
      totalFeesCents: totalFees._sum.stripe_fee_cents || 0,
      totalDiscountsCents: totalDiscounts._sum.discount_cents || 0,
      netRevenueCents: (totalRevenue._sum.total_cents || 0) - (totalFees._sum.stripe_fee_cents || 0),
    };
  } catch (error) {
    console.error('[transaction-log] Failed to get summary:', error);
    return {
      totalTransactions: 0,
      completedTransactions: 0,
      totalRevenueCents: 0,
      totalFeesCents: 0,
      totalDiscountsCents: 0,
      netRevenueCents: 0,
    };
  }
}
