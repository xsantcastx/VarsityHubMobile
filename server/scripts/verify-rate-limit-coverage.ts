#!/usr/bin/env npx tsx
/**
 * Verifies sensitive endpoints include rate limiting middleware.
 *
 * Usage:
 *   npm --prefix server run verify:rate-limits
 */

import fs from 'node:fs/promises';
import path from 'node:path';

type Check = {
  file: string;
  mustContain: string;
  label: string;
};

const checks: Check[] = [
  // Baseline coverage
  {
    file: 'src/middleware/rateLimiters.ts',
    mustContain: 'export const defaultApiLimiter = createLimiter({',
    label: 'default API limiter exported',
  },
  {
    file: 'src/app.ts',
    mustContain: 'parent.use(defaultApiLimiter);',
    label: 'default API limiter mounted',
  },

  // Auth — uses Redis-backed rate limiting (rlIncr + MAX_AUTH_ATTEMPTS)
  {
    file: 'src/routes/auth.ts',
    mustContain: 'checkAuthRateLimit',
    label: 'auth rate limiter function',
  },
  {
    file: 'src/routes/auth.ts',
    mustContain: 'MAX_AUTH_ATTEMPTS',
    label: 'auth max attempts config',
  },
  {
    file: 'src/routes/auth.ts',
    mustContain: "'/register',",
    label: 'auth register endpoint',
  },
  {
    file: 'src/routes/auth.ts',
    mustContain: "'/login',",
    label: 'auth login endpoint',
  },
  {
    file: 'src/routes/auth.ts',
    mustContain: "'/verify/request',",
    label: 'auth verify/request endpoint',
  },
  {
    file: 'src/routes/auth.ts',
    mustContain: "'/verify/send',",
    label: 'auth verify/send endpoint',
  },

  // Payments
  {
    file: 'src/routes/payments.ts',
    mustContain:
      "paymentsRouter.post('/checkout', expressPkg.json(), requireVerified as any, paymentLimiter",
    label: 'payments checkout limiter',
  },
  {
    file: 'src/routes/payments.ts',
    mustContain:
      "paymentsRouter.post('/create-payment-sheet', expressPkg.json(), requireVerified as any, paymentLimiter",
    label: 'payments payment-sheet limiter',
  },
  {
    file: 'src/routes/payments.ts',
    mustContain:
      "paymentsRouter.post('/finalize-session', expressPkg.json(), requireVerified as any, paymentLimiter",
    label: 'payments finalize-session limiter',
  },
  {
    file: 'src/routes/payments.ts',
    mustContain:
      "paymentsRouter.post('/cancel-intent', expressPkg.json(), requireVerified as any, paymentLimiter",
    label: 'payments cancel-intent limiter',
  },
  {
    file: 'src/routes/payments.ts',
    mustContain:
      "paymentsRouter.post('/subscribe', expressPkg.json(), requireVerified as any, paymentLimiter",
    label: 'payments subscribe limiter',
  },
  {
    file: 'src/routes/payments.ts',
    mustContain:
      "paymentsRouter.post('/subscription/cancel', expressPkg.json(), requireVerified as any, paymentLimiter",
    label: 'payments subscription cancel limiter',
  },
  {
    file: 'src/routes/payments.ts',
    mustContain:
      "paymentsRouter.post('/update-subscription-quantity', expressPkg.json(), requireVerified as any, paymentLimiter",
    label: 'payments quantity update limiter',
  },
  {
    file: 'src/routes/payments.ts',
    mustContain:
      "paymentsRouter.post('/apple/verify-receipt', expressPkg.json(), requireVerified as any, paymentLimiter",
    label: 'payments apple receipt limiter',
  },
  {
    file: 'src/routes/payments.ts',
    mustContain:
      "paymentsRouter.post('/apple/verify-ad-receipt', expressPkg.json(), requireVerified as any, paymentLimiter",
    label: 'payments apple ad receipt limiter',
  },
  {
    file: 'src/routes/payments.ts',
    mustContain:
      "paymentsRouter.post('/google/verify-purchase', expressPkg.json(), requireVerified as any, paymentLimiter",
    label: 'payments google purchase limiter',
  },

  // Uploads
  {
    file: 'src/routes/uploads.ts',
    mustContain: "uploadsRouter.get('/cloudinary-signature', requireAuth as any, uploadLimiter",
    label: 'uploads cloudinary-signature limiter',
  },
  {
    file: 'src/routes/uploads.ts',
    mustContain: "uploadsRouter.get('/sign', requireAuth as any, uploadLimiter",
    label: 'uploads sign limiter',
  },
  {
    file: 'src/routes/uploads.ts',
    mustContain: "uploadsRouter.post('/', requireAuth as any, uploadLimiter",
    label: 'uploads media endpoint limiter',
  },
  {
    file: 'src/routes/uploads.ts',
    mustContain: "uploadsRouter.post('/files', requireAuth as any, uploadLimiter",
    label: 'uploads files endpoint limiter',
  },
  {
    file: 'src/routes/uploads.ts',
    mustContain: "uploadsRouter.post('/avatar', requireAuth as any, uploadLimiter",
    label: 'uploads avatar limiter',
  },
];

async function main() {
  const root = path.resolve(process.cwd());
  const grouped = new Map<string, Check[]>();
  for (const check of checks) {
    if (!grouped.has(check.file)) grouped.set(check.file, []);
    grouped.get(check.file)!.push(check);
  }

  const failures: string[] = [];

  for (const [file, fileChecks] of grouped.entries()) {
    const filePath = path.join(root, file);
    const content = await fs.readFile(filePath, 'utf8');
    for (const check of fileChecks) {
      const ok = content.includes(check.mustContain);
      if (!ok) failures.push(`${check.label} (${file})`);
      const status = ok ? 'PASS' : 'FAIL';
      // eslint-disable-next-line no-console
      console.log(`[${status}] ${check.label}`);
    }
  }

  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error('\nMissing rate-limit coverage checks:');
    for (const failure of failures) {
      // eslint-disable-next-line no-console
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  // eslint-disable-next-line no-console
  console.log(`\nAll ${checks.length} sensitive endpoint rate-limit checks passed.`);
}

main().catch(err => {
  // eslint-disable-next-line no-console
  console.error('verify-rate-limit-coverage failed:', err);
  process.exit(1);
});
