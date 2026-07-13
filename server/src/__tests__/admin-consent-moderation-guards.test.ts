import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const adminSrc = readFileSync(join(process.cwd(), 'src', 'routes', 'admin.ts'), 'utf8');

describe('admin consent / moderation guards', () => {
  it('unban clears banned_until as well as banned flag', () => {
    const block =
      adminSrc.match(
        /adminRouter\.post\(\s*'\/users\/:id\/unban'[\s\S]*?updateUserAndInvalidate\(prisma,\s*\{[\s\S]*?\}\);/
      )?.[0] || '';
    expect(block).toMatch(/banned:\s*false/);
    expect(block).toMatch(/banned_until:\s*null/);
  });

  it('parental consent pending/approved overrides clear ban state and invalidate me cache', () => {
    const block =
      adminSrc.match(
        /adminRouter\.patch\(\s*'\/users\/:id\/parental-consent'[\s\S]{0,5000}/
      )?.[0] || '';
    expect(block).toMatch(/status === 'approved'[\s\S]*?updateData\.banned = false/);
    expect(block).toMatch(/banned_until = null|banned_until:\s*null/);
    expect(block).toMatch(/status === 'pending'[\s\S]*?updateData\.banned = false/);
    expect(block).toMatch(/invalidateMeCacheForUser\(userId\)/);
  });

  it('parental consent pending override reissues a fresh consent email when parent_email exists', () => {
    const block =
      adminSrc.match(
        /status === 'pending'[\s\S]{0,1800}sendParentalConsentRequestEmail\(\{/
      )?.[0] || '';
    expect(block).toMatch(/issueConsentToken\(userId\)/);
    expect(block).toMatch(/parent_email/);
    expect(block).toMatch(/sendParentalConsentRequestEmail\(\{/);
  });
});
