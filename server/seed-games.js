const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const games = [
  {
    title: 'Lions vs Tigers',
    date: new Date('2025-11-28T19:00:00Z'),
    location: 'City Stadium, New York, NY 10001',
    cover_image_url: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=2940&auto=format&fit=crop',
  },
  {
    title: 'Sharks vs Eagles',
    date: new Date('2025-11-29T18:30:00Z'),
    location: 'West High School, Los Angeles, CA 90001',
    cover_image_url: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?q=80&w=2940&auto=format&fit=crop',
  },
  {
    title: 'Panthers vs Bears',
    date: new Date('2025-12-05T20:00:00Z'),
    location: 'North Arena, Chicago, IL 60601',
    cover_image_url: 'https://images.unsplash.com/photo-1487466365202-1afdb86c764e?q=80&w=2940&auto=format&fit=crop',
  },
  {
    title: 'Falcons vs Jets',
    date: new Date('2025-12-06T17:00:00Z'),
    location: 'South Park, Miami, FL 33101',
    cover_image_url: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=2940&auto=format&fit=crop',
  },
  {
    title: 'Giants vs Cowboys',
    date: new Date('2025-12-12T19:00:00Z'),
    location: 'MetLife Stadium, East Rutherford, NJ 07073',
    cover_image_url: 'https://images.unsplash.com/photo-1521412644187-c49fa049e8be?q=80&w=2835&auto=format&fit=crop',
  },
];

async function main() {
  console.log('Start seeding...');
  for (const game of games) {
    const newGame = await prisma.game.create({
      data: game,
    });
    console.log(`Created game with id: ${newGame.id}`);
  }
  console.log('Seeding finished.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async (). => {
    await prisma.$disconnect();
  });
