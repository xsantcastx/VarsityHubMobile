import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const overnightTasksSrc = readFileSync(
  join(process.cwd(), 'src', 'cron', 'overnightTasks.ts'),
  'utf8'
);
const emailLibSrc = readFileSync(join(process.cwd(), 'src', 'lib', 'email.ts'), 'utf8');
const indexSrc = readFileSync(join(process.cwd(), 'src', 'index.ts'), 'utf8');

describe('email infra regressions', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('does not enqueue removed ads.goes_live emails from the overnight ad lifecycle sweep', () => {
    expect(overnightTasksSrc).not.toMatch(/emailQueue\?\.add\('ads\.goes_live'/);
  });

  it('keeps SUBSCRIPTION_EXPIRING out of the startup-required template list', () => {
    const requiredStart = emailLibSrc.indexOf('export const REQUIRED_TEMPLATE_KEYS');
    const recommendedStart = emailLibSrc.indexOf('export const RECOMMENDED_TEMPLATE_KEYS');
    const requiredBlock = emailLibSrc.slice(requiredStart, recommendedStart);
    const recommendedBlock = emailLibSrc.slice(recommendedStart);

    expect(requiredBlock).not.toContain("'SUBSCRIPTION_EXPIRING'");
    expect(recommendedBlock).toContain("'SUBSCRIPTION_EXPIRING'");
    expect(indexSrc).not.toMatch(/SENDGRID_SUBSCRIPTION_EXPIRING_TEMPLATE_ID/);
  });

  it('normalizes unsupported EMAIL_PROVIDER values to sendgrid', async () => {
    process.env.EMAIL_PROVIDER = 'smtp';
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { getEmailService } = await import('../services/email/service.js');
    expect(() => getEmailService()).not.toThrow();
    expect((getEmailService() as any).config.provider).toBe('sendgrid');
    expect(warnSpy).toHaveBeenCalledWith(
      '[email] Unsupported EMAIL_PROVIDER=smtp; falling back to sendgrid'
    );
    warnSpy.mockRestore();
  });
});
