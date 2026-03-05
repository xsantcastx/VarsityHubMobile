import { prisma } from './src/lib/prisma.js';
import { signJwt } from './src/lib/jwt.js';

async function main() {
  const users = await prisma.user.findMany({
    take: 5,
    orderBy: { created_at: 'asc' },
    select: { id: true, email: true, display_name: true, email_verified: true }
  });
  console.log('Users found:', JSON.stringify(users, null, 2));

  if (users.length > 0) {
    const token = signJwt({ id: users[0].id });
    console.log('\nFirst user email:', users[0].email);
    console.log('JWT Token:', token);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
