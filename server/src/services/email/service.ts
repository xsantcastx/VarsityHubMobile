/**
 * Email Service Singleton
 *
 * Provides a configured instance of EmailService
 */

import { EmailService } from './EmailService.js';
import type { EmailServiceConfig } from './types.js';
import {
  CANONICAL_EMAIL_FROM,
  isCanonicalEmailFrom,
  resolveEmailFrom,
} from '../../lib/emailSender.js';

let emailServiceInstance: EmailService | null = null;

/**
 * Get or create the email service instance
 */
export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    const rawProvider = String(process.env.EMAIL_PROVIDER || 'sendgrid')
      .trim()
      .toLowerCase();
    const provider = rawProvider === 'test' ? 'test' : 'sendgrid';
    if (rawProvider && rawProvider !== provider) {
      console.warn(
        `[email] Unsupported EMAIL_PROVIDER=${rawProvider}; falling back to ${provider}`
      );
    }
    const defaultFrom = resolveEmailFrom();

    const config: EmailServiceConfig = {
      provider,
      defaultFrom,
      timeout: parseInt(process.env.EMAIL_TIMEOUT_MS || '10000', 10),
      retryAttempts: parseInt(process.env.EMAIL_RETRY_ATTEMPTS || '2', 10),
      retryDelay: parseInt(process.env.EMAIL_RETRY_DELAY_MS || '1000', 10),
      enableQueue: process.env.EMAIL_ENABLE_QUEUE === 'true',
      enableLogging: process.env.EMAIL_ENABLE_LOGGING !== 'false',
    };

    emailServiceInstance = new EmailService(config);
  }

  return emailServiceInstance;
}

/**
 * Initialize email service and validate configuration
 */
export function initEmailService(): { success: boolean; errors: string[] } {
  const service = getEmailService();
  const validation = service.validateConfig();

  if (validation.valid && service.isConfigured()) {
    const config = service['config'];
    console.log('✅ Email service initialized successfully');
    console.log(`   Provider: ${config.provider}`);
    console.log(`   Sender: ${config.defaultFrom}`);
    if (!isCanonicalEmailFrom(String(config.defaultFrom))) {
      console.warn(
        `⚠️ Email sender drift detected: expected ${CANONICAL_EMAIL_FROM}, got ${String(config.defaultFrom)}`
      );
    }
    console.log(`   Timeout: ${config.timeout}ms`);
    console.log(`   Retries: ${config.retryAttempts}`);
  } else {
    console.warn('⚠️ Email service configuration issues:');
    validation.errors.forEach(error => {
      console.warn(`   - ${error}`);
    });
    if (!service.isConfigured()) {
      console.warn('   Email service is not configured - emails will not be sent');
    }
  }

  return {
    success: validation.valid && service.isConfigured(),
    errors: validation.errors,
  };
}
