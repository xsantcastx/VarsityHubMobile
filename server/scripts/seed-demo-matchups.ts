/**
 * Seed two demo matchups (Duke v UNC, Cavs v Warriors) with real Team and
 * Game rows so the admin account can post stories, media, and RSVPs against
 * them for marketing/promo content.
 *
 * Why this is separate from the main seed:
 * - Safe to run against production — tagged with [DEMO_MATCHUP] in every
 *   description so wipe-demo-matchups.ts can remove them surgically.
 * - Idempotent: re-running won't create duplicates.
 * - Creates *real* Game rows, not `sample-` synthetic IDs, so FK-constrained
 *   child rows (stories, posts, RSVPs) persist correctly.
 *
 * Run:
 *   cd server && npx tsx scripts/seed-demo-matchups.ts
 *
 * Wipe:
 *   cd server && npx tsx scripts/wipe-demo-matchups.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_TAG = '[DEMO_MATCHUP]';

interface TeamSeed {
  name: string;
  description: string;
  sport: string;
  logo_url: string;
  avatar_url: string;
  city: string;
  state: string;
  league: string;
  venue_address: string;
  venue_lat: number;
  venue_lng: number;
}

interface GameSeed {
  title: string;
  home: string; // team name
  away: string;
  daysFromNow: number;
  location: string;
  latitude: number;
  longitude: number;
  banner_url: string;
  cover_image_url: string;
  description: string;
}

// Fully fictional placeholder teams and venues — no real leagues, clubs, or
// trademarked arena names. Coordinates are kept only so the map surfaces render.
// Logos are neutral text monograms (ui-avatars). Do not swap in real club names
// or logo files — they are protected marks.
const TEAMS: TeamSeed[] = [
  {
    name: 'Riverside Ravens',
    description: `${DEMO_TAG} Demo team for promo content.`,
    sport: 'basketball',
    logo_url: 'https://ui-avatars.com/api/?name=Riverside+Ravens&size=200',
    avatar_url: 'https://ui-avatars.com/api/?name=Riverside+Ravens&size=200',
    city: 'Riverside',
    state: 'NC',
    league: 'Demo League',
    venue_address: 'Riverside Arena, 100 Campus Drive, Riverside, NC 27708',
    venue_lat: 36.0017,
    venue_lng: -78.9430,
  },
  {
    name: 'Lakeside Lions',
    description: `${DEMO_TAG} Demo team for promo content.`,
    sport: 'basketball',
    logo_url: 'https://ui-avatars.com/api/?name=Lakeside+Lions&size=200',
    avatar_url: 'https://ui-avatars.com/api/?name=Lakeside+Lions&size=200',
    city: 'Lakeside',
    state: 'NC',
    league: 'Demo League',
    venue_address: 'Lakeside Fieldhouse, 300 Lakeside Boulevard, Lakeside, NC 27514',
    venue_lat: 35.8994,
    venue_lng: -79.0408,
  },
  {
    name: 'Harbor City Hawks',
    description: `${DEMO_TAG} Demo team for promo content.`,
    sport: 'basketball',
    logo_url: 'https://ui-avatars.com/api/?name=Harbor+City+Hawks&size=200',
    avatar_url: 'https://ui-avatars.com/api/?name=Harbor+City+Hawks&size=200',
    city: 'Harbor City',
    state: 'OH',
    league: 'Demo League',
    venue_address: 'Harbor City Arena, 1 Center Court, Harbor City, OH 44115',
    venue_lat: 41.4965,
    venue_lng: -81.6882,
  },
  {
    name: 'Summit Storm',
    description: `${DEMO_TAG} Demo team for promo content.`,
    sport: 'basketball',
    logo_url: 'https://ui-avatars.com/api/?name=Summit+Storm&size=200',
    avatar_url: 'https://ui-avatars.com/api/?name=Summit+Storm&size=200',
    city: 'Summit City',
    state: 'CA',
    league: 'Demo League',
    venue_address: 'Summit Pavilion, 1 Summit Way, Summit City, CA 94158',
    venue_lat: 37.7680,
    venue_lng: -122.3877,
  },
];

const GAMES: GameSeed[] = [
  {
    title: 'Riverside Ravens vs. Lakeside Lions',
    home: 'Riverside Ravens',
    away: 'Lakeside Lions',
    daysFromNow: 1, // Re-running the seed bumps this forward — always "tomorrow"
    location: 'Riverside Arena, Riverside, NC',
    latitude: 36.0017,
    longitude: -78.9430,
    banner_url: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/q_auto:best/f_auto/v1776111005/convert_dauk3b.webp',
    cover_image_url: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/q_auto:best/f_auto/v1776111005/convert_dauk3b.webp',
    description: `${DEMO_TAG} Local rivalry. Demo event for promo content.`,
  },
  {
    title: 'Harbor City Hawks vs. Summit Storm',
    home: 'Harbor City Hawks',
    away: 'Summit Storm',
    daysFromNow: 2,
    location: 'Harbor City Arena, Harbor City, OH',
    latitude: 41.4965,
    longitude: -81.6882,
    banner_url: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/q_auto:best/f_auto/v1776113584/IMG_5935_qazitw.jpg',
    cover_image_url: 'https://res.cloudinary.com/dxb5oq4fs/image/upload/q_auto:best/f_auto/v1776113584/IMG_5935_qazitw.jpg',
    description: `${DEMO_TAG} Demo event for promo content.`,
  },
];

async function upsertTeam(seed: TeamSeed): Promise<string> {
  // Match by exact name — safest cardinality for a demo. A real team with the
  // same name would get reused; if that's a concern, prefix with DEMO_.
  const existing = await prisma.team.findFirst({ where: { name: seed.name } });
  if (existing) {
    // Reuse; patch description/venue so the DEMO_MATCHUP tag gets applied even
    // if the row pre-dated this script.
    await prisma.team.update({
      where: { id: existing.id },
      data: {
        description: seed.description,
        sport: seed.sport,
        logo_url: seed.logo_url,
        avatar_url: seed.avatar_url,
        city: seed.city,
        state: seed.state,
        league: seed.league,
        venue_address: seed.venue_address,
        venue_lat: seed.venue_lat,
        venue_lng: seed.venue_lng,
        status: 'active',
      },
    });
    console.log(`  = team (reused): ${seed.name} — ${existing.id}`);
    return existing.id;
  }
  const created = await prisma.team.create({ data: seed });
  console.log(`  + team: ${seed.name} — ${created.id}`);
  return created.id;
}

async function upsertGame(seed: GameSeed, homeId: string, awayId: string): Promise<string> {
  const date = new Date(Date.now() + seed.daysFromNow * 24 * 60 * 60 * 1000);

  const existing = await prisma.game.findFirst({
    where: {
      title: seed.title,
      home_team_id: homeId,
      away_team_id: awayId,
    },
  });

  if (existing) {
    await prisma.game.update({
      where: { id: existing.id },
      data: {
        date,
        location: seed.location,
        latitude: seed.latitude,
        longitude: seed.longitude,
        banner_url: seed.banner_url,
        cover_image_url: seed.cover_image_url,
        description: seed.description,
        home_team: seed.home,
        away_team: seed.away,
        approval_status: 'approved',
      },
    });
    console.log(`  = game (reused): ${seed.title} — ${existing.id}`);
    return existing.id;
  }

  const created = await prisma.game.create({
    data: {
      title: seed.title,
      date,
      location: seed.location,
      latitude: seed.latitude,
      longitude: seed.longitude,
      home_team_id: homeId,
      away_team_id: awayId,
      home_team: seed.home,
      away_team: seed.away,
      banner_url: seed.banner_url,
      cover_image_url: seed.cover_image_url,
      description: seed.description,
      event_type: 'game',
      approval_status: 'approved',
    },
  });
  console.log(`  + game: ${seed.title} — ${created.id}`);
  return created.id;
}

async function main() {
  console.log(`[seed-demo-matchups] Seeding demo matchups. Tag: ${DEMO_TAG}`);
  console.log(`[seed-demo-matchups] Target DB: ${maskDatabaseUrl(process.env.DATABASE_URL)}`);
  console.log();

  console.log('Teams:');
  const teamIds = new Map<string, string>();
  for (const t of TEAMS) {
    teamIds.set(t.name, await upsertTeam(t));
  }
  console.log();

  console.log('Games:');
  const gameIds: string[] = [];
  for (const g of GAMES) {
    const homeId = teamIds.get(g.home);
    const awayId = teamIds.get(g.away);
    if (!homeId || !awayId) {
      throw new Error(`Team IDs missing for matchup ${g.title}`);
    }
    gameIds.push(await upsertGame(g, homeId, awayId));
  }
  console.log();

  console.log('Summary:');
  console.log(`  teams: ${teamIds.size}`);
  console.log(`  games: ${gameIds.length}`);
  console.log();
  console.log('Next steps:');
  console.log('  1. Sign in to the app as an ADMIN_EMAILS account.');
  console.log('  2. Navigate to the Games tab — both matchups will be listed as upcoming.');
  console.log('  3. Admin accounts bypass geofencing, approval, and team-membership gates.');
  console.log('     Post stories, photos, RSVPs freely.');
  console.log('  4. When done, run: npx tsx scripts/wipe-demo-matchups.ts');
}

function maskDatabaseUrl(url: string | undefined): string {
  if (!url) return '(unset)';
  return url.replace(/:[^:@/]*@/, ':***@');
}

main()
  .catch((err) => {
    console.error('[seed-demo-matchups] Failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
