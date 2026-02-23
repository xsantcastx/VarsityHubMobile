/**
 * Not Found Error
 * 
 * Thrown when a requested resource doesn't exist (404 Not Found)
 */

import { AppError, type ErrorMetadata } from './AppError.js';

export class NotFoundError extends AppError {
  constructor(
    message: string = 'Resource not found',
    options?: {
      errorCode?: string;
      metadata?: ErrorMetadata;
      resourceType?: string;
      resourceId?: string;
    }
  ) {
    const metadata: ErrorMetadata = {
      ...options?.metadata,
      ...(options?.resourceType && { resourceType: options.resourceType }),
      ...(options?.resourceId && { resourceId: options.resourceId }),
    };

    super(404, message, {
      errorCode: options?.errorCode || 'NOT_FOUND',
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  }
}
