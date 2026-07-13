/**
 * Authorization Error
 *
 * Thrown when user lacks permission for an action (403 Forbidden)
 */

import { AppError, type ErrorMetadata } from './AppError.js';

export class AuthorizationError extends AppError {
  constructor(
    message: string = 'Insufficient permissions',
    options?: {
      errorCode?: string;
      metadata?: ErrorMetadata;
    }
  ) {
    super(403, message, {
      errorCode: options?.errorCode || 'INSUFFICIENT_PERMISSIONS',
      metadata: options?.metadata,
    });
  }
}
