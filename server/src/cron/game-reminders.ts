/**
 * Cron job to send game reminder notifications
 *
 * This should be run by a scheduler (cron, AWS EventBridge, etc.) at:
 * - Every hour to catch 12-hour and 1-hour reminders
 *
 * Example cron schedule: `0 * * * *` (every hour at minute 0)
 */

import { notifyUpcomingGames } from '../lib/notifications.js';
import { debugLog } from '../lib/debugLog.js';

async function runGameReminders() {
  debugLog(`[${new Date().toISOString()}] Running game reminder notifications...`);

  try {
    // Check for games starting in 12 hours
    await notifyUpcomingGames(12);

    // Check for games starting in 1 hour
    await notifyUpcomingGames(1);

    debugLog(`[${new Date().toISOString()}] Game reminders completed successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error running game reminders:`, error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runGameReminders()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { runGameReminders };
