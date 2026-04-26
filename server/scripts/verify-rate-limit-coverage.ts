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
  label: string;
  pattern: RegExp;
};

const checks: Check[] = [
  // Baseline coverage
  {
    file: 'src/middleware/rateLimiters.ts',
    pattern: /export const defaultApiLimiter = createLimiter\(\{/,
    label: 'default API limiter exported',
  },
  {
    file: 'src/app.ts',
    pattern: /parent\.use\(defaultApiLimiter\);/,
    label: 'default API limiter mounted',
  },

  // Auth — uses Redis-backed rate limiting (rlIncr + MAX_AUTH_ATTEMPTS)
  {
    file: 'src/routes/auth.ts',
    pattern: /checkAuthRateLimit/,
    label: 'auth rate limiter function',
  },
  {
    file: 'src/routes/auth.ts',
    pattern: /MAX_AUTH_ATTEMPTS/,
    label: 'auth max attempts config',
  },
  {
    file: 'src/routes/auth.ts',
    pattern: /'\/register',/,
    label: 'auth register endpoint',
  },
  {
    file: 'src/routes/auth.ts',
    pattern: /'\/login',/,
    label: 'auth login endpoint',
  },
  {
    file: 'src/routes/auth.ts',
    pattern: /'\/verify\/request',/,
    label: 'auth verify/request endpoint',
  },
  {
    file: 'src/routes/auth.ts',
    pattern: /'\/verify\/send',/,
    label: 'auth verify/send endpoint',
  },

  // Payments
  {
    file: 'src/routes/payments.ts',
    pattern:
      /paymentsRouter\.post\('\/checkout',\s*expressPkg\.json\(\),[\s\S]*?paymentLimiter[\s\S]*?asyncHandler/,
    label: 'payments checkout limiter',
  },
  {
    file: 'src/routes/payments.ts',
    pattern:
      /paymentsRouter\.post\('\/create-payment-sheet',\s*expressPkg\.json\(\),[\s\S]*?paymentLimiter[\s\S]*?asyncHandler/,
    label: 'payments payment-sheet limiter',
  },
  {
    file: 'src/routes/payments.ts',
    pattern:
      /paymentsRouter\.post\('\/finalize-session',\s*expressPkg\.json\(\),[\s\S]*?paymentLimiter[\s\S]*?asyncHandler/,
    label: 'payments finalize-session limiter',
  },
  {
    file: 'src/routes/payments.ts',
    pattern:
      /paymentsRouter\.post\('\/cancel-intent',\s*expressPkg\.json\(\),[\s\S]*?paymentLimiter[\s\S]*?asyncHandler/,
    label: 'payments cancel-intent limiter',
  },
  {
    file: 'src/routes/payments.ts',
    pattern:
      /paymentsRouter\.post\('\/subscribe',\s*expressPkg\.json\(\),[\s\S]*?paymentLimiter[\s\S]*?asyncHandler/,
    label: 'payments subscribe limiter',
  },
  {
    file: 'src/routes/payments.ts',
    pattern:
      /paymentsRouter\.post\('\/subscription\/cancel',\s*expressPkg\.json\(\),[\s\S]*?paymentLimiter[\s\S]*?asyncHandler/,
    label: 'payments subscription cancel limiter',
  },
  {
    file: 'src/routes/payments.ts',
    pattern:
      /paymentsRouter\.post\('\/update-subscription-quantity',\s*expressPkg\.json\(\),[\s\S]*?paymentLimiter[\s\S]*?asyncHandler/,
    label: 'payments quantity update limiter',
  },
  {
    file: 'src/routes/payments.ts',
    pattern:
      /paymentsRouter\.post\('\/apple\/verify-receipt',\s*expressPkg\.json\(\),[\s\S]*?paymentLimiter[\s\S]*?asyncHandler/,
    label: 'payments apple receipt limiter',
  },
  {
    file: 'src/routes/payments.ts',
    pattern:
      /paymentsRouter\.post\('\/apple\/verify-ad-receipt',\s*expressPkg\.json\(\),[\s\S]*?paymentLimiter[\s\S]*?asyncHandler/,
    label: 'payments apple ad receipt limiter',
  },
  {
    file: 'src/routes/payments.ts',
    pattern:
      /paymentsRouter\.post\('\/google\/verify-purchase',\s*expressPkg\.json\(\),[\s\S]*?paymentLimiter[\s\S]*?asyncHandler/,
    label: 'payments google purchase limiter',
  },

  // Uploads
  {
    file: 'src/routes/uploads.ts',
    pattern:
      /uploadsRouter\.get\('\/cloudinary-signature',[\s\S]*?uploadLimiter[\s\S]*?asyncHandler/,
    label: 'uploads cloudinary-signature limiter',
  },
  {
    file: 'src/routes/uploads.ts',
    pattern: /uploadsRouter\.get\('\/sign',[\s\S]*?uploadLimiter[\s\S]*?asyncHandler/,
    label: 'uploads sign limiter',
  },
  {
    file: 'src/routes/uploads.ts',
    pattern: /uploadsRouter\.post\('\/',[\s\S]*?uploadLimiter[\s\S]*?asyncHandler/,
    label: 'uploads media endpoint limiter',
  },
  {
    file: 'src/routes/uploads.ts',
    pattern: /uploadsRouter\.post\('\/files',[\s\S]*?uploadLimiter[\s\S]*?asyncHandler/,
    label: 'uploads files endpoint limiter',
  },
  {
    file: 'src/routes/uploads.ts',
    pattern: /uploadsRouter\.post\('\/avatar',[\s\S]*?uploadLimiter[\s\S]*?asyncHandler/,
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
      const ok = check.pattern.test(content);
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
