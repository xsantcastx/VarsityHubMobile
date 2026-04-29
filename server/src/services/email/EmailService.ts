/**
 * Centralized Email Service
 * 
 * Provides a unified interface for sending emails with:
 * - Provider abstraction
 * - Retry logic
 * - Structured logging
 * - Error handling
 * - Validation
 */

import type {
  EmailProvider,
  EmailOptions,
  BaseEmailOptions,
  TemplateEmailOptions,
  EmailResult,
  EmailServiceConfig,
} from './types.js';
import { EmailErrorCode } from './types.js';
import { SendGridProvider } from './providers/SendGridProvider.js';
import { captureException, captureMessage } from '../../lib/sentry.js';
import { resolveEmailFrom } from '../../lib/emailSender.js';
import {
  redactEmailList,
  sanitizeEmailLogMessage,
  sanitizeEmailSubject,
} from '../../lib/emailRedaction.js';
// debugLog import removed — info-level email logs now use console.log
// so they're visible in Railway production logs (not gated by ENABLE_SERVER_DEBUG_LOGS)

export class EmailService {
  private provider: EmailProvider;
  private config: EmailServiceConfig;
  private correlationIdCounter = 0;

  constructor(config: EmailServiceConfig) {
    this.config = {
      timeout: 10000,
      retryAttempts: 2,
      retryDelay: 1000,
      enableQueue: false,
      enableLogging: true,
      ...config,
    };

    // Initialize provider
    this.provider = this.createProvider();
  }

  private createProvider(): EmailProvider {
    switch (this.config.provider) {
      case 'sendgrid':
        const apiKey = process.env.SENDGRID_API_KEY || '';
        const defaultFrom = resolveEmailFrom();

        return new SendGridProvider({
          apiKey,
          defaultFrom,
          timeout: this.config.timeout,
        });

      case 'test':
        // Test provider for development/testing
        return new TestProvider();

      default:
        throw new Error(`Unsupported email provider: ${this.config.provider}`);
    }
  }

  /**
   * Validate email service configuration
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    return this.provider.validateConfig();
  }

  /**
   * Check if email service is configured
   */
  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  /**
   * Send an email (with retry logic)
   */
  async send(options: EmailOptions): Promise<EmailResult> {
    const correlationId = this.generateCorrelationId();
    const isTemplate = 'templateId' in options;

    // --- Non-production email redirect & audit log ---
    const isProduction = process.env.NODE_ENV === 'production';
    const overrideRecipient = process.env.EMAIL_OVERRIDE_TO; // e.g. support@varsityhub.app
    const originalRecipient = this.extractRecipient(options.to);
    const auditPrivacy = options.metadata?.audit_privacy;

    if (!isProduction && overrideRecipient) {
      // Redirect all emails to the override address in staging/test
      options = { ...options, to: overrideRecipient };
    }

    // Structured audit log for every outgoing email
    console.log(JSON.stringify({
      _tag: 'EMAIL_AUDIT',
      timestamp: new Date().toISOString(),
      originalRecipient: this.redactAuditRecipient(originalRecipient, auditPrivacy),
      actualRecipient: this.redactAuditRecipient(
        !isProduction && overrideRecipient ? overrideRecipient : originalRecipient,
        auditPrivacy
      ),
      subject: sanitizeEmailSubject(options.subject),
      redirected: !isProduction && !!overrideRecipient,
      environment: process.env.NODE_ENV || 'development',
    }));

    // Validate inputs
    const validation = this.validateEmailOptions(options);
    if (!validation.valid) {
      this.log('error', correlationId, 'Validation failed', { errors: validation.errors });
      return {
        success: false,
        error: validation.errors.join(', '),
        errorCode: EmailErrorCode.INVALID_RECIPIENT,
        provider: this.provider.name,
      };
    }

    // Attempt to send with retry
    let lastError: EmailResult | null = null;
    const maxAttempts = this.config.retryAttempts || 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.log(
          'info',
          correlationId,
          `Sending email (attempt ${attempt}/${maxAttempts})`,
          {
            to: this.redactAuditRecipient(
              this.extractRecipient(options.to),
              auditPrivacy
            ),
            subject: sanitizeEmailSubject(options.subject),
            isTemplate,
            attempt,
          }
        );

        const result = isTemplate
          ? await this.provider.sendTemplate(options as TemplateEmailOptions)
          : await this.provider.send(options as BaseEmailOptions);

        if (result.success) {
          this.log('info', correlationId, 'Email sent successfully', {
            messageId: result.messageId,
            attempt,
          });
          return { ...result, provider: this.provider.name };
        }

        lastError = result;

        // Check if error is retryable
        if (!this.isRetryableError(result.errorCode as EmailErrorCode | undefined)) {
          this.log('error', correlationId, 'Non-retryable error', {
            error: result.error,
            errorCode: result.errorCode,
          });
          // Centralized Sentry surface so every fire-and-forget sender (which
          // historically only console.warn'd on failure) gets observable
          // failures without per-call-site instrumentation. Provider already
          // logs the underlying API error; this just guarantees the alert
          // pipeline sees it.
          captureMessage(`Email send failed (non-retryable): ${result.error || 'unknown'}`, 'error', {
            context: 'email_send_non_retryable',
            provider: this.provider.name,
            errorCode: result.errorCode,
            correlationId,
            isTemplate,
          });
          return result;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxAttempts) {
          const delay = this.config.retryDelay! * Math.pow(2, attempt - 1);
          this.log('warn', correlationId, 'Retrying after delay', { delay, attempt });
          await this.sleep(delay);
        }
      } catch (error: any) {
        lastError = {
          success: false,
          error: error.message || 'Unknown error',
          errorCode: EmailErrorCode.PROVIDER_ERROR,
          provider: this.provider.name,
        };

        this.log('error', correlationId, 'Email send exception', {
          error: error.message,
          attempt,
        });

        // Surface to Sentry so the underlying exception (network blip, SendGrid
        // 5xx, malformed payload) doesn't sit in container stdout invisible.
        // Captured per attempt — if subsequent retries succeed, the success
        // log line shows in audit but the captured exception still exists for
        // forensics on flaky sends.
        captureException(error instanceof Error ? error : new Error(String(error)), {
          context: 'email_send_exception',
          provider: this.provider.name,
          correlationId,
          attempt,
          isTemplate,
        });

        // Don't retry on non-retryable errors
        if (!this.isRetryableError(lastError.errorCode as EmailErrorCode | undefined)) {
          break;
        }

        // Wait before retry
        if (attempt < maxAttempts) {
          const delay = this.config.retryDelay! * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    this.log('error', correlationId, 'Email send failed after all retries', {
      attempts: maxAttempts,
      lastError: lastError?.error,
    });

    return lastError || {
      success: false,
      error: 'Email send failed after all retries',
      errorCode: EmailErrorCode.PROVIDER_ERROR,
      provider: this.provider.name,
    };
  }

  /**
   * Validate email options
   */
  private validateEmailOptions(options: EmailOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate recipient
    if (!options.to) {
      errors.push('Recipient (to) is required');
    } else {
      const recipients = Array.isArray(options.to) ? options.to : [options.to];
      for (const recipient of recipients) {
        const email = typeof recipient === 'string' ? recipient : recipient.email;
        if (!this.isValidEmail(email)) {
          errors.push(`Invalid recipient email: ${email}`);
        }
      }
    }

    // Validate subject
    if (!options.subject || options.subject.trim().length === 0) {
      errors.push('Subject is required');
    }

    // Validate template email
    if ('templateId' in options) {
      if (!options.templateId || options.templateId.trim().length === 0) {
        errors.push('Template ID is required for template emails');
      }
      if (!options.templateData) {
        errors.push('Template data is required for template emails');
      }
    } else {
      // Validate non-template email has content
      if (!options.text && !options.html) {
        errors.push('Email must have either text or html content');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(errorCode?: EmailErrorCode): boolean {
    if (!errorCode) return false;

    const retryableCodes = [
      EmailErrorCode.NETWORK_ERROR,
      EmailErrorCode.TIMEOUT,
      EmailErrorCode.RATE_LIMIT_EXCEEDED,
      EmailErrorCode.PROVIDER_ERROR, // Some provider errors are retryable
    ];

    return retryableCodes.includes(errorCode);
  }

  /**
   * Extract recipient email for logging
   */
  private extractRecipient(
    recipient: string | { email: string; name?: string } | Array<string | { email: string; name?: string }>
  ): string | string[] {
    if (typeof recipient === 'string') {
      return recipient;
    }

    if (Array.isArray(recipient)) {
      return recipient.map((r) => (typeof r === 'string' ? r : r.email));
    }

    return recipient.email;
  }

  private redactAuditRecipient(
    recipient: string | string[],
    auditPrivacy?: string
  ): string | string[] {
    if (auditPrivacy !== 'minor') return redactEmailList(recipient);
    if (Array.isArray(recipient)) {
      return recipient.map(() => '[redacted-minor-email]');
    }
    return '[redacted-minor-email]';
  }

  /**
   * Generate correlation ID for tracking
   */
  private generateCorrelationId(): string {
    this.correlationIdCounter++;
    const timestamp = Date.now();
    return `email-${timestamp}-${this.correlationIdCounter}`;
  }

  /**
   * Structured logging
   */
  private log(level: 'info' | 'warn' | 'error', correlationId: string, message: string, data?: any): void {
    if (!this.config.enableLogging) return;

    const logData = {
      correlationId,
      service: 'email',
      provider: this.provider.name,
      ...this.sanitizeLogData(data),
    };

    switch (level) {
      case 'info':
        console.log(`[EmailService] ${sanitizeEmailLogMessage(message)}`, JSON.stringify(logData));
        break;
      case 'warn':
        console.warn(`[EmailService] ${sanitizeEmailLogMessage(message)}`, logData);
        break;
      case 'error':
        console.error(`[EmailService] ${sanitizeEmailLogMessage(message)}`, logData);
        break;
    }
  }

  private sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
    const sanitized = { ...data };
    if ('subject' in sanitized) sanitized.subject = sanitizeEmailSubject(sanitized.subject);
    if ('to' in sanitized) sanitized.to = redactEmailList(sanitized.to);
    if ('error' in sanitized && typeof sanitized.error === 'string') {
      sanitized.error = sanitizeEmailLogMessage(sanitized.error);
    }
    return sanitized;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

/**
 * Test provider for development/testing
 */
class TestProvider implements EmailProvider {
  name = 'test';

  isConfigured(): boolean {
    return true;
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    return { valid: true, errors: [] };
  }

  async send(options: BaseEmailOptions): Promise<EmailResult> {
    console.log('[TestProvider] Would send email:', {
      subject: options.subject,
    });
    return {
      success: true,
      messageId: `test-${Date.now()}`,
      provider: this.name,
    };
  }

  async sendTemplate(options: TemplateEmailOptions): Promise<EmailResult> {
    console.log('[TestProvider] Would send template email:', {
      templateId: options.templateId,
    });
    return {
      success: true,
      messageId: `test-${Date.now()}`,
      provider: this.name,
    };
  }
}
