import { readFileSync } from 'fs';
import { join } from 'path';

const authRouteSource = readFileSync(join(process.cwd(), 'src/routes/auth.ts'), 'utf8');
const limiterSource = readFileSync(join(process.cwd(), 'src/middleware/rateLimiters.ts'), 'utf8');

describe('auth profile update limiter contract', () => {
  it('defines a dedicated profile-update limiter', () => {
    expect(limiterSource).toContain('export const profileUpdateLimiter = createLimiter({');
    expect(limiterSource).toContain("name: 'profile-update'");
    expect(limiterSource).toContain('profileUpdate: profileUpdateLimiter');
  });

  it('applies the limiter to both /auth/me profile update methods', () => {
    expect(authRouteSource).toContain('profileUpdateLimiter,');
    expect(authRouteSource).toMatch(/authRouter\.put\(\s*'\/me',\s*profileUpdateLimiter,/);
    expect(authRouteSource).toMatch(/authRouter\.patch\(\s*'\/me',\s*profileUpdateLimiter,/);
  });
});
