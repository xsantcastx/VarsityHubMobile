import { PrismaClient } from '@prisma/client';

// Initialize Prisma
const prisma = new PrismaClient();

async function checkAllUserPlans() {
  try {
    console.log('🔍 Checking all user subscription plans...\n');

    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        display_name: true,
        preferences: true
      }
    });

    console.log(`Total users found: ${allUsers.length}\n`);

    const planCounts = {
      rookie: 0,
      veteran: 0,
      legend: 0,
      unset: 0
    };

    const planDetails = {
      rookie: [],
      veteran: [],
      legend: [],
      unset: []
    };

    allUsers.forEach(user => {
      const prefs = (user.preferences && typeof user.preferences === 'object') ? user.preferences : {};
      const plan = prefs.plan || 'unset';
      const subscriptionId = prefs.subscription_id;
      const paymentPending = prefs.payment_pending;
      
      planCounts[plan]++;
      planDetails[plan].push({
        email: user.email,
        name: user.display_name,
        subscriptionId,
        paymentPending
      });
    });

    console.log('📊 PLAN DISTRIBUTION:');
    console.log(`  Rookie: ${planCounts.rookie} users`);
    console.log(`  Veteran: ${planCounts.veteran} users`);
    console.log(`  Legend: ${planCounts.legend} users`);
    console.log(`  Unset: ${planCounts.unset} users\n`);

    // Show details for paid plans
    if (planDetails.veteran.length > 0) {
      console.log('👤 VETERAN USERS:');
      planDetails.veteran.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email} (${user.name || 'No name'})`);
        console.log(`     Subscription ID: ${user.subscriptionId || 'None'}`);
        console.log(`     Payment Pending: ${user.paymentPending || false}\n`);
      });
    }

    if (planDetails.legend.length > 0) {
      console.log('🏆 LEGEND USERS:');
      planDetails.legend.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.email} (${user.name || 'No name'})`);
        console.log(`     Subscription ID: ${user.subscriptionId || 'None'}`);
        console.log(`     Payment Pending: ${user.paymentPending || false}\n`);
      });
    }

    // Check for potential issues
    const paidPlansWithoutSubscription = allUsers.filter(user => {
      const prefs = (user.preferences && typeof user.preferences === 'object') ? user.preferences : {};
      const plan = prefs.plan;
      const subscriptionId = prefs.subscription_id;
      return (plan === 'veteran' || plan === 'legend') && !subscriptionId;
    });

    if (paidPlansWithoutSubscription.length > 0) {
      console.log('⚠️  POTENTIAL ISSUES:');
      console.log(`Found ${paidPlansWithoutSubscription.length} users with paid plans but no subscription ID:`);
      paidPlansWithoutSubscription.forEach(user => {
        const prefs = user.preferences;
        console.log(`  - ${user.email}: ${prefs.plan} plan, no subscription ID`);
      });
    } else {
      console.log('✅ No issues found - all users have consistent plan/subscription status');
    }

  } catch (error) {
    console.error('❌ Script error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkAllUserPlans()
  .then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });