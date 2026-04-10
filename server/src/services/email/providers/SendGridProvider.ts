/**
 * SendGrid Email Provider
 *
 * Implements EmailProvider interface for SendGrid
 */

import sgMail, { MailDataRequired } from '@sendgrid/mail';
import type {
  EmailProvider,
  EmailResult,
  BaseEmailOptions,
  TemplateEmailOptions,
  EmailError,
} from '../types.js';
import { EmailErrorCode } from '../types.js';

export class SendGridProvider implements EmailProvider {
  name = 'sendgrid';
  private apiKey: string;
  private defaultFrom: string;
  private timeout: number;

  constructor(config: { apiKey: string; defaultFrom: string; timeout?: number }) {
    this.apiKey = config.apiKey;
    this.defaultFrom = config.defaultFrom;
    this.timeout = config.timeout || 10000; // 10 seconds default

    if (this.apiKey) {
      sgMail.setApiKey(this.apiKey);
    }
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.defaultFrom);
  }

  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.apiKey) {
      errors.push('SENDGRID_API_KEY is required');
    } else if (!this.apiKey.startsWith('SG.')) {
      errors.push('SENDGRID_API_KEY appears to be invalid (should start with SG.)');
    }

    if (!this.defaultFrom) {
      errors.push('EMAIL_FROM is required');
    } else if (!this.isValidEmail(this.defaultFrom)) {
      errors.push('EMAIL_FROM is not a valid email address');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async send(options: BaseEmailOptions): Promise<EmailResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'SendGrid is not configured',
        errorCode: EmailErrorCode.CONFIGURATION_ERROR,
        provider: this.name,
      };
    }

    try {
      const mailData = this.buildMailData(options);

      // Add timeout protection
      const sendPromise = sgMail.send(mailData);
      const timeoutPromise = new Promise<EmailResult>(resolve => {
        setTimeout(
          () =>
            resolve({
              success: false,
              error: 'SendGrid request timed out',
              errorCode: EmailErrorCode.TIMEOUT,
              provider: this.name,
            }),
          this.timeout
        );
      });

      const result = await Promise.race([sendPromise, timeoutPromise]);

      if ('success' in result) {
        return result; // Timeout result
      }

      // Extract message ID from SendGrid response
      const messageId = Array.isArray(result)
        ? result[0]?.headers?.['x-message-id'] || undefined
        : undefined;

      return {
        success: true,
        messageId,
        statusCode: Array.isArray(result) ? result[0]?.statusCode : undefined,
        provider: this.name,
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  async sendTemplate(options: TemplateEmailOptions): Promise<EmailResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'SendGrid is not configured',
        errorCode: EmailErrorCode.CONFIGURATION_ERROR,
        provider: this.name,
      };
    }

    if (!options.templateId) {
      return {
        success: false,
        error: 'Template ID is required',
        errorCode: EmailErrorCode.TEMPLATE_NOT_FOUND,
        provider: this.name,
      };
    }

    try {
      const mailData = this.buildMailData(options, {
        templateId: options.templateId,
        dynamicTemplateData: options.templateData,
      });

      // Add timeout protection
      const sendPromise = sgMail.send(mailData);
      const timeoutPromise = new Promise<EmailResult>(resolve => {
        setTimeout(
          () =>
            resolve({
              success: false,
              error: 'SendGrid request timed out',
              errorCode: EmailErrorCode.TIMEOUT,
              provider: this.name,
            }),
          this.timeout
        );
      });

      const result = await Promise.race([sendPromise, timeoutPromise]);

      if ('success' in result) {
        return result; // Timeout result
      }

      // Extract message ID from SendGrid response
      const messageId = Array.isArray(result)
        ? result[0]?.headers?.['x-message-id'] || undefined
        : undefined;

      return {
        success: true,
        messageId,
        statusCode: Array.isArray(result) ? result[0]?.statusCode : undefined,
        provider: this.name,
      };
    } catch (error: any) {
      return this.handleError(error);
    }
  }

  private buildMailData(
    options: BaseEmailOptions | TemplateEmailOptions,
    additionalData?: Partial<MailDataRequired>
  ): MailDataRequired {
    const to = this.normalizeRecipient(options.to);
    const from = options.from ? this.normalizeRecipient(options.from) : this.defaultFrom;

    const baseData: any = {
      to,
      from: from as string,
      subject: options.subject,
    };

    // Add text/html if not using template.
    // Use text/html shorthand only — do NOT also set a content array.
    // Setting both causes @sendgrid/mail to emit duplicate content entries
    // which SendGrid rejects, silently dropping the email.
    if (!('templateId' in options)) {
      if (options.text) {
        baseData.text = options.text;
      }
      if (options.html) {
        baseData.html = options.html;
      }
    }

    // Add reply-to if provided
    if (options.replyTo) {
      baseData.replyTo = this.normalizeRecipient(options.replyTo) as string;
    }

    // Add attachments if provided
    if (options.attachments && options.attachments.length > 0) {
      baseData.attachments = options.attachments.map(att => ({
        content: att.content,
        filename: att.filename,
        type: att.type,
        disposition: att.disposition || 'attachment',
      }));
    }

    // Add custom args (metadata)
    if (options.metadata) {
      baseData.customArgs = options.metadata;
    }

    // Add categories (tags)
    if (options.tags && options.tags.length > 0) {
      baseData.categories = options.tags;
    }

    return { ...baseData, ...additionalData } as MailDataRequired;
  }

  private normalizeRecipient(
    recipient:
      | string
      | { email: string; name?: string }
      | Array<string | { email: string; name?: string }>
  ): string | string[] {
    if (typeof recipient === 'string') {
      return recipient;
    }

    if (Array.isArray(recipient)) {
      return recipient.map(r => this.normalizeRecipient(r) as string);
    }

    if (recipient.name) {
      return `${recipient.name} <${recipient.email}>`;
    }

    return recipient.email;
  }

  private handleError(error: any): EmailResult {
    const errorCode = this.classifyError(error);

    // Log the full SendGrid response body so the specific rejection reason is visible in logs
    const sgErrors = error?.response?.body?.errors;
    console.error('[SendGridProvider] send failed', {
      statusCode: error?.code ?? error?.response?.statusCode,
      message: error?.message,
      sendgridErrors: sgErrors ?? null,
    });

    return {
      success: false,
      error: sgErrors ? JSON.stringify(sgErrors) : error.message || 'Unknown SendGrid error',
      errorCode,
      statusCode: error?.code ?? error?.response?.statusCode,
      provider: this.name,
    };
  }

  private classifyError(error: any): EmailErrorCode {
    if (error.code === 429) {
      return EmailErrorCode.RATE_LIMIT_EXCEEDED;
    }

    if (error.code === 408 || error.message?.includes('timeout')) {
      return EmailErrorCode.TIMEOUT;
    }

    if (error.response?.body?.errors) {
      const firstError = error.response.body.errors[0];
      if (firstError.field === 'to') {
        return EmailErrorCode.INVALID_RECIPIENT;
      }
      if (firstError.field === 'from') {
        return EmailErrorCode.INVALID_SENDER;
      }
    }

    if (error.code >= 500) {
      return EmailErrorCode.NETWORK_ERROR;
    }

    return EmailErrorCode.PROVIDER_ERROR;
  }

  private isRetryableError(error: any): boolean {
    // Retry on network errors, timeouts, and rate limits
    if (error.code === 429) return true; // Rate limit
    if (error.code === 408) return true; // Timeout
    if (error.code >= 500) return true; // Server errors
    if (error.message?.includes('timeout')) return true;
    if (error.message?.includes('ECONNRESET')) return true;
    if (error.message?.includes('ENOTFOUND')) return true;

    return false;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
