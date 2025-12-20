// @ts-nocheck
import { calculateDistance } from '../src/lib/geofencing.js';
import { prisma } from '../src/lib/prisma.js';

/**
 * Background job to archive/delete posts and stories that violate the new geofencing rules:
 * - Stories: Must be within 2km of event location AND created on event calendar day
 * - Posts: Must be within 15km of event location AND within event window (48h before to 72h after)
 *
 * This job ensures historical data is consistent with new policies.
 */

const STORY_RADIUS_KM = 2;
const POST_RADIUS_KM = 15;

async function cleanupViolatingContent(): Promise<void> {
  console.log('🧹 Starting geofencing cleanup job...\n');

  // Fetch all stories and posts with their related event data
  const stories = await prisma.story.findMany({
    include: {
      event: {
        select: { id: true, date: true, latitude: true, longitude: true },
      },
    },
  });

  const posts = await prisma.post.findMany({
    include: {
      event: {
        select: { id: true, date: true, latitude: true, longitude: true },
      },
    },
  });

  let storiesToDelete = 0;
  let postsToDelete = 0;

  console.log(`Scanning ${stories.length} stories...`);

  for (const story of stories) {
    if (!story.event || !story.latitude || !story.longitude) {
      continue; // Skip if no location or event data
    }

    const distance = calculateDistance(
      story.latitude,
      story.longitude,
      story.event.latitude ?? 0,
      story.event.longitude ?? 0,
    );

    // Check radius violation
    if (distance > STORY_RADIUS_KM) {
      console.log(
        `  ❌ Story ${story.id}: ${distance.toFixed(2)}km from event (max 2km)`,
      );
      storiesToDelete++;
      continue;
    }

    // Check calendar day violation
    const eventDate = new Date(story.event.date);
    const createdDate = new Date(story.createdAt);
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    const createdDay = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());

    if (eventDay.getTime() !== createdDay.getTime()) {
      console.log(`  ❌ Story ${story.id}: Created ${createdDate.toDateString()}, event ${eventDate.toDateString()}`);
      storiesToDelete++;
    }
  }

  console.log(`\nScanning ${posts.length} posts...`);

  for (const post of posts) {
    if (!post.event || !post.latitude || !post.longitude) {
      continue; // Skip if no location or event data
    }

    const distance = calculateDistance(
      post.latitude,
      post.longitude,
      post.event.latitude ?? 0,
      post.event.longitude ?? 0,
    );

    // Check radius violation
    if (distance > POST_RADIUS_KM) {
      console.log(
        `  ❌ Post ${post.id}: ${distance.toFixed(2)}km from event (max 15km)`,
      );
      postsToDelete++;
      continue;
    }

    // Check time window violation (48h before to 72h after)
    const eventTime = new Date(post.event.date);
    const postTime = new Date(post.createdAt);
    const diffHours = (postTime.getTime() - eventTime.getTime()) / (1000 * 60 * 60);

    if (diffHours < -48 || diffHours > 72) {
      console.log(
        `  ❌ Post ${post.id}: Created ${diffHours.toFixed(1)}h from event (window: -48h to +72h)`,
      );
      postsToDelete++;
    }
  }

  console.log(`\n📊 Cleanup Summary:`);
  console.log(`  Stories to delete: ${storiesToDelete}`);
  console.log(`  Posts to delete: ${postsToDelete}`);
  console.log(`  Total violations: ${storiesToDelete + postsToDelete}`);

  // Dry-run confirmation
  if (storiesToDelete + postsToDelete === 0) {
    console.log('\n✅ No violations found. Database is clean!');
    return;
  }

  console.log('\n⚠️  DRY RUN COMPLETE. No records deleted.');
  console.log('To enable deletions, update the script with actual delete calls.');
}

cleanupViolatingContent()
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
