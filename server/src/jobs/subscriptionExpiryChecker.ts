/**
 * Subscription Expiry Checker - DISABLED
 * This file is now empty. Subscription expiring email was removed
 * as it is a non-mandatory engagement/marketing email.
 */

export async function checkExpiringSubscriptions() {
  // Subscription expiry check email removed — non-mandatory engagement email
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
