import { PrismaClient } from '@prisma/client';
import 'dotenv/config';

const prisma = new PrismaClient();

async function main() {
  const orgs = await prisma.organization.findMany({
    select: {
      id: true,
      name: true,
      formatted_address: true,
      place_id: true,
      zip_code: true,
      latitude: true,
      longitude: true,
      status: true,
    },
    orderBy: { name: 'asc' },
  });

  const rows = orgs.map((o) => ({
    id: o.id,
    name: o.name,
    place_id: o.place_id || null,
    formatted_address: o.formatted_address || null,
    zip_code: o.zip_code || null,
    coords: (typeof o.latitude === 'number' && typeof o.longitude === 'number') ? `${o.latitude},${o.longitude}` : null,
    status: o.status,
  }));

  console.table(rows);

  const westhill = orgs.find((o) => o.name.toLowerCase() === 'westhill high school');
  if (westhill) {
    console.log('\nWesthill High School details:');
    console.log(JSON.stringify(westhill, null, 2));
  } else {
    console.log('\nWesthill High School not found.');
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
