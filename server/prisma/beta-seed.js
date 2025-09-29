import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createBetaTestData() {
  console.log('🧪 Creating beta test data...');

  // Create test users
  const hashedPassword = await bcrypt.hash('beta123', 12);
  
  const testUsers = [
    {
      email: 'coach@test.com',
      password_hash: hashedPassword,
      display_name: 'Coach Smith',
      username: 'coach_smith',
      email_verified: true,
      preferences: {
        notifications: { game_event_reminders: true, team_updates: true, comments_upvotes: true },
        plan: 'veteran'
      }
    },
    {
      email: 'player@test.com',
      password_hash: hashedPassword,
      display_name: 'Alex Johnson',
      username: 'alex_player',
      email_verified: true,
      preferences: {
        notifications: { game_event_reminders: true, team_updates: false, comments_upvotes: true },
        plan: 'rookie'
      }
    },
    {
      email: 'fan@test.com',
      password_hash: hashedPassword,
      display_name: 'Sports Fan',
      username: 'sports_fan',
      email_verified: true,
      preferences: {
        notifications: { game_event_reminders: false, team_updates: true, comments_upvotes: false },
        plan: 'rookie'
      }
    }
  ];

  // Get or create test users
  const createdUsers = [];
  for (const userData of testUsers) {
    try {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {},
        create: userData
      });
      createdUsers.push(user);
      console.log(`✅ User ready: ${user.display_name} (${user.email})`);
    } catch (error) {
      console.log(`❌ Error with user ${userData.email}:`, error.message);
    }
  }

  // If no users were created/found, fetch them by email
  if (createdUsers.length === 0) {
    console.log('🔍 Fetching existing users...');
    for (const userData of testUsers) {
      try {
        const user = await prisma.user.findUnique({
          where: { email: userData.email }
        });
        if (user) {
          createdUsers.push(user);
          console.log(`✅ Found existing user: ${user.display_name}`);
        }
      } catch (error) {
        console.log(`❌ Error finding user ${userData.email}`);
      }
    }
  }

  // Create sample sports posts
  const samplePosts = [
    {
      title: "Epic Football Touchdown!",
      content: "Amazing 80-yard touchdown pass in the final quarter! What a game! 🏈",
      author_id: createdUsers[0]?.id,
      upvotes_count: 15,
      country_code: 'US'
    },
    {
      title: "Basketball Season Highlights",
      content: "Check out these incredible dunks from our season opener! The team is looking strong this year! 🏀",
      author_id: createdUsers[1]?.id,
      upvotes_count: 8,
      country_code: 'US'
    },
    {
      title: "Baseball Victory",
      content: "Bottom of the 9th, bases loaded, and we hit a grand slam! What a way to win the championship! ⚾",
      author_id: createdUsers[2]?.id,
      upvotes_count: 23,
      country_code: 'US'
    },
    {
      title: "Soccer Skills Training",
      content: "Training hard for the upcoming tournament. Check out these free kick techniques! ⚽",
      author_id: createdUsers[0]?.id,
      upvotes_count: 5,
      country_code: 'US'
    },
    {
      title: "Tennis Match Highlights",
      content: "What an incredible serve! Ace after ace in today's match. The crowd went wild! 🎾",
      author_id: createdUsers[1]?.id,
      upvotes_count: 12,
      country_code: 'US'
    }
  ];

  const createdPosts = [];
  for (const postData of samplePosts) {
    try {
      const post = await prisma.post.create({
        data: postData
      });
      createdPosts.push(post);
      console.log(`✅ Created post: ${post.title}`);
    } catch (error) {
      console.log(`⚠️ Error creating post: ${postData.title}`);
    }
  }

  // Create sample comments
  const sampleComments = [
    {
      content: "Incredible play! That's why you're the best coach!",
      post_id: createdPosts[0]?.id,
      author_id: createdUsers[1]?.id
    },
    {
      content: "Can't wait to see more highlights like this!",
      post_id: createdPosts[0]?.id,
      author_id: createdUsers[2]?.id
    },
    {
      content: "Amazing basketball skills! Keep up the great work!",
      post_id: createdPosts[1]?.id,
      author_id: createdUsers[0]?.id
    },
    {
      content: "That grand slam was legendary! 🔥",
      post_id: createdPosts[2]?.id,
      author_id: createdUsers[1]?.id
    },
    {
      content: "Soccer training looks intense! Good luck in the tournament!",
      post_id: createdPosts[3]?.id,
      author_id: createdUsers[2]?.id
    }
  ];

  for (const commentData of sampleComments) {
    try {
      if (commentData.post_id && commentData.author_id) {
        const comment = await prisma.comment.create({
          data: commentData
        });
        console.log(`✅ Created comment: ${comment.content.substring(0, 30)}...`);
      }
    } catch (error) {
      console.log(`⚠️ Error creating comment`);
    }
  }

  // Create some follow relationships
  try {
    if (createdUsers.length >= 3) {
      await prisma.follows.createMany({
        data: [
          { follower_id: createdUsers[1].id, following_id: createdUsers[0].id },
          { follower_id: createdUsers[2].id, following_id: createdUsers[0].id },
          { follower_id: createdUsers[0].id, following_id: createdUsers[1].id }
        ],
        skipDuplicates: true
      });
      console.log('✅ Created follow relationships');
    }
  } catch (error) {
    console.log('⚠️ Follow relationships may already exist');
  }

  // Create some upvotes
  try {
    if (createdPosts.length > 0 && createdUsers.length > 0) {
      await prisma.postUpvote.createMany({
        data: [
          { post_id: createdPosts[0].id, user_id: createdUsers[1].id },
          { post_id: createdPosts[0].id, user_id: createdUsers[2].id },
          { post_id: createdPosts[1].id, user_id: createdUsers[0].id },
          { post_id: createdPosts[2].id, user_id: createdUsers[1].id }
        ],
        skipDuplicates: true
      });
      console.log('✅ Created sample upvotes');
    }
  } catch (error) {
    console.log('⚠️ Upvotes may already exist');
  }

  console.log('🎉 Beta test data creation complete!');
  console.log('');
  console.log('📱 Test Accounts Created:');
  console.log('  coach@test.com / beta123 (Coach Smith)');
  console.log('  player@test.com / beta123 (Alex Johnson)');
  console.log('  fan@test.com / beta123 (Sports Fan)');
  console.log('');
  console.log('📝 Sample Content:');
  console.log(`  ${createdPosts.length} sports posts with comments and upvotes`);
  console.log('  Follow relationships between users');
  console.log('');
}

// Run the seeding
createBetaTestData()
  .then(() => {
    console.log('✅ Beta test data setup completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error setting up beta test data:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });