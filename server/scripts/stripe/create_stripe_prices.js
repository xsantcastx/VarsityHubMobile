import Stripe from 'stripe';

// Initialize Stripe with the test secret key
const stripe = new Stripe('sk_test_51S5t0kRuB2a0vFjp0bdj2NbzkDp6ACVhtWU48TXtNuviL0wnJxxIx0eBgg6whwiM9gJkNiqnINPbSQHqV9qRIxfe00KEwuxjwZ');

async function createTestPrices() {
  try {
    console.log('Creating test prices for subscription plans...');

    // Create Veteran plan price (monthly: $1.50 per team)
    const veteranPrice = await stripe.prices.create({
      unit_amount: 150, // $1.50 in cents
      currency: 'usd',
      recurring: { interval: 'month' },
      product_data: {
        name: 'VarsityHub Veteran Plan (Per Team)'
      }
    });

    console.log('✅ Veteran plan price created:', veteranPrice.id);

    // Create Legend plan price (annual: $19.99)
    const legendPrice = await stripe.prices.create({
      unit_amount: 1999, // $19.99 in cents
      currency: 'usd',
      recurring: { interval: 'year' },
      product_data: {
        name: 'VarsityHub Legend Plan (Unlimited)'
      }
    });

    console.log('✅ Legend plan price created:', legendPrice.id);

    console.log('\n📋 Update your server/.env file with these values:');
    console.log(`STRIPE_PRICE_VETERAN=${veteranPrice.id}`);
    console.log(`STRIPE_PRICE_LEGEND=${legendPrice.id}`);

    return { veteranPrice: veteranPrice.id, legendPrice: legendPrice.id };
  } catch (error) {
    console.error('❌ Failed to create prices:', error.message);
    throw error;
  }
}

createTestPrices()
  .then((prices) => {
    console.log('\n🎉 All prices created successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Error creating prices:', error);
    process.exit(1);
  });