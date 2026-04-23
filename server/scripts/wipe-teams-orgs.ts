/**
 * Wipe all Teams and Organizations from the database.
 *
 * Cascades (per schema): TeamMembership, TeamInvite, TeamFollow,
 * OrganizationMembership, OrganizationInvite, OrganizationJoinRequest,
 * OrganizationFollow, Ads with team_id set (+ their AdReservations).
 *
 * Preserved: Users (organization_id → null), Posts/Events/Games
 * (team_id → null), standalone ads (team_id was null), all other data.
 *
 * Usage:
 *   cd server && npx tsx scripts/wipe-teams-orgs.ts --confirm
 *   railway run npx tsx scripts/wipe-teams-orgs.ts --confirm
 */

import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL not set. Run via: railway run npx tsx scripts/wipe-teams-orgs.ts --confirm');
  process.exit(1);
}

const args = process.argv.slice(2);
if (!args.includes('--confirm')) {
  console.log('\n⚠️  This will DELETE all teams and organizations.');
  console.log('    Cascades: TeamMembership, TeamInvite, TeamFollow, OrganizationMembership,');
  console.log('              OrganizationInvite, OrganizationJoinRequest, OrganizationFollow,');
  console.log('              Ads (with team_id set) + their AdReservations.');
  console.log('    Preserved: users, posts, events, games, standalone ads.\n');
  console.log('    To proceed, run with --confirm flag:\n');
  console.log('    railway run npx tsx scripts/wipe-teams-orgs.ts --confirm\n');
  process.exit(0);
}

const prisma = new PrismaClient({ datasourceUrl: DATABASE_URL });

async function main() {
  try {
    const teamCount = await prisma.team.count();
    const orgCount = await prisma.organization.count();
    console.log(`\n🗑️  Wiping ${teamCount} teams and ${orgCount} organizations...\n`);

    // Teams first — Team.organization_id has onDelete: Restrict,
    // so organizations cannot be deleted while teams reference them.
    const teamResult = await prisma.team.deleteMany();
    console.log(`   ✅ Team: ${teamResult.count} rows (memberships, invites, follows, team-ads cascaded)`);

    const orgResult = await prisma.organization.deleteMany();
    console.log(`   ✅ Organization: ${orgResult.count} rows (memberships, invites, join requests, follows cascaded)`);

    console.log('\n🎉 Teams and organizations wipe complete.\n');
  } catch (err) {
    console.error('\n❌ Error during wipe:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
