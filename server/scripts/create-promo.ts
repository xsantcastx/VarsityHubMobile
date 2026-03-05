import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    const promo = await prisma.promoCode.upsert({
      where: { code: 'Hubvarsity321' },
      update: {
        type: 'COMPLIMENTARY',
        percent_off: null,
        enabled: true,
        max_redemptions: 3,
        per_user_limit: 1,
        applies_to_service: null,
        uses: 0,
        note: 'VarsityHub launch promo — complimentary ad booking',
      },
      create: {
        code: 'Hubvarsity321',
        type: 'COMPLIMENTARY',
        enabled: true,
        max_redemptions: 3,
        per_user_limit: 1,
        applies_to_service: null,
        note: 'VarsityHub launch promo — complimentary ad booking',
      },
    });
    console.log('Created:', JSON.stringify(promo, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main();
