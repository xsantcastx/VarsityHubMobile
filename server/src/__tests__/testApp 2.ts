/**
 * Test app factory for integration tests
 * Creates an Express app instance with proper setup and teardown
 */

import cors from 'cors';
import express, { Express } from 'express';
import helmet from 'helmet';

/**
 * Creates a minimal Express app for testing
 * Does NOT start server or initialize background workers
 */
export function createTestApp(): Express {
  const app = express();

  // Minimal middleware setup for testing
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: false }));
  app.use(express.json());

  // Routes would be imported dynamically in actual use
  // For now, provide minimal test structure

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', env: 'test' });
  });

  // Simple /me endpoint for token validation tests
  app.get('/me', (req, res) => {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    res.json(user);
  });

  return app;
}
