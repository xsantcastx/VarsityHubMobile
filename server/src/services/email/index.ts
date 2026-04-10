/**
 * Email Service Exports
 */

export { EmailService } from './EmailService.js';
export * from './templates/index.js';
export type {
  EmailOptions,
  BaseEmailOptions,
  TemplateEmailOptions,
  EmailResult,
  EmailServiceConfig,
  EmailProvider,
  EmailErrorCode,
  EmailRecipient,
  EmailAddress,
} from './types.js';
export { SendGridProvider } from './providers/SendGridProvider.js';
