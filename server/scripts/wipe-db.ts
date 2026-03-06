import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  console.log('Wiping all rows from every table (preserving schema)...\n');

  // Delete in order that respects foreign key constraints
  // (children before parents)
  await prisma.$transaction([
    // Notifications (references user, post, comment, message)
    prisma.notification.deleteMany(),
    // Abuse reports (references user)
    prisma.abuseReport.deleteMany(),
    // Admin activity log (standalone)
    prisma.adminActivityLog.deleteMany(),
    // Messages (references user)
    prisma.message.deleteMany(),
    // Group chat messages, members, chats
    prisma.groupChatMessage.deleteMany(),
    prisma.groupChatMember.deleteMany(),
    prisma.groupChat.deleteMany(),
    // Blocked users
    prisma.blockedUser.deleteMany(),
    // Comments (references post, user)
    prisma.comment.deleteMany(),
    // Post upvotes and bookmarks (references post, user)
    prisma.postUpvote.deleteMany(),
    prisma.postBookmark.deleteMany(),
    // Category assignments and follows
    prisma.categoryAssignment.deleteMany(),
    prisma.categoryFollow.deleteMany(),
    // Polls (references post)
    prisma.pollVote.deleteMany(),
    prisma.pollOption.deleteMany(),
    prisma.poll.deleteMany(),
    // Stories (references game, user)
    prisma.story.deleteMany(),
    // Game votes (references game, user)
    prisma.gameVote.deleteMany(),
    // Promo redemptions (references promoCode, user)
    prisma.promoRedemption.deleteMany(),
    // Ad reservations (references ad)
    prisma.adReservation.deleteMany(),
    // Transaction logs (references user)
    prisma.transactionLog.deleteMany(),
    // Processed Stripe events (standalone)
    prisma.processedStripeEvent.deleteMany(),
    // Ads (references user)
    prisma.ad.deleteMany(),
    // Event RSVPs (references event, user)
    prisma.eventRsvp.deleteMany(),
    // Events (references game, user)
    prisma.event.deleteMany(),
    // Games (references team, user)
    prisma.game.deleteMany(),
    // Team memberships, invites, follows (references team, user)
    prisma.teamMembership.deleteMany(),
    prisma.teamInvite.deleteMany(),
    prisma.teamFollow.deleteMany(),
    // Organization memberships, invites, join requests, follows
    prisma.organizationMembership.deleteMany(),
    prisma.organizationInvite.deleteMany(),
    prisma.organizationJoinRequest.deleteMany(),
    prisma.organizationFollow.deleteMany(),
    // User follows (references user)
    prisma.follows.deleteMany(),
    // Posts (references user, game, team)
    prisma.post.deleteMany(),
    // Teams (references organization)
    prisma.team.deleteMany(),
    // Organizations
    prisma.organization.deleteMany(),
    // Categories (standalone)
    prisma.category.deleteMany(),
    // Promo codes (standalone)
    prisma.promoCode.deleteMany(),
    // Users (root)
    prisma.user.deleteMany(),
  ]);

  console.log('All rows deleted.\n');

  // Verify by counting every table
  const counts: Record<string, number> = {
    User: await prisma.user.count(),
    Organization: await prisma.organization.count(),
    Team: await prisma.team.count(),
    Post: await prisma.post.count(),
    Comment: await prisma.comment.count(),
    PostUpvote: await prisma.postUpvote.count(),
    PostBookmark: await prisma.postBookmark.count(),
    Poll: await prisma.poll.count(),
    PollOption: await prisma.pollOption.count(),
    PollVote: await prisma.pollVote.count(),
    Game: await prisma.game.count(),
    GameVote: await prisma.gameVote.count(),
    Event: await prisma.event.count(),
    EventRsvp: await prisma.eventRsvp.count(),
    Story: await prisma.story.count(),
    Ad: await prisma.ad.count(),
    AdReservation: await prisma.adReservation.count(),
    Category: await prisma.category.count(),
    CategoryAssignment: await prisma.categoryAssignment.count(),
    CategoryFollow: await prisma.categoryFollow.count(),
    Message: await prisma.message.count(),
    GroupChat: await prisma.groupChat.count(),
    GroupChatMember: await prisma.groupChatMember.count(),
    GroupChatMessage: await prisma.groupChatMessage.count(),
    BlockedUser: await prisma.blockedUser.count(),
    Notification: await prisma.notification.count(),
    Follows: await prisma.follows.count(),
    TeamMembership: await prisma.teamMembership.count(),
    TeamInvite: await prisma.teamInvite.count(),
    TeamFollow: await prisma.teamFollow.count(),
    OrganizationMembership: await prisma.organizationMembership.count(),
    OrganizationInvite: await prisma.organizationInvite.count(),
    OrganizationJoinRequest: await prisma.organizationJoinRequest.count(),
    OrganizationFollow: await prisma.organizationFollow.count(),
    TransactionLog: await prisma.transactionLog.count(),
    ProcessedStripeEvent: await prisma.processedStripeEvent.count(),
    PromoCode: await prisma.promoCode.count(),
    PromoRedemption: await prisma.promoRedemption.count(),
    AdminActivityLog: await prisma.adminActivityLog.count(),
    AbuseReport: await prisma.abuseReport.count(),
  };

  console.log('Table Row Counts After Wipe:');
  console.log('----------------------------');
  let total = 0;
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(28)} ${count}`);
    total += count;
  }
  console.log('----------------------------');
  console.log(`  TOTAL${' '.repeat(22)}${total}`);

  if (total === 0) {
    console.log('\nDatabase is clean.');
  } else {
    console.error('\nWARNING: Some tables still have rows!');
    process.exit(1);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Wipe failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
