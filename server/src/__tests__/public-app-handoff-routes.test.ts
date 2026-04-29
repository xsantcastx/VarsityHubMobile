import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const handoffRoute = readFileSync(
  join(process.cwd(), 'src', 'routes', 'publicAppHandoff.ts'),
  'utf8'
);
const appSrc = readFileSync(join(process.cwd(), 'src', 'app.ts'), 'utf8');
const testAppSrc = readFileSync(join(process.cwd(), 'src', 'testApp.ts'), 'utf8');

describe('Public app handoff routes', () => {
  it('pre-validates verification and reset links before rendering the handoff page', () => {
    expect(handoffRoute).toContain("publicAppHandoffRouter.get('/verify'");
    expect(handoffRoute).toContain("publicAppHandoffRouter.get('/reset-password'");
    expect(handoffRoute).toContain("kind: 'expired'");
    expect(handoffRoute).toContain("kind: 'already_verified'");
    expect(handoffRoute).toContain('Verification Link Expired');
    expect(handoffRoute).toContain('Verification Link Invalid');
    expect(handoffRoute).toContain('Email Already Verified');
    expect(handoffRoute).toContain('Reset Link Expired');
    expect(handoffRoute).toContain('Reset Link Invalid');
  });

  it('offers an in-browser resend recovery path for bad verification links', () => {
    expect(handoffRoute).toContain("publicAppHandoffRouter.post(");
    expect(handoffRoute).toContain("'/verify/resend'");
    expect(handoffRoute).toContain('Request a New Code');
    expect(handoffRoute).toContain('If an unverified account exists for');
    expect(handoffRoute).toContain('sendVerificationEmail(');
    expect(handoffRoute).toContain('publicVerifyResendLimiter');
  });

  it('only auto-redirects handoff pages on mobile user agents', () => {
    expect(handoffRoute).toContain('function isMobileUserAgent');
    expect(handoffRoute).toContain('/iphone|ipad|ipod|android|mobile/i');
    expect(handoffRoute).toContain('options.autoRedirect === true');
    expect(handoffRoute).toContain('{ autoRedirect }');
    expect(handoffRoute).toContain("{ autoRedirect: isMobileUserAgent(req) }");
  });

  it('mounts the shared handoff router in both production and test app entrypoints', () => {
    expect(appSrc).toContain("import { publicAppHandoffRouter } from './routes/publicAppHandoff.js';");
    expect(appSrc).toContain('app.use(publicAppHandoffRouter);');
    expect(testAppSrc).toContain(
      "import { publicAppHandoffRouter } from './routes/publicAppHandoff.js';"
    );
    expect(testAppSrc).toContain('app.use(publicAppHandoffRouter);');
  });
});
