import { PrismaClient } from '@prisma/client';
import readline from 'readline';

// Initialize Prisma
const prisma = new PrismaClient();

async function resetUsersWithoutSubscriptionId() {
  try {
    console.log('🔍 Finding users with paid plans but no subscription ID...\n');

    // Get all users and filter in JavaScript (simpler than complex Prisma query)
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        display_name: true,
        preferences: true
      }
    });

    const usersToReset = allUsers.filter(user => {
      const prefs = (user.preferences && typeof user.preferences === 'object') ? user.preferences : {};
      const plan = prefs.plan;
      const subscriptionId = prefs.subscription_id;
      
      // Find users with paid plans but no subscription ID
      return (plan === 'veteran' || plan === 'legend') && !subscriptionId;
    });

    console.log(`Found ${usersToReset.length} users with paid plans but no subscription ID:\n`);

    if (usersToReset.length === 0) {
      console.log('🎉 No users need to be reset!');
      return;
    }

    usersToReset.forEach((user, index) => {
      const prefs = (user.preferences && typeof user.preferences === 'object') ? user.preferences : {};
      console.log(`${index + 1}. ${user.email} (${user.display_name || 'No name'})`);
      console.log(`   Current plan: ${prefs.plan}`);
      console.log(`   Payment pending: ${prefs.payment_pending || false}`);
      console.log('');
    });

    // Ask for confirmation
    console.log(`⚠️  WARNING: This will reset ${usersToReset.length} users to rookie plan!`);
    console.log('This action will:');
    console.log('  - Set plan to "rookie"');
    console.log('  - Remove any subscription-related fields');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise((resolve) => {
      rl.question('\nDo you want to proceed? (yes/no): ', resolve);
    });

    rl.close();

    if (answer.toLowerCase() !== 'yes' && answer.toLowerCase() !== 'y') {
      console.log('❌ Operation cancelled.');
      return;
    }

    // Reset users
    console.log('\n🔄 Resetting users...');
    let resetCount = 0;

    for (const user of usersToReset) {
      try {
        const currentPrefs = (user.preferences && typeof user.preferences === 'object') ? user.preferences : {};
        const nextPrefs = { ...currentPrefs };
        
        // Reset subscription-related preferences
        nextPrefs.plan = 'rookie';
        delete nextPrefs.subscription_id;
        delete nextPrefs.subscription_period_end;
        delete nextPrefs.stripe_customer_id;
        delete nextPrefs.payment_pending;

        await prisma.user.update({ 
          where: { id: user.id }, 
          data: { preferences: nextPrefs } 
        });

        console.log(`✅ Reset ${user.email} to rookie plan`);
        resetCount++;
      } catch (error) {
        console.error(`❌ Failed to reset ${user.email}:`, error.message);
      }
    }

    console.log(`\n🎉 Successfully reset ${resetCount}/${usersToReset.length} users to rookie plan!`);

  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
resetUsersWithoutSubscriptionId()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });