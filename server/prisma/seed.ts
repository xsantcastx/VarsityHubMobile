import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const seedPassword = process.env.SEED_PASSWORD;
  if (!seedPassword) {
    console.error('SEED_PASSWORD environment variable is required');
    process.exit(1);
  }
  const password_hash = await bcrypt.hash(seedPassword, 10);

  // --- Users (upsert by email for idempotency) ---

  const fan = await prisma.user.upsert({
    where: { email: 'fan@test.com' },
    update: {
      display_name: 'Alex Fan',
      email_verified: true,
      role: 'fan',
      onboarding_completed: true,
      plan: 'rookie',
      preferences: { role: 'fan' },
    },
    create: {
      email: 'fan@test.com',
      password_hash,
      display_name: 'Alex Fan',
      email_verified: true,
      role: 'fan',
      onboarding_completed: true,
      plan: 'rookie',
      preferences: { role: 'fan', onboarding_completed: true },
    },
  });

  const rookieCoach = await prisma.user.upsert({
    where: { email: 'rookie@test.com' },
    update: {
      display_name: 'Coach Rivera',
      email_verified: true,
      subscription_tier: 'free',
      role: 'coach',
      onboarding_completed: true,
      plan: 'rookie',
      preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
    },
    create: {
      email: 'rookie@test.com',
      password_hash,
      display_name: 'Coach Rivera',
      email_verified: true,
      subscription_tier: 'free',
      role: 'coach',
      onboarding_completed: true,
      plan: 'rookie',
      preferences: { role: 'coach', plan: 'rookie', onboarding_completed: true },
    },
  });

  const veteranCoach = await prisma.user.upsert({
    where: { email: 'veteran@test.com' },
    update: {
      display_name: 'Coach Williams',
      email_verified: true,
      subscription_tier: 'premium',
      role: 'coach',
      onboarding_completed: true,
      plan: 'veteran',
      preferences: { role: 'coach', plan: 'veteran', onboarding_completed: true },
    },
    create: {
      email: 'veteran@test.com',
      password_hash,
      display_name: 'Coach Williams',
      email_verified: true,
      subscription_tier: 'premium',
      role: 'coach',
      onboarding_completed: true,
      plan: 'veteran',
      preferences: { role: 'coach', plan: 'veteran', onboarding_completed: true },
    },
  });

  console.log(`Users: fan=${fan.id}, rookieCoach=${rookieCoach.id}, veteranCoach=${veteranCoach.id}`);

  // --- Organization (deleteMany + create for idempotency) ---

  await prisma.organizationMembership.deleteMany();
  await prisma.teamMembership.deleteMany();
  await prisma.post.deleteMany();
  await prisma.team.deleteMany();
  await prisma.organization.deleteMany();

  const org = await prisma.organization.create({
    data: {
      name: 'Westhill Athletics',
      org_type: 'school',
      zip_code: '06907',
      location: 'Stamford, CT',
    },
  });

  await prisma.organizationMembership.create({
    data: {
      organization_id: org.id,
      user_id: rookieCoach.id,
      role: 'owner',
    },
  });

  console.log(`Organization: ${org.name} (${org.id})`);

  // --- Teams (linked to org, owned by rookie coach) ---

  const team1 = await prisma.team.create({
    data: {
      name: 'Westhill Warriors',
      sport: 'Basketball',
      description: 'Varsity basketball team competing in FCIAC conference.',
      organization_id: org.id,
    },
  });

  await prisma.teamMembership.create({
    data: { team_id: team1.id, user_id: rookieCoach.id, role: 'owner' },
  });

  const team2 = await prisma.team.create({
    data: {
      name: 'Westhill FC',
      sport: 'Soccer',
      description: 'Boys varsity soccer program with a focus on player development.',
      organization_id: org.id,
    },
  });

  await prisma.teamMembership.create({
    data: { team_id: team2.id, user_id: rookieCoach.id, role: 'owner' },
  });

  console.log(`Teams: ${team1.name} (${team1.id}), ${team2.name} (${team2.id})`);

  // --- Posts (5 total: 2 fan, 2 rookie, 1 veteran) ---

  await prisma.post.createMany({
    data: [
      {
        author_id: fan.id,
        title: 'Incredible overtime win last night',
        content: 'The Warriors pulled off a 78-75 overtime victory against Stamford. Final three-pointer from half court sealed the deal. Best game I have seen all season.',
        type: 'update',
        country_code: 'US',
        lat: 41.0534,
        lng: -73.5387,
      },
      {
        author_id: fan.id,
        title: 'Soccer tryouts start next week',
        content: 'Heads up to anyone interested in joining Westhill FC — open tryouts are Monday through Wednesday after school on the main field. Bring cleats and shin guards.',
        type: 'update',
        country_code: 'US',
        lat: 41.0534,
        lng: -73.5387,
      },
      {
        author_id: rookieCoach.id,
        title: 'Practice schedule updated for March',
        content: 'New practice times posted for the Warriors. Tuesday and Thursday sessions move to 4:30 PM starting next week due to gym renovations. Check the team page for details.',
        type: 'update',
        team_id: team1.id,
        country_code: 'US',
        lat: 41.0534,
        lng: -73.5387,
      },
      {
        author_id: rookieCoach.id,
        title: 'FC preseason conditioning program',
        content: 'Sharing our six-week preseason conditioning plan. Focus areas are endurance, agility ladder drills, and small-sided games. Players should log their runs in the shared spreadsheet.',
        type: 'update',
        team_id: team2.id,
        country_code: 'US',
        lat: 41.0534,
        lng: -73.5387,
      },
      {
        author_id: veteranCoach.id,
        title: 'Scouting report from FCIAC showcase',
        content: 'Attended the FCIAC showcase this weekend. Strong talent across the board in the Class LL bracket. Our Warriors matchup against Norwalk will be a real test — their press defense is relentless.',
        type: 'update',
        country_code: 'US',
        lat: 41.0534,
        lng: -73.5387,
      },
    ],
  });

  console.log('Posts: 5 created (2 fan, 2 rookie coach, 1 veteran coach)');

  // --- Final verification ---
  const counts = {
    users: await prisma.user.count(),
    organizations: await prisma.organization.count(),
    teams: await prisma.team.count(),
    posts: await prisma.post.count(),
    ads: await prisma.ad.count(),
    events: await prisma.event.count(),
    games: await prisma.game.count(),
    teamMemberships: await prisma.teamMembership.count(),
    orgMemberships: await prisma.organizationMembership.count(),
  };

  console.log('\nSeed verification:');
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count}`);
  }

  console.log('\nSeed complete.');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
