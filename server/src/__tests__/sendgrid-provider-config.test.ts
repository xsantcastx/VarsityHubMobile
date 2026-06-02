import { SendGridProvider } from '../services/email/providers/SendGridProvider.js';

describe('SendGridProvider configuration guard', () => {
  it('treats placeholder API keys as unconfigured', () => {
    const provider = new SendGridProvider({
      apiKey: 'SG.your-sendgrid-api-key-here',
      defaultFrom: 'support@varsityhub.app',
    });

    expect(provider.isConfigured()).toBe(false);
    expect(provider.validateConfig().valid).toBe(false);
  });

  it('treats valid-looking keys with a valid sender as configured', () => {
    const provider = new SendGridProvider({
      apiKey: 'SG.abcdefghijklmnopqrstuvwxyz1234567890',
      defaultFrom: 'support@varsityhub.app',
    });

    expect(provider.isConfigured()).toBe(true);
  });
});
