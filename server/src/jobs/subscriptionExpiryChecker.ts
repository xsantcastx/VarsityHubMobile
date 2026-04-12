/**
 * Subscription Expiry Checker - Cron Job
 * Runs daily to check for expiring subscriptions and send notifications
 */

import { sendSubscriptionExpiringEmail } from '../lib/email.js';
import { prisma } from '../lib/prisma.js';

const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://varsityhub.app').replace(/\/$/, '');

/**
 * Check for subscriptions expiring in 7 days and send email alerts
 */
export async function checkExpiringSubscriptions() {
  console.log('[subscriptionExpiry] Starting expiry check...');
  
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  
  try {
    // Find users with subscriptions expiring in 7-14 days
    const users = await prisma.user.findMany({
      where: {
        OR: [
          {
            preferences: {
              path: ['subscription_end_date'],
              gte: sevenDaysFromNow.toISOString(),
              lte: fourteenDaysFromNow.toISOString(),
            }
          },
          {
            preferences: {
              path: ['plan_expiry_date'],
              gte: sevenDaysFromNow.toISOString(),
              lte: fourteenDaysFromNow.toISOString(),
            }
          }
        ]
      },
      select: {
        id: true,
        email: true,
        display_name: true,
        preferences: true,
      }
    });
    
    console.log(`[subscriptionExpiry] Found ${users.length} users with expiring subscriptions`);
    
    for (const user of users) {
      if (!user.email) continue;
      
      const prefs = (user.preferences || {}) as any;
      const plan = prefs.plan || 'free';
      const expiryDate = prefs.subscription_end_date || prefs.plan_expiry_date;
      
      if (!expiryDate) continue;
      
      const expiry = new Date(expiryDate);
      const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      // Only send if within 7-14 day window
      if (daysUntilExpiry < 7 || daysUntilExpiry > 14) continue;
      
      // Check if we already sent an expiry email (track in preferences)
      if (prefs.expiry_email_sent_at) {
        const lastSent = new Date(prefs.expiry_email_sent_at);
        const hoursSinceLastEmail = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
        
        // Don't send more than once per week
        if (hoursSinceLastEmail < 168) {
          console.log(`[subscriptionExpiry] Skipping ${user.email} - email sent ${Math.floor(hoursSinceLastEmail)}h ago`);
          continue;
        }
      }
      
      try {
        await sendSubscriptionExpiringEmail({
          to: user.email,
          userName: user.display_name || user.email.split('@')[0],
          planName: plan === 'veteran' ? 'Veteran Membership' : 
                    plan === 'legend' ? 'Legend Membership' : 
                    'VarsityHub Plan',
          expiresDate: expiry.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'America/Chicago',
          }),
          daysRemaining: String(daysUntilExpiry),
          renewalPrice: plan === 'legend' ? '$29.99/year' : '$0/month',
          featuresLosing: ['Access to premium features', 'Team management tools'],
          renewLink: `${APP_BASE_URL}/billing/renew`,
          manageSubscriptionLink: `${APP_BASE_URL}/billing`,
        });
        
        // Update preferences to track email sent
        await prisma.user.update({
          where: { id: user.id },
          data: {
            preferences: {
              ...(prefs || {}),
              expiry_email_sent_at: now.toISOString(),
            }
          }
        });
        
        console.log(`[subscriptionExpiry] Sent expiry email to ${user.email} (${daysUntilExpiry} days remaining)`);
      } catch (err) {
        console.error(`[subscriptionExpiry] Failed to send email to ${user.email}:`, err);
      }
    }
    
    console.log('[subscriptionExpiry] Expiry check completed');
  } catch (error) {
    console.error('[subscriptionExpiry] Error during expiry check:', error);
  }
}

/**
 * Setup cron job - run daily at 9 AM
 * Add this to your server initialization:
 * 
 * import cron from 'node-cron';
 * import { checkExpiringSubscriptions } from './jobs/subscriptionExpiryChecker.js';
 * 
 * // Run daily at 9 AM
 * cron.schedule('0 9 * * *', () => {
 *   checkExpiringSubscriptions();
 * });
 */
