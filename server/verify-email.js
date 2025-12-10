#!/usr/bin/env node
/**
 * Verify email for a user
 * Usage: node verify-email.js emilmancero@gmail.com
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyEmail(email) {
  try {
    console.log(`Looking for user with email: ${email}`);
    
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      console.log('❌ User not found');
      return;
    }

    console.log(`Found user: ${user.username || user.email} (ID: ${user.id})`);
    console.log(`Current verification status: ${user.email_verified ? 'VERIFIED' : 'NOT VERIFIED'}`);

    if (user.email_verified) {
      console.log('✅ Email already verified!');
    } else {
      console.log('Verifying email...');
      await prisma.user.update({
        where: { id: user.id },
        data: { email_verified: true }
      });
      console.log('✅ Email verified successfully!');
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

const email = process.argv[2];
if (!email) {
  console.error('Usage: node verify-email.js <email>');
  process.exit(1);
}

verifyEmail(email);
