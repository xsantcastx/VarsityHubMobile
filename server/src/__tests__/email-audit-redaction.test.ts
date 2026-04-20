import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('EmailService audit logging', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalOverride = process.env.EMAIL_OVERRIDE_TO;

  beforeEach(() => {
    process.env.NODE_ENV = 'development';
    delete process.env.EMAIL_OVERRIDE_TO;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalOverride === undefined) {
      delete process.env.EMAIL_OVERRIDE_TO;
    } else {
      process.env.EMAIL_OVERRIDE_TO = originalOverride;
    }
    jest.restoreAllMocks();
  });

  it('redacts minor recipients in EMAIL_AUDIT logs', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { EmailService } = await import('../services/email/EmailService.js');
    logSpy.mockClear();

    const service = new EmailService({
      provider: 'test',
      defaultFrom: 'noreply@varsityhub.app',
      enableLogging: false,
    });

    const result = await service.send({
      to: 'parent@example.com',
      subject: 'Parental consent',
      templateId: 'd-test-parental-consent',
      templateData: {},
      metadata: { audit_privacy: 'minor' },
    });

    expect(result.success).toBe(true);

    const auditLine = [...logSpy.mock.calls]
      .reverse()
      .find((call) => typeof call[0] === 'string' && call[0].includes('"EMAIL_AUDIT"'))
      ?.[0] as string | undefined;

    expect(auditLine).toBeDefined();
    const payload = JSON.parse(auditLine!);
    expect(payload.originalRecipient).toBe('[redacted-minor-email]');
    expect(payload.actualRecipient).toBe('[redacted-minor-email]');
  });

  it('keeps non-minor recipients visible in EMAIL_AUDIT logs', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { EmailService } = await import('../services/email/EmailService.js');
    logSpy.mockClear();

    const service = new EmailService({
      provider: 'test',
      defaultFrom: 'noreply@varsityhub.app',
      enableLogging: false,
    });

    const result = await service.send({
      to: 'coach@example.com',
      subject: 'Team invite',
      templateId: 'd-test-team-invite',
      templateData: {},
    });

    expect(result.success).toBe(true);

    const auditLine = [...logSpy.mock.calls]
      .reverse()
      .find((call) => typeof call[0] === 'string' && call[0].includes('"EMAIL_AUDIT"'))
      ?.[0] as string | undefined;

    expect(auditLine).toBeDefined();
    const payload = JSON.parse(auditLine!);
    expect(payload.originalRecipient).toBe('coach@example.com');
    expect(payload.actualRecipient).toBe('coach@example.com');
  });

  it('redacts every element of a minor recipient array', async () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { EmailService } = await import('../services/email/EmailService.js');
    logSpy.mockClear();

    const service = new EmailService({
      provider: 'test',
      defaultFrom: 'noreply@varsityhub.app',
      enableLogging: false,
    });

    await service.send({
      to: ['kid1@example.com', 'kid2@example.com'],
      subject: 'Group notice',
      templateId: 'd-test',
      templateData: {},
      metadata: { audit_privacy: 'minor' },
    });

    const auditLine = [...logSpy.mock.calls]
      .reverse()
      .find((call) => typeof call[0] === 'string' && call[0].includes('"EMAIL_AUDIT"'))
      ?.[0] as string | undefined;

    expect(auditLine).toBeDefined();
    const payload = JSON.parse(auditLine!);
    expect(payload.originalRecipient).toEqual([
      '[redacted-minor-email]',
      '[redacted-minor-email]',
    ]);

    // Belt-and-braces: the raw minor addresses must never appear in ANY log
    // line this send produced (EMAIL_AUDIT, info-level attempt log, etc.).
    const allOutput = JSON.stringify(logSpy.mock.calls);
    expect(allOutput).not.toContain('kid1@example.com');
    expect(allOutput).not.toContain('kid2@example.com');
  });

  it('also redacts the info-level attempt log for minor recipients', async () => {
    // enableLogging:true turns on the attempt log; both sinks must honor
    // audit_privacy. The EMAIL_AUDIT check above covers stdout JSON; this
    // catches the [EmailService] attempt line.
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const { EmailService } = await import('../services/email/EmailService.js');
    logSpy.mockClear();

    const service = new EmailService({
      provider: 'test',
      defaultFrom: 'noreply@varsityhub.app',
      enableLogging: true,
    });

    await service.send({
      to: 'minor-kid@example.com',
      subject: 'Welcome',
      templateId: 'd-test',
      templateData: {},
      metadata: { audit_privacy: 'minor' },
    });

    const allOutput = JSON.stringify(logSpy.mock.calls);
    expect(allOutput).not.toContain('minor-kid@example.com');
    expect(allOutput).toContain('[redacted-minor-email]');
  });
});

describe('redactEmail / redactEmailList helper', () => {
  const originalUnredacted = process.env.EMAIL_LOG_UNREDACTED;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalUnredacted === undefined) delete process.env.EMAIL_LOG_UNREDACTED;
    else process.env.EMAIL_LOG_UNREDACTED = originalUnredacted;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('masks local-part while keeping domain', async () => {
    const { redactEmail } = await import('../lib/emailRedaction.js');
    expect(redactEmail('alice@gmail.com')).toBe('a***@gmail.com');
    expect(redactEmail('bob.smith@example.co.uk')).toBe('b***@example.co.uk');
  });

  it('returns [redacted] for invalid / missing inputs', async () => {
    const { redactEmail } = await import('../lib/emailRedaction.js');
    expect(redactEmail('')).toBe('[redacted]');
    expect(redactEmail(null)).toBe('[redacted]');
    expect(redactEmail(undefined)).toBe('[redacted]');
    expect(redactEmail('no-at-sign')).toBe('[redacted]');
    expect(redactEmail('@nolocal.com')).toBe('[redacted]');
    expect(redactEmail('trailing@')).toBe('[redacted]');
    expect(redactEmail('no-tld@example')).toBe('[redacted]');
  });

  it('handles arrays via redactEmailList', async () => {
    const { redactEmailList } = await import('../lib/emailRedaction.js');
    expect(redactEmailList(['a@b.com', 'c@d.org'])).toEqual([
      'a***@b.com',
      'c***@d.org',
    ]);
    expect(redactEmailList('single@x.com')).toBe('s***@x.com');
  });

  it('ignores EMAIL_LOG_UNREDACTED in production (fail-closed)', async () => {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_LOG_UNREDACTED = '1';
    const { redactEmail } = await import('../lib/emailRedaction.js');
    expect(redactEmail('alice@gmail.com')).toBe('a***@gmail.com');
  });

  it('respects EMAIL_LOG_UNREDACTED in development', async () => {
    process.env.NODE_ENV = 'development';
    process.env.EMAIL_LOG_UNREDACTED = '1';
    const { redactEmail } = await import('../lib/emailRedaction.js');
    expect(redactEmail('alice@gmail.com')).toBe('alice@gmail.com');
  });
});
