import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import 'dotenv/config';
import { sendPasswordResetEmail } from '../dist/lib/email.js';

const prisma = new PrismaClient();

const email = process.argv[2] || 'test@example.com';

(async () => {
  try {
    let user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    if (!user) {
      const randomSecret = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const password_hash = await bcrypt.hash(randomSecret, 10);
      user = await prisma.user.create({
        data: {
          email,
          password_hash,
          display_name: email.split('@')[0],
          email_verified: false,
          preferences: { role: 'fan', onboarding_completed: false },
        },
      });
      console.log('[forgot] Created dev user:', user.id);
    } else {
      console.log('[forgot] Found user:', user.id);
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expires = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_reset_code: code, password_reset_expires: expires },
    });

    const base = (process.env.APP_BASE_URL || 'https://varsityhub.app').replace(/\/$/, '');
    const resetLink = `${base}/reset/${encodeURIComponent(code)}`;
    const ok = await sendPasswordResetEmail(email, code, user.display_name || email.split('@')[0], resetLink, '1 hour');
    console.log(JSON.stringify({ ok, code, resetLink }));
  } catch (err) {
    console.error('Error running forgot flow:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
