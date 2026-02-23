/**
 * Conflict Error
 * 
 * Thrown when a request conflicts with current state (409 Conflict)
 * e.g., duplicate email, resource already exists
 */

import { AppError, type ErrorMetadata } from './AppError.js';

export class ConflictError extends AppError {
  constructor(
    message: string,
    options?: {
      errorCode?: string;
      metadata?: ErrorMetadata;
    }
  ) {
    super(409, message, {
      errorCode: options?.errorCode || 'CONFLICT',
      metadata: options?.metadata,
    });
  }
}
