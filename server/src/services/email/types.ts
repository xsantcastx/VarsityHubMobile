/**
 * Email Service Types
 * 
 * Centralized type definitions for the email service
 */

export type EmailAddress = string;

export interface EmailRecipient {
  email: EmailAddress;
  name?: string;
}

export interface EmailAttachment {
  content: string;
  filename: string;
  type?: string;
  disposition?: 'attachment' | 'inline';
}

export interface BaseEmailOptions {
  to: EmailRecipient | EmailRecipient[] | EmailAddress | EmailAddress[];
  from?: EmailRecipient | EmailAddress;
  replyTo?: EmailRecipient | EmailAddress;
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  metadata?: Record<string, string>;
  tags?: string[];
}

export interface TemplateEmailOptions extends Omit<BaseEmailOptions, 'text' | 'html'> {
  templateId: string;
  templateData: Record<string, any>;
}

export type EmailOptions = BaseEmailOptions | TemplateEmailOptions;

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  provider?: string;
}

export interface EmailProvider {
  name: string;
  send(options: BaseEmailOptions): Promise<EmailResult>;
  sendTemplate(options: TemplateEmailOptions): Promise<EmailResult>;
  isConfigured(): boolean;
  validateConfig(): { valid: boolean; errors: string[] };
}

export enum EmailErrorCode {
  INVALID_RECIPIENT = 'INVALID_RECIPIENT',
  INVALID_SENDER = 'INVALID_SENDER',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  TIMEOUT = 'TIMEOUT',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
}

export interface EmailError extends Error {
  code: EmailErrorCode;
  retryable: boolean;
  provider?: string;
}

export interface EmailServiceConfig {
  provider: 'sendgrid' | 'smtp' | 'test';
  defaultFrom: EmailRecipient | EmailAddress;
  defaultReplyTo?: EmailRecipient | EmailAddress;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  enableQueue?: boolean;
  enableLogging?: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description?: string;
  requiredFields: string[];
  optionalFields?: string[];
}
