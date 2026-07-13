/**
 * Authentication Error
 *
 * Thrown when user authentication fails (401 Unauthorized)
 */

import { AppError, type ErrorMetadata } from './AppError.js';

export class AuthenticationError extends AppError {
  constructor(
    message: string = 'Authentication required',
    options?: {
      errorCode?: string;
      metadata?: ErrorMetadata;
    }
  ) {
    super(401, message, {
      errorCode: options?.errorCode || 'AUTHENTICATION_REQUIRED',
      metadata: options?.metadata,
    });
  }
}
